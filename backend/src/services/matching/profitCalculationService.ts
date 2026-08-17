import { config } from "../../config/index.js";

export type ProfitBreakdown = {
  grossRevenue: number;
  estimatedFuelCost: number;
  estimatedToll: number;
  driverCost: number;
  platformFee: number;
  netProfit: number;
  profitPerKm: number;
};

export type ImpactMetrics = {
  emptyKmWithoutTruckTrade: number;
  emptyKmWithTruckTrade: number;
  emptyKmSaved: number;
  fuelSaved: number;
  estimatedCO2Saved: number;
};

const FUEL_PER_KM = 0.15; // litres
const CO2_PER_LITRE = 2.35;

export async function getPlatformFeePercent(): Promise<number> {
  const setting = await import("../../config/database.js").then(({ prisma }) =>
    prisma.platformSetting.findUnique({ where: { key: "platform_fee_percent" } }),
  );
  return setting ? parseFloat(setting.value) : config.platform.feePercent;
}

export function calculateProfit(params: {
  loadRevenue: number;
  emptyTripKm: number;
  loadedKm: number;
  platformFeePercent?: number;
}): ProfitBreakdown {
  const feePercent = params.platformFeePercent ?? config.platform.feePercent;
  const grossRevenue = params.loadRevenue;
  const totalKm = params.emptyTripKm + params.loadedKm;
  const estimatedFuelCost = Math.round(totalKm * config.platform.fuelCostPerKm);
  const estimatedToll = Math.round(params.loadedKm * config.platform.tollCostPerKm);
  const driverCost = Math.round(params.loadedKm * config.platform.driverCostPerKm);
  const platformFee = Math.round(grossRevenue * (feePercent / 100));
  const netProfit = grossRevenue - estimatedFuelCost - estimatedToll - driverCost - platformFee;

  return {
    grossRevenue,
    estimatedFuelCost,
    estimatedToll,
    driverCost,
    platformFee,
    netProfit,
    profitPerKm: totalKm > 0 ? Math.round(netProfit / totalKm) : 0,
  };
}

export function calculateImpact(params: {
  baselineEmptyKm: number;
  deadheadKm: number;
}): ImpactMetrics {
  const emptyKmWithoutTruckTrade = params.baselineEmptyKm;
  const emptyKmWithTruckTrade = params.deadheadKm;
  const emptyKmSaved = Math.max(0, emptyKmWithoutTruckTrade - emptyKmWithTruckTrade);
  const fuelSaved = Math.round(emptyKmSaved * FUEL_PER_KM);
  const estimatedCO2Saved = Math.round(fuelSaved * CO2_PER_LITRE);

  return {
    emptyKmWithoutTruckTrade,
    emptyKmWithTruckTrade,
    emptyKmSaved,
    fuelSaved,
    estimatedCO2Saved,
  };
}
