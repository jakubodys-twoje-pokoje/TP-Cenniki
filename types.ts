
export type SettingsTab = "global" | "rooms" | "seasons" | "channels";

export interface ChannelDiscountProfile {
  mobile: number;
  mobileEnabled: boolean;
  seasonal: number;
  seasonalEnabled: boolean;
  additional1: number; // Renamed from additional
  additional1Enabled: boolean;
  additional2: number; // New second additional discount
  additional2Enabled: boolean;
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
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
  obpEnabled: boolean; // Occupancy Based Pricing
}

export interface GlobalSettings {
  defaultObp: number; // Price reduction per person
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
  isProfitable: boolean; // net >= direct
}