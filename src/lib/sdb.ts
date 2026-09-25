import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";

/** Wait for atomic schema creation and non-destructive defaults before any query. */
export async function getDb() {
  await ensureSeeded();
  return db;
}

