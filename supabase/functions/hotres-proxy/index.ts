// Supabase Edge Function - Hotres API Proxy
// Handles CORS by proxying requests to panel.hotres.pl

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const HOTRES_BASE_URL = "https://panel.hotres.pl";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const endpoint = new URL(req.url).searchParams.get('endpoint') || '(none)';

  try {
    const url = new URL(req.url);

    // Read body BEFORE any other async operations
    const body = req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.text()
      : undefined;

    // Extract target endpoint and query params from request
    const targetEndpoint = url.searchParams.get('endpoint') || '';
    const targetUrl = `${HOTRES_BASE_URL}${targetEndpoint}`;

    // Remove 'endpoint' param and forward the rest to Hotres
    url.searchParams.delete('endpoint');
    const queryString = url.search.substring(1); // Remove leading '?'
    const finalUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    console.log(`[proxy] ${req.method} ${targetEndpoint} | body: ${body?.length ?? 0} bytes`);

    // Forward the request to Hotres
    const hotresResponse = await fetch(finalUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers.get('Content-Type') || 'application/json',
      },
      body,
    });

    // Get response data
    const data = await hotresResponse.text();

    console.log(`[proxy] Hotres ${hotresResponse.status} | body: ${data.substring(0, 500)}`);

    // Return with CORS headers, forwarding Hotres' actual status
    return new Response(data, {
      status: hotresResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[proxy] Error for ${endpoint}: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      }
    );
  }
});
