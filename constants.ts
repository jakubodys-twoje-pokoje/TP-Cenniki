

import { Channel, GlobalSettings, RoomType, Season } from "./types";

export const INITIAL_SETTINGS: GlobalSettings = {
  obpEnabled: true, // Default to enabled
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
    seasonDiscounts: defaultDiscounts(10, 10, 0, 0, 0), // 10% mobile, 10% genius
    discountLabels: { ...defaultLabels }
  },
  {
    id: "airbnb",
    name: "Airbnb",
    commissionPct: 16,
    color: "#FF5A5F",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 15, 0), // Example first minute
    discountLabels: { ...defaultLabels }
  },
  {
    id: "noclegi",
    name: "Noclegi.pl",
    commissionPct: 12,
    color: "#34D399",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 0, 0),
    discountLabels: { ...defaultLabels }
  },
  {
    id: "noclegowo",
    name: "Noclegowo",
    commissionPct: 10,
    color: "#FBBF24",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 0, 0),
    discountLabels: { ...defaultLabels }
  },
];

export const INITIAL_ROOMS: RoomType[] = [
  { id: "1", name: "Pokój", maxOccupancy: 2, tid: "", basePricePeak: 200, minObpOccupancy: 1, obpPerPerson: 30 },
  { id: "2", name: "Studio", maxOccupancy: 3, tid: "", basePricePeak: 300, minObpOccupancy: 2, obpPerPerson: 30 },
  { id: "3", name: "Domek", maxOccupancy: 6, tid: "", basePricePeak: 600, minObpOccupancy: 3, obpPerPerson: 30 },
];

export const INITIAL_SEASONS: Season[] = [
  {
    id: "s1",
    name: "Majówka",
    rid: "",
    startDate: "2025-05-01",
    endDate: "2025-05-05",
    multiplier: 1.1,
    minNights: 4,
  },
  {
    id: "s2",
    name: "Przed szczytem",
    rid: "",
    startDate: "2025-05-06",
    endDate: "2025-06-25",
    multiplier: 0.85,
    minNights: 2,
  },
  {
    id: "s3",
    name: "Open'er Festival",
    rid: "",
    startDate: "2025-06-26",
    endDate: "2025-07-02",
    multiplier: 1.5,
    minNights: 4,
  },
  {
    id: "s4",
    name: "Szczyt (Lipiec/Sierpień)",
    rid: "",
    startDate: "2025-07-03",
    endDate: "2025-08-17",
    multiplier: 1.0,
    minNights: 5,
  },
  {
    id: "s5",
    name: "Koniec Wakacji",
    rid: "",
    startDate: "2025-08-18",
    endDate: "2025-08-31",
    multiplier: 0.9,
    minNights: 3,
  },
];