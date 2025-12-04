
import { Channel, GlobalSettings, RoomType, Season } from "./types";

export const INITIAL_SETTINGS: GlobalSettings = {
  seasonalObp: {
    "s1": { amount: 30, enabled: true },
    "s2": { amount: 30, enabled: true },
    "s3": { amount: 30, enabled: false }, // Disabled for Majówka by default example
  }
};

// Helper to create default discount map for initial seasons
// Now supports 5 specific discount types
const defaultDiscounts = (
  mobile: number = 0, 
  genius: number = 0, 
  seasonal: number = 0, 
  firstMinute: number = 0, 
  lastMinute: number = 0
) => ({
  "s1": { 
    mobile, mobileEnabled: true, 
    genius, geniusEnabled: true,
    seasonal, seasonalEnabled: true,
    firstMinute, firstMinuteEnabled: true,
    lastMinute, lastMinuteEnabled: true,
  },
  "s2": { 
    mobile, mobileEnabled: true, 
    genius, geniusEnabled: true,
    seasonal, seasonalEnabled: true,
    firstMinute, firstMinuteEnabled: true,
    lastMinute, lastMinuteEnabled: true,
  },
  "s3": { 
    mobile, mobileEnabled: true, 
    genius, geniusEnabled: true,
    seasonal, seasonalEnabled: true,
    firstMinute, firstMinuteEnabled: true,
    lastMinute, lastMinuteEnabled: true,
  },
});

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
  { id: "1", name: "Pokój", maxOccupancy: 2, quantity: 5, basePricePeak: 200 },
  { id: "2", name: "Studio", maxOccupancy: 3, quantity: 3, basePricePeak: 300 },
  { id: "3", name: "Domek", maxOccupancy: 6, quantity: 2, basePricePeak: 600 },
];

export const INITIAL_SEASONS: Season[] = [
  {
    id: "s1",
    name: "Szczyt",
    startDate: "2024-07-01",
    endDate: "2024-08-31",
    multiplier: 1.0,
  },
  {
    id: "s2",
    name: "Przed szczytem",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    multiplier: 0.85,
  },
  {
    id: "s3",
    name: "Majówka",
    startDate: "2024-05-01",
    endDate: "2024-05-05",
    multiplier: 1.1,
  },
];
