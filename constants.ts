import { Channel, GlobalSettings, RoomType, Season } from "./types";

export const INITIAL_SETTINGS: GlobalSettings = {
  seasonalObp: {
    "s1": { amount: 30, enabled: true },
    "s2": { amount: 30, enabled: true },
    "s3": { amount: 30, enabled: false }, 
    "s4": { amount: 30, enabled: true }, 
    "s5": { amount: 30, enabled: true },
  }
};

// Helper to create default discount map for initial seasons
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
    "s1": defaults, // Majówka
    "s2": defaults, // Czerwiec
    "s3": defaults, // Open'er (High demand, maybe different?)
    "s4": defaults, // Wysoki Sezon
    "s5": defaults, // Festiwal Sopot
  };
};

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: "booking",
    name: "Booking.com",
    commissionPct: 20,
    color: "#003580",
    seasonDiscounts: defaultDiscounts(10, 10, 0, 0, 0), // 10% mobile, 10% genius
  },
  {
    id: "airbnb",
    name: "Airbnb",
    commissionPct: 16,
    color: "#FF5A5F",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 15, 0), // Example first minute
  },
  {
    id: "noclegi",
    name: "Noclegi.pl",
    commissionPct: 12,
    color: "#34D399",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 0, 0),
  },
  {
    id: "noclegowo",
    name: "Noclegowo",
    commissionPct: 10,
    color: "#FBBF24",
    seasonDiscounts: defaultDiscounts(0, 0, 0, 0, 0),
  },
];

export const INITIAL_ROOMS: RoomType[] = [
  { id: "1", name: "Pokój", maxOccupancy: 2, tid: "", basePricePeak: 200 },
  { id: "2", name: "Studio", maxOccupancy: 3, tid: "", basePricePeak: 300 },
  { id: "3", name: "Domek", maxOccupancy: 6, tid: "", basePricePeak: 600 },
];

export const INITIAL_SEASONS: Season[] = [
  {
    id: "s1",
    name: "Majówka",
    startDate: "2024-05-01",
    endDate: "2024-05-05",
    multiplier: 1.1,
  },
  {
    id: "s2",
    name: "Czerwiec",
    startDate: "2024-06-01",
    endDate: "2024-06-25",
    multiplier: 0.85,
  },
  {
    id: "s3",
    name: "Open'er",
    startDate: "2024-06-26",
    endDate: "2024-07-02",
    multiplier: 1.3, // High demand
  },
  {
    id: "s4",
    name: "Wysoki Sezon",
    startDate: "2024-07-03",
    endDate: "2024-08-17",
    multiplier: 1.0,
  },
  {
    id: "s5",
    name: "Festiwal",
    startDate: "2024-08-18",
    endDate: "2024-08-31",
    multiplier: 1.2, // High demand
  }
];