import { getDb } from "@/lib/sdb";
import { settings } from "@/db/schema";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select({ key: settings.key }).from(settings).limit(1);
    if (!rows.length) {
      return Response.json({ ok: false, db: "uninitialized" }, { status: 503 });
    }
    return Response.json({
      ok: true,
      app: "لقمة Luqma",
      db: "ready",
      ts: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[luqma] healthcheck failed:", error);
    return Response.json(
      { ok: false, db: "unavailable", error: "Database initialization failed" },
      { status: 503 },
    );
  }
}
