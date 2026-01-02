
export type SettingsTab = "global" | "rooms" | "seasons" | "channels" | "variants";

export type UserRole = 'super_admin' | 'admin' | 'client';

export interface UserPermissions {
  role: UserRole;
  allowedPropertyIds?: string[]; 
}

export interface DbUserRole {
  email: string;
  role: UserRole;
  allowed_property_ids: string[];
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

export interface ChannelDiscountLabels {
  mobile: string;
  genius: string;
  seasonal: string;
  firstMinute: string;
  lastMinute: string;
}

export interface Channel {
  id: string;
  name: string;
  commissionPct: number;
  color: string;
  rid?: string; 
  seasonDiscounts: Record<string, ChannelDiscountProfile>;
  discountLabels?: ChannelDiscountLabels;
}

export interface RoomType {
  id: string;
  name: string;
  maxOccupancy: number;
  tid: string;
  basePricePeak: number;
  minObpOccupancy?: number;
  seasonBasePrices?: Record<string, number>; 
  seasonComments?: Record<string, string>;
  seasonOccupancy?: Record<string, number>;
  obpPerPerson?: number; 
  seasonalObpActive?: Record<string, boolean>;
  sortOrder?: number;
}

export interface Season {
  id: string;
  name: string;
  channelRids?: Record<string, string>; 
  rid?: string; 
  startDate: string;
  endDate: string;
  multiplier: number;
  minNights?: number;
}

export interface GlobalSettings {
  obpEnabled: boolean;
}

export interface Variant {
  id: string;
  name: string;
  rooms: RoomType[];
  seasons: Season[];
  channels: Channel[];
  settings: GlobalSettings;
  notes?: string;
  isLocked?: boolean;
}

export interface Property {
  id: string;
  name: string;
  oid?: string; 
  variants: Variant[];
  activeVariantId: string;
  sortOrder?: number;
}

export interface PricingRow {
  roomId: string;
  seasonId: string;
  roomName: string;
  basePrice: number;
  minNights: number;
  seasonName: string;
  occupancy: number;
  maxOccupancy: number;
  directPrice: number;
  comment?: string;
  occupancyRate?: number;
  channelCalculations: Record<string, ChannelCalculation>;
}

export interface ChannelCalculation {
  listPrice: number;
  estimatedNet: number;
  commission: number;
  isProfitable: boolean;
  discountBreakdown: {
    mobile: number;
    genius: number;
    seasonal: number;
    firstMinute: number;
    lastMinute: number;
  };
  discountPercentages: {
    mobile: number;
    genius: number;
    seasonal: number;
    firstMinute: number;
    lastMinute: number;
  };
  pif5?: number;
  pif10?: number;
  pif10Direct?: number;
  pif5Direct?: number;
}
