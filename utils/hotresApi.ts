

import { RoomType, Season, GlobalSettings } from "../types";
import { calculateDirectPrice } from "./pricingEngine";

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
  code: string; // Used as name
  single: string; // "0" or "1" etc
  double: string;
  sofa: string;
  sofa_single: string;
}

const BASE_URL = "https://panel.hotres.pl/api_availability";
const ROOMS_URL = "https://panel.hotres.pl/api_rooms";
const UPDATE_PRICES_URL = "https://panel.hotres.pl/api_updateprices";
const USER = "admin@twojepokoje.com.pl";
const PASS = "Admin123@@";

// Using CodeTabs proxy which is often more reliable for simple JSON forwarding
const PROXY_URL = "https://api.codetabs.com/v1/proxy?quest=";

const fetchWithProxy = async (url: string, options?: RequestInit) => {
  // CodeTabs requires the target URL to be appended. 
  // Note: API keys passed in URL parameters are visible to the proxy owner.
  const proxiedUrl = PROXY_URL + encodeURIComponent(url);
  return fetch(proxiedUrl, options);
};

// Helper to calculate percentage from dates array
const calculatePercentage = (dates: HotresDay[]): number => {
  if (!dates || dates.length === 0) return 0;
  const totalDays = dates.length;
  // Count days where available is "0" (Booked)
  const bookedDays = dates.filter(day => day.available === "0").length;
  return Math.round((bookedDays / totalDays) * 100);
};

// Fetches occupancy for a single room (Specific TID)
export const fetchHotresOccupancy = async (
  oid: string,
  tid: string,
  startDate: string,
  endDate: string
): Promise<number> => {
  if (!oid || !tid) throw new Error("Brak konfiguracji OID lub TID");

  const url = `${BASE_URL}?user=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&oid=${oid}&type_id=${tid}&from=${startDate}&till=${endDate}`;

  try {
    const response = await fetchWithProxy(url);
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

// Fetches occupancy for ALL rooms in a given season (No TID)
// Returns a map where key is TID (string) and value is Occupancy % (number)
export const fetchSeasonOccupancyMap = async (
  oid: string,
  startDate: string,
  endDate: string
): Promise<Record<string, number>> => {
  if (!oid) throw new Error("Brak OID");

  // Call without type_id to get all rooms
  const url = `${BASE_URL}?user=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&oid=${oid}&from=${startDate}&till=${endDate}`;

  try {
    const response = await fetchWithProxy(url);
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
    // Return empty map on error to not crash entire app flow
    return {};
  }
};

// Fetches Rooms definition from Hotres and maps to App's RoomType
export const fetchHotresRooms = async (oid: string): Promise<RoomType[]> => {
  if (!oid) throw new Error("Brak OID");

  const url = `${ROOMS_URL}?user=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&oid=${oid}`;

  try {
    const response = await fetchWithProxy(url);
    if (!response.ok) throw new Error(`Błąd API: ${response.status}`);

    const data: HotresRoomResponse[] = await response.json();
    if (!Array.isArray(data)) throw new Error("Nieprawidłowy format danych z Hotres (oczekiwano tablicy)");

    return data.map((item, index) => {
      // Calculate Max Occupancy based on logic:
      // single * 1 + double * 2 + sofa * 2 + sofa_single * 1
      const single = parseInt(item.single) || 0;
      const double = parseInt(item.double) || 0;
      const sofa = parseInt(item.sofa) || 0;
      const sofaSingle = parseInt(item.sofa_single) || 0;

      const maxOccupancy = (single * 1) + (double * 2) + (sofa * 2) + (sofaSingle * 1);

      return {
        id: Date.now().toString() + index, // Generate temporary unique ID
        name: item.code || `Pokój ${item.type_id}`, // "code - nazwa pokoju"
        maxOccupancy: maxOccupancy > 0 ? maxOccupancy : 2, // Default to 2 if calc fails
        tid: item.type_id.toString(),
        basePricePeak: 300, // Default base price
        minObpOccupancy: 1, // Default to 1 person min
        obpPerPerson: 30, // Default OBP amount
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
  settings: GlobalSettings
): Promise<void> => {
  if (!oid) throw new Error("Brak OID obiektu.");

  // Build Payload
  const payload: any[] = [];

  // Filter only rooms that have TID and seasons that have RID
  const validRooms = rooms.filter(r => r.tid && r.tid.trim() !== "");
  const validSeasons = seasons.filter(s => s.rid && s.rid.trim() !== "");

  if (validRooms.length === 0) throw new Error("Brak pokoi ze zdefiniowanym TID (Hotres Type ID).");
  if (validSeasons.length === 0) throw new Error("Brak sezonów ze zdefiniowanym RID (Hotres Rate ID).");

  validRooms.forEach(room => {
    validSeasons.forEach(season => {
      // Base price is usually calculated for MAX occupancy
      const basePrice = calculateDirectPrice(room, season, room.maxOccupancy, settings);

      // Create price period entry
      const priceEntry: any = {
        from: season.startDate,
        till: season.endDate,
        baseprice: basePrice,
        min: season.minNights || 1,
        // Default flags (ignored but good practice if needed later)
        cta: 0,
        ctd: 0
      };

      // Fill pers1, pers2, ... pers8 based on max occupancy
      // Logic: pers{N} is price for N people.
      for (let i = 1; i <= room.maxOccupancy; i++) {
        // Limit to 8 as per API spec, though standard hotels rarely exceed this
        if (i > 8) break;
        const obpPrice = calculateDirectPrice(room, season, i, settings);
        priceEntry[`pers${i}`] = obpPrice;
      }

      // Construct item for this room-season combination
      payload.push({
        type_id: parseInt(room.tid),
        rate_id: parseInt(season.rid!),
        mode: "delta",
        prices: [priceEntry]
      });
    });
  });

  if (payload.length === 0) throw new Error("Brak danych do wysłania.");

  // Prepare URL parameters
  const params = new URLSearchParams({
    user: USER,
    password: PASS,
    oid: oid
  });

  const url = `${UPDATE_PRICES_URL}?${params.toString()}`;

  try {
    // For updateprices, we are sending POST data. CodeTabs supports this if we use fetch options.
    // However, sending complex JSON via GET proxy is tricky.
    // Let's try sending standard POST through the proxy.
    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // If proxy fails with 404, it might mean the proxy service is down or doesn't allow POST.
      // But usually CodeTabs allows it.
      throw new Error(`Błąd HTTP (Proxy/Hotres): ${response.status}`);
    }

    const result = await response.json();
    
    // Check Hotres specific error structure
    if (result.result !== 'success') {
       throw new Error(`Hotres API Error: ${JSON.stringify(result)}`);
    }
    
  } catch (error) {
    console.error("Hotres Update Prices Error:", error);
    throw error;
  }
};
