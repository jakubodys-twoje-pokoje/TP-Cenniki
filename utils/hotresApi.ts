
import { RoomType, Season, GlobalSettings, Channel } from "../types";
import { calculateDirectPrice, calculateChannelPrice } from "./pricingEngine";
import { supabase } from "./supabaseClient";

// --- API CREDENTIALS ---
const USER = "admin@twojepokoje.com.pl";
const PASS = "Admin123@@";

// CORS Proxy Configuration
const USE_SUPABASE_PROXY = true; // Use Supabase Edge Function as CORS proxy
const SUPABASE_PROJECT_URL = "https://stdepyblwccelpbrqjux.supabase.co"; // Your Supabase project URL
const TRY_DIRECT_FIRST = false; // Direct connection doesn't work (CORS blocked)

// --- INTERFACES ---
interface HotresDay {
  date: string;
  available: string; // "1" = free, "0" = booked
  reception: any;
}

interface HotresResponseItem {
  type_id: number;
  dates: HotresDay[];
}

interface HotresRoomResponse {
  type_id: number;
  code: string;
  single: string;
  double: string;
  sofa: string;
  sofa_single: string;
}

// --- HELPERS ---

const buildUrl = (endpoint: string, params: Record<string, string>, useDirect: boolean = false) => {
  const queryString = new URLSearchParams(params).toString();

  if (useDirect) {
    // Direct connection to Hotres (blocked by CORS, but try anyway)
    return `https://panel.hotres.pl${endpoint}?${queryString}`;
  }

  if (USE_SUPABASE_PROXY) {
    // Use Supabase Edge Function as proxy
    // Format: https://<project>.supabase.co/functions/v1/hotres-proxy?endpoint=/api_rooms&user=...&password=...
    const proxyParams = new URLSearchParams({ endpoint, ...params });
    return `${SUPABASE_PROJECT_URL}/functions/v1/hotres-proxy?${proxyParams.toString()}`;
  }

  // Fallback to public CORS proxy (may not work for POST)
  const targetUrl = `https://panel.hotres.pl${endpoint}?${queryString}`;
  return `https://corsproxy.org/?${encodeURIComponent(targetUrl)}`;
};

// Helper to try fetch with fallback from direct to proxy
const fetchWithFallback = async (endpoint: string, params: Record<string, string>, options?: RequestInit): Promise<Response> => {
  if (TRY_DIRECT_FIRST) {
    try {
      const directUrl = buildUrl(endpoint, params, true);
      console.log('[Hotres] Trying direct connection:', directUrl);
      const response = await fetch(directUrl, options);
      console.log('[Hotres] Direct connection successful!');
      return response;
    } catch (directError) {
      console.log('[Hotres] Direct connection failed (CORS), using proxy');
    }
  }

  // Use proxy (Supabase Edge Function or public proxy)
  const proxyUrl = buildUrl(endpoint, params, false);
  const proxyType = USE_SUPABASE_PROXY ? 'Supabase Edge Function' : 'Public CORS proxy';

  const requestMethod = options?.method || 'GET';
  console.log(`[Hotres] 🔄 HTTP ${requestMethod} REQUEST #1 via ${proxyType}`);
  console.log(`[Hotres] URL:`, proxyUrl.substring(0, 100) + '...');

  // Add auth headers for Supabase Edge Function
  let finalOptions = { ...options };
  if (USE_SUPABASE_PROXY) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(finalOptions.headers);

    // Add Supabase anon key for public Edge Function access
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';
    headers.set('apikey', SUPABASE_ANON_KEY);
    headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);

    finalOptions.headers = headers;
  }

  console.log('[Hotres] ⏳ Waiting for response...');
  return await fetch(proxyUrl, finalOptions);
};

const calculatePercentage = (totalDays: number, bookedDays: number): number => {
  if (totalDays === 0) return 0;
  return Math.round((bookedDays / totalDays) * 100);
};

// Sanitize payload: replace NaN/Infinity with 0 so Hotres doesn't reject the request
const sanitizePricePayload = (payload: { type_id: number, rate_id: number, mode: string, prices: any[] }[]) => {
  return payload.map(item => ({
    ...item,
    prices: item.prices.map((p: any) => {
      const clean: any = {};
      for (const [k, v] of Object.entries(p)) {
        if (typeof v === 'number' && !isFinite(v)) {
          console.warn(`[Hotres] ⚠️ Invalid value (${v}) for "${k}" in type_id=${item.type_id} rate_id=${item.rate_id} – replacing with 0`);
          clean[k] = 0;
        } else {
          clean[k] = v;
        }
      }
      return clean;
    })
  }));
};

