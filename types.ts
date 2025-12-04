export interface Channel {
  id: string;
  name: string;
  commissionPct: number; // 0-100
  mobileDiscountPct: number; // 0-100
  seasonalDiscountPct: number; // 0-100
  additionalDiscountPct: number; // 0-100
  color: string;
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

export interface PricingRow {
  roomName: string;
  seasonName: string;
  occupancy: number;
  directPrice: number;
  channelCalculations: Record<string, ChannelCalculation>;
}

export interface ChannelCalculation {
  listPrice: number;
  estimatedNet: number;
  commission: number;
  isProfitable: boolean; // net >= direct
}
