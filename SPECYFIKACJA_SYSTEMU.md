# Specyfikacja Systemu TP-Cenniki

## 1. Przegląd Projektu

**Nazwa:** TP-Cenniki (Twoje Pokoje - System Zarządzania Cennikami)

**Cel:** System do dynamicznego zarządzania cenami pokoi w obiektach noclegowych, z automatycznymi obliczeniami opartymi na sezonach, obłożeniu, kanałach sprzedaży i integracji z PMS Hotres.

**Typ aplikacji:** Single Page Application (SPA) z autoryzacją użytkowników i bazą danych w chmurze.

**Grupa docelowa:**
- Właściciele obiektów noclegowych (hotele, pensjonaty, apartamenty)
- Menedżerowie zarządzający wieloma obiektami
- Klienci przeglądający cenniki (widok publiczny)

---

## 2. Stack Technologiczny

### Frontend
- **Framework:** React 18 z TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS (via CDN dla prostoty)
- **Ikony:** Lucide React
- **Wykresy:** Recharts (do wizualizacji obłożenia)
- **Router:** React Router DOM (opcjonalnie, głównie single-page z conditionalami)

### Backend/Infrastruktura
- **BaaS:** Supabase
  - **Auth:** Email/Password authentication
  - **Database:** PostgreSQL (tabele: users, properties, profiles)
  - **Edge Functions:** CORS proxy dla Hotres API
- **API zewnętrzne:** Hotres PMS (panel.hotres.pl)

### Hosting
- Frontend: Dowolny static hosting (Vercel, Netlify, GitHub Pages)
- Backend: Supabase (managed)

---

## 3. Role Użytkowników i Uprawnienia

### 3.1 Admin
- Pełny dostęp do wszystkich funkcji
- Zarządzanie użytkownikami (dodawanie, edycja, usuwanie)
- Zarządzanie wieloma obiektami
- Tworzenie i przypisywanie obiektów do klientów
- Edycja wszystkich danych (pokoje, sezony, kanały, ustawienia)
- Import z Hotres
- Upload cenników do Hotres

### 3.2 Client (Klient)
- Dostęp tylko do przypisanych obiektów
- Przeglądanie i edycja danych obiektów (pokoje, sezony, ceny)
- **Brak dostępu** do:
  - Zarządzania użytkownikami
  - Tworzenia nowych obiektów
  - Usuwania obiektów

### 3.3 Widok publiczny (bez logowania)
- Dostęp przez specjalny link: `/?oid={propertyId}`
- Tylko odczyt cennika
- Dwa widoki:
  - **Overview:** Tabela z wszystkimi pokojami i sezonami
  - **Season View:** Szczegółowy widok wybranego sezonu

---

## 4. Struktura Danych

### 4.1 Baza Danych Supabase

#### Tabela: `users`
```sql
- id (uuid, primary key)
- email (text, unique)
- role (text: 'admin' | 'client')
- created_at (timestamp)
```

