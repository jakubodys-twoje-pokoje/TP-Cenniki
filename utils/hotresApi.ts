
import { RoomType, Season, GlobalSettings, Channel } from "../types";
import { calculateDirectPrice, calculateChannelPrice } from "./pricingEngine";

// --- API CREDENTIALS ---
const USER = "admin@twojepokoje.com.pl";
const PASS = "Admin123@@";

// CORS Proxy Configuration
const USE_SUPABASE_PROXY = true;
const SUPABASE_PROJECT_URL = "https://stdepyblwccelpbrqjux.supabase.co";
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZGVweWJsd2NjZWxwYnJxanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg0MjksImV4cCI6MjA4MDQ1NDQyOX0.4PI0txHrLVQIscfoOgj_Aeo-uRwbIWARvzArk12erqg';

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

const buildUrl = (endpoint: string, params: Record<string, string>) => {
  if (USE_SUPABASE_PROXY) {
    const proxyParams = new URLSearchParams({ endpoint, ...params });
    return `${SUPABASE_PROJECT_URL}/functions/v1/hotres-proxy?${proxyParams.toString()}`;
  }
  const queryString = new URLSearchParams(params).toString();
  return `https://panel.hotres.pl${endpoint}?${queryString}`;
};

const hotresFetch = async (endpoint: string, params: Record<string, string>, options?: RequestInit): Promise<Response> => {
  const url = buildUrl(endpoint, params);
  let finalOptions = { ...options };

  if (USE_SUPABASE_PROXY) {
    const headers = new Headers(finalOptions.headers);
    headers.set('apikey', SUPABASE_ANON_KEY);
    headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    finalOptions.headers = headers;
  }

  return fetch(url, finalOptions);
};

const calculatePercentage = (totalDays: number, bookedDays: number): number => {
  if (totalDays === 0) return 0;
  return Math.round((bookedDays / totalDays) * 100);
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
    const response = await hotresFetch('/api_availability', {
      user: USER, password: PASS, oid, type_id: tid, from: startDate, till: endDate
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
    const response = await hotresFetch('/api_availability', {
      user: USER, password: PASS, oid, from: startDate, till: endDate
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

  try {
    const response = await hotresFetch('/api_rooms', { user: USER, password: PASS, oid });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd API Hotres: ${response.status} - ${errorText.substring(0, 100)}`);
    }
    const data: HotresRoomResponse[] = await response.json();
    if (!Array.isArray(data)) throw new Error("Nieprawidłowy format danych z Hotres - oczekiwano tablicy");
    if (data.length === 0) throw new Error("Hotres zwrócił pustą listę pokoi dla OID: " + oid);

    return data.map((item, index) => {
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
  } catch (error) {
    console.error("Hotres Rooms Fetch Error:", error);
    if (error instanceof Error) throw error;
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
    if (room.hotresSyncEnabled === false) return;

    seasons.forEach(season => {
      validChannels.forEach(channel => {
        const channelRid = channel.rid;
        if (channelRid) {
          const directBasePrice = calculateDirectPrice(room, season, room.maxOccupancy, settings);
          const channelBaseCalc = calculateChannelPrice(directBasePrice, channel, season.id, settings.roundingEnabled ?? true);
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
            const chanCalc = calculateChannelPrice(directP, channel, season.id, settings.roundingEnabled ?? true);
            priceEntry[`pers${i}`] = chanCalc.listPrice;
          }
          const key = `${room.tid}-${channelRid}`;
          if (!payloadMap.has(key)) {
            payloadMap.set(key, { type_id: parseInt(room.tid), rate_id: parseInt(channelRid), mode: "delta", prices: [] });
          }
          payloadMap.get(key)!.prices.push(priceEntry);
        }
      });
    });
  });

  const payload = Array.from(payloadMap.values());
  if (payload.length === 0) throw new Error("Brak danych do wysłania.");

  const response = await hotresFetch('/api_updateprices', { user: USER, password: PASS, oid }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Błąd HTTP: ${response.status} - ${errorText.substring(0, 200)}`);
  }
  const result = await response.json();
  if (result.result !== 'success') throw new Error(`Hotres API Error: ${JSON.stringify(result)}`);
};

/**
 * Pushes manually calculated prices from the Calculator to Hotres for multiple snapshots.
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

  const roomSnapshotMap = new Map<string, {
    room: RoomType,
    priceData: {
      dateRange: { startDate: string, endDate: string, minNights: number },
      obpLadder: { occupancy: number, channelPrices: { id: string, listPrice: number }[] }[]
    }[]
  }>();

  snapshots.forEach(snapshot => {
    snapshot.roomIds.forEach(roomId => {
      const room = rooms.find(r => r.id === roomId);
      if (!room || !room.tid) return;
      if (room.hotresSyncEnabled === false) return;

      if (!roomSnapshotMap.has(roomId)) {
        roomSnapshotMap.set(roomId, { room, priceData: [] });
      }
      roomSnapshotMap.get(roomId)!.priceData.push({
        dateRange: { startDate: snapshot.startDate, endDate: snapshot.endDate, minNights: snapshot.minNights },
        obpLadder: snapshot.obpLadder
      });
    });
  });

  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();

  roomSnapshotMap.forEach(({ room, priceData }) => {
    channels.forEach(channel => {
      if (!channel.rid || channel.rid.trim() === "") return;

      const allPriceEntries: any[] = [];
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

  const payload = Array.from(payloadMap.values());
  if (payload.length === 0) throw new Error("Brak zmapowanych kanałów (RID) dla wybranych pokoi.");

  const response = await hotresFetch('/api_updateprices', { user: USER, password: PASS, oid }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Błąd HTTP: ${response.status} - ${errorText.substring(0, 200)}`);
  }
  const result = await response.json();
  if (result.result !== 'success') throw new Error(`Hotres API Error: ${JSON.stringify(result)}`);
};

export const pushManualPriceUpdate = async (
  oid: string,
  room: RoomType,
  dateRanges: { startDate: string, endDate: string, minNights: number }[],
  channels: Channel[],
  obpLadder: { occupancy: number, channelPrices: { id: string, listPrice: number }[] }[]
): Promise<void> => {
  if (!oid) throw new Error("Brak OID obiektu.");
  if (!room.tid) throw new Error("Brak TID dla wybranego pokoju.");
  if (dateRanges.length === 0) throw new Error("Musisz dodać przynajmniej jeden zakres dat.");

  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();

  channels.forEach(channel => {
    if (!channel.rid || channel.rid.trim() === "") return;

    const maxOccRow = obpLadder.find(r => r.occupancy === room.maxOccupancy);
    if (!maxOccRow) return;
    const channelMaxPrice = maxOccRow.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
    if (channelMaxPrice === undefined) return;

    const priceEntries = dateRanges.map(range => {
      const priceEntry: any = {
        from: range.startDate,
        till: range.endDate,
        baseprice: channelMaxPrice,
        min: range.minNights,
        child: 0
      };
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
      prices: priceEntries
    });
  });

  const payload = Array.from(payloadMap.values());
  if (payload.length === 0) throw new Error("Brak zmapowanych kanałów (RID) dla tego obiektu.");

  const response = await hotresFetch('/api_updateprices', { user: USER, password: PASS, oid }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Błąd HTTP: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  if (result.result !== 'success') throw new Error(`Hotres Error: ${JSON.stringify(result)}`);
};
