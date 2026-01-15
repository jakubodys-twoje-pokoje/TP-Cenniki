
import { RoomType, Season, GlobalSettings, Channel } from "../types";
import { calculateDirectPrice, calculateChannelPrice } from "./pricingEngine";

// --- API CREDENTIALS ---
const USER = "admin@twojepokoje.com.pl";
const PASS = "Admin123@@";
const USE_LOCAL_PROXY = false;

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
  const queryString = new URLSearchParams(params).toString();
  if (USE_LOCAL_PROXY) {
    return `/api_hotres${endpoint}?${queryString}`;
  } else {
    const targetUrl = `https://panel.hotres.pl${endpoint}?${queryString}`;
    return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  }
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

  const url = buildUrl('/api_availability', {
    user: USER, password: PASS, oid: oid, type_id: tid, from: startDate, till: endDate
  });

  try {
    const response = await fetch(url);
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

  const url = buildUrl('/api_availability', {
    user: USER, password: PASS, oid: oid, from: startDate, till: endDate
  });

  try {
    const response = await fetch(url);
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

  const url = buildUrl('/api_rooms', {
    user: USER,
    password: PASS,
    oid: oid
  });

  console.log('Fetching Hotres rooms from:', url);

  try {
    const response = await fetch(url);
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

  const payload = Array.from(payloadMap.values());
  if (payload.length === 0) throw new Error("Brak danych do wysłania.");

  const url = buildUrl('/api_updateprices', {
    user: USER,
    password: PASS,
    oid: oid
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd HTTP: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    
    if (result.result !== 'success') {
       throw new Error(`Hotres API Error: ${JSON.stringify(result)}`);
    }
    
  } catch (error) {
    console.error("Hotres Update Prices Error:", error);
    throw error;
  }
};

/**
 * Pushes manually calculated prices from the Calculator to Hotres for a specific date range.
 * Does NOT update the internal database state.
 */
export const pushManualPriceUpdate = async (
  oid: string,
  room: RoomType,
  startDate: string,
  endDate: string,
  channels: Channel[],
  // Data from calculator
  obpLadder: { occupancy: number, channelPrices: { id: string, listPrice: number }[] }[],
  minNights: number
): Promise<void> => {
  if (!oid) throw new Error("Brak OID obiektu.");
  if (!room.tid) throw new Error("Brak TID dla wybranego pokoju.");

  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();
  
  // Iterate only through channels that have a valid RID and are present in the calculation
  channels.forEach(channel => {
    if (!channel.rid || channel.rid.trim() === "") return;

    // Get Base Price (Usually Max Occupancy price)
    // In Hotres logic, 'baseprice' often acts as the standard rate or max occupancy rate depending on config.
    // Here we take the price for Max Occupancy from the ladder.
    const maxOccRow = obpLadder.find(r => r.occupancy === room.maxOccupancy);
    if (!maxOccRow) return;

    const channelMaxPrice = maxOccRow.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
    if (channelMaxPrice === undefined) return;

    const priceEntry: any = {
      from: startDate,
      till: endDate,
      baseprice: channelMaxPrice,
      min: minNights,
      child: 0
    };

    // Add per-person prices from the ladder
    obpLadder.forEach(row => {
       const cPrice = row.channelPrices.find(cp => cp.id === channel.id)?.listPrice;
       if (cPrice !== undefined && row.occupancy <= 8) {
          priceEntry[`pers${row.occupancy}`] = cPrice;
       }
    });

    const key = `${room.tid}-${channel.rid}`;
    payloadMap.set(key, {
      type_id: parseInt(room.tid),
      rate_id: parseInt(channel.rid),
      mode: "delta",
      prices: [priceEntry]
    });
  });

  const payload = Array.from(payloadMap.values());
  if (payload.length === 0) throw new Error("Brak zmapowanych kanałów (RID) dla tego obiektu.");

  const url = buildUrl('/api_updateprices', {
    user: USER,
    password: PASS,
    oid: oid
  });

  try {
    const response = await fetch(url, {
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
