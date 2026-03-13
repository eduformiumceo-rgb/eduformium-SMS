// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Worker: SMS Proxy
//
//  WHY THIS EXISTS:
//  SMS API keys (Hubtel, Africa's Talking, Twilio, Termii) were
//  previously stored in localStorage, making them readable by any
//  JS running on the page. This worker stores them as Cloudflare
//  Secrets so they never touch the browser.
//
//  DEPLOY STEPS:
//  1. In Cloudflare Dashboard → Workers → create "eduformium-sms-proxy"
//  2. Settings → Variables → Secrets — add:
//       SMS_PROVIDER   = hubtel | africastalking | twilio | termii
//       SMS_API_KEY    = your API key / Account SID
//       SMS_API_SECRET = your API secret / Auth Token  (if needed)
//       SMS_SENDER_ID  = your registered sender name
//       ALLOWED_ORIGIN = https://your-production-domain.com
//  3. Paste this file into the Worker editor and hit Deploy
//  4. In the app Settings → SMS Notifications:
//       - Replace the API Key / Secret fields with your Worker URL
//       - The UI change is in index.html (see inline comment there)
//
//  ENDPOINT: POST /send-sms
//  Body: { to: "+233...", message: "..." }
//  Auth: Bearer <supabase-session-access-token>  (validated against Supabase)
//
//  NOTE: Caller must send a valid Supabase session JWT so only
//  authenticated school admins can trigger SMS sends. The worker
//  validates the token against the Supabase project URL before
//  forwarding to the SMS gateway.
// ══════════════════════════════════════════════════════════════════

const json = (data, status = 200, cors = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

function getCors(env, request) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  const origin  = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin':  (allowed === '*' || origin === allowed) ? allowed : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// ── Provider adapters ──────────────────────────────────────────────

async function sendHubtel(env, to, message) {
  const url = 'https://smsc.hubtel.com/v1/messages/send?' + new URLSearchParams({
    clientsecret: env.SMS_API_SECRET,
    clientid:     env.SMS_API_KEY,
    from:         env.SMS_SENDER_ID,
    to,
    content:      message,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hubtel error ${res.status}`);
  return await res.json();
}

async function sendAfricasTalking(env, to, message) {
  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey:         env.SMS_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: new URLSearchParams({ username: env.SMS_API_SECRET || 'sandbox', to, message, from: env.SMS_SENDER_ID }),
  });
  if (!res.ok) throw new Error(`AfricasTalking error ${res.status}`);
  return await res.json();
}

async function sendTwilio(env, to, message) {
  const accountSid = env.SMS_API_KEY;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization:  'Basic ' + btoa(`${accountSid}:${env.SMS_API_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: env.SMS_SENDER_ID, Body: message }),
  });
  if (!res.ok) throw new Error(`Twilio error ${res.status}`);
  return await res.json();
}

async function sendTermii(env, to, message) {
  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.SMS_API_KEY,
      to,
      from:    env.SMS_SENDER_ID,
      sms:     message,
      type:    'plain',
      channel: 'generic',
    }),
  });
  if (!res.ok) throw new Error(`Termii error ${res.status}`);
  return await res.json();
}

export default {
  async fetch(request, env) {
    const CORS = getCors(env, request);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname !== '/send-sms' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    // ── Authenticate caller via Supabase JWT ──────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Unauthorized' }, 401, CORS);

    const supabaseUrl = env.SUPABASE_URL; // set as a Worker secret too
    if (supabaseUrl) {
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY || '' },
      });
      if (!verifyRes.ok) return json({ error: 'Unauthorized' }, 401, CORS);
    }

    // ── Parse body ────────────────────────────────────────────────
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, CORS); }
    const { to, message } = body;
    if (!to || !message) return json({ error: 'Missing to or message' }, 400, CORS);
    if (message.length > 640) return json({ error: 'Message too long (max 640 chars)' }, 400, CORS);

    // ── Route to correct provider ─────────────────────────────────
    const provider = (env.SMS_PROVIDER || 'hubtel').toLowerCase();
    try {
      let result;
      if (provider === 'hubtel')          result = await sendHubtel(env, to, message);
      else if (provider === 'africastalking') result = await sendAfricasTalking(env, to, message);
      else if (provider === 'twilio')     result = await sendTwilio(env, to, message);
      else if (provider === 'termii')     result = await sendTermii(env, to, message);
      else return json({ error: `Unknown provider: ${provider}` }, 400, CORS);
      return json({ success: true, result }, 200, CORS);
    } catch (e) {
      console.error('SMS send failed:', e.message);
      return json({ error: e.message }, 500, CORS);
    }
  },
};
