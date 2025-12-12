

import { createClient } from '@supabase/supabase-js';

// WYPEŁNIJ TE DANE SWOIMI KLUCZAMI Z SUPABASE (Settings -> API)
const SUPABASE_URL = 'https://stdepyblwccelpbrqjux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';

// Custom fetch wrapper to ensure correct headers are always sent
// This fixes the 406 Not Acceptable error from PostgREST
const customFetch = (url: any, options: any = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: customFetch
  }
});
