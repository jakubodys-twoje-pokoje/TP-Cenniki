
import { RoomType, Season, GlobalSettings, Channel } from "../types";
import { calculateDirectPrice, calculateChannelPrice } from "./pricingEngine";

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

const USER = "admin@twojepokoje.com.pl";
const PASS = "Admin123@@";

// CHANGE: Force local proxy to true because vite.config.ts is present and configured in this environment.
// External proxies (corsproxy.io) are often unstable or blocked.
const USE_LOCAL_PROXY = true;

// Funkcja budująca poprawny URL w zależności od środowiska
const buildUrl = (endpoint: string, params: Record<string, string>) => {
  const queryString = new URLSearchParams(params).toString();
  
  if (USE_LOCAL_PROXY) {
    // LOKALNIE / DEV: Używamy proxy zdefiniowanego w vite.config.ts
    // Vite Dev Server przekieruje to do https://panel.hotres.pl
    return `/api_hotres${endpoint}?${queryString}`;
  } else {
    // PRODUKCJA (tylko jeśli build statyczny bez Vite Servera): Używamy zewnętrznego proxy
    const targetUrl = `https://panel.hotres.pl${endpoint}?${queryString}`;
    return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  }
};

const calculatePercentage = (dates: HotresDay[]): number => {
  if (!dates || dates.length === 0) return 0;
  const totalDays = dates.length;
  const bookedDays = dates.filter(day => day.available === "0").length;
  return Math.round((bookedDays / totalDays) * 100);
};

// --- API FUNCTIONS ---

export const fetchHotresOccupancy = async (
  oid: string,
  tid: string,
  startDate: string,
  endDate: string
): Promise<number> => {
  if (!oid || !tid) throw new Error("Brak konfiguracji OID lub TID");

  const url = buildUrl('/api_availability', {
    user: USER,
    password: PASS,
    oid: oid,
    type_id: tid,
    from: startDate,
    till: endDate
  });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Błąd API: ${response.status}`);

    const data: HotresResponseItem[] = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Pusta odpowiedź z API");

    const roomData = data.find(item => item.type_id === Number(tid));
    if (!roomData) throw new Error("Brak danych dla tego pokoju");

    return calculatePercentage(roomData.dates);
  } catch (error) {
    console.error("Hotres Single Fetch Error:", error);
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
    user: USER,
    password: PASS,
    oid: oid,
    from: startDate,
    till: endDate
  });

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Błąd API: ${response.status}`);

    const data: HotresResponseItem[] = await response.json();
    if (!Array.isArray(data)) return {};

    const occupancyMap: Record<string, number> = {};

    data.forEach(item => {
      if (item.type_id) {
        occupancyMap[item.type_id.toString()] = calculatePercentage(item.dates);
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

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Błąd API: ${response.status}`);

    const data: HotresRoomResponse[] = await response.json();
    if (!Array.isArray(data)) throw new Error("Nieprawidłowy format danych z Hotres (oczekiwano tablicy)");

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
    throw error;
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

  console.group("🔥 HOTRES UPDATE REQUEST DEBUG 🔥");
  console.log("Using Local Proxy:", USE_LOCAL_PROXY);
  console.log("URL:", url);
  console.groupEnd();

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
      console.error("Hotres Error Body:", errorText);
      throw new Error(`Błąd HTTP: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    console.log("🔥 HOTRES RESPONSE:", result);
    
    if (result.result !== 'success') {
       throw new Error(`Hotres API Error: ${JSON.stringify(result)}`);
    }
    
  } catch (error) {
    console.error("Hotres Update Prices Error:", error);
    throw error;
  }
};
