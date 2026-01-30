# Hotres API Proxy - Instrukcja Wdrożenia

## Problem
Publiczne CORS proxy nie obsługują POST requestów, więc upload cenników do Hotres nie działa.

## Rozwiązanie
Stworzyliśmy Supabase Edge Function, która działa jako proxy między aplikacją a Hotres API.

## Kroki Wdrożenia

### 1. Zainstaluj Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop install supabase

# Lub przez NPM
npm install -g supabase
```

### 2. Zaloguj się do Supabase

```bash
supabase login
```

### 3. Połącz się z projektem

```bash
# W katalogu projektu TP-Cenniki
supabase link --project-ref stdepyblwccelpbrqjux
```

**Uwaga:** `stdepyblwccelpbrqjux` to ID Twojego projektu Supabase (z URL: https://stdepyblwccelpbrqjux.supabase.co)

### 4. Wdróż Edge Function

```bash
# Wdróż Edge Function (autoryzacja jest obsługiwana automatycznie)
supabase functions deploy hotres-proxy --no-verify-jwt
```

**Uwaga:** Flaga `--no-verify-jwt` jest wymagana, aby Edge Function była dostępna publicznie (nie wymaga tokenu użytkownika).

### 5. Sprawdź czy działa

Po wdrożeniu, spróbuj:
- **Import pokoi** z Hotres (dodaj nowy obiekt → Import z Hotres)
- **Upload cennika** do systemu

W konsoli przeglądarki powinieneś zobaczyć:
```
[Hotres] Using Supabase Edge Function: https://stdepyblwccelpbrqjux.supabase.co/functions/v1/hotres-proxy?...
```

## Troubleshooting

### Błąd: "Function not found"
- Upewnij się, że Edge Function została poprawnie wdrożona: `supabase functions list`
- Sprawdź logi: `supabase functions logs hotres-proxy`

### Błąd CORS nadal występuje
- Sprawdź czy `USE_SUPABASE_PROXY = true` w `utils/hotresApi.ts`
- Zweryfikuj URL projektu: `SUPABASE_PROJECT_URL` powinien być `https://stdepyblwccelpbrqjux.supabase.co`

### Błąd 401 Unauthorized
- Edge Function jest publiczna i nie wymaga autoryzacji
- Jeśli problem występuje, sprawdź ustawienia funkcji w Dashboard Supabase

## Co robi Edge Function?

Prosty proxy który:
1. Przyjmuje requesty z aplikacji
2. Przekazuje je do `panel.hotres.pl`
3. Zwraca odpowiedź z odpowiednimi headerami CORS

Dzięki temu wszystkie wywołania API (GET i POST) działają bez problemów z CORS.

## Alternatywa: Wyłączenie Supabase Proxy

Jeśli nie chcesz używać Edge Function, możesz wrócić do publicznych proxy (tylko GET będzie działać):

W `utils/hotresApi.ts` zmień:
```typescript
const USE_SUPABASE_PROXY = false;
```

**Uwaga:** Upload cenników nie będzie działać bez własnego proxy!
