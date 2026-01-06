
export type SettingsTab = "global" | "rooms" | "seasons" | "channels" | "profiles";

export type UserRole = 'super_admin' | 'admin' | 'client';

export interface UserPermissions {
  role: UserRole;
  // If role is 'client', they can only see these property IDs.
  // If undefined/empty for client, they see nothing (or a demo).
  allowedPropertyIds?: string[]; 
}

// Interface matching the Supabase 'user_roles' table
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

// Per-season room configuration (overrides global defaults)
export interface SeasonalRoomConfig {
  obpPerPerson?: number;          // Override OBP amount for this season
  minObpOccupancy?: number;       // Override min occupancy threshold for this season
  foodBreakfastPrice?: number;    // Override breakfast price for this season
  foodFullPrice?: number;         // Override full board price for this season
}

export interface Channel {
  id: string;
  name: string;
  commissionPct: number; // 0-100
  color: string;
  // Global Rate ID for this channel in Hotres
  rid?: string; 
  // Key is season.id, value is the discount profile
  seasonDiscounts: Record<string, ChannelDiscountProfile>;
  // Custom labels for the discount columns
  discountLabels?: ChannelDiscountLabels;
}

export interface RoomType {
  id: string;
  name: string;
  maxOccupancy: number;
  tid: string; // Type ID (replaced quantity)
  basePricePeak: number;
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

  // OBP Setting: Active per season (Key: season.id, Value: boolean)
  seasonalObpActive?: Record<string, boolean>;

  // Food (Wyżywienie) Settings: Prices for breakfast and full board
  foodBreakfastPrice?: number;
  foodFullPrice?: number;

  // Food Setting: Which option is active per season (Key: season.id, Value: 'breakfast' | 'full' | 'none')
  seasonalFoodOption?: Record<string, 'breakfast' | 'full' | 'none'>;

  // NEW: Per-season configuration overrides (takes precedence over global values)
  // Key: season.id, Value: season-specific config
  seasonalConfig?: Record<string, SeasonalRoomConfig>;

  // Sorting order
  sortOrder?: number;
}

export interface Season {
  id: string;
  name: string;
  // DEPRECATED: channelRids is no longer used, we use Channel.rid instead.
  // Kept temporarily for type safety during migration if needed, but logic ignores it.
  channelRids?: Record<string, string>; 
  rid?: string; // DEPRECATED: Kept for migration safety
  startDate: string;
  endDate: string;
  multiplier: number;
  minNights?: number; // Global minimum nights for this season
}

export interface GlobalSettings {
  obpEnabled: boolean; // Global toggle for OBP logic
  foodEnabled: boolean; // Global toggle for food pricing (wyżywienie)
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isDefault?: boolean;

  // All pricing configuration lives at profile level
  settings: GlobalSettings;
  channels: Channel[];
  rooms: RoomType[];
  seasons: Season[];
}

export interface Property {
  id: string;
  name: string;
  oid?: string; // Object ID

  // NEW: Profiles array (primary data structure)
  profiles: Profile[];

  // DEPRECATED: Kept temporarily for backward compatibility during migration
  settings?: GlobalSettings;
  channels?: Channel[];
  rooms?: RoomType[];
  seasons?: Season[];

  notes?: string;
  sortOrder?: number;
}

export interface PricingRow {
  roomId: string;
  seasonId: string;
  roomName: string;
  basePrice: number;
  minNights: number; // Displayed in dashboard (sourced from Season)
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
  };
  discountPercentages: {
    mobile: number;
    genius: number;
    seasonal: number;
    firstMinute: number;
    lastMinute: number;
  };
  // Booking.com Pay In Full variations (Calculated from List Price)
  pif5?: number; // 5% discount
  pif10?: number; // 10% discount
  
  // Pay In Full variations (Calculated from Direct Price)
  pif10Direct?: number;
  pif5Direct?: number;
}
