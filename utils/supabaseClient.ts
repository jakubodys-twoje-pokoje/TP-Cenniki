

import { createClient } from '@supabase/supabase-js';

// WYPEŁNIJ TE DANE SWOIMI KLUCZAMI Z SUPABASE (Settings -> API)
const SUPABASE_URL = 'https://stdepyblwccelpbrqjux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';

// Custom fetch wrapper to ensure correct headers are always sent
// This fixes the 406 Not Acceptable error from PostgREST while preserving Auth headers
const customFetch = (url: any, options: any = {}) => {
  // Create a robust Headers object from existing options
  // This handles plain objects, arrays, and existing Headers instances correctly
  const headers = new Headers(options.headers);

  // Force Accept header to fix 406 Not Acceptable errors
  headers.set('Accept', 'application/json');
  
  // Ensure Content-Type is set (though usually Supabase handles this)
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
