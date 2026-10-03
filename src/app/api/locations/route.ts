import { NextResponse } from "next/server";
import { db } from "@/db";
import { governorates, areas } from "@/db/schema";

export async function GET() {
  const [g, a] = await Promise.all([db.select().from(governorates), db.select().from(areas)]);
  return NextResponse.json({ governorates: g, areas: a });
}