#### Tabela: `properties`
```sql
- id (uuid, primary key)
- name (text)
- oid (text) - ID obiektu w Hotres
- user_id (uuid, foreign key → users.id)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Tabela: `profiles`
```sql
- id (uuid, primary key)
- property_id (uuid, foreign key → properties.id)
- name (text) - nazwa profilu cenowego
- rooms (jsonb) - array pokoi
- seasons (jsonb) - array sezonów
- channels (jsonb) - array kanałów sprzedaży
- settings (jsonb) - globalne ustawienia
- created_at (timestamp)
- updated_at (timestamp)
```

### 4.2 Struktura JSON

#### Room (Pokój)
```typescript
{
  id: string,
  name: string,
  maxOccupancy: number,
  tid?: string, // ID typu pokoju w Hotres

  // Ceny bazowe
  basePricePeak: number,
  seasonBasePrices?: Record<seasonId, number>,

  // OBP (Opłata za Brakujące Pokoje)
  obpPerPerson?: number,
  minObpOccupancy?: number,
  seasonalObpActive?: Record<seasonId, boolean>,

  // Wyżywienie
  foodBreakfastPrice?: number,
  foodFullPrice?: number,
  seasonalFoodOption?: Record<seasonId, 'none' | 'breakfast' | 'full'>,

  // Konfiguracja sezonowa (nadpisuje globalne wartości)
  seasonalConfig?: Record<seasonId, {
    obpPerPerson?: number,
    minObpOccupancy?: number,
    foodBreakfastPrice?: number,
    foodFullPrice?: number
  }>,

  // Ręczne ceny Direct (nadpisują kalkulację)
  manualDirectPrices?: Record<seasonId, number>,

  // Mapowanie kanałów Hotres
  channelRidMap?: Record<channelId, string>
}
```

#### Season (Sezon)
```typescript
{
  id: string,
  name: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,
  multiplier: number, // mnożnik ceny (np. 1.0, 1.2, 0.8)
  minNights: number, // minimalna liczba noclegów
  color: string // hex color dla UI
}
```

#### Channel (Kanał sprzedaży)
```typescript
{
  id: string,
  name: string,
  margin: number, // prowizja w % (np. 15 = 15%)
  color: string
}
```

#### GlobalSettings (Ustawienia globalne)
```typescript
{
  obpEnabled: boolean, // czy OBP jest włączone globalnie
  foodEnabled: boolean // czy wyżywienie jest włączone globalnie
}
```

---

## 5. Logika Biznesowa - Obliczanie Cen

### 5.1 Hierarchia Obliczeń (Cena Direct)

**Krok 1: Ustal cenę bazową**
```
JEŚLI istnieje manualDirectPrices[seasonId]:
  cena = manualDirectPrices[seasonId]
W PRZECIWNYM RAZIE:
  JEŚLI istnieje seasonBasePrices[seasonId]:
    cena = seasonBasePrices[seasonId] * season.multiplier
  W PRZECIWNYM RAZIE:
    cena = room.basePricePeak * season.multiplier
```

**Krok 2: Zastosuj OBP (jeśli włączone)**
```
JEŚLI settings.obpEnabled === true I seasonalObpActive[seasonId] !== false:
  // Sprawdź sezonowe nadpisanie
  minOccupancy = seasonalConfig[seasonId]?.minObpOccupancy ?? room.minObpOccupancy ?? 1
  obpAmount = seasonalConfig[seasonId]?.obpPerPerson ?? room.obpPerPerson ?? 30

  effectiveOccupancy = max(actualOccupancy, minOccupancy)
  missingPeople = max(0, room.maxOccupancy - effectiveOccupancy)

  cena = cena - (missingPeople * obpAmount)
```

**Krok 3: Dodaj wyżywienie (jeśli włączone)**
```
JEŚLI settings.foodEnabled === true I seasonalFoodOption[seasonId] !== 'none':
  foodOption = seasonalFoodOption[seasonId]

  JEŚLI foodOption === 'breakfast':
    price = seasonalConfig[seasonId]?.foodBreakfastPrice ?? room.foodBreakfastPrice ?? 50
    cena = cena + (price * actualOccupancy)

  JEŚLI foodOption === 'full':
    price = seasonalConfig[seasonId]?.foodFullPrice ?? room.foodFullPrice ?? 100
    cena = cena + (price * actualOccupancy)
```

**Krok 4: Zastosuj minimum (tylko dla cen kalkulowanych)**
```
JEŚLI NIE manualDirectPrices[seasonId]:
  cena = max(cena, 50)
```

**Krok 5: Zaokrąglij**
```
cena = Math.round(cena)
```

### 5.2 Obliczanie Cen Kanałowych

```
directPrice = calculateDirectPrice(room, season, occupancy)

