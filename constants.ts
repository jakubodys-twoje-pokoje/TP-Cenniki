import { Channel, GlobalSettings, RoomType, Season } from "./types";

export const INITIAL_SETTINGS: GlobalSettings = {
  defaultObp: 30,
};

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: "booking",
    name: "Booking.com",
    commissionPct: 20,
    mobileDiscountPct: 10,
    seasonalDiscountPct: 0,
    additionalDiscountPct: 0,
    color: "#003580",
  },
  {
    id: "airbnb",
    name: "Airbnb",
    commissionPct: 16,
    mobileDiscountPct: 0,
    seasonalDiscountPct: 0,
    additionalDiscountPct: 0,
    color: "#FF5A5F",
  },
  {
    id: "noclegi",
    name: "Noclegi.pl",
    commissionPct: 12,
    mobileDiscountPct: 0,
    seasonalDiscountPct: 0,
    additionalDiscountPct: 0,
    color: "#34D399",
  },
  {
    id: "noclegowo",
    name: "Noclegowo",
    commissionPct: 10,
    mobileDiscountPct: 0,
    seasonalDiscountPct: 0,
    additionalDiscountPct: 0,
    color: "#FBBF24",
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
    obpEnabled: true,
  },
  {
    id: "s2",
    name: "Przed szczytem",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    multiplier: 0.85,
    obpEnabled: true,
  },
  {
    id: "s3",
    name: "Majówka",
    startDate: "2024-05-01",
    endDate: "2024-05-05",
    multiplier: 1.1,
    obpEnabled: false,
  },
];
