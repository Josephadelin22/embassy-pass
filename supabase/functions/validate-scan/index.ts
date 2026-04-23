import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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
    if (userErr || !userData.user) return json(401, { status: 'error', reason: 'unauthorized' });

    // Must be agent or admin
    const { data: roles } = await userClient
      .from('user_roles').select('role').eq('user_id', userData.user.id);
    const allowed = (roles ?? []).some((r) => r.role === 'agent' || r.role === 'admin');
    if (!allowed) return json(403, { status: 'error', reason: 'forbidden' });

    const body = await req.json().catch(() => ({}));
    const payload: string = (body?.payload ?? '').toString().trim();
    const device_info: string | null = body?.device_info ?? null;

    if (!payload || !payload.includes('.')) {
      return json(200, { status: 'invalid', reason: 'payload_format' });
    }
    const [uuid, signature] = payload.split('.');
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(uuid) || !signature) {
      return json(200, { status: 'invalid', reason: 'payload_format' });
    }

    const expected = await hmacSign(uuid, SIGNING_SECRET);
    if (!timingSafeEqual(expected, signature)) {
      return json(200, { status: 'invalid', reason: 'bad_signature' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find invitation
    const { data: inv, error: invErr } = await admin
      .from('invitations')
      .select('id, status, used_at, participant_id')
      .eq('uuid_secret', uuid)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inv) return json(200, { status: 'invalid', reason: 'not_found' });

    // Participant info
    const { data: participant } = await admin
      .from('participants')
      .select('full_name, category, organization')
      .eq('id', inv.participant_id)
      .maybeSingle();

    // Existing check-ins
    const { data: existing } = await admin
      .from('check_ins')
      .select('scanned_at')
      .eq('invitation_id', inv.id)
      .order('scanned_at', { ascending: true });

    const firstScan = existing?.[0]?.scanned_at ?? null;

    if (inv.status === 'revoque') {
      return json(200, { status: 'revoked', participant, first_scan_at: firstScan });
    }

    // Always log the scan attempt
    await admin.from('check_ins').insert({
      invitation_id: inv.id,
      agent_id: userData.user.id,
      device_info,
    });

    if (firstScan || inv.status === 'utilise' || inv.used_at) {
      return json(200, {
        status: 'duplicate',
        participant,
        first_scan_at: firstScan ?? inv.used_at,
      });
    }

    // Mark as used
    await admin
      .from('invitations')
      .update({ status: 'utilise', used_at: new Date().toISOString() })
      .eq('id', inv.id);

    return json(200, { status: 'valid', participant, first_scan_at: null });
  } catch (e) {
    console.error('validate-scan error', e);
    const msg = e instanceof Error ? e.message : 'unknown';
    return json(500, { status: 'error', reason: msg });
  }
});
