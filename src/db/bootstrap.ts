import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Initial, additive schema bootstrap for a completely empty (or partially
 * initialized) PostgreSQL database. Keep this baseline in sync with schema.ts.
 *
 * This is deliberately not `drizzle-kit push`: the CLI is a devDependency and
 * is not available inside a Vercel function. Later schema changes should be
 * deployed as reviewed migrations, not made by dropping or recreating tables.
 * All statements below are static application SQL; no user input is interpolated.
 */
type BootstrapTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const TABLE_NAMES = [
  "governorates",
  "areas",
  "customers",
  "stores",
  "drivers",
  "driver_documents",
  "admins",
  "customer_bonuses",
  "categories",
  "items",
  "item_sizes",
  "item_addons",
  "orders",
  "order_items",
  "reviews",
  "price_requests",
  "discounts",
  "payouts",
  "settings",
  "cms_pages",
  "banners",
] as const;

// Dependency order matters for the foreign keys. IF NOT EXISTS preserves data.
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS "governorates" (
    "id" serial PRIMARY KEY,
    "name_ar" text NOT NULL,
    "name_en" text,
    "active" boolean NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS "areas" (
    "id" serial PRIMARY KEY,
    "governorate_id" integer NOT NULL CONSTRAINT "areas_governorate_id_governorates_id_fk" REFERENCES "governorates" ("id") ON DELETE CASCADE,
    "name_ar" text NOT NULL,
    "name_en" text,
    "delivery_fee_fils" integer NOT NULL DEFAULT 1500,
    "active" boolean NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS "customers" (
    "id" serial PRIMARY KEY,
    "name" text NOT NULL,
    "email" text NOT NULL CONSTRAINT "customers_email_unique" UNIQUE,
    "phone" text NOT NULL DEFAULT '',
    "password_hash" text NOT NULL,
    "area_id" integer CONSTRAINT "customers_area_id_areas_id_fk" REFERENCES "areas" ("id") ON DELETE SET NULL,
    "address" text NOT NULL DEFAULT '',
    "bonus_balance_fils" integer NOT NULL DEFAULT 0,
    "email_verified" boolean NOT NULL DEFAULT false,
    "verify_token" text,
    "verify_expires_at" timestamptz,
    "verify_sent_at" timestamptz,
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "stores" (
    "id" serial PRIMARY KEY,
    "name_ar" text NOT NULL,
    "name_en" text,
    "email" text NOT NULL CONSTRAINT "stores_email_unique" UNIQUE,
    "phone" text NOT NULL DEFAULT '',
    "password_hash" text NOT NULL,
    "cuisine" text NOT NULL DEFAULT 'مشاوي',
    "description" text NOT NULL DEFAULT '',
    "description_en" text,
    "cuisine_en" text,
    "image" text NOT NULL DEFAULT '/images/r-grill.jpg',
    "area_id" integer CONSTRAINT "stores_area_id_areas_id_fk" REFERENCES "areas" ("id") ON DELETE SET NULL,
    "address" text NOT NULL DEFAULT '',
    "status" text NOT NULL DEFAULT 'open',
    "working_hours" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "approved" boolean NOT NULL DEFAULT false,
    "banned" boolean NOT NULL DEFAULT false,
    "rating_sum" integer NOT NULL DEFAULT 0,
    "rating_count" integer NOT NULL DEFAULT 0,
    "commission_fils" integer NOT NULL DEFAULT 500,
    "min_order_fils" integer NOT NULL DEFAULT 3000,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "drivers" (
    "id" serial PRIMARY KEY,
    "name" text NOT NULL,
    "email" text NOT NULL CONSTRAINT "drivers_email_unique" UNIQUE,
    "phone" text NOT NULL DEFAULT '',
    "password_hash" text NOT NULL,
    "id_card_number" text NOT NULL DEFAULT '',
    "license_number" text NOT NULL DEFAULT '',
    "terms_accepted" boolean NOT NULL DEFAULT false,
    "email_verified" boolean NOT NULL DEFAULT false,
    "verify_token" text,
    "verify_expires_at" timestamptz,
    "verify_sent_at" timestamptz,
    "status" text NOT NULL DEFAULT 'pending',
    "online" boolean NOT NULL DEFAULT false,
    "commission_pct" integer NOT NULL DEFAULT 10,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "driver_documents" (
    "driver_id" integer PRIMARY KEY CONSTRAINT "driver_documents_driver_id_drivers_id_fk" REFERENCES "drivers" ("id") ON DELETE CASCADE,
    "id_card_data" text NOT NULL,
    "license_data" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "admins" (
    "id" serial PRIMARY KEY,
    "username" text NOT NULL CONSTRAINT "admins_username_unique" UNIQUE,
    "email" text CONSTRAINT "admins_email_unique" UNIQUE,
    "password_hash" text NOT NULL,
    "full_name" text NOT NULL DEFAULT '',
    "title" text NOT NULL DEFAULT 'مدير النظام',
    "permissions" jsonb NOT NULL DEFAULT '["all"]'::jsonb,
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "customer_bonuses" (
    "id" serial PRIMARY KEY,
    "customer_id" integer NOT NULL CONSTRAINT "customer_bonuses_customer_id_customers_id_fk" REFERENCES "customers" ("id") ON DELETE CASCADE,
    "admin_id" integer CONSTRAINT "customer_bonuses_admin_id_admins_id_fk" REFERENCES "admins" ("id") ON DELETE SET NULL,
    "amount_fils" integer NOT NULL,
    "note" text NOT NULL DEFAULT '',
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "categories" (
    "id" serial PRIMARY KEY,
    "store_id" integer NOT NULL CONSTRAINT "categories_store_id_stores_id_fk" REFERENCES "stores" ("id") ON DELETE CASCADE,
    "name_ar" text NOT NULL,
    "name_en" text,
    "sort_order" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS "items" (
    "id" serial PRIMARY KEY,
    "store_id" integer NOT NULL CONSTRAINT "items_store_id_stores_id_fk" REFERENCES "stores" ("id") ON DELETE CASCADE,
    "category_id" integer CONSTRAINT "items_category_id_categories_id_fk" REFERENCES "categories" ("id") ON DELETE SET NULL,
    "name_ar" text NOT NULL,
    "name_en" text,
    "description" text NOT NULL DEFAULT '',
    "description_en" text,
    "image" text NOT NULL DEFAULT '',
    "price_fils" integer NOT NULL DEFAULT 0,
    "discount_pct" integer NOT NULL DEFAULT 0,
    "available" boolean NOT NULL DEFAULT true,
    "sort_order" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "item_sizes" (
    "id" serial PRIMARY KEY,
    "item_id" integer NOT NULL CONSTRAINT "item_sizes_item_id_items_id_fk" REFERENCES "items" ("id") ON DELETE CASCADE,
    "name_ar" text NOT NULL,
    "price_fils" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS "item_addons" (
    "id" serial PRIMARY KEY,
    "item_id" integer NOT NULL CONSTRAINT "item_addons_item_id_items_id_fk" REFERENCES "items" ("id") ON DELETE CASCADE,
    "name_ar" text NOT NULL,
    "price_fils" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS "orders" (
    "id" serial PRIMARY KEY,
    "code" text NOT NULL CONSTRAINT "orders_code_unique" UNIQUE,
    "customer_id" integer CONSTRAINT "orders_customer_id_customers_id_fk" REFERENCES "customers" ("id") ON DELETE SET NULL,
    "store_id" integer NOT NULL CONSTRAINT "orders_store_id_stores_id_fk" REFERENCES "stores" ("id") ON DELETE CASCADE,
    "area_id" integer CONSTRAINT "orders_area_id_areas_id_fk" REFERENCES "areas" ("id") ON DELETE SET NULL,
    "driver_id" integer CONSTRAINT "orders_driver_id_drivers_id_fk" REFERENCES "drivers" ("id") ON DELETE SET NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "subtotal_fils" integer NOT NULL DEFAULT 0,
    "delivery_fee_fils" integer NOT NULL DEFAULT 0,
    "discount_fils" integer NOT NULL DEFAULT 0,
    "total_fils" integer NOT NULL DEFAULT 0,
    "bonus_used_fils" integer NOT NULL DEFAULT 0,
    "bonus_restored" boolean NOT NULL DEFAULT false,
    "store_commission_fils" integer NOT NULL DEFAULT 500,
    "delivery_commission_pct" integer NOT NULL DEFAULT 10,
    "payment_method" text NOT NULL DEFAULT 'benefitpay',
    "payment_status" text NOT NULL DEFAULT 'unpaid',
    "card_last4" text,
    "payment_ref" text,
    "address" text NOT NULL DEFAULT '',
    "note" text NOT NULL DEFAULT '',
    "cancel_reason" text,
    "cancelled_by" text,
    "placed_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "order_items" (
    "id" serial PRIMARY KEY,
    "order_id" integer NOT NULL CONSTRAINT "order_items_order_id_orders_id_fk" REFERENCES "orders" ("id") ON DELETE CASCADE,
    "item_id" integer,
    "name_ar" text NOT NULL,
    "size_name" text,
    "unit_price_fils" integer NOT NULL DEFAULT 0,
    "qty" integer NOT NULL DEFAULT 1,
    "addons" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "line_total_fils" integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS "reviews" (
    "id" serial PRIMARY KEY,
    "order_id" integer CONSTRAINT "reviews_order_id_orders_id_fk" REFERENCES "orders" ("id") ON DELETE CASCADE,
    "store_id" integer CONSTRAINT "reviews_store_id_stores_id_fk" REFERENCES "stores" ("id") ON DELETE CASCADE,
    "customer_id" integer CONSTRAINT "reviews_customer_id_customers_id_fk" REFERENCES "customers" ("id") ON DELETE SET NULL,
    "rating" integer NOT NULL DEFAULT 5,
    "comment" text NOT NULL DEFAULT '',
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "price_requests" (
    "id" serial PRIMARY KEY,
    "store_id" integer NOT NULL CONSTRAINT "price_requests_store_id_stores_id_fk" REFERENCES "stores" ("id") ON DELETE CASCADE,
    "item_id" integer CONSTRAINT "price_requests_item_id_items_id_fk" REFERENCES "items" ("id") ON DELETE CASCADE,
    "size_id" integer,
    "target" text NOT NULL DEFAULT 'item',
    "target_name" text NOT NULL DEFAULT '',
    "old_price_fils" integer NOT NULL DEFAULT 0,
    "new_price_fils" integer NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'pending',
    "admin_note" text NOT NULL DEFAULT '',
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "discounts" (
    "id" serial PRIMARY KEY,
    "store_id" integer NOT NULL CONSTRAINT "discounts_store_id_stores_id_fk" REFERENCES "stores" ("id") ON DELETE CASCADE,
    "code" text NOT NULL,
    "percent" integer NOT NULL DEFAULT 10,
    "active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "payouts" (
    "id" serial PRIMARY KEY,
    "driver_id" integer NOT NULL CONSTRAINT "payouts_driver_id_drivers_id_fk" REFERENCES "drivers" ("id") ON DELETE CASCADE,
    "amount_fils" integer NOT NULL DEFAULT 0,
    "note" text NOT NULL DEFAULT '',
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "settings" (
    "key" text PRIMARY KEY,
    "value" text NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS "cms_pages" (
    "id" serial PRIMARY KEY,
    "slug" text NOT NULL CONSTRAINT "cms_pages_slug_unique" UNIQUE,
    "title_ar" text NOT NULL,
    "title_en" text,
    "body_ar" text NOT NULL DEFAULT '',
    "body_en" text,
    "updated_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "banners" (
    "id" serial PRIMARY KEY,
    "image" text NOT NULL DEFAULT '/images/hero-feast.jpg',
    "title_ar" text NOT NULL DEFAULT '',
    "title_en" text,
    "subtitle_ar" text NOT NULL DEFAULT '',
    "subtitle_en" text,
    "sort_order" integer NOT NULL DEFAULT 0,
    "active" boolean NOT NULL DEFAULT true
  )`,
] as const;

const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS "bonus_customer_idx" ON "customer_bonuses" ("customer_id")',
  'CREATE INDEX IF NOT EXISTS "areas_gov_idx" ON "areas" ("governorate_id")',
  'CREATE INDEX IF NOT EXISTS "cat_store_idx" ON "categories" ("store_id")',
  'CREATE INDEX IF NOT EXISTS "item_store_idx" ON "items" ("store_id")',
  'CREATE INDEX IF NOT EXISTS "order_store_idx" ON "orders" ("store_id")',
  'CREATE INDEX IF NOT EXISTS "order_driver_idx" ON "orders" ("driver_id")',
  'CREATE INDEX IF NOT EXISTS "order_status_idx" ON "orders" ("status")',
  'CREATE INDEX IF NOT EXISTS "order_placed_idx" ON "orders" ("placed_at")',
] as const;

/** Must be called inside the transaction holding the bootstrap advisory lock. */
export async function createSchemaIfMissing(tx: BootstrapTransaction): Promise<void> {
  const existing = await tx.execute(sql`
    SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()
  `);
  const names = new Set(existing.rows.map((row) => String(row.tablename)));
  if (!TABLE_NAMES.every((name) => names.has(name))) {
    for (const statement of CREATE_TABLES) await tx.execute(sql.raw(statement));
    for (const statement of CREATE_INDEXES) await tx.execute(sql.raw(statement));
  }

  // Safe incremental upgrades for existing installations.
  const column = await tx.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'admins' AND column_name = 'email'
  `);
  if (!column.rows.length) await tx.execute(sql`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "email" text`);
  const constraint = await tx.execute(sql`
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'admins'::regclass AND conname = 'admins_email_unique'
  `);
  if (!constraint.rows.length)
    await tx.execute(sql`ALTER TABLE "admins" ADD CONSTRAINT "admins_email_unique" UNIQUE ("email")`);

  await tx.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "bonus_balance_fils" integer NOT NULL DEFAULT 0`);
  await tx.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "verify_expires_at" timestamptz`);
  await tx.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "verify_sent_at" timestamptz`);
  await tx.execute(sql`ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "verify_expires_at" timestamptz`);
  await tx.execute(sql`ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "verify_sent_at" timestamptz`);
  await tx.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'unpaid'`);
  await tx.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "bonus_used_fils" integer NOT NULL DEFAULT 0`);
  await tx.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "bonus_restored" boolean NOT NULL DEFAULT false`);
  await tx.execute(sql`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "description_en" text`);
  await tx.execute(sql`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "cuisine_en" text`);
  await tx.execute(sql`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "working_hours" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await tx.execute(sql`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "name_en" text`);
  await tx.execute(sql`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "description_en" text`);
  await tx.execute(sql`ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "title_en" text`);
  await tx.execute(sql`ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "body_en" text`);
  await tx.execute(sql`ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "title_en" text`);
  await tx.execute(sql`ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "subtitle_en" text`);
}
