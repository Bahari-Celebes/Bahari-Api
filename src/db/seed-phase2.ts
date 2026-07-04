// BAHARI Intelligence Phase 2 seed: weather forecasts, outlet locations, price benchmarks.
// Additive — does NOT reset existing data. Run: npm run db:seed-phase2
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import {
  cooperatives,
  weatherCache,
  outletLocations,
  priceSnapshots,
} from "./schema/index.js";

const seedClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(seedClient);

async function main() {
  console.log("🌊 Seeding Phase 2: weather + outlets + price benchmarks...");

  // --- Find existing cooperative ---
  const [coop] = await db
    .select()
    .from(cooperatives)
    .where(eq(cooperatives.name, "Koperasi Nelayan Bahari"))
    .limit(1);

  if (!coop) {
    console.error("❌ Cooperative 'Koperasi Nelayan Bahari' not found. Run db:seed first.");
    await seedClient.end();
    process.exit(1);
  }

  const coopId = coop.id;
  const now = new Date();

  // ========== 1. Weather Cache (5 days forecast) ==========
  const weatherData = [];
  const weatherDescs = [
    { desc: "Cerah berawan", temp: 31.2, humidity: 72, rainfall: 0 },
    { desc: "Hujan ringan", temp: 28.5, humidity: 88, rainfall: 12.5 },
    { desc: "Cerah", temp: 32.8, humidity: 65, rainfall: 0 },
    { desc: "Hujan sedang", temp: 27.1, humidity: 92, rainfall: 35.8 },
    { desc: "Berawan", temp: 29.6, humidity: 78, rainfall: 2.1 },
  ];

  for (let i = 0; i < 5; i++) {
    const forecastDate = new Date(now);
    forecastDate.setDate(forecastDate.getDate() + i);
    const w = weatherDescs[i];
    weatherData.push({
      region: coop.region,
      forecastDate: forecastDate.toISOString().split("T")[0],
      temperature: String(w.temp),
      humidity: String(w.humidity),
      rainfallMm: String(w.rainfall),
      weatherDesc: w.desc,
      source: "bmkg",
      fetchedAt: now,
    });
  }
  await db.insert(weatherCache).values(weatherData);
  console.log(`  Weather: ${weatherData.length} days`);

  // ========== 2. Outlet Locations (4 outlets) ==========
  // Coordinates around Pesisir Selatan, Sulawesi Selatan area
  const outlets = [
    {
      cooperativeId: coopId,
      name: "Warung Mina Bahari",
      type: "warung",
      latitude: "-5.4321000",
      longitude: "119.4567000",
      commoditiesSold: ["Ikan Tuna Segar", "Kerang Hijau", "Udang Segar"],
      capacity: 150,
    },
    {
      cooperativeId: coopId,
      name: "Toko Laut Sejahtera",
      type: "toko",
      latitude: "-5.4180000",
      longitude: "119.4720000",
      commoditiesSold: ["Ikan Olahan Asap", "Rumput Laut Kering"],
      capacity: 200,
    },
    {
      cooperativeId: coopId,
      name: "Cabang Kopdes Pantai Indah",
      type: "cabang",
      latitude: "-5.4450000",
      longitude: "119.4380000",
      commoditiesSold: ["Ikan Tuna Segar", "Udang Segar", "Rumput Laut Kering", "Kerang Hijau", "Ikan Olahan Asap"],
      capacity: 500,
    },
    {
      cooperativeId: coopId,
      name: "Warung Pesisir Jaya",
      type: "warung",
      latitude: "-5.4600000",
      longitude: "119.4900000",
      commoditiesSold: ["Ikan Tuna Segar", "Kerang Hijau"],
      capacity: 80,
    },
  ];
  await db.insert(outletLocations).values(outlets);
  console.log(`  Outlets: ${outlets.length}`);

  // ========== 3. Price Snapshots / Benchmarks (9 commodities) ==========
  // Static benchmark prices simulating Bapanas Panel Harga Pangan data
  // These represent national/regional average prices for comparison with local Kopdes prices
  const priceBenchmarks = [
    // Komoditas lokal Kopdes (for direct comparison)
    { commodity: "Ikan Tuna Segar", source: "bapanas", region: "Nasional", price: 62000, unit: "kg" },
    { commodity: "Ikan Tuna Segar", source: "bapanas", region: "Sulawesi Selatan", price: 55000, unit: "kg" },
    { commodity: "Rumput Laut Kering", source: "bapanas", region: "Nasional", price: 22000, unit: "kg" },
    { commodity: "Udang Segar", source: "bapanas", region: "Nasional", price: 95000, unit: "kg" },
    { commodity: "Udang Segar", source: "bapanas", region: "Jakarta", price: 110000, unit: "kg" },
    { commodity: "Kerang Hijau", source: "bapanas", region: "Nasional", price: 28000, unit: "kg" },
    { commodity: "Ikan Olahan Asap", source: "bapanas", region: "Nasional", price: 45000, unit: "pack" },
    // Komoditas strategis non-lokal (for market context)
    { commodity: "Cabai Rawit Merah", source: "bapanas", region: "Nasional", price: 85000, unit: "kg" },
    { commodity: "Bawang Merah", source: "bapanas", region: "Nasional", price: 42000, unit: "kg" },
  ];

  const priceRows = priceBenchmarks.map((p) => ({
    commodityName: p.commodity,
    source: p.source,
    region: p.region,
    price: String(p.price),
    unit: p.unit,
    fetchedAt: now,
  }));
  await db.insert(priceSnapshots).values(priceRows);
  console.log(`  Price benchmarks: ${priceRows.length}`);

  console.log("✅ Phase 2 seed complete");
  await seedClient.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
