
interface HotresDay {
  date: string;
  available: string; // "1" = free, "0" = booked
  reception: any;
}

interface HotresResponseItem {
  type_id: number;
  dates: HotresDay[];
}

const BASE_URL = "https://panel.hotres.pl/api_availability";
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