// --- CORE FUNCTIONS ---

export const fetchHotresOccupancy = async (
  oid: string,
  tid: string,
  startDate: string,
  endDate: string
): Promise<number> => {
  if (!oid || !tid) throw new Error("Brak konfiguracji OID lub TID");

  try {
    const response = await fetchWithFallback('/api_availability', {
      user: USER, password: PASS, oid: oid, type_id: tid, from: startDate, till: endDate
    });

    if (!response.ok) throw new Error(`Błąd API: ${response.status}`);
    const data: HotresResponseItem[] = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Pusta odpowiedź z API");
    const roomData = data.find(item => item.type_id === Number(tid));
    if (!roomData) throw new Error("Brak danych dla tego pokoju");

    const total = roomData.dates.length;
    const booked = roomData.dates.filter(d => d.available === "0").length;
    return calculatePercentage(total, booked);
  } catch (error) {
    console.error("Hotres API Error:", error);
    throw error;
  }
};

export const fetchSeasonOccupancyMap = async (
  oid: string,
  startDate: string,
  endDate: string
): Promise<Record<string, number>> => {
  if (!oid) throw new Error("Brak OID");

  try {
    const response = await fetchWithFallback('/api_availability', {
      user: USER, password: PASS, oid: oid, from: startDate, till: endDate
    });

    if (!response.ok) throw new Error(`Błąd API: ${response.status}`);
    const data: HotresResponseItem[] = await response.json();
    if (!Array.isArray(data)) return {};

    const occupancyMap: Record<string, number> = {};
    data.forEach(item => {
      if (item.type_id) {
        const total = item.dates.length;
        const booked = item.dates.filter(d => d.available === "0").length;
        occupancyMap[item.type_id.toString()] = calculatePercentage(total, booked);
      }
    });
    return occupancyMap;
  } catch (error) {
    console.error("Hotres Bulk Fetch Error:", error);
    return {};
  }
};

export const fetchHotresRooms = async (oid: string): Promise<RoomType[]> => {
  if (!oid) throw new Error("Brak OID");

  console.log('Fetching Hotres rooms for OID:', oid);

  try {
    const response = await fetchWithFallback('/api_rooms', {
      user: USER,
      password: PASS,
      oid: oid
    });

    console.log('Hotres API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hotres API error response:', errorText);
      throw new Error(`Błąd API Hotres: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data: HotresRoomResponse[] = await response.json();
    console.log('Hotres API raw data:', data);

    if (!Array.isArray(data)) {
      throw new Error("Nieprawidłowy format danych z Hotres - oczekiwano tablicy");
    }

    if (data.length === 0) {
      throw new Error("Hotres zwrócił pustą listę pokoi dla OID: " + oid);
    }

    const rooms = data.map((item, index) => {
      const single = parseInt(item.single) || 0;
      const double = parseInt(item.double) || 0;
      const sofa = parseInt(item.sofa) || 0;
      const sofaSingle = parseInt(item.sofa_single) || 0;

      const maxOccupancy = (single * 1) + (double * 2) + (sofa * 2) + (sofaSingle * 1);

      return {
        id: Date.now().toString() + index,
        name: item.code || `Pokój ${item.type_id}`,
        maxOccupancy: maxOccupancy > 0 ? maxOccupancy : 2,
        tid: item.type_id.toString(),
        basePricePeak: 300,
        minObpOccupancy: 1,
        obpPerPerson: 30,
      };
    });

    console.log('Mapped rooms:', rooms);
    return rooms;

  } catch (error) {
    console.error("Hotres Rooms Fetch Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Nieznany błąd podczas importu pokoi z Hotres");
  }
};

export const updateHotresPrices = async (
  oid: string,
  rooms: RoomType[],
  seasons: Season[],
  channels: Channel[],
  settings: GlobalSettings
): Promise<void> => {
  if (!oid) throw new Error("Brak OID obiektu.");

  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();
  const validRooms = rooms.filter(r => r.tid && r.tid.trim() !== "");
  const validChannels = channels.filter(c => c.rid && c.rid.trim() !== "");

  if (validRooms.length === 0) throw new Error("Brak pokoi ze zdefiniowanym TID.");
  if (validChannels.length === 0) throw new Error("Brak kanałów ze zdefiniowanym RID.");

  validRooms.forEach(room => {
    // Skip rooms with Hotres sync disabled
    if (room.hotresSyncEnabled === false) {
      console.log(`[Hotres] ⏭️  Skipping room "${room.name}" (sync disabled)`);
      return;
    }

    seasons.forEach(season => {
      validChannels.forEach(channel => {
         const channelRid = channel.rid;
         if (channelRid) {
            const directBasePrice = calculateDirectPrice(room, season, room.maxOccupancy, settings);
            const channelBaseCalc = calculateChannelPrice(directBasePrice, channel, season.id);
            
            const priceEntry: any = {
              from: season.startDate,
              till: season.endDate,
              baseprice: channelBaseCalc.listPrice,
              min: season.minNights || 1,
              child: 0
            };

            for (let i = 1; i <= room.maxOccupancy; i++) {
              if (i > 8) break;
              const directP = calculateDirectPrice(room, season, i, settings);
              const chanCalc = calculateChannelPrice(directP, channel, season.id);
              priceEntry[`pers${i}`] = chanCalc.listPrice;
            }

            const key = `${room.tid}-${channelRid}`;
            if (!payloadMap.has(key)) {
              payloadMap.set(key, {
                type_id: parseInt(room.tid),
                rate_id: parseInt(channelRid),
                mode: "delta",
                prices: []
              });
            }
            payloadMap.get(key)!.prices.push(priceEntry);
         }
      });
    });
  });

  const rawPayload = Array.from(payloadMap.values());
  if (rawPayload.length === 0) throw new Error("Brak danych do wysłania.");
  const payload = sanitizePricePayload(rawPayload);

  const CHUNK_DELAY_MS = 1500;
  // Group by type_id so all channels for one room are always in the same chunk
  const groupedByRoom = new Map<number, typeof payload>();
  for (const item of payload) {
    if (!groupedByRoom.has(item.type_id)) groupedByRoom.set(item.type_id, []);
    groupedByRoom.get(item.type_id)!.push(item);
  }
  const MAX_ROOMS_PER_CHUNK = 1; // 1 room per chunk to stay within Hotres limits
  const chunks: (typeof payload)[] = [];
  let currentChunk: typeof payload = [];
  let roomsInChunk = 0;
  for (const roomItems of groupedByRoom.values()) {
    if (roomsInChunk >= MAX_ROOMS_PER_CHUNK && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      roomsInChunk = 0;
    }
    currentChunk.push(...roomItems);
    roomsInChunk++;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  console.log(`[Hotres] Sending ${payload.length} items (${groupedByRoom.size} rooms) in ${chunks.length} chunk(s), ${CHUNK_DELAY_MS}ms apart...`);

  const failedTypeIds: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
    }

    const chunk = chunks[i];
    const typeIds = [...new Set(chunk.map(c => c.type_id))];
    console.log(`[Hotres] Chunk ${i + 1}/${chunks.length}: type_id=${typeIds.join(',')} (${chunk.length} items)`);

    try {
      const response = await fetchWithFallback('/api_updateprices', {
        user: USER,
        password: PASS,
        oid: oid
      }, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Hotres] ❌ Chunk ${i + 1} FAILED: HTTP ${response.status} for type_id=${typeIds.join(',')} | ${errorText.substring(0, 300)}`);
        failedTypeIds.push(...typeIds);
        continue; // skip, try remaining rooms
      }

      const result = await response.json();
      if (result.result !== 'success') {
        console.error(`[Hotres] ❌ Chunk ${i + 1} REJECTED by Hotres: type_id=${typeIds.join(',')} | ${JSON.stringify(result)}`);
        failedTypeIds.push(...typeIds);
        continue;
      }

      console.log(`[Hotres] ✅ Chunk ${i + 1} OK (type_id=${typeIds.join(',')})`);
    } catch (err) {
      console.error(`[Hotres] ❌ Chunk ${i + 1} network error: type_id=${typeIds.join(',')} |`, err);
      failedTypeIds.push(...typeIds);
    }
  }

  if (failedTypeIds.length > 0) {
    throw new Error(`Hotres: nie udało się zaktualizować TID: ${failedTypeIds.join(', ')}. Sprawdź logi konsoli po szczegóły.`);
  }
};

/**
 * Pushes manually calculated prices from the Calculator to Hotres for a specific date range.
 * Does NOT update the internal database state.
 */
