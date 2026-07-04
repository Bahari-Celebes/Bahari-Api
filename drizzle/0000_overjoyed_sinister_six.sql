CREATE TYPE "public"."payment_status" AS ENUM('paid', 'pending', 'delayed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'cooperative_manager', 'operator', 'reviewer');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodity_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"commodity_name" text NOT NULL,
	"category" text NOT NULL,
	"volume" numeric(14, 2) NOT NULL,
	"unit" text NOT NULL,
	"source_group" text NOT NULL,
	"buy_price" numeric(14, 2) NOT NULL,
	"expected_sell_price" numeric(14, 2) NOT NULL,
	"actual_sell_price" numeric(14, 2),
	"spoilage_percentage" numeric(6, 4) DEFAULT '0' NOT NULL,
	"date" date NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooperatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"village" text NOT NULL,
	"region" text NOT NULL,
	"total_members" integer DEFAULT 0 NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"main_commodities" jsonb DEFAULT '[]'::jsonb,
	"contact_person" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feasibility_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"scenario_name" text NOT NULL,
	"capex" numeric(16, 2) NOT NULL,
	"monthly_opex" numeric(14, 2) NOT NULL,
	"monthly_revenue" numeric(14, 2) NOT NULL,
	"margin" numeric(6, 4) NOT NULL,
	"discount_rate" numeric(6, 4) NOT NULL,
	"growth_rate" numeric(6, 4) NOT NULL,
	"projection_months" integer NOT NULL,
	"logistics_cost" numeric(14, 2) NOT NULL,
	"spoilage_assumption" numeric(6, 4) NOT NULL,
	"price_adjustment" numeric(6, 4) DEFAULT '0',
	"cost_adjustment" numeric(6, 4) DEFAULT '0',
	"volume_adjustment" numeric(6, 4) DEFAULT '0',
	"spoilage_adjustment" numeric(6, 4) DEFAULT '0',
	"payment_delay_days" integer DEFAULT 0,
	"result_npv" numeric(18, 2),
	"result_irr" numeric(10, 6),
	"result_payback_period" numeric(10, 4),
	"result_bcr" numeric(10, 6),
	"result_status" text,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"score_date" date NOT NULL,
	"overall_score" numeric(5, 1) NOT NULL,
	"status" text NOT NULL,
	"liquidity_ratio" numeric(8, 4),
	"solvability_ratio" numeric(8, 4),
	"profitability_ratio" numeric(8, 4),
	"activity_ratio" numeric(8, 4),
	"benchmark_rank" integer,
	"benchmark_total" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"commodities_sold" text[],
	"capacity" integer DEFAULT 100,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commodity_name" text NOT NULL,
	"source" text NOT NULL,
	"region" text NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"unit" text DEFAULT 'kg' NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"commodity_record_id" uuid,
	"buyer_type" text NOT NULL,
	"volume_sold" numeric(14, 2) NOT NULL,
	"selling_price" numeric(14, 2) NOT NULL,
	"gross_value" numeric(16, 2) NOT NULL,
	"logistics_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"storage_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"date" date NOT NULL,
	"sync_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'reviewer' NOT NULL,
	"cooperative_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weather_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"forecast_date" date NOT NULL,
	"temperature" numeric(5, 1),
	"humidity" numeric(5, 1),
	"rainfall_mm" numeric(7, 2),
	"weather_desc" text,
	"source" text DEFAULT 'bmkg' NOT NULL,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "commodity_records_coop_idx" ON "commodity_records" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "commodity_records_name_idx" ON "commodity_records" USING btree ("commodity_name");--> statement-breakpoint
CREATE INDEX "commodity_records_category_idx" ON "commodity_records" USING btree ("category");--> statement-breakpoint
CREATE INDEX "commodity_records_date_idx" ON "commodity_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "cooperatives_village_idx" ON "cooperatives" USING btree ("village");--> statement-breakpoint
CREATE INDEX "cooperatives_region_idx" ON "cooperatives" USING btree ("region");--> statement-breakpoint
CREATE INDEX "feasibility_scenarios_coop_idx" ON "feasibility_scenarios" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "feasibility_scenarios_name_idx" ON "feasibility_scenarios" USING btree ("scenario_name");--> statement-breakpoint
CREATE INDEX "health_scores_coop_idx" ON "health_scores" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "health_scores_date_idx" ON "health_scores" USING btree ("score_date");--> statement-breakpoint
CREATE INDEX "outlet_locations_coop_idx" ON "outlet_locations" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "price_snapshots_commodity_idx" ON "price_snapshots" USING btree ("commodity_name");--> statement-breakpoint
CREATE INDEX "price_snapshots_source_idx" ON "price_snapshots" USING btree ("source");--> statement-breakpoint
CREATE INDEX "price_snapshots_region_idx" ON "price_snapshots" USING btree ("region");--> statement-breakpoint
CREATE INDEX "price_snapshots_fetched_idx" ON "price_snapshots" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "transaction_records_coop_idx" ON "transaction_records" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "transaction_records_commodity_idx" ON "transaction_records" USING btree ("commodity_record_id");--> statement-breakpoint
CREATE INDEX "transaction_records_buyer_idx" ON "transaction_records" USING btree ("buyer_type");--> statement-breakpoint
CREATE INDEX "transaction_records_payment_idx" ON "transaction_records" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "transaction_records_date_idx" ON "transaction_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_cooperative_idx" ON "users" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "weather_cache_region_idx" ON "weather_cache" USING btree ("region");--> statement-breakpoint
CREATE INDEX "weather_cache_date_idx" ON "weather_cache" USING btree ("forecast_date");