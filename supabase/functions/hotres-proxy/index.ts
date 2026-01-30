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

  try {
    const url = new URL(req.url);

    // Extract target endpoint and query params from request
    const endpoint = url.searchParams.get('endpoint') || '';
    const targetUrl = `${HOTRES_BASE_URL}${endpoint}`;

    // Remove 'endpoint' param and forward the rest to Hotres
    url.searchParams.delete('endpoint');
    const queryString = url.search.substring(1); // Remove leading '?'
    const finalUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    console.log('Proxying request to:', finalUrl);

    // Forward the request to Hotres
    const hotresResponse = await fetch(finalUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers.get('Content-Type') || 'application/json',
      },
      body: req.method !== 'GET' ? await req.text() : undefined,
    });

    // Get response data
    const data = await hotresResponse.text();

    console.log('Hotres response status:', hotresResponse.status);

    // Return with CORS headers
    return new Response(data, {
      status: hotresResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
