
export type SettingsTab = "global" | "rooms" | "seasons" | "channels";

export interface ChannelDiscountProfile {
  mobile: number;
  mobileEnabled: boolean;
  seasonal: number;
  seasonalEnabled: boolean;
  additional1: number; 
  additional1Enabled: boolean;
  additional2: number; 
  additional2Enabled: boolean;
  obpAmount: number; // NEW: OBP specific to channel/season
  obpEnabled: boolean; // NEW
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
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
  // obpEnabled removed from here
}

export interface GlobalSettings {
  // defaultObp removed from here
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
  channelCalculations: Record<string, ChannelCalculation>;
}

export interface ChannelCalculation {
  listPrice: number;
  estimatedNet: number;
  commission: number;
  isProfitable: boolean; // net >= targetNet (direct adjusted by OBP)
}
