import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > MAX) {
      return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 });
    }
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const safeName = `luqma_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext === "svg" ? "svg" : ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(dir, safeName), buf);
    return NextResponse.json({ url: `/uploads/${safeName}`, path: safeName });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
