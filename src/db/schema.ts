import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull().default(""),
  isMaster: boolean("is_master").notNull().default(false),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    bonusBalance: numeric("bonus_balance").notNull().default("0"),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("customers_email_idx").on(t.email)]
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    label: text("label").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    governorateId: integer("governorate_id"),
    areaId: integer("area_id"),
    line: text("line").notNull().default(""),
  },
  (t) => [index("addr_cust_idx").on(t.customerId)]
);

export const stores = pgTable(
  "stores",
  {
    id: serial("id").primaryKey(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    ownerName: text("owner_name").notNull().default(""),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id"),
    governorateId: integer("governorate_id"),
    areaId: integer("area_id"),
    deliveryFee: numeric("delivery_fee").notNull().default("1.00"),
    minOrder: numeric("min_order").notNull().default("5.00"),
    status: text("status").notNull().default("open"), // open | busy | closed
    workingHours: jsonb("working_hours").$type<{ from: string; to: string; enabled: boolean }[]>()
      .notNull()
      .default([{ from: "10:00", to: "23:00", enabled: true }]),
    discountPercent: integer("discount_percent").notNull().default(0),
    pinned: boolean("pinned").notNull().default(false),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("stores_approved_idx").on(t.approved)]
);

export const drivers = pgTable(
  "drivers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    idCardUrl: text("id_card_url"),
    licenseUrl: text("license_url"),
    vehicle: text("vehicle").notNull().default(""),
    isOnline: boolean("is_online").notNull().default(false),
    approved: boolean("approved").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("drivers_approved_idx").on(t.approved)]
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  icon: text("icon").notNull().default("•"),
  sort: integer("sort").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id").notNull(),
    categoryId: integer("category_id"),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    description: text("description").notNull().default(""),
    price: numeric("price").notNull().default("0"),
    oldPrice: numeric("old_price"),
    discountPercent: integer("discount_percent").notNull().default(0),
    available: boolean("available").notNull().default(true),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    options: jsonb("options").$type<{ name: string; nameEn: string; choices: { name: string; price: number }[] }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("products_store_idx").on(t.storeId)]
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull().unique(),
    customerId: integer("customer_id").notNull(),
    storeId: integer("store_id").notNull(),
    driverId: integer("driver_id"),
    customerName: text("customer_name").notNull().default(""),
    address: jsonb("address").$type<Record<string, string>>().notNull().default({}),
    items: jsonb("items").$type<unknown[]>().notNull().default([]),
    subtotal: numeric("subtotal").notNull().default("0"),
    discountAmount: numeric("discount_amount").notNull().default("0"),
    deliveryFee: numeric("delivery_fee").notNull().default("0"),
    bonusUsed: numeric("bonus_used").notNull().default("0"),
    total: numeric("total").notNull().default("0"),
    paymentMethod: text("payment_method").notNull().default("cod"),
    status: text("status").notNull().default("pending"),
    // pending | accepted | preparing | ready | out_for_delivery | delivered | cancelled
    placedAt: timestamp("placed_at").notNull().defaultNow(),
    storeAcceptedAt: timestamp("store_accepted_at"),
    readyAt: timestamp("ready_at"),
    driverAcceptedAt: timestamp("driver_accepted_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledReason: text("cancelled_reason"),
  },
  (t) => [
    index("orders_store_idx").on(t.storeId),
    index("orders_status_idx").on(t.status),
    index("orders_driver_idx").on(t.driverId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    productId: integer("product_id"),
    name: text("name").notNull(),
    qty: integer("qty").notNull().default(1),
    unitPrice: numeric("unit_price").notNull().default("0"),
    options: jsonb("options").$type<{ name: string; choice: string; price: number }[]>()
      .notNull()
      .default([]),
    lineTotal: numeric("line_total").notNull().default("0"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)]
);

export const governorates = pgTable("governorates", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
});

export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  governorateId: integer("governorate_id").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
});

export const cancelledOrdersLog = pgTable("cancelled_orders_log", {
  id: serial("id").primaryKey(),
  orderNo: text("order_no").notNull(),
  storeId: integer("store_id"),
  storeName: text("store_name").notNull().default(""),
  customerName: text("customer_name").notNull().default(""),
  actor: text("actor").notNull().default("customer"), // customer | store | driver
  driverName: text("driver_name"),
  reason: text("reason").notNull().default(""),
  total: numeric("total").notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cmsSettings = pgTable("cms_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: serial("id").primaryKey(),
    userType: text("user_type").notNull(), // customer | store | driver | admin
    userId: integer("user_id").notNull(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull().default("verify"), // verify | reset
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("tokens_lookup_idx").on(t.userType, t.userId, t.purpose)]
);
