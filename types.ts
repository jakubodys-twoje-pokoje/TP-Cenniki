
export type SettingsTab = "global" | "rooms" | "seasons" | "channels";

export type UserRole = 'super_admin' | 'admin' | 'client';

export interface UserPermissions {
  role: UserRole;
  // If role is 'client', they can only see these property IDs.
  // If undefined/empty for client, they see nothing (or a demo).
  allowedPropertyIds?: string[]; 
}

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
  tid: string; // Type ID (replaced quantity)
  basePricePeak: number;
  minNights?: number; // Minimum number of nights
  minObpOccupancy?: number; // Minimum occupancy threshold for OBP calculation
  // Key is season.id, value is the specific base price for that season.
  // If not present, falls back to basePricePeak.
  seasonBasePrices?: Record<string, number>; 
  // Key is season.id, value is a specific comment string
  seasonComments?: Record<string, string>;
  // Key is season.id, value is the calculated occupancy percentage (0-100)
  seasonOccupancy?: Record<string, number>;
  
  // OBP Setting: Amount per person to deduct
  obpPerPerson?: number; 
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
}

export interface GlobalSettings {
  obpEnabled: boolean; // Global toggle for OBP logic
}

export interface Property {
  id: string;
  name: string;
  oid?: string; // Object ID
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
  minNights: number; // Displayed in dashboard
  seasonName: string;
  occupancy: number;
  maxOccupancy: number;
  directPrice: number;
  comment?: string;
  occupancyRate?: number; // Cached occupancy percentage
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
