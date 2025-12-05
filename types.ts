
export type SettingsTab = "global" | "rooms" | "seasons" | "channels";

export interface ChannelDiscountProfile {
  mobile: number;
  mobileEnabled: boolean;
  genius: number;
  geniusEnabled: boolean;
  seasonal: number;
  seasonalEnabled: boolean;
  firstMinute: number; 
  firstMinuteEnabled: boolean;
  lastMinute: number; 
  lastMinuteEnabled: boolean;
}

export interface Channel {
  id: string;
  name: string;
  commissionPct: number; // 0-100
  color: string;
  // Key is season.id, value is the discount profile
  seasonDiscounts: Record<string, ChannelDiscountProfile>;
}

export interface RoomType {
  id: string;
  name: string;
  maxOccupancy: number;
  quantity: number;
  basePricePeak: number;
  // Key is season.id, value is the specific base price for that season.
  // If not present, falls back to basePricePeak.
  seasonBasePrices?: Record<string, number>; 
  // Key is season.id, value is a specific comment string
  seasonComments?: Record<string, string>;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
}

export interface GlobalSettings {
  // Key is season.id, value is OBP config
  seasonalObp: Record<string, { amount: number; enabled: boolean }>;
}

export interface Property {
  id: string;
  name: string;
  settings: GlobalSettings;
  channels: Channel[];
  rooms: RoomType[];
  seasons: Season[];
  notes?: string;
}

export interface PricingRow {
  roomId: string;
  seasonId: string;
  roomName: string;
  basePrice: number;
  seasonName: string;
  occupancy: number;
  maxOccupancy: number;
  directPrice: number;
  comment?: string;
  channelCalculations: Record<string, ChannelCalculation>;
}

export interface ChannelCalculation {
  listPrice: number;
  estimatedNet: number;
  commission: number;
  isProfitable: boolean; // net >= directPrice
  discountBreakdown: {
    mobile: number;
    genius: number;
    seasonal: number;
    firstMinute: number;
    lastMinute: number;
  }
}