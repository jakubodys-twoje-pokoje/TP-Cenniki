
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

// Strict check for localhost.
// import.meta.env.DEV can be unreliable depending on build tools/preview modes.
const IS_LOCALHOST = 
  typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Funkcja budująca poprawny URL w zależności od środowiska
const buildUrl = (endpoint: string, params: Record<string, string>) => {
  const queryString = new URLSearchParams(params).toString();
  
  if (IS_LOCALHOST) {
    // LOKALNIE: Używamy proxy zdefiniowanego w vite.config.ts
    // Zapytanie idzie do http://localhost:5173/api_hotres/... -> Vite przekazuje do https://panel.hotres.pl/...
    return `/api_hotres${endpoint}?${queryString}`;
  } else {
    // PRODUKCJA: Używamy zewnętrznego proxy, aby ominąć CORS na serwerze docelowym.
    // Zapytanie idzie bezpośrednio do panel.hotres.pl przez corsproxy.io
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

  // Group payload by "type_id + rate_id" to match Hotres API structure
  // Key: typeId_rateId, Value: Payload Object
  const payloadMap = new Map<string, { type_id: number, rate_id: number, mode: string, prices: any[] }>();

  const validRooms = rooms.filter(r => r.tid && r.tid.trim() !== "");
  
  // Filter channels that have a RID configured
  const validChannels = channels.filter(c => c.rid && c.rid.trim() !== "");

  if (validRooms.length === 0) throw new Error("Brak pokoi ze zdefiniowanym TID.");
  if (validChannels.length === 0) throw new Error("Brak kanałów ze zdefiniowanym RID.");

  validRooms.forEach(room => {
    // Iterate over ALL seasons (previously we filtered by season.channelRids)
    seasons.forEach(season => {
      
      validChannels.forEach(channel => {
         // Use the Global Channel RID
         const channelRid = channel.rid;
         
         if (channelRid) {
            // Calculate "List Price" for the channel
            
            const directBasePrice = calculateDirectPrice(room, season, room.maxOccupancy, settings);
            const channelBaseCalc = calculateChannelPrice(directBasePrice, channel, season.id);
            
            const priceEntry: any = {
              from: season.startDate,
              till: season.endDate,
              baseprice: channelBaseCalc.listPrice, // Send inflated price
              min: season.minNights || 1,
              child: 0
            };

            // Calculate OBP List Prices for Channel
            for (let i = 1; i <= room.maxOccupancy; i++) {
              if (i > 8) break;
              // Get direct price for 'i' people
              const directP = calculateDirectPrice(room, season, i, settings);
              // Convert to Channel List Price
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

  // Convert Map to Array
  const payload = Array.from(payloadMap.values());

  if (payload.length === 0) throw new Error("Brak danych do wysłania (sprawdź TID pokoi oraz RID kanałów).");

  const url = buildUrl('/api_updateprices', {
    user: USER,
    password: PASS,
    oid: oid
  });

  // --- DEBUG LOGGING START ---
  console.group("🔥 HOTRES UPDATE REQUEST DEBUG (MULTI-CHANNEL) 🔥");
  console.log("Environment:", IS_LOCALHOST ? "LOCALHOST (Vite Proxy)" : "PRODUCTION (CORS Proxy)");
  console.log("Full URL:", url); 
  console.log("Method: POST");
  console.log("Payload Groups:", payload.length);
  console.log("Payload Size:", JSON.stringify(payload).length, "bytes");
  console.log("Payload Preview (First Item):", payload[0]);
  console.groupEnd();
  // --- DEBUG LOGGING END ---

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
