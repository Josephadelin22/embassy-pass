import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    let onlyActive = true;
    try {
      const body = await req.json();
      if (typeof body?.only_active === 'boolean') onlyActive = body.only_active;
    } catch { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = admin.from('invitations').select('id, status, uuid_secret, signature');
    if (onlyActive) q = q.eq('status', 'actif');
    const { data: invs, error: listErr } = await q;
    if (listErr) throw listErr;

    const batchId = crypto.randomUUID();
    const regeneratedAt = new Date().toISOString();
    let updated = 0;
    const errors: string[] = [];

    for (const inv of invs ?? []) {
      const newSecret = crypto.randomUUID();
      const newSig = await hmacSign(newSecret, SIGNING_SECRET);
      const { error: histErr } = await admin.from('qr_signature_history').insert({
        invitation_id: inv.id,
        old_uuid_secret: inv.uuid_secret,
        old_signature: inv.signature,
        regeneration_batch_id: batchId,
        admin_id: userData.user.id,
        regenerated_at: regeneratedAt,
      });
      if (histErr) {
        errors.push(`${inv.id}: history ${histErr.message}`);
        continue;
      }
      const { error: upErr } = await admin
        .from('invitations')
        .update({ uuid_secret: newSecret, signature: newSig, generated_at: regeneratedAt })
        .eq('id', inv.id);
      if (upErr) errors.push(`${inv.id}: ${upErr.message}`);
      else updated++;
    }

    return new Response(
      JSON.stringify({ total: invs?.length ?? 0, updated, errors, batch_id: batchId, regenerated_at: regeneratedAt }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('regenerate-qrs error', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