channelPrice = directPrice * (1 + channel.margin / 100)
channelPrice = Math.round(channelPrice)
```

**Przykład:**
- Direct: 500 zł
- Booking.com (margin 15%): 500 * 1.15 = 575 zł

---

## 6. Funkcjonalności Główne

### 6.1 Dashboard Administratora

**Nagłówek aplikacji:**
- Logo/Nazwa aplikacji
- Wybór aktywnego obiektu (dropdown)
- Przycisk "Dodaj obiekt" (tylko admin)
- Kalkulator ceny (ikona kalkulatora)
- Panel użytkownika:
  - Wyświetlanie email zalogowanego użytkownika
  - Przycisk "Zarządzaj użytkownikami" (tylko admin)
  - Przycisk wylogowania

**Nawigacja:**
- Zakładki:
  - **Dashboard** - główny widok cennika
  - **Ustawienia** - konfiguracja pokoi, sezonów, kanałów
  - **Klient** - podgląd publicznego cennika

### 6.2 Widok Dashboard

**Główna tabela cennikowa:**
- Kolumny:
  - Pokój/Sezon (nagłówki)
  - Direct Price (edytowalna!)
  - Kanały sprzedaży (dynamiczne, zależne od konfiguracji)
  - Obłożenie (% z Hotres, jeśli skonfigurowane)
  - Wykres obłożenia (mini chart)

**Filtrowanie:**
- Wybór sezonu (dropdown)
- Wybór liczby osób (1 do maxOccupancy)

**Cena Direct - funkcjonalność edycji:**
- Kliknij w cenę → zmienia się na input
- Zmień wartość → zapisz (Enter lub onBlur)
- Jeśli cena ręczna:
  - **Pomarańczowe tło**
  - Przycisk reset (⟲) obok ceny
- Ręczna cena to baza dla obliczeń (OBP i food nadal się stosują!)

**Wykresy obłożenia:**
- Pokazywane tylko jeśli pokój ma skonfigurowane `tid` (Hotres)
- Wykres słupkowy (mini) z % obłożenia
- Kolor zależny od obłożenia:
  - 0-33%: zielony
  - 34-66%: żółty
  - 67-100%: czerwony

### 6.3 Panel Ustawień

**Trzy sekcje (zakładki):**

#### A) Pokoje
- Lista wszystkich pokoi
- Każdy pokój:
  - Nazwa
  - Pojemność (max)
  - Cena bazowa (peak)
  - OBP (kwota na osobę, min. zajętość)
  - Wyżywienie (śniadanie, pełne - ceny)
  - TID (Hotres type_id)
  - **Ikona Settings** → otwiera modal konfiguracji sezonowej
- Przyciski: Edytuj, Usuń
- Przycisk dodawania nowego pokoju

**Modal konfiguracji sezonowej:**
- Pokazuje wszystkie sezony w tabeli
- Dla każdego sezonu można nadpisać:
  - OBP per person
  - Min. zajętość dla OBP
  - Cena śniadania
  - Cena pełnego wyżywienia
- Puste pola = używa wartości globalnych
- Wiersze z nadpisaniem: **niebieskie tło** + badge "Nadpisane"

#### B) Sezony
- Lista wszystkich sezonów
- Każdy sezon:
  - Nazwa
  - Daty (start - koniec)
  - Mnożnik ceny
  - Min. noce
  - Kolor (color picker)
- Przyciski: Edytuj, Usuń
- Przycisk dodawania nowego sezonu

#### C) Kanały Sprzedaży
- Lista wszystkich kanałów
- Każdy kanał:
  - Nazwa (np. Booking.com, Airbnb)
  - Marża (%)
  - Kolor
  - **Mapowanie RID dla Hotres** (dla każdego pokoju)
- Przyciski: Edytuj, Usuń
- Przycisk dodawania nowego kanału

**Hotres Integration:**
- Sekcja "Integracja Hotres"
- Przycisk "Pobierz obłożenie z Hotres"
  - Pobiera dane o zajętości dla aktywnego sezonu
  - Aktualizuje Dashboard
- Przycisk "Wyślij cennik do Hotres"
  - Wysyła wszystkie ceny kanałowe do Hotres API
  - Wymaga poprawnie zmapowanych RID dla każdego pokoju/kanału

### 6.4 Widok Klienta (Publiczny)

**Dostęp:**
- Wewnętrzny: Zakładka "Klient" w aplikacji
- Zewnętrzny: URL `/?oid={propertyId}`

**Dwa tryby widoku:**

#### Overview (Przegląd roczny)
- Tabela z wszystkimi pokojami (wiersze) i sezonami (kolumny)
- Dla każdej komórki:
  - Cena Direct
  - Opcjonalnie: info o wyżywieniu (małym fontem)
  - **Minimalna liczba nocy** (małym fontem, pod ceną)
    - Format: "min X noc/noce/nocy" (poprawna forma polska!)

#### Season View (Szczegóły sezonu)
- Wybór sezonu (dropdown)
- Tabela szczegółowa:
  - Kolumny: Pokój, Pojemność, **Min. Noclegi**, Cena Direct, Kanały...
  - Każdy wiersz = jeden pokój
  - Dla każdej ceny: zaokrąglone, z jednostką "zł"

**Formy polskie dla nocy:**
- 1 = "noc"
- 2-4 = "noce"
- 5-10 = "nocy"

### 6.5 Kalkulator Ceny

**Modalny kalkulator (overlay):**
- Wybór:
  - Pokój (dropdown)
  - Sezon (dropdown)
  - Liczba osób (input number, 1 do maxOccupancy)
- **Podgląd obliczeń krok po kroku:**
  - Cena bazowa: X zł
  - Mnożnik sezonowy (Y): X * Y = Z zł
  - OBP (jeśli aktywne): Z - (missing * obpAmount) = W zł
  - Wyżywienie (jeśli aktywne): W + (food * occupancy) = Final zł
- **Debug info:**
  - Status OBP: ON/OFF
  - Status Food: ON/OFF, typ (breakfast/full)
  - Wartości sezonowe vs globalne

### 6.6 Zarządzanie Użytkownikami (Admin)

**Modal "Users Management":**
- Lista wszystkich użytkowników
- Dla każdego:
  - Email
  - Rola (admin/client)
  - Data utworzenia
  - Przyciski: Edytuj, Usuń

**Dodawanie nowego użytkownika:**
- Email (input)
- Hasło (input, min 6 znaków)
- Rola (dropdown: admin/client)
- Tworzy konto w Supabase Auth + wpis w tabeli `users`

**Uwaga:** Hasło musi być min. 6 znaków (wymóg Supabase).

### 6.7 Zarządzanie Obiektami

**Dodawanie obiektu (Admin):**
- Dwa tryby:
  - **Manualny:** Nazwa obiektu, pusty cennik
  - **Import z Hotres:**
    - Podaj OID (Hotres object ID)
    - System automatycznie pobiera listę pokoi
    - Mapuje pokoje (nazwa, pojemność z konfiguracji łóżek)

**Import pokoi z Hotres:**
```
API: GET /api_rooms?user={user}&password={pass}&oid={oid}

