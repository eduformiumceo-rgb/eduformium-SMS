// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Worker entry point
//
//  Handles ONE route:  GET /config.js
//    → Returns Supabase project URLs + anon keys from env vars.
//      Keys never appear in source code or git history.
//
//  Everything else:
//    → Passed straight through to the static site assets.
//
//  SETUP — after deploying, go to:
//  Cloudflare Dashboard → Workers & Pages → eduformium
//  → Settings → Variables and Secrets → Add variable:
//
//    DEV_SUPABASE_URL       https://<your-dev-project>.supabase.co
//    DEV_SUPABASE_ANON_KEY  <your dev anon key>
//    PROD_SUPABASE_URL      https://<your-prod-project>.supabase.co
//    PROD_SUPABASE_ANON_KEY <your prod anon key>
//
//  Mark all four as "Secret" so they are encrypted at rest.
// ══════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve runtime config — keys come from env vars, never source code
    if (url.pathname === '/config.js') {
      const config = {
        dev:  { url: env.DEV_SUPABASE_URL  || '', anonKey: env.DEV_SUPABASE_ANON_KEY  || '' },
        prod: { url: env.PROD_SUPABASE_URL || '', anonKey: env.PROD_SUPABASE_ANON_KEY || '' },
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

    // Everything else → static assets (your HTML, CSS, JS files)
    return env.ASSETS.fetch(request);
  },
};