export const pushMultipleSnapshotsToHotres = async (
  oid: string,
  snapshots: {
    roomIds: string[],
    startDate: string,
    endDate: string,
    minNights: number,
    obpLadder: { occupancy: number, channelPrices: { id: string, listPrice: number }[] }[]
  }[],
  rooms: RoomType[],
  channels: Channel[]
): Promise<void> => {
  if (!oid) throw new Error("Brak OID obiektu.");
  if (snapshots.length === 0) throw new Error("Brak snapshotów do wysłania.");

  // Group all snapshots by room to minimize API calls
  // For each unique room, collect ALL price entries from ALL snapshots
  const roomSnapshotMap = new Map<string, {
    room: RoomType,
    priceData: {
      dateRange: { startDate: string, endDate: string, minNights: number },
      obpLadder: { occupancy: number, channelPrices: { id: string, listPrice: number }[] }[]
    }[]
  }>();

  // Build the map
  snapshots.forEach(snapshot => {
    snapshot.roomIds.forEach(roomId => {
      const room = rooms.find(r => r.id === roomId);
      if (!room || !room.tid) return;

      // Skip rooms with Hotres sync disabled
      if (room.hotresSyncEnabled === false) {
        console.log(`[Hotres] ⏭️  Skipping room "${room.name}" (sync disabled)`);
        return;
      }

      if (!roomSnapshotMap.has(roomId)) {
        roomSnapshotMap.set(roomId, { room, priceData: [] });
      }

      roomSnapshotMap.get(roomId)!.priceData.push({
        dateRange: {
          startDate: snapshot.startDate,
          endDate: snapshot.endDate,
          minNights: snapshot.minNights
        },
        obpLadder: snapshot.obpLadder
      });
    });
  });

  // Now build ONE big payload with all rooms and all their price entries
  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();

  roomSnapshotMap.forEach(({ room, priceData }) => {
    channels.forEach(channel => {
      if (!channel.rid || channel.rid.trim() === "") return;

      const allPriceEntries: any[] = [];

      // For each price data (snapshot) for this room
      priceData.forEach(({ dateRange, obpLadder }) => {
        const maxOccRow = obpLadder.find(r => r.occupancy === room.maxOccupancy);
        if (!maxOccRow) return;

        const channelMaxPrice = maxOccRow.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
        if (channelMaxPrice === undefined) return;

        const priceEntry: any = {
          from: dateRange.startDate,
          till: dateRange.endDate,
          baseprice: channelMaxPrice,
          min: dateRange.minNights,
          child: 0
        };

        // Add per-person prices from the ladder
        obpLadder.forEach(row => {
          const cPrice = row.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
          if (cPrice !== undefined && row.occupancy <= 8) {
            priceEntry[`pers${row.occupancy}`] = cPrice;
          }
        });

        allPriceEntries.push(priceEntry);
      });

      if (allPriceEntries.length > 0) {
        const key = `${room.tid}-${channel.rid}`;
        payloadMap.set(key, {
          type_id: parseInt(room.tid),
          rate_id: parseInt(channel.rid),
          mode: "delta",
          prices: allPriceEntries
        });
      }
    });
  });

  const rawPayload = Array.from(payloadMap.values());
  if (rawPayload.length === 0) throw new Error("Brak zmapowanych kanałów (RID) dla wybranych pokoi.");
  const payload = sanitizePricePayload(rawPayload);

  const totalPriceEntries = payload.reduce((sum, p) => sum + p.prices.length, 0);

  const CHUNK_DELAY_MS = 1500;
  // Group by type_id so all channels for one room are always in the same chunk
  const groupedByRoom = new Map<number, typeof payload>();
  for (const item of payload) {
    if (!groupedByRoom.has(item.type_id)) groupedByRoom.set(item.type_id, []);
    groupedByRoom.get(item.type_id)!.push(item);
  }
  const MAX_ROOMS_PER_CHUNK = 1; // 1 room per chunk to stay within Hotres limits
  const chunks: (typeof payload)[] = [];
  let currentChunk: typeof payload = [];
  let roomsInChunk = 0;
  for (const roomItems of groupedByRoom.values()) {
    if (roomsInChunk >= MAX_ROOMS_PER_CHUNK && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      roomsInChunk = 0;
    }
    currentChunk.push(...roomItems);
    roomsInChunk++;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Hotres] 📊 BULK UPDATE SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📸 Snapshots added:', snapshots.length);
  console.log('  🏠 Unique rooms:', roomSnapshotMap.size);
  console.log('  📝 Payload items (room×channel):', payload.length);
  console.log('  📅 Total price entries:', totalPriceEntries);
  console.log(`  🚀 HTTP REQUESTS: ${chunks.length} chunk(s), 1 room each, ${CHUNK_DELAY_MS}ms apart`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const failedTypeIds: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      console.log(`[Hotres] ⏳ Waiting ${CHUNK_DELAY_MS}ms before next chunk...`);
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
    }

    const chunk = chunks[i];
    const typeIds = [...new Set(chunk.map(c => c.type_id))];
    const startTime = Date.now();
    console.log(`[Hotres] 🌐 Sending chunk ${i + 1}/${chunks.length}: type_id=${typeIds.join(',')} (${chunk.length} items)...`);

    try {
      const response = await fetchWithFallback('/api_updateprices', {
        user: USER,
        password: PASS,
        oid: oid
      }, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Hotres] ❌ Chunk ${i + 1} FAILED in ${duration}ms: HTTP ${response.status} for type_id=${typeIds.join(',')} | ${errorText.substring(0, 300)}`);
        failedTypeIds.push(...typeIds);
        continue;
      }

      const result = await response.json();
      if (result.result !== 'success') {
        console.error(`[Hotres] ❌ Chunk ${i + 1} REJECTED by Hotres in ${duration}ms: type_id=${typeIds.join(',')} | ${JSON.stringify(result)}`);
        failedTypeIds.push(...typeIds);
        continue;
      }

      console.log(`[Hotres] ✅ Chunk ${i + 1} OK in ${duration}ms (type_id=${typeIds.join(',')})`);
    } catch (err) {
      console.error(`[Hotres] ❌ Chunk ${i + 1} network error: type_id=${typeIds.join(',')} |`, err);
      failedTypeIds.push(...typeIds);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failedTypeIds.length > 0) {
    throw new Error(`Hotres: nie udało się zaktualizować TID: ${failedTypeIds.join(', ')}. Sprawdź logi konsoli po szczegóły.`);
  }
  console.log('[Hotres] ✅ All chunks sent successfully!');
};

export const pushManualPriceUpdate = async (
  oid: string,
  room: RoomType,
  dateRanges: { startDate: string, endDate: string, minNights: number }[], // Array of date ranges
  channels: Channel[],
  // Data from calculator
  obpLadder: { occupancy: number, channelPrices: { id: string, listPrice: number }[] }[]
): Promise<void> => {
  if (!oid) throw new Error("Brak OID obiektu.");
  if (!room.tid) throw new Error("Brak TID dla wybranego pokoju.");
  if (dateRanges.length === 0) throw new Error("Musisz dodać przynajmniej jeden zakres dat.");

  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();

  // Iterate only through channels that have a valid RID and are present in the calculation
  channels.forEach(channel => {
    if (!channel.rid || channel.rid.trim() === "") return;

    // Get Base Price (Usually Max Occupancy price)
    const maxOccRow = obpLadder.find(r => r.occupancy === room.maxOccupancy);
    if (!maxOccRow) return;

    const channelMaxPrice = maxOccRow.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
    if (channelMaxPrice === undefined) return;

    // Create price entries for each date range
    const priceEntries = dateRanges.map(range => {
      const priceEntry: any = {
        from: range.startDate,
        till: range.endDate,
        baseprice: channelMaxPrice,
        min: range.minNights,
        child: 0
      };

      // Add per-person prices from the ladder
      obpLadder.forEach(row => {
         const cPrice = row.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
         if (cPrice !== undefined && row.occupancy <= 8) {
            priceEntry[`pers${row.occupancy}`] = cPrice;
         }
      });

      return priceEntry;
    });

    const key = `${room.tid}-${channel.rid}`;
    payloadMap.set(key, {
      type_id: parseInt(room.tid),
      rate_id: parseInt(channel.rid),
      mode: "delta",
      prices: priceEntries // Multiple entries now!
    });
  });

  const payload = Array.from(payloadMap.values());
  if (payload.length === 0) throw new Error("Brak zmapowanych kanałów (RID) dla tego obiektu.");

  try {
    const response = await fetchWithFallback('/api_updateprices', {
      user: USER,
      password: PASS,
      oid: oid
    }, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd HTTP: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result.result !== 'success') {
       throw new Error(`Hotres Error: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.error("Hotres Manual Update Error:", error);
    throw error;
  }
};