Response: [
  {
    type_id: 123,
    code: "DeLuxe 2os",
    single: 0,
    double: 1,
    sofa: 0,
    sofa_single: 0
  }
]

Obliczanie pojemności:
maxOccupancy = (single * 1) + (double * 2) + (sofa * 2) + (sofaSingle * 1)
```

**Tworzenie profilu:**
- Każdy obiekt ma domyślny profil "Główny"
- Profile zawierają: rooms, seasons, channels, settings
- Domyślne wartości:
  - 3 pokoje (Standard, Premium, Apartament)
  - 12 sezonów (miesiące)
  - 2 kanały (Booking.com, Airbnb)
  - OBP: włączone, 30 zł/osoba
  - Food: wyłączone

---

## 7. Integracja Hotres API

### 7.1 Problem CORS
Hotres API nie obsługuje CORS → bezpośrednie wywołania z przeglądarki są blokowane.

**Rozwiązanie:** Supabase Edge Function jako proxy.

### 7.2 Supabase Edge Function: `hotres-proxy`

**Lokalizacja:** `supabase/functions/hotres-proxy/index.ts`

**Funkcjonalność:**
- Przyjmuje request z aplikacji
- Parametr `endpoint` określa ścieżkę API Hotres (np. `/api_rooms`)
- Reszta parametrów (user, password, oid, itp.) przekazywana dalej
- Wykonuje request do `panel.hotres.pl`
- Zwraca odpowiedź z headerami CORS

**Deployment:**
```bash
supabase functions deploy hotres-proxy --no-verify-jwt
```

Flaga `--no-verify-jwt` wyłącza wymóg tokenu JWT (funkcja publiczna).

### 7.3 Endpointy Hotres

#### GET /api_rooms
Pobiera listę pokoi dla obiektu.
```
Parametry:
- user: admin email
- password: admin password
- oid: ID obiektu

