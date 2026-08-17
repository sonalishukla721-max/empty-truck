import dotenv from "dotenv";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "5000", 10),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwt: {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "7d",
  },
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  },
  map: {
    provider: process.env.MAP_PROVIDER ?? "demo",
    apiKey: process.env.MAP_API_KEY ?? "",
  },
  demo: {
    mode: process.env.DEMO_MODE === "true",
    payment: process.env.DEMO_PAYMENT_MODE === "true" || !process.env.RAZORPAY_KEY_ID,
    map: process.env.DEMO_MAP_MODE === "true" || !process.env.MAP_API_KEY,
    tracking: process.env.DEMO_TRACKING_MODE === "true",
  },
  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT ?? "5"),
    fuelCostPerKm: parseFloat(process.env.FUEL_COST_PER_KM ?? "12"),
    tollCostPerKm: parseFloat(process.env.TOLL_COST_PER_KM ?? "2"),
    driverCostPerKm: parseFloat(process.env.DRIVER_COST_PER_KM ?? "8"),
  },
};
