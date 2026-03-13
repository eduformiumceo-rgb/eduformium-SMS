// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Pages Function: /config.js
//
//  Serves Supabase project URLs + anon keys from environment
//  variables so they are NEVER stored in source code or git history.
//
//  SETUP (Cloudflare Pages Dashboard):
//    Settings → Environment variables → Add variable:
//      DEV_SUPABASE_URL        = https://<your-dev-project>.supabase.co
//      DEV_SUPABASE_ANON_KEY   = sb_publishable_...
//      PROD_SUPABASE_URL       = https://<your-prod-project>.supabase.co
//      PROD_SUPABASE_ANON_KEY  = sb_publishable_...
//
//  The returned JS sets window.APP_CONFIG, which supabase.js reads
//  before creating the Supabase client. The response is marked
//  no-store so it is never cached by the browser or service worker.
// ══════════════════════════════════════════════════════════════════

export async function onRequest(context) {
  const { env } = context;

  const config = {
    dev: {
      url:     env.DEV_SUPABASE_URL       || '',
      anonKey: env.DEV_SUPABASE_ANON_KEY  || '',
    },
    prod: {
      url:     env.PROD_SUPABASE_URL      || '',
      anonKey: env.PROD_SUPABASE_ANON_KEY || '',
    },
  };

  return new Response(
    `window.APP_CONFIG = ${JSON.stringify(config)};`,
    {
      headers: {
        'Content-Type':  'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
