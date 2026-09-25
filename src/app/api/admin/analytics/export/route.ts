import { can, getSession } from "@/lib/auth";
import { buildDriverReport, buildSalesReport, parseReportFilters } from "@/lib/admin-reports";
import { driverPdf, driverXlsx, salesPdf, salesXlsx } from "@/lib/admin-export";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession("admin");
  if (!session) return Response.json({ error: "تسجيل الدخول مطلوب" }, { status: 401 });
  const url = new URL(req.url);
  const section = url.searchParams.get("section");
  const format = url.searchParams.get("format");
  if ((section !== "sales" && section !== "drivers") || (format !== "xlsx" && format !== "pdf"))
    return Response.json({ error: "اختر نوع تقرير وصيغة تنزيل صحيحة" }, { status: 400 });
  if (section === "sales" && !(can(session, "finance") || can(session, "operations")))
    return Response.json({ error: "ليس لديك صلاحية لتصدير المبيعات" }, { status: 403 });
  if (section === "drivers" && !(can(session, "finance") || can(session, "operations") || can(session, "users")))
    return Response.json({ error: "ليس لديك صلاحية لتصدير تقارير المندوبين" }, { status: 403 });
  const parsed = parseReportFilters(url);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    let bytes: Buffer;
    if (section === "sales") {
      const data = await buildSalesReport(parsed.value);
      bytes = format === "xlsx" ? await salesXlsx(data) : await salesPdf(data);
    } else {
      const data = await buildDriverReport(parsed.value);
      bytes = format === "xlsx" ? await driverXlsx(data) : await driverPdf(data);
    }
    const filename = `luqma-${section}-${parsed.value.from}-to-${parsed.value.to}.${format}`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[luqma] report export failed", error);
    return Response.json({ error: "تعذّر إعداد الملف، حاول مجدداً" }, { status: 503 });
  }
}
