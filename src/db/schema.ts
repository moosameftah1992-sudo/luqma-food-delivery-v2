import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { WorkingPeriod } from "@/lib/working-hours";

// All money values are stored as integer FILS (1000 fils = 1 BHD).

export const governorates = pgTable("governorates", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  active: boolean("active").notNull().default(true),
});

export const areas = pgTable(
  "areas",
  {
    id: serial("id").primaryKey(),
    governorateId: integer("governorate_id")
      .notNull()
      .references(() => governorates.id, { onDelete: "cascade" }),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    deliveryFeeFils: integer("delivery_fee_fils").notNull().default(1500),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("areas_gov_idx").on(t.governorateId)],
);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  areaId: integer("area_id").references(() => areas.id, { onDelete: "set null" }),
  address: text("address").notNull().default(""),
  bonusBalanceFils: integer("bonus_balance_fils").notNull().default(0),
  emailVerified: boolean("email_verified").notNull().default(false),
  verifyToken: text("verify_token"), // SHA-256 digest, never the raw link token
  verifyExpiresAt: timestamp("verify_expires_at", { withTimezone: true }),
  verifySentAt: timestamp("verify_sent_at", { withTimezone: true }),
  status: text("status").notNull().default("active"), // pending_email | active | banned
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  cuisine: text("cuisine").notNull().default("مشاوي"),
  cuisineEn: text("cuisine_en"),
  description: text("description").notNull().default(""),
  descriptionEn: text("description_en"),
  image: text("image").notNull().default("/images/r-grill.jpg"),
  areaId: integer("area_id").references(() => areas.id, { onDelete: "set null" }),
  address: text("address").notNull().default(""),
  status: text("status").notNull().default("open"), // open | busy | closed
  workingHours: jsonb("working_hours").$type<WorkingPeriod[]>().notNull().default([]),
  approved: boolean("approved").notNull().default(false),
  banned: boolean("banned").notNull().default(false),
  ratingSum: integer("rating_sum").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  commissionFils: integer("commission_fils").notNull().default(500), // fixed 0.500 BHD / order
  minOrderFils: integer("min_order_fils").notNull().default(3000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  idCardNumber: text("id_card_number").notNull().default(""),
  licenseNumber: text("license_number").notNull().default(""),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  verifyToken: text("verify_token"), // SHA-256 digest
  verifyExpiresAt: timestamp("verify_expires_at", { withTimezone: true }),
  verifySentAt: timestamp("verify_sent_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"), // pending_email | pending | active | banned | terminated
  online: boolean("online").notNull().default(false),
  commissionPct: integer("commission_pct").notNull().default(10), // platform cut of the delivery fee
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driverDocuments = pgTable("driver_documents", {
  driverId: integer("driver_id").primaryKey().references(() => drivers.id, { onDelete: "cascade" }),
  idCardData: text("id_card_data").notNull(),
  licenseData: text("license_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  // Nullable for administrators created before email-based login was added.
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull().default(""),
  title: text("title").notNull().default("مدير النظام"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default(["all"]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerBonuses = pgTable(
  "customer_bonuses",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    adminId: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
    amountFils: integer("amount_fils").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bonus_customer_idx").on(table.customerId)],
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("cat_store_idx").on(t.storeId)],
);

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    description: text("description").notNull().default(""),
    descriptionEn: text("description_en"),
    image: text("image").notNull().default(""),
    priceFils: integer("price_fils").notNull().default(0),
    discountPct: integer("discount_pct").notNull().default(0),
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("item_store_idx").on(t.storeId)],
);

export const itemSizes = pgTable("item_sizes", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(),
  priceFils: integer("price_fils").notNull().default(0),
});

export const itemAddons = pgTable("item_addons", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(),
  priceFils: integer("price_fils").notNull().default(0),
});

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    areaId: integer("area_id").references(() => areas.id, { onDelete: "set null" }),
    driverId: integer("driver_id").references(() => drivers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    // pending | accepted | ready | assigned | onway | delivered
    // | rejected | cancelled_customer | cancelled_store | cancelled_driver
    subtotalFils: integer("subtotal_fils").notNull().default(0),
    deliveryFeeFils: integer("delivery_fee_fils").notNull().default(0),
    discountFils: integer("discount_fils").notNull().default(0),
    totalFils: integer("total_fils").notNull().default(0),
    bonusUsedFils: integer("bonus_used_fils").notNull().default(0),
    bonusRestored: boolean("bonus_restored").notNull().default(false),
    storeCommissionFils: integer("store_commission_fils").notNull().default(500),
    deliveryCommissionPct: integer("delivery_commission_pct").notNull().default(10),
    paymentMethod: text("payment_method").notNull().default("benefitpay"), // benefitpay | card | cash
    paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid | initiated | captured | cash_due | cash_collected | cash_cancelled | refund_pending | refunded | failed
    cardLast4: text("card_last4"),
    paymentRef: text("payment_ref"),
    address: text("address").notNull().default(""),
    note: text("note").notNull().default(""),
    cancelReason: text("cancel_reason"),
    cancelledBy: text("cancelled_by"),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("order_store_idx").on(t.storeId),
    index("order_driver_idx").on(t.driverId),
    index("order_status_idx").on(t.status),
    index("order_placed_idx").on(t.placedAt),
  ],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  itemId: integer("item_id"),
  nameAr: text("name_ar").notNull(),
  sizeName: text("size_name"),
  unitPriceFils: integer("unit_price_fils").notNull().default(0),
  qty: integer("qty").notNull().default(1),
  addons: jsonb("addons").$type<{ name: string; price: number }[]>().notNull().default([]),
  lineTotalFils: integer("line_total_fils").notNull().default(0),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  rating: integer("rating").notNull().default(5),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceRequests = pgTable("price_requests", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => items.id, { onDelete: "cascade" }),
  sizeId: integer("size_id"),
  target: text("target").notNull().default("item"), // item | size | addon
  targetName: text("target_name").notNull().default(""),
  oldPriceFils: integer("old_price_fils").notNull().default(0),
  newPriceFils: integer("new_price_fils").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const discounts = pgTable("discounts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  percent: integer("percent").notNull().default(10),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id")
    .notNull()
    .references(() => drivers.id, { onDelete: "cascade" }),
  amountFils: integer("amount_fils").notNull().default(0),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export const cmsPages = pgTable("cms_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en"),
  bodyAr: text("body_ar").notNull().default(""),
  bodyEn: text("body_en"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  image: text("image").notNull().default("/images/hero-feast.jpg"),
  titleAr: text("title_ar").notNull().default(""),
  titleEn: text("title_en"),
  subtitleAr: text("subtitle_ar").notNull().default(""),
  subtitleEn: text("subtitle_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});
