import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  category: z.enum(['vip', 'visiteur', 'exposant']),
  organization: z.string().trim().max(160).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  amount: z.number().nonnegative().max(10_000_000),
  currency: z.string().trim().min(2).max(8).default('XAF'),
  payment_method: z.string().trim().max(40).optional().or(z.literal('')),
});

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  // base64url
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SIGNING_SECRET = Deno.env.get('QR_SIGNING_SECRET')!;
    if (!SIGNING_SECRET) throw new Error('QR_SIGNING_SECRET missing');

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const { data: roleRow } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'invalid_input', details: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const p = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. participant
    const { data: part, error: partErr } = await admin
      .from('participants')
      .insert({
        full_name: p.full_name,
        email: p.email || null,
        phone: p.phone || null,
        category: p.category,
        organization: p.organization || null,
        notes: p.notes || null,
        created_by: userData.user.id,
      })
      .select()
      .single();
    if (partErr) throw partErr;

    // 2. invitation (signature based on uuid_secret)
    const uuidSecret = crypto.randomUUID();
    const signature = await hmacSign(uuidSecret, SIGNING_SECRET);

    const { data: inv, error: invErr } = await admin
      .from('invitations')
      .insert({
        participant_id: part.id,
        uuid_secret: uuidSecret,
        signature,
        created_by: userData.user.id,
      })
      .select()
      .single();
    if (invErr) throw invErr;

    // 3. transaction (only if amount > 0)
    if (p.amount > 0) {
      const { error: txErr } = await admin.from('transactions').insert({
        invitation_id: inv.id,
        amount: p.amount,
        currency: p.currency || 'XAF',
        payment_method: p.payment_method || null,
        created_by: userData.user.id,
      });
      if (txErr) throw txErr;
    }

    return new Response(
      JSON.stringify({
        participant: part,
        invitation: inv,
        qr_payload: `${uuidSecret}.${signature}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('create-invitation error', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