Response: [{type_id, code, single, double, sofa, sofa_single}]
```

#### GET /api_availability
Pobiera dane o dostępności pokoi w okresie.
```
Parametry:
- user, password, oid
- type_id: ID typu pokoju (opcjonalnie)
- from: YYYY-MM-DD
- till: YYYY-MM-DD

Response: [{type_id, dates: [{date, available: "0"|"1"}]}]
```

**Obliczanie obłożenia:**
```
total = dates.length
booked = dates.filter(d => d.available === "0").length
occupancy = Math.round((booked / total) * 100)
```

#### POST /api_updateprices
Aktualizuje ceny w systemie Hotres.
```
Parametry URL:
- user, password, oid

Body (JSON): [
  {
    rid: "123", // Room ID w Hotres (zmapowane z channelRidMap)
    prices: {
      "2024-01-01": 500,
      "2024-01-02": 500,
      ...
    }
  }
]
```

**Generowanie payload:**
- Dla każdej kombinacji pokój+kanał+sezon
- Znajdź RID z `room.channelRidMap[channel.id]`
- Wygeneruj ceny dla każdej daty w sezonie
- Użyj kalkulowanej ceny kanałowej (Direct + marża)

---

## 8. Interfejs Użytkownika (UI/UX)

### 8.1 Schemat Kolorów
- **Primary:** Niebieski (#3B82F6)
- **Success:** Zielony (#10B981)
- **Warning:** Pomarańczowy (#F59E0B)
- **Danger:** Czerwony (#EF4444)
- **Neutral:** Szary (#6B7280)

### 8.2 Typografia
- **Font:** System fonts (sans-serif)
- **Rozmiary:**
  - Headers: 24px, 20px, 18px
  - Body: 14px
  - Small: 12px, 10px

### 8.3 Komponenty

**Buttons:**
- Primary: niebieski, white text
- Secondary: szary outline
- Danger: czerwony
- Stany: hover, active, disabled

**Inputs:**
- Border: szary, focus: niebieski
- Walidacja: czerwony border + komunikat

**Tables:**
- Header: szare tło
- Zebra striping: naprzemienne wiersze
- Hover: lekkie podświetlenie
- Responsive: scroll horizontal na mobile

**Modals:**
- Backdrop: czarny, 50% opacity
- Backdrop blur (jeśli obsługiwany)
- Centrum ekranu
- ESC zamyka, klik poza zamyka

**Icons:**
- Lucide React
- Rozmiar: 16-24px
- Consistent stroke width

### 8.4 Responsywność
- Desktop first
- Breakpoint mobile: < 768px
- Na mobile:
  - Tabele: horizontal scroll
  - Buttons: full width
  - Modal: 90% szerokości

---

## 9. Przepływ Użytkownika

### 9.1 Pierwsza wizyta (Admin)

1. **Rejestracja/Logowanie:**
   - Wejście na stronę
   - Formularz logowania (email + hasło)
   - Jeśli brak konta: Admin tworzy ręcznie w Supabase Dashboard

2. **Dodanie obiektu:**
   - Kliknij "Dodaj obiekt"
   - Wybierz tryb: Manualny lub Import Hotres
   - Jeśli Hotres: podaj OID → automatyczny import pokoi
   - System tworzy domyślny profil z przykładowymi danymi

3. **Konfiguracja:**
   - Zakładka "Ustawienia"
   - Edytuj pokoje (nazwy, ceny, OBP)
   - Edytuj sezony (daty, mnożniki)
   - Edytuj kanały (marże, mapowanie RID)

4. **Testowanie:**
   - Sprawdź Dashboard (podgląd cen)
   - Użyj kalkulatora do weryfikacji
   - Przełącz na widok Klienta

5. **Hotres Integration:**
   - Zmapuj RID dla każdego pokoju i kanału
   - Kliknij "Wyślij cennik do Hotres"
   - Sprawdź czy ceny pojawiły się w Hotres

### 9.2 Codzienne użycie

**Admin:**
- Logowanie
- Wybór obiektu (jeśli wiele)
- Modyfikacja cen Direct (jeśli potrzebna ręczna zmiana)
- Aktualizacja sezonów/kanałów
- Upload cennika do Hotres

**Klient:**
- Dostaje link publiczny od Admina
- Otwiera w przeglądarce
- Przegląda ceny (Overview lub Season View)
- Bez możliwości edycji

---

## 10. Wymagania Niefunkcjonalne

### 10.1 Performance
- Ładowanie aplikacji: < 2s (first contentful paint)
- Zmiana widoku: instant (React state)
- Zapisywanie danych: < 500ms (Supabase)
- Hotres API: timeout 30s (może być wolne)

### 10.2 Security
- Hasła: bcrypt (obsługuje Supabase Auth)
- Auth tokens: JWT, short-lived
- HTTPS wymagane (Supabase + hosting)
- Row Level Security (RLS) w Supabase:
  - Users widzą tylko swoje obiekty
  - Admin widzi wszystko

### 10.3 Scalability
- Obsługa do 100 obiektów na użytkownika
- Do 50 pokoi na obiekt
- Do 20 sezonów na profil
- Do 10 kanałów sprzedaży

### 10.4 Browser Support
- Chrome/Edge: ostatnie 2 wersje
- Firefox: ostatnie 2 wersje
- Safari: ostatnia wersja
- Mobile browsers: iOS Safari, Chrome Mobile

---

## 11. Instalacja i Deployment

### 11.1 Wymagania
- Node.js 18+
- npm/yarn
- Konto Supabase
- (Opcjonalnie) Supabase CLI

### 11.2 Setup Supabase

**Krok 1: Utwórz projekt**
- Wejdź na supabase.com
- Create new project
- Zapisz URL i anon key

**Krok 2: Database Schema**
```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Properties table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  oid TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Główny',
  rooms JSONB DEFAULT '[]',
  seasons JSONB DEFAULT '[]',
  channels JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{"obpEnabled": true, "foodEnabled": false}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies (przykładowe)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own properties"
  ON properties FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- ... więcej policies dla INSERT, UPDATE, DELETE
