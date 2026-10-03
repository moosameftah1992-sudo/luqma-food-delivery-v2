import { db } from "@/db";
import {
  admins,
  customers,
  customerAddresses,
  stores,
  drivers,
  categories,
  products,
  orders,
  orderItems,
  governorates,
  areas,
  cancelledOrdersLog,
} from "./schema";
import { hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

const img = {
  kebab: "https://images.pexels.com/photos/18188571/pexels-photo-18188571.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  fastfood: "https://images.pexels.com/photos/32524109/pexels-photo-32524109.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  doner: "https://images.pexels.com/photos/38337105/pexels-photo-38337105.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  wrap: "https://images.pexels.com/photos/15913640/pexels-photo-15913640.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  kebab2: "https://images.pexels.com/photos/11286814/pexels-photo-11286814.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  burger: "https://images.pexels.com/photos/12025834/pexels-photo-12025834.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  wrap2: "https://images.pexels.com/photos/15202777/pexels-photo-15202777.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  burgers: "https://images.pexels.com/photos/6111948/pexels-photo-6111948.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  burger2: "https://images.pexels.com/photos/5374420/pexels-photo-5374420.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  pizza: "https://images.pexels.com/photos/13726794/pexels-photo-13726794.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  dessert1: "https://images.pexels.com/photos/33731580/pexels-photo-33731580.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  dessert2: "https://images.pexels.com/photos/602211/dessert-food-restaurant-diner-602211.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  cakes: "https://images.pexels.com/photos/28146830/pexels-photo-28146830.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  dessert3: "https://images.pexels.com/photos/5172006/pexels-photo-5172006.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  dessert4: "https://images.pexels.com/photos/12927134/pexels-photo-12927134.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
};

async function main() {
  const master = (await db.select().from(admins).where(eq(admins.username, "moosameftah")))[0];
  if (master) {
    console.log("Seed already applied (master exists). Skipping.");
    return;
  }

  // ---- Admins ----
  const [ma] = await db
    .insert(admins)
    .values({
      username: "moosameftah",
      email: "moosameftah1992@gmail.com",
      fullName: "المدير الرئيسي",
      passwordHash: hashPassword("Vsml3142@"),
      isMaster: true,
      permissions: ["*"],
    })
    .returning({ id: admins.id });
  await db.insert(admins).values({
    username: "ops",
    email: "ops@luqma.store",
    fullName: "مدير العمليات",
    passwordHash: hashPassword("Ops#2024x"),
    isMaster: false,
    permissions: ["stores", "orders", "reports"],
  });

  // ---- Governorates & Areas ----
  const gov: Array<[string, string, string[]]> = [
    ["العاصمة", "Capital", ["المنامة", "الحد", "سار", "بوليفارد سيتي"]],
    ["المحرق", "Muharraq", ["مدينة عيسى", "سترة", "زنج"]],
    ["الشمالية", "Northern", ["أم الحصم", "عوالي", "كرزكان"]],
    ["الجنوبية", "Southern", ["الرفاع", "مدينة حمد", "أبوصبح"]],
    ["المنطقة الجنوبية الغربية", "South Western", ["الدعيا", "الجسرة", "المحرق الغربي الكبير"]],
  ];
  const govIds: Record<string, number> = {};
  const areaIds: string[] = [];
  for (const [ar, en, areasList] of gov) {
    const [g] = await db.insert(governorates).values({ nameAr: ar, nameEn: en }).returning({ id: governorates.id });
    govIds[ar] = g.id;
    for (const [aar, aen] of [
      ["المنامة", "Manama"], ["الحد", "Hidd"], ["سار", "Sarooq"], ["بوليفارد سيتي", "Boulevard City"],
      ["مدينة عيسى", "Madinat Isa"], ["سترة", "Sitra"], ["زنج", "Zinj"], ["أم الحصم", "Umm Al Hushi"],
      ["عوالي", "Ehali"], ["كرزكان", "Karzan"], ["الرفاع", "Riffa"], ["مدينة حمد", "Hamad Town"],
      ["أبوصبح", "Abu Seefah"], ["الدعيا", "Daiya"], ["الجسرة", "Jasra"], ["المحرق الغربي الكبير", "West Muharraq"],
    ]) {
      if (areasList.includes(aar)) {
        const [a] = await db.insert(areas).values({ governorateId: g.id, nameAr: aar, nameEn: aen }).returning({ id: areas.id });
        areaIds.push(aar);
      }
    }
  }

  // ---- Categories ----
  const catDefs: Array<[string, string, string]> = [
    ["برجر", "Burgers", "B"],
    ["بيتزا", "Pizza", "P"],
    ["شاورما", "Shawarma", "S"],
    ["كباب وشواء", "Kebab & Grill", "K"],
    ["حلويات", "Desserts", "D"],
    ["وجبات", "Meals", "M"],
  ];
  const catIds: Record<string, number> = {};
  for (let i = 0; i < catDefs.length; i++) {
    const [ar, en, ic] = catDefs[i];
    const [c] = await db.insert(categories).values({ nameAr: ar, nameEn: en, icon: ic, sort: i }).returning({ id: categories.id });
    catIds[ar] = c.id;
  }

  // ---- Stores ----
  type StoreDef = {
    ar: string; en: string; email: string; banner: string; desc: string;
    cat: string; gov: string; area: string; fee: string; min: string;
    disc: number; pinned: boolean; approved: boolean; hours: { from: string; to: string; enabled: boolean }[];
  };
  const storeDefs: StoreDef[] = [
    { ar: "بيت الكباب البحريني", en: "Bahraini Kebab House", email: "kebab@luqma.store", banner: img.kebab, desc: "كباب مشوي على الفحم، ألذ أطباق اللحوم في البحرين", cat: "كباب وشواء", gov: "العاصمة", area: "بوليفارد سيتي", fee: "1.50", min: "5", disc: 10, pinned: true, approved: true, hours: [{ from: "11:00", to: "14:00", enabled: true }, { from: "17:00", to: "23:30", enabled: true }] },
    { ar: "بيتزا روما", en: "Pizza Roma", email: "pizza@luqma.store", banner: img.pizza, desc: "بيتزا إيطالية حارة مع جبنة موزاريلا فاخرة", cat: "بيتزا", gov: "الجنوبية", area: "مدينة حمد", fee: "1.00", min: "4", disc: 0, pinned: true, approved: true, hours: [{ from: "12:00", to: "23:00", enabled: true }] },
    { ar: "برغر هاوس", en: "Burger House", email: "burger@luqma.store", banner: img.burger, desc: "برجر لحم 100% مع إضافات فاخرة", cat: "برجر", gov: "الشمالية", area: "عوالي", fee: "1.00", min: "3", disc: 0, pinned: false, approved: true, hours: [{ from: "10:00", to: "01:00", enabled: true }] },
    { ar: "شاورما الشيف", en: "Shawarma Al Chef", email: "shawarma@luqma.store", banner: img.doner, desc: "شاورما دجاج ولحم طازجة على مدار اليوم", cat: "شاورما", gov: "المحرق", area: "مدينة عيسى", fee: "0.50", min: "2", disc: 20, pinned: false, approved: true, hours: [{ from: "08:00", to: "23:59", enabled: true }] },
    { ar: "حلا السعادة", en: "Sadaa Sweets", email: "sweets@luqma.store", banner: img.cakes, desc: "حلويات غربية وشرقية فاخرة", cat: "حلويات", gov: "العاصمة", area: "سار", fee: "1.00", min: "3", disc: 15, pinned: false, approved: true, hours: [{ from: "14:00", to: "00:00", enabled: true }] },
    { ar: "الجريل للوجبات", en: "Grill Meals", email: "grill@luqma.store", banner: img.wrap2, desc: "وجبات مشويات وسلطات طازجة", cat: "وجبات", gov: "الجنوبية", area: "الرفاع", fee: "1.50", min: "5", disc: 0, pinned: false, approved: true, hours: [{ from: "11:00", to: "22:00", enabled: true }] },
    { ar: "مطعم النخيل الجديد", en: "Al Nakheel", email: "nakheel@luqma.store", banner: img.fastfood, desc: "مطعم جديد قيد المراجعة", cat: "وجبات", gov: "العاصمة", area: "الحد", fee: "1.00", min: "3", disc: 0, pinned: false, approved: false, hours: [{ from: "11:00", to: "23:00", enabled: true }] },
  ];
  const storeIds: Record<string, number> = {};
  for (const s of storeDefs) {
    const [row] = await db
      .insert(stores)
      .values({
        nameAr: s.ar, nameEn: s.en, ownerName: "مالك المطعم", email: s.email, phone: "+973 3XXX XXX",
        passwordHash: hashPassword("Store#2024"),
        bannerUrl: s.banner, logoUrl: null, description: s.desc,
        categoryId: catIds[s.cat], governorateId: govIds[s.gov], areaId: areaIds.indexOf(s.area) >= 0 ? undefined : undefined,
        deliveryFee: s.fee, minOrder: s.min, status: "open", workingHours: s.hours,
        discountPercent: s.disc, pinned: s.pinned, approved: s.approved,
      })
      .returning({ id: stores.id });
    storeIds[s.en] = row.id;
  }

  // ---- Products ----
  type PDef = { store: string; cat: string; ar: string; en: string; price: string; old?: string; disc: number; image: string; desc: string };
  const pDefs: PDef[] = [
    { store: "Bahraini Kebab House", cat: "كباب وشواء", ar: "كباب مشوي على الفحم", en: "Charcoal Kebab", price: "3.500", old: "4.500", disc: 10, image: img.kebab, desc: "قطعة كباب مشوية مع رز وسلطة" },
    { store: "Bahraini Kebab House", cat: "كباب وشواء", ar: "طقم كباب عائلي", en: "Family Kebab Platter", price: "12.000", disc: 0, image: img.kebab2, desc: "يكفي 3-4 أشخاص مع خبز وخبز" },
    { store: "Bahraini Kebab House", cat: "شاورما", ar: "شاورما لحمة على الفحم", en: "Grill Beef Shawarma", price: "1.750", disc: 0, image: img.doner, desc: "شاورما لحمة طازجة مع ثومية" },
    { store: "Bahraini Kebab House", cat: "وجبات", ar: "مشاوي مشكلة", en: "Mixed Grill", price: "6.500", disc: 0, image: img.wrap2, desc: "كباب، كبدة، ونص برياني" },
    { store: "Pizza Roma", cat: "بيتزا", ar: "بيتزا بيتشن بانية", en: "Pepperoni Pizza", price: "3.250", old: "4.000", disc: 10, image: img.pizza, desc: "بيتشن بانية موزاريلا وريحان" },
    { store: "Pizza Roma", cat: "بيتزا", ar: "بيتزا خضار", en: "Veggie Pizza", price: "2.750", disc: 0, image: img.fastfood, desc: "خضار طازجة مع جبنة" },
    { store: "Pizza Roma", cat: "حلويات", ar: "تيراميسو", en: "Tiramisu", price: "1.500", disc: 0, image: img.dessert3, desc: "تيراميسو إيطالي أصلي" },
    { store: "Burger House", cat: "برجر", ar: "برجر كلاسيك", en: "Classic Burger", price: "2.500", disc: 0, image: img.burger, desc: "برجر لحم مع جبنة شيدر" },
    { store: "Burger House", cat: "برجر", ar: "دبل شيك برجر", en: "Double Cheese Burger", price: "3.750", old: "4.500", disc: 10, image: img.burgers, desc: "قطعتي لحم موزاريلا مزدوجة" },
    { store: "Burger House", cat: "وجبات", ar: "سيت برجر مع بطاطس", en: "Burger Meal", price: "4.000", disc: 0, image: img.burger2, desc: "برجر + بطاطس مقلية + مشروب" },
    { store: "Shawarma Al Chef", cat: "شاورما", ar: "شاورما دجاج", en: "Chicken Shawarma", price: "1.250", old: "1.750", disc: 20, image: img.doner, desc: "شاورما دجاج مع خس وطماطم" },
    { store: "Shawarma Al Chef", cat: "شاورما", ar: "شاورما لحمة", en: "Beef Shawarma", price: "1.500", old: "2.000", disc: 20, image: img.wrap, desc: "شاورما لحمة طازجة" },
    { store: "Shawarma Al Chef", cat: "وجبات", ar: "بوكس شاورما عائلي", en: "Shawarma Family Box", price: "8.000", disc: 0, image: img.fastfood, desc: "4 شاورما + بطاطس + 4 مشروبات" },
    { store: "Sadaa Sweets", cat: "حلويات", ar: "تشيز كيك فراولة", en: "Strawberry Cheesecake", price: "2.000", old: "2.500", disc: 15, image: img.dessert1, desc: "تشيز كيك بارد مع فراولة طازجة" },
    { store: "Sadaa Sweets", cat: "حلويات", ar: "تorta شوكولاتة", en: "Chocolate Torta", price: "1.750", old: "2.250", disc: 15, image: img.dessert4, desc: "شوكولاتة سويسرية فاخرة" },
    { store: "Sadaa Sweets", cat: "حلويات", ar: "فوندو كريمي", en: "Crème Fondant", price: "2.250", old: "2.750", disc: 15, image: img.dessert2, desc: "كعكة شوكولاتة ساخنة بقلب كريمي" },
    { store: "Grill Meals", cat: "كباب وشواء", ar: "منقيلة لحم", en: "Beef Manqale", price: "4.500", disc: 0, image: img.wrap2, desc: "منقيلة بحرينية تقليدية" },
    { store: "Grill Meals", cat: "وجبات", ar: "برياني دجاج", en: "Chicken Biryani", price: "2.750", disc: 0, image: img.wrap, desc: "برياني على الطريقة البحرينية" },
    { store: "Grill Meals", cat: "وجبات", ar: "سلطة زعتر وليمون", en: "Lemon Zaatar Salad", price: "1.250", disc: 0, image: img.fastfood, desc: "خضار طازجة بزيت الزيتون" },
  ];
  const prodIds: Record<string, number> = {};
  for (const p of pDefs) {
    const [row] = await db
      .insert(products)
      .values({
        storeId: storeIds[p.store], categoryId: catIds[p.cat],
        nameAr: p.ar, nameEn: p.en, description: p.desc,
        price: p.price, oldPrice: p.old || null, discountPercent: p.disc,
        available: true, images: [p.image],
        options: [
          { name: "الحجم", nameEn: "Size", choices: [{ name: "عادي", price: 0 }, { name: "كبير +0.50", price: 0.5 }] },
          { name: "إضافات", nameEn: "Extras", choices: [{ name: "جبنة إضافية", price: 0.35 }, { name: "صلصة خاصة", price: 0.25 }] },
        ],
      })
      .returning({ id: products.id });
    prodIds[p.en] = row.id;
  }

  // ---- Customer ----
  const [cust] = await db
    .insert(customers)
    .values({ name: "أحمد العلي", email: "demo@luqma.store", phone: "+973 3900 1111", passwordHash: hashPassword("Demo#2024"), bonusBalance: "10.00", emailVerified: true })
    .returning({ id: customers.id });
  const [addr] = await db
    .insert(customerAddresses)
    .values({ customerId: cust.id, label: "المنزل", isDefault: true, line: "شارع الجبيهة، شارع 25، بناية 8", governorateId: govIds["العاصمة"], areaId: 1 })
    .returning({ id: customerAddresses.id });
  void addr;

  // ---- Drivers ----
  const [drv] = await db
    .insert(drivers)
    .values({ name: "سامي حسين", email: "sami@luqma.store", phone: "+973 3955 2222", passwordHash: hashPassword("Driver#2024"), vehicle: "موتوسيكل", approved: true, active: true, isOnline: false })
    .returning({ id: drivers.id });
  await db.insert(drivers).values({ name: "خالد يوسف", email: "khaled@luqma.store", phone: "+973 3988 3333", passwordHash: hashPassword("Driver#2024"), vehicle: "سيارة", approved: false, active: true });

  // ---- Sample Orders ----
  const kebab = prodIds["Charcoal Kebab"];
  const pizza = prodIds["Pepperoni Pizza"];
  const shaw = prodIds["Chicken Shawarma"];
  const ordersData: Array<{
    storeId: number; items: Array<{ pid: number; name: string; qty: number; unit: number }>;
    status: string; daysAgo: number; driver?: boolean; method: string;
  }> = [
    { storeId: storeIds["Bahraini Kebab House"], items: [{ pid: kebab, name: "كباب مشوي على الفحم", qty: 2, unit: 3.85 }, { pid: prodIds["Grill Beef Shawarma"], name: "شاورما لحمة على الفحم", qty: 1, unit: 2.0 }], status: "delivered", daysAgo: 3, driver: true, method: "cod" },
    { storeId: storeIds["Pizza Roma"], items: [{ pid: pizza, name: "بيتزا بيتشن بانية", qty: 1, unit: 3.6 }], status: "delivered", daysAgo: 2, driver: true, method: "card" },
    { storeId: storeIds["Shawarma Al Chef"], items: [{ pid: shaw, name: "شاورما دجاج", qty: 2, unit: 1.6 }], status: "delivered", daysAgo: 1, driver: true, method: "benefi" },
    { storeId: storeIds["Burger House"], items: [{ pid: prodIds["Classic Burger"], name: "برجر كلاسيك", qty: 1, unit: 3.0 }], status: "delivered", daysAgo: 0, driver: true, method: "cod" },
    { storeId: storeIds["Bahraini Kebab House"], items: [{ pid: kebab, name: "كباب مشوي على الفحم", qty: 1, unit: 3.85 }], status: "pending", daysAgo: 0, method: "cod" },
  ];
  let cancelledOne = false;
  for (const o of ordersData) {
    const when = new Date(Date.now() - o.daysAgo * 864e5);
    let subtotal = 0;
    for (const it of o.items) subtotal += it.qty * it.unit;
    const discPct = o.status === "pending" ? 10 : 0;
    const disc = (subtotal * discPct) / 100;
    const fee = 1.5;
    const total = subtotal - disc + fee;
    const orderNo = "LQ-SEED" + Math.floor(Math.random() * 9000 + 1000);
    const deliveredAt = o.status === "delivered" ? new Date(when.getTime() + 40 * 60000) : null;
    const [order] = await db
      .insert(orders)
      .values({
        orderNo, customerId: cust.id, storeId: o.storeId, driverId: o.driver ? drv.id : null,
        customerName: "أحمد العلي", address: { label: "المنزل", line: "شارع الجبيهة، شارع 25" },
        items: o.items.map((it) => ({ nameAr: it.name, qty: it.qty, unitPrice: it.unit, lineTotal: it.qty * it.unit })),
        subtotal: subtotal.toFixed(2), discountAmount: disc.toFixed(2), deliveryFee: fee.toFixed(2),
        bonusUsed: "0", total: total.toFixed(2), paymentMethod: o.method, status: o.status,
        placedAt: when, storeAcceptedAt: new Date(when.getTime() + 2 * 60000),
        readyAt: o.status === "delivered" ? new Date(when.getTime() + 20 * 60000) : null,
        driverAcceptedAt: o.driver ? new Date(when.getTime() + 25 * 60000) : null,
        deliveredAt,
      })
      .returning();
    for (const it of o.items) {
      await db.insert(orderItems).values({ orderId: order.id, productId: it.pid, name: it.name, qty: it.qty, unitPrice: it.unit.toFixed(2), lineTotal: (it.qty * it.unit).toFixed(2), options: [] });
    }
    if (!cancelledOne && o.status === "pending") {
      // create one historical cancelled order + log instead
      cancelledOne = true;
      void 0;
    }
  }
  // historical cancelled order with log
  const cno = "LQ-SEED" + Math.floor(Math.random() * 9000 + 1000);
  const [co] = await db
    .insert(orders)
    .values({
      orderNo: cno, customerId: cust.id, storeId: storeIds["Pizza Roma"],
      customerName: "أحمد العلي", address: { label: "المنزل", line: "شارع الجبيهة" },
      items: [{ nameAr: "بيتزا بيتشن بانية", qty: 1, unitPrice: 3.6, lineTotal: 3.6 }],
      subtotal: "3.60", discountAmount: "0", deliveryFee: "1.00", bonusUsed: "0", total: "4.60",
      paymentMethod: "cod", status: "cancelled", cancelledReason: "تأخر في التوصيل",
      placedAt: new Date(Date.now() - 5 * 864e5),
    })
    .returning({ id: orders.id });
  await db.insert(cancelledOrdersLog).values({
    orderNo: cno, storeId: storeIds["Pizza Roma"], storeName: "بيتزا روما",
    customerName: "أحمد العلي", actor: "customer", reason: "تأخر في التوصيل", total: "4.60",
    createdAt: new Date(Date.now() - 5 * 864e5 + 6 * 60000),
  });
  void co;

  console.log("Seed complete.");
  console.log("Master admin: moosameftah / Vsml3142@");
  console.log("Sub-admin:    ops / Ops#2024x");
  console.log("Customer:     demo@luqma.store / Demo#2024");
  console.log("Store:        pizza@luqma.store / Store#2024");
  console.log("Driver:       sami@luqma.store / Driver#2024");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
