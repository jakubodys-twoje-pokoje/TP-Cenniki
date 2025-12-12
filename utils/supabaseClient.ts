

import { createClient } from '@supabase/supabase-js';

// WYPEŁNIJ TE DANE SWOIMI KLUCZAMI Z SUPABASE (Settings -> API)
const SUPABASE_URL = 'https://stdepyblwccelpbrqjux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';

// Custom fetch wrapper to ensure correct headers are always sent.
// This fixes the 406 Not Acceptable error while ensuring Auth headers (401 fix) are present.
const customFetch = (url: any, options: any = {}) => {
  const headers = new Headers(options.headers);

  // 1. Force Accept header to application/json (Fixes 406 Not Acceptable)
  // We overwrite it to ensure browsers don't send default text/html or */* preferences
  headers.set('Accept', 'application/json');

  // 2. Fix 401 Unauthorized (Ensure API Key is present)
  // Sometimes the Supabase client might not inject it into options.headers in time 
  // when using a custom global fetch. We force it here.
  if (!headers.has('apikey')) {
    headers.set('apikey', SUPABASE_ANON_KEY);
  }

  // 3. Ensure Content-Type for non-GET requests
  if (!headers.has('Content-Type') && options.method !== 'GET' && options.method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers: headers
  });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: customFetch
  }
});
