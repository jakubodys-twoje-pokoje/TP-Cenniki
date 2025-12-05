import { RoomType } from "../types";

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
const USER = "admin@twojepokoje.com.pl";
const PASS = "Admin123@@";

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
    // Return empty map on error to not crash entire app flow
    return {};
  }
};

// Fetches Rooms definition from Hotres and maps to App's RoomType
export const fetchHotresRooms = async (oid: string): Promise<RoomType[]> => {
  if (!oid) throw new Error("Brak OID");

  const url = `${ROOMS_URL}?user=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}&oid=${oid}`;

  try {
    const response = await fetch(url);
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
      };
    });

  } catch (error) {
    console.error("Hotres Rooms Fetch Error:", error);
    throw error;
  }
};