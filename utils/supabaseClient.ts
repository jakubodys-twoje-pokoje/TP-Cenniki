

import { createClient } from '@supabase/supabase-js';

// WYPEŁNIJ TE DANE SWOIMI KLUCZAMI Z SUPABASE (Settings -> API)
const SUPABASE_URL = 'https://stdepyblwccelpbrqjux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';

// Tworzymy klienta
// Jeśli nie podasz kluczy, aplikacja będzie działać w trybie "tylko odczyt" lub wyrzuci błąd przy zapisie.
// Added explicit Accept header to prevent 406 errors in some environments
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      'Accept': 'application/json'
    }
  }
});