```

**Krok 3: Auth Settings**
- Authentication → Providers → Email
- Enable Email Signup: ON
- Confirm Email: OFF (dla prostoty, lub ON w produkcji)

**Krok 4: Edge Function**
- Dashboard → Edge Functions → Create new function
- Nazwa: `hotres-proxy`
- Wklej kod z sekcji 7
- Settings → Verify JWT: OFF
- Deploy

### 11.3 Setup Frontend

**Krok 1: Clone/Create repo**
```bash
npm create vite@latest tp-cenniki -- --template react-ts
cd tp-cenniki
```

**Krok 2: Install dependencies**
```bash
npm install @supabase/supabase-js react-router-dom lucide-react recharts
```

**Krok 3: Configure Supabase**
Utwórz `src/utils/supabaseClient.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Krok 4: Build**
```bash
npm run build
```

**Krok 5: Deploy**
- Vercel: `vercel deploy`
- Netlify: drag & drop `dist` folder
- GitHub Pages: push `dist` to gh-pages branch

---

## 12. Testowanie

### 12.1 Scenariusze testowe

**T1: Logowanie**
1. Otwórz aplikację
2. Wprowadź poprawne dane
3. Sprawdź przekierowanie do Dashboard
4. Sprawdź wyświetlanie email w nagłówku

