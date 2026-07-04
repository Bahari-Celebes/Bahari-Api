import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { weatherCache, outletLocations, cooperatives } from "./schema/index.js";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log("🌊 Seeding Phase 2: weather + outlets...");

  const days = ["2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08"];
  await db.insert(weatherCache).values(days.map(d => ({
    region: "Kabupaten Pesisir Selatan",
    forecastDate: d,
    temperature: String(28 + Math.round(Math.random() * 4)),
    humidity: String(72 + Math.round(Math.random() * 12)),
    rainfallMm: String(Math.round(Math.random() * 25)),
    weatherDesc: Math.random() > 0.3 ? "cerah" : "hujan ringan",
    source: "bmkg",
    fetchedAt: new Date(),
  })));
  console.log(`  Weather: ${days.length} days`);

  const coops = await db.select().from(cooperatives).limit(1);
  const cid = coops[0]?.id;
  if (cid) {
    await db.insert(outletLocations).values([
      { cooperativeId: cid, name: "Warung Bu Ani", type: "warung", latitude: "-8.2", longitude: "112.5", capacity: 80 },
      { cooperativeId: cid, name: "Toko Sumber Rezeki", type: "toko", latitude: "-8.18", longitude: "112.6", capacity: 200 },
      { cooperativeId: cid, name: "Cabang Pasar Minggu", type: "cabang", latitude: "-8.25", longitude: "112.55", capacity: 500 },
      { cooperativeId: cid, name: "Warung Pak Budi", type: "warung", latitude: "-8.22", longitude: "112.58", capacity: 60 },
    ]);
    console.log(`  Outlets: 4`);
  }

  console.log("✅ Phase 2 seed complete");
  await sql.end();
}

main().catch(err => { console.error("Phase 2 seed failed:", err); process.exit(1); });
