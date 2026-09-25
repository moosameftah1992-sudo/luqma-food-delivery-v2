import { can, getSession } from "@/lib/auth";
import { buildDriverReport, buildSalesReport, parseReportFilters } from "@/lib/admin-reports";

export const runtime = "nodejs";
export async function GET(req: Request) {
  const session = await getSession("admin");
  if (!session) return Response.json({ error: "تسجيل الدخول مطلوب" }, { status: 401 });
  const url = new URL(req.url);
  const section = url.searchParams.get("section") || "sales";
  if (section !== "sales" && section !== "drivers")
    return Response.json({ error: "نوع التقرير غير صالح" }, { status: 400 });
  if (section === "sales" && !(can(session, "finance") || can(session, "operations")))
    return Response.json({ error: "صلاحية التقارير المالية أو العمليات مطلوبة" }, { status: 403 });
  if (section === "drivers" && !(can(session, "finance") || can(session, "operations") || can(session, "users")))
    return Response.json({ error: "ليس لديك صلاحية لتقارير المندوبين" }, { status: 403 });
  const filters = parseReportFilters(url);
  if (!filters.ok) return Response.json({ error: filters.error }, { status: 400 });
  try {
    const data = section === "sales" ? await buildSalesReport(filters.value) : await buildDriverReport(filters.value);
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[luqma] admin analytics failed", error);
    return Response.json({ error: "تعذّر إنشاء التقرير. حاول مرة أخرى." }, { status: 503 });
  }
}