**T2: Dodawanie obiektu (Import Hotres)**
1. Kliknij "Dodaj obiekt"
2. Wybierz "Import z Hotres"
3. Wpisz OID: `4631` (testowy)
4. Sprawdź czy pokoje zostały zaimportowane
5. Sprawdź pojemność pokoi

**T3: Edycja pokoju**
1. Ustawienia → Pokoje
2. Edytuj pierwszy pokój
3. Zmień nazwę, cenę bazową
4. Zapisz
5. Sprawdź Dashboard - czy cena się zaktualizowała

**T4: Konfiguracja sezonowa**
1. Ustawienia → Pokoje
2. Kliknij ikonę Settings przy pokoju
3. Dla pierwszego sezonu wpisz OBP: 50
4. Zapisz modal
5. Dashboard → Sprawdź czy OBP 50 jest używany dla tego sezonu

**T5: Ręczna cena Direct**
1. Dashboard
2. Kliknij w cenę Direct
3. Wpisz 999
4. Kliknij poza input
5. Sprawdź: pomarańczowe tło, przycisk reset
6. Zmień zajętość → sprawdź czy OBP się stosuje
7. Kliknij reset → sprawdź powrót do kalkulacji

**T6: Kalkulator**
1. Kliknij ikonę kalkulatora
2. Wybierz pokój, sezon, osoby
3. Sprawdź podgląd obliczeń krok po kroku
4. Porównaj z Dashboard

**T7: Widok klienta**
1. Zakładka "Klient"
2. Sprawdź tabelę Overview
3. Sprawdź min. noce pod cenami (poprawna forma polska)
4. Wybierz Season View → sprawdź szczegóły

**T8: Upload do Hotres**
1. Ustawienia → Hotres Integration
2. Zmapuj RID dla każdego pokoju i kanału
3. Kliknij "Wyślij cennik"
4. Sprawdź logi w konsoli
5. Sprawdź w Hotres czy ceny się pojawiły

**T9: Zarządzanie użytkownikami (Admin)**
1. Kliknij "Zarządzaj użytkownikami"
2. Dodaj nowego (email, hasło, rola)
3. Sprawdź w Supabase Dashboard czy user istnieje
4. Zaloguj się jako nowy user
5. Sprawdź uprawnienia (client nie widzi zarządzania)

### 12.2 Edge Cases

**E1: Pusty obiekt (bez pokoi)**
- System powinien pokazać komunikat "Brak pokoi"
- Przycisk dodawania pokoju

**E2: Sezon bez dat**
- Walidacja: daty wymagane
- Alert jeśli data końca < data początku

**E3: OBP większy niż cena**
- Cena nie może być ujemna
- Minimum 50 zł (lub 0 dla ręcznych)

**E4: Brak połączenia z Hotres**
- Timeout po 30s
- Komunikat błędu użytkownikowi
- Retry button

**E5: Duplikat sezonu (nakładające się daty)**
- Obecnie: brak walidacji (do dodania?)
- Lub: ostrzeżenie w UI

---

## 13. Potencjalne Rozszerzenia (Roadmap)

### Wersja 1.1
- [ ] Multi-profile support (wiele cenników na obiekt)
- [ ] Historia zmian (audit log)
- [ ] Eksport cennika do PDF
- [ ] Email notifications (ceny zaktualizowane)

### Wersja 1.2
- [ ] Integracja z innymi PMS (Beds24, Mews)
- [ ] Automatyczna synchronizacja cen (scheduled)
- [ ] Dashboard analytics (wykresy sprzedaży)
- [ ] Multi-currency support

### Wersja 2.0
- [ ] Mobile app (React Native)
- [ ] White-label dla agencji
- [ ] API dla zewnętrznych integracji
- [ ] Advanced pricing rules (machine learning?)

---

