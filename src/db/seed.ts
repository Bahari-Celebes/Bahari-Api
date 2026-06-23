import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users, cooperatives, producers, commodities,
  commodityBatches, marketplaceListings, orders, orderItems,
  ecoPointTransactions
} from "./schema";
import { hashPassword } from "../lib/password";

const seedClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(seedClient);

async function main() {
  console.log("Starting DB seed...");

  // 1. Cooperatives
  console.log("Seeding cooperatives...");
  const [coop1, coop2] = await db.insert(cooperatives).values([
    {
      name: "Koperasi Nelayan Sejahtera",
      registrationNumber: "KOP-12345",
      villageName: "Desa Pesisir Utara",
      district: "Kecamatan Bahari",
      province: "Jawa Timur",
      contactPerson: "Bapak Budi",
      phone: "081234567890",
    },
    {
      name: "Koperasi Rumput Laut Jaya",
      registrationNumber: "KOP-54321",
      villageName: "Desa Karang Selatan",
      district: "Kecamatan Bahari",
      province: "Jawa Timur",
      contactPerson: "Ibu Siti",
      phone: "089876543210",
    }
  ]).returning();

  // 2. Users
  console.log("Seeding users...");
  const adminPassword = await hashPassword("admin123");
  const buyerPassword = await hashPassword("buyer123");

  await db.insert(users).values([
    {
      name: "Super Admin",
      email: "super@bahari.id",
      passwordHash: adminPassword,
      role: "super_admin",
    },
    {
      name: "Admin Coop 1",
      email: "admin1@bahari.id",
      passwordHash: adminPassword,
      role: "cooperative_admin",
      cooperativeId: coop1.id,
    },
    {
      name: "Admin Coop 2",
      email: "admin2@bahari.id",
      passwordHash: adminPassword,
      role: "cooperative_admin",
      cooperativeId: coop2.id,
    },
    {
      name: "John Buyer",
      email: "buyer@bahari.id",
      passwordHash: buyerPassword,
      role: "buyer",
    }
  ]);

  // 3. Producers
  console.log("Seeding producers...");
  const [prod1, prod2] = await db.insert(producers).values([
    {
      cooperativeId: coop1.id,
      name: "Pak Nelayan 1",
      producerType: "fisherman",
      phone: "08111111111",
      status: "active",
    },
    {
      cooperativeId: coop2.id,
      name: "Bu Rumput Laut 1",
      producerType: "seaweed_farmer",
      phone: "08222222222",
      status: "active",
    }
  ]).returning();

  // 4. Commodities
  console.log("Seeding commodities...");
  const [comm1, comm2] = await db.insert(commodities).values([
    {
      name: "Ikan Tuna Segar",
      category: "fresh_seafood",
      unit: "kg",
      storageType: "chilled",
    },
    {
      name: "Rumput Laut Kering",
      category: "seaweed",
      unit: "kg",
      storageType: "dry_storage",
    }
  ]).returning();

  // 5. Commodity Batches
  console.log("Seeding batches...");
  const [batch1, batch2] = await db.insert(commodityBatches).values([
    {
      cooperativeId: coop1.id,
      producerId: prod1.id,
      commodityId: comm1.id,
      batchCode: "BATCH-20260624-A1B2",
      quantity: "50.00",
      unit: "kg",
      status: "verified",
      qualityStatus: "fresh",
      basePrice: "40000.00",
    },
    {
      cooperativeId: coop2.id,
      producerId: prod2.id,
      commodityId: comm2.id,
      batchCode: "BATCH-20260624-C3D4",
      quantity: "100.00",
      unit: "kg",
      status: "verified",
      qualityStatus: "dried",
      basePrice: "15000.00",
    }
  ]).returning();

  // 6. Marketplace Listings
  console.log("Seeding listings...");
  await db.insert(marketplaceListings).values([
    {
      cooperativeId: coop1.id,
      commodityBatchId: batch1.id,
      title: "Ikan Tuna Segar Premium (Tangkapan Hari Ini)",
      pricePerUnit: "45000.00",
      availableQuantity: "50.00",
      minimumOrder: "5.00",
      listingStatus: "active",
    },
    {
      cooperativeId: coop2.id,
      commodityBatchId: batch2.id,
      title: "Rumput Laut Kering Kualitas A",
      pricePerUnit: "18000.00",
      availableQuantity: "100.00",
      minimumOrder: "10.00",
      listingStatus: "active",
    }
  ]);

  // 7. Eco Points
  console.log("Seeding eco points...");
  await db.insert(ecoPointTransactions).values([
    {
      producerId: prod1.id,
      cooperativeId: coop1.id,
      activityType: "plastic_deposit",
      description: "Setor 5kg sampah plastik dari laut",
      points: 50,
      status: "approved",
    },
    {
      producerId: prod2.id,
      cooperativeId: coop2.id,
      activityType: "coastal_cleanup",
      description: "Ikut kerja bakti bersih pantai",
      points: 100,
      status: "approved",
    }
  ]);

  console.log("✅ Seed complete!");
  await seedClient.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
