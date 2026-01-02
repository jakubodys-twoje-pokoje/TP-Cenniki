
import { Channel, GlobalSettings, Profile, RoomType, Season } from "./types";

export const INITIAL_SETTINGS: GlobalSettings = {
  obpEnabled: true, // Default to enabled
  foodEnabled: false, // Default to disabled for backward compatibility
};

// Helper to create default discount map for initial seasons
// Now supports 5 specific discount types
const defaultDiscounts = (
  mobile: number = 0, 
  genius: number = 0, 
  seasonal: number = 0, 
  firstMinute: number = 0, 
  lastMinute: number = 0
) => {
  const defaults = { 
    mobile, mobileEnabled: true, 
    genius, geniusEnabled: true,
    seasonal, seasonalEnabled: true,
    firstMinute, firstMinuteEnabled: true,
    lastMinute, lastMinuteEnabled: true,
  };
  return {
    "s1": { ...defaults },
    "s2": { ...defaults },
    "s3": { ...defaults },
    "s4": { ...defaults },
    "s5": { ...defaults },
  };
};

const defaultLabels = {
  mobile: "Mobile",
  genius: "Genius",
  seasonal: "Sezon",
  firstMinute: "First Min",
  lastMinute: "Last Min",
};

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: "booking",
    name: "Booking.com",
    commissionPct: 20,
    color: "#003580",
    rid: "",
    seasonDiscounts: defaultDiscounts(10, 10, 0, 0, 0), // 10% mobile, 10% genius
    discountLabels: { ...defaultLabels }
  },
  {
    id: "airbnb",
    name: "Airbnb",
    commissionPct: 16,
    color: "#FF5A5F",
    rid: "",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 15, 0), // Example first minute
    discountLabels: { ...defaultLabels }
  },
  {
    id: "noclegi",
    name: "Noclegi.pl",
    commissionPct: 12,
    color: "#34D399",
    rid: "",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 0, 0),
    discountLabels: { ...defaultLabels }
  },
  {
    id: "noclegowo",
    name: "Noclegowo",
    commissionPct: 10,
    color: "#FBBF24",
    rid: "",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 0, 0),
    discountLabels: { ...defaultLabels }
  },
];

export const INITIAL_ROOMS: RoomType[] = [
  { id: "1", name: "Pokój", maxOccupancy: 2, tid: "", basePricePeak: 200, minObpOccupancy: 1, obpPerPerson: 30, foodBreakfastPrice: 50, foodFullPrice: 100 },
  { id: "2", name: "Studio", maxOccupancy: 3, tid: "", basePricePeak: 300, minObpOccupancy: 2, obpPerPerson: 30, foodBreakfastPrice: 50, foodFullPrice: 100 },
  { id: "3", name: "Domek", maxOccupancy: 6, tid: "", basePricePeak: 600, minObpOccupancy: 3, obpPerPerson: 30, foodBreakfastPrice: 50, foodFullPrice: 100 },
];

export const INITIAL_SEASONS: Season[] = [
  {
    id: "s1",
    name: "Majówka",
    startDate: "2025-05-01",
    endDate: "2025-05-05",
    multiplier: 1.1,
    minNights: 4,
  },
  {
    id: "s2",
    name: "Przed szczytem",
    startDate: "2025-05-06",
    endDate: "2025-06-25",
    multiplier: 0.85,
    minNights: 2,
  },
  {
    id: "s3",
    name: "Open'er Festival",
    startDate: "2025-06-26",
    endDate: "2025-07-02",
    multiplier: 1.5,
    minNights: 4,
  },
  {
    id: "s4",
    name: "Szczyt (Lipiec/Sierpień)",
    startDate: "2025-07-03",
    endDate: "2025-08-17",
    multiplier: 1.0,
    minNights: 5,
  },
  {
    id: "s5",
    name: "Koniec Wakacji",
    startDate: "2025-08-18",
    endDate: "2025-08-31",
    multiplier: 0.9,
    minNights: 3,
  },
];

// Helper to create a deep clone of an object
const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Create a default profile with initial data
export const createDefaultProfile = (): Profile => ({
  id: "default",
  name: "Domyślny",
  description: "Standardowy cennik",
  sortOrder: 0,
  isDefault: true,
  settings: { ...INITIAL_SETTINGS },
  channels: deepClone(INITIAL_CHANNELS),
  rooms: deepClone(INITIAL_ROOMS),
  seasons: deepClone(INITIAL_SEASONS),
});