## 14. Troubleshooting

### Problem: Nie mogę się zalogować
**Rozwiązanie:**
- Sprawdź czy email signup jest włączony w Supabase
- Sprawdź czy użytkownik istnieje w tabeli `users`
- Sprawdź hasło (min. 6 znaków)

### Problem: Hotres import nie działa
**Rozwiązanie:**
- Sprawdź Edge Function: czy jest wdrożona?
- Sprawdź logi Edge Function
- Sprawdź OID (czy prawidłowy?)
- Sprawdź credentials (user/password Hotres)

### Problem: Ceny się nie aktualizują w Hotres
**Rozwiązanie:**
- Sprawdź mapowanie RID (czy wszystkie pokoje mają RID?)
- Sprawdź logi w konsoli przeglądarki
- Sprawdź response z Hotres API
- Zweryfikuj credentials

### Problem: OBP się nie stosuje
**Rozwiązanie:**
- Sprawdź czy OBP jest włączone (settings.obpEnabled)
- Sprawdź czy sezonowe OBP nie jest wyłączone
- Sprawdź debug w kalkulatorze
- Sprawdź console.log w pricingEngine.ts

---

## 15. Słownik Pojęć

- **OBP (Opłata za Brakujące Osoby):** Mechanizm obniżania ceny, gdy zajętość jest mniejsza niż maksymalna pojemność pokoju
- **Direct Price:** Cena bazowa (bez prowizji kanałów)
- **Channel Price:** Cena z doliczonym marginesem kanału sprzedaży
- **Season Multiplier:** Mnożnik ceny sezonowej (np. 1.2 = +20%)
- **TID (Type ID):** ID typu pokoju w systemie Hotres
- **RID (Room ID):** ID kanału sprzedaży w Hotres (mapowanie pokój+kanał)
- **OID (Object ID):** ID obiektu noclegowego w Hotres
- **Profile:** Zestaw konfiguracji cenowej (pokoje + sezony + kanały)
- **Manual Price:** Ręcznie wprowadzona cena nadpisująca kalkulację

---

## 16. Struktura Plików Projektu

### Kluczowe pliki do stworzenia:

```
tp-cenniki/
├── src/
│   ├── App.tsx                      # Główny komponent aplikacji
│   ├── types.ts                     # TypeScript interfaces
│   ├── constants.ts                 # Domyślne wartości (pokoje, sezony)
│   ├── utils/
│   │   ├── pricingEngine.ts         # Logika obliczeń cenowych
│   │   ├── hotresApi.ts             # Integracja z Hotres API
│   │   └── supabaseClient.ts        # Konfiguracja Supabase
│   ├── components/
│   │   ├── Dashboard.tsx            # Główny widok cennika
│   │   ├── SettingsPanel.tsx        # Panel konfiguracji
│   │   ├── ClientDashboard.tsx      # Widok publiczny cennika
│   │   ├── CalculatorModal.tsx      # Kalkulator ceny
│   │   └── UsersManagement.tsx      # Zarządzanie użytkownikami
│   └── index.css                    # Tailwind CSS imports
├── supabase/
│   ├── functions/
│   │   └── hotres-proxy/
│   │       └── index.ts             # Edge Function proxy CORS
│   └── config.toml                  # Konfiguracja Supabase
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## 17. Podsumowanie

Ten dokument zawiera **kompletną specyfikację** systemu TP-Cenniki. Używając tej specyfikacji, możesz:

1. ✅ Zbudować system od zera (wszystkie detale są opisane)
2. ✅ Onboardować nowych deweloperów
3. ✅ Tworzyć testy (scenariusze testowe w sekcji 12)
4. ✅ Planować rozbudowę (roadmap w sekcji 13)
5. ✅ Troubleshootować problemy (sekcja 14)

**Szacowany czas implementacji:** 40-60 godzin (doświadczony dev React + TypeScript)

---

**Wersja dokumentu:** 1.0
**Data:** 2026-02-02
**Autor:** System dokumentacji TP-Cenniki
