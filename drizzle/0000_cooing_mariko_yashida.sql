CREATE TYPE "public"."eco_activity_type" AS ENUM('plastic_deposit', 'coastal_cleanup', 'waste_sorting', 'mangrove_activity', 'sustainable_production', 'byproduct_reuse');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('submitted', 'verified', 'stored', 'listed', 'partially_sold', 'sold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."commodity_category" AS ENUM('fresh_seafood', 'aquaculture', 'seaweed', 'salt', 'coastal_agriculture', 'processed_food', 'handicraft', 'recycled_material');--> statement-breakpoint
CREATE TYPE "public"."eco_point_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'paused', 'sold_out');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'packed', 'ready_for_pickup', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."producer_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."producer_type" AS ENUM('fisherman', 'fish_farmer', 'seaweed_farmer', 'salt_farmer', 'coastal_farmer', 'msme_processor', 'women_group', 'recycling_group', 'community_group');--> statement-breakpoint
CREATE TYPE "public"."quality_status" AS ENUM('fresh', 'chilled', 'frozen', 'dried', 'processed', 'sorted', 'packed');--> statement-breakpoint
CREATE TYPE "public"."storage_type" AS ENUM('cold_storage', 'chilled', 'dry_storage', 'room_temperature', 'frozen', 'none');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'cooperative_admin', 'producer', 'buyer');--> statement-breakpoint
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
CREATE TABLE "commodities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" "commodity_category" NOT NULL,
	"unit" text NOT NULL,
	"description" text,
	"storage_type" "storage_type" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commodities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "commodity_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"producer_id" uuid NOT NULL,
	"commodity_id" uuid NOT NULL,
	"batch_code" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"grade" text,
	"production_date" date,
	"harvest_location" text,
	"base_price" numeric(15, 2),
	"quality_status" "quality_status",
	"status" "batch_status" DEFAULT 'submitted' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commodity_batches_batch_code_unique" UNIQUE("batch_code")
);
--> statement-breakpoint
CREATE TABLE "cooperatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"registration_number" text,
	"village_name" text,
	"district" text,
	"province" text,
	"address" text,
	"contact_person" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cooperatives_registration_number_unique" UNIQUE("registration_number")
);
--> statement-breakpoint
CREATE TABLE "eco_point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producer_id" uuid NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"activity_type" "eco_activity_type" NOT NULL,
	"description" text,
	"points" integer NOT NULL,
	"evidence_url" text,
	"status" "eco_point_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"commodity_batch_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_per_unit" numeric(15, 2) NOT NULL,
	"available_quantity" numeric(12, 2) NOT NULL,
	"minimum_order" numeric(12, 2),
	"listing_status" "listing_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"commodity_name" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"order_code" text NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"delivery_method" text,
	"buyer_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
CREATE TABLE "producers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"nik" text,
	"phone" text,
	"address" text,
	"producer_type" "producer_type" NOT NULL,
	"business_name" text,
	"production_area" text,
	"production_asset" text,
	"member_number" text,
	"joined_at" date,
	"status" "producer_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'buyer' NOT NULL,
	"cooperative_id" uuid,
	"producer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "commodity_batches" ADD CONSTRAINT "commodity_batches_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_batches" ADD CONSTRAINT "commodity_batches_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_batches" ADD CONSTRAINT "commodity_batches_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eco_point_transactions" ADD CONSTRAINT "eco_point_transactions_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eco_point_transactions" ADD CONSTRAINT "eco_point_transactions_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_commodity_batch_id_commodity_batches_id_fk" FOREIGN KEY ("commodity_batch_id") REFERENCES "public"."commodity_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;