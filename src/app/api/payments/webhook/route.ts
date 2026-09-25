import { reconcileCharge, retrieveTapCharge, verifyTapWebhookSignature, type TapCharge } from "@/lib/tap";

export const runtime = "nodejs";
export async function POST(req: Request) {
  let payload: TapCharge;
  try { payload = await req.json() as TapCharge; } catch { return Response.json({ error: "invalid body" }, { status: 400 }); }
  if (payload?.object !== undefined && payload.object !== "charge") return Response.json({ ok: true });
  if (!payload?.id || !verifyTapWebhookSignature(payload, req.headers.get("hashstring")))
    return Response.json({ error: "invalid signature" }, { status: 401 });
  try {
    // Never trust the webhook body alone: retrieve the charge using the server key.
    const charge = await retrieveTapCharge(payload.id);
    const result = await reconcileCharge(charge);
    return Response.json({ ok: true, status: result.status });
  } catch (error) {
    console.error("[luqma] payment webhook failure", error);
    return Response.json({ error: "processing failed" }, { status: 503 });
  }
}
