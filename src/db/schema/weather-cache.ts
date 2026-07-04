import { pgTable, text, numeric, date, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const weatherCache = pgTable(
  "weather_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    region: text("region").notNull(),
    forecastDate: date("forecast_date").notNull(),
    temperature: numeric("temperature", { precision: 5, scale: 1 }),
    humidity: numeric("humidity", { precision: 5, scale: 1 }),
    rainfallMm: numeric("rainfall_mm", { precision: 7, scale: 2 }),
    weatherDesc: text("weather_desc"), // cerah, hujan ringan, badai, dll
    source: text("source").notNull().default("bmkg"), // bmkg
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    regionIdx: index("weather_cache_region_idx").on(t.region),
    dateIdx: index("weather_cache_date_idx").on(t.forecastDate),
  })
);
