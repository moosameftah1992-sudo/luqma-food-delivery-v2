import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SalesReport, DriverReport } from "@/lib/admin-reports";
import { fmtFils } from "@/lib/util";

type Cell = string | number;
type TableSpec = {
  title: string;
  headers: string[];
  rows: Cell[][];
  widths: number[];
  money?: number[];
};

function money(fils: number) { return Number((fils / 1000).toFixed(3)); }
function timestamp(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

function salesTables(data: SalesReport): TableSpec[] {
  const total = data.totals;
  return [
    { title: "ملخص المبيعات", headers: ["المؤشر", "القيمة"], rows: [
      ["من", data.filters.from], ["إلى", data.filters.to],
      ["الطلبات المكتملة والمدفوعة", total.orders],
      ["إجمالي المبيعات مع التوصيل (د.ب)", money(total.salesFils)],
      ["مبيعات الطعام بعد الخصومات (د.ب)", money(total.foodSalesFils)],
      ["الخصومات (د.ب)", money(total.discountFils)],
      ["رسوم التوصيل (د.ب)", money(total.deliveryFeesFils)],
      ["عمولة المنصة من المتاجر (د.ب)", money(total.storeCommissionFils)],
      ["عمولة المنصة من التوصيل (د.ب)", money(total.deliveryCommissionFils)],
      ["إيراد المنصة (د.ب)", money(total.platformRevenueFils)],
      ["الطلبات الملغاة والمرفوضة", total.cancellations],
    ], widths: [46, 28], money: [1] },
    { title: "مبيعات المطاعم", headers: ["المطعم", "الطلبات", "الطعام د.ب", "الخصم د.ب", "التوصيل د.ب", "عمولة المتجر د.ب", "صافي المتجر د.ب"],
      rows: data.breakdown.map((r) => [r.name, r.orders, money(r.foodSalesFils), money(r.discountFils), money(r.deliveryFeesFils), money(r.storeCommissionFils), money(r.storeNetFils)]),
      widths: [26, 11, 18, 16, 19, 23, 23], money: [2, 3, 4, 5, 6] },
    { title: "المبيعات حسب الفترة", headers: ["الفترة", "الطلبات", "الطعام د.ب", "الخصم د.ب", "التوصيل د.ب", "مبيعات كلية د.ب", "إيراد المنصة د.ب"],
      rows: data.timeline.map((r) => [r.period, r.orders, money(r.foodSalesFils), money(r.discountFils), money(r.deliveryFeesFils), money(r.salesFils), money(r.platformRevenueFils)]),
      widths: [18, 12, 19, 17, 19, 23, 24], money: [2, 3, 4, 5, 6] },
    { title: "الطلبات المكتملة", headers: ["الطلب", "التاريخ", "المطعم", "العميل", "المندوب", "الطعام د.ب", "الخصم د.ب", "التوصيل د.ب", "الإجمالي د.ب"],
      rows: data.completed.map((r) => [r.code, timestamp(r.placedAt), r.storeName, r.customerName, r.driverName, money(r.grossFils), money(r.discountFils), money(r.deliveryFeesFils), money(r.totalFils)]),
      widths: [18, 22, 26, 24, 23, 17, 17, 19, 19], money: [5, 6, 7, 8] },
    { title: "سجل الطلبات الملغاة", headers: ["رقم الطلب", "التاريخ", "المطعم", "اسم العميل", "هاتف العميل", "الحالة", "أُلغي بواسطة", "سبب الإلغاء", "تفاصيل الأصناف", "العنوان", "القيمة د.ب", "حالة الدفع"],
      rows: data.cancellations.map((r) => [r.code, timestamp(r.placedAt), r.storeName, r.customerName, r.customerPhone, r.statusLabel, r.cancelledBy, r.reason, r.items.join(" | "), r.address, money(r.totalFils), r.paymentStatus]),
      widths: [18, 22, 26, 24, 19, 28, 20, 35, 55, 35, 18, 20], money: [10] },
  ];
}

function driverTables(data: DriverReport): TableSpec[] {
  const total = data.totals;
  return [
    { title: "ملخص توصيل المندوبين", headers: ["المؤشر", "القيمة"], rows: [
      ["من", data.filters.from], ["إلى", data.filters.to],
      ["الطلبات المكتملة والمدفوعة", total.completed],
      ["إجمالي رسوم التوصيل (د.ب)", money(total.deliveryFeesFils)],
      ["عمولة المنصة من التوصيل (د.ب)", money(total.commissionFils)],
      ["صافي استحقاق المندوبين (د.ب)", money(total.netFils)],
      ["المدفوع في هذه الفترة (د.ب)", money(total.paidFils)],
      ["فرق الاستحقاق والمدفوع في الفترة (د.ب)", money(total.remainingFils)],
    ], widths: [52, 28], money: [1] },
    { title: "مستحقات كل مندوب", headers: ["المندوب", "البريد", "الطلبات", "رسوم التوصيل د.ب", "عمولة المنصة د.ب", "صافي المستحق د.ب", "المدفوع د.ب"],
      rows: data.breakdown.map((r) => [r.name, r.email, r.completed, money(r.deliveryFeesFils), money(r.commissionFils), money(r.netFils), money(r.paidFils)]),
      widths: [26, 35, 12, 23, 23, 23, 19], money: [3, 4, 5, 6] },
    { title: "التوصيلات حسب الفترة", headers: ["الفترة", "الطلبات المكتملة", "رسوم التوصيل د.ب", "عمولة المنصة د.ب", "صافي المندوب د.ب"],
      rows: data.timeline.map((r) => [r.period, r.completed, money(r.deliveryFeesFils), money(r.commissionFils), money(r.netFils)]),
      widths: [23, 21, 28, 28, 26], money: [2, 3, 4] },
    { title: "تفاصيل التوصيلات", headers: ["الطلب", "التاريخ", "المندوب", "المطعم", "رسوم التوصيل د.ب", "العمولة %", "عمولة المنصة د.ب", "صافي المندوب د.ب"],
      rows: data.orders.map((r) => [r.code, timestamp(r.placedAt), r.driverName, r.storeName, money(r.deliveryFeesFils), r.commissionPct, money(r.commissionFils), money(r.netFils)]),
      widths: [18, 23, 25, 25, 23, 15, 24, 24], money: [4, 6, 7] },
    { title: "المدفوعات", headers: ["التاريخ", "المندوب", "القيمة د.ب", "البيان"],
      rows: data.payouts.map((r) => [timestamp(r.createdAt), r.driverName, money(r.amountFils), r.note]),
      widths: [24, 27, 20, 48], money: [2] },
  ];
}

function makeWorkbook(tables: TableSpec[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Luqma Administration";
  workbook.created = new Date();
  for (const table of tables) {
    const sheet = workbook.addWorksheet(table.title, { views: [{ state: "frozen", ySplit: 1, rightToLeft: true }] });
    sheet.columns = table.headers.map((label, index) => ({ header: label, key: `col${index}`, width: table.widths[index] }));
    sheet.getRow(1).height = 32;
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Noto Sans Arabic", size: 11 };
    sheet.getRow(1).alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF281044" } };
    for (const cells of table.rows) {
      const row = sheet.addRow(cells);
      row.font = { name: "Noto Sans Arabic", size: 10, color: { argb: "FF281044" } };
      row.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      row.height = Math.min(90, 26 + Math.max(0, ...cells.map((cell) => String(cell).length - 55)) / 3);
      if (row.number % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F5EE" } };
      for (const index of table.money ?? []) row.getCell(index + 1).numFmt = '0.000 "د.ب"';
    }
    sheet.autoFilter = table.headers.length > 2 ? { from: "A1", to: `${String.fromCharCode(64 + table.headers.length)}1` } : undefined;
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  return workbook;
}

export async function salesXlsx(data: SalesReport) {
  const bytes = await makeWorkbook(salesTables(data)).xlsx.writeBuffer();
  return Buffer.from(bytes);
}
export async function driverXlsx(data: DriverReport) {
  const bytes = await makeWorkbook(driverTables(data)).xlsx.writeBuffer();
  return Buffer.from(bytes);
}

function pdf(tables: TableSpec[], title: string, from: string, to: string, cancellations?: SalesReport["cancellations"]): Promise<Buffer> {
  const fontPath = join(process.cwd(), "src/assets/fonts/NotoSansArabic.ttf");
  const font = readFileSync(fontPath);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 38, info: { Title: title, Author: "Luqma Administration" } });
    const chunks: Buffer[] = [];
    let y = 96;
    const width = doc.page.width - 76;
    const bottom = doc.page.height - 40;
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.registerFont("LuqmaArabic", font);
    function header() {
      doc.rect(0, 0, doc.page.width, 72).fill("#281044");
      doc.font("LuqmaArabic").fillColor("#FFC432").fontSize(20).text("لقمة  |  Luqma", 38, 16, { width: 360, align: "right", lineBreak: false });
      doc.font("LuqmaArabic").fillColor("#FFFFFF").fontSize(12).text(title, 405, 21, { width: doc.page.width - 443, align: "right", lineBreak: false });
      doc.font("LuqmaArabic").fillColor("#BCAACF").fontSize(8).text(`${from}   —   ${to}  (توقيت البحرين)`, 38, 53, { width: doc.page.width - 76, align: "right", lineBreak: false });
      y = 96;
    }
    doc.on("pageAdded", header);
    header();
    function ensure(height: number) { if (y + height > bottom) doc.addPage(); }
    function section(text: string) {
      ensure(52);
      doc.rect(38, y, width, 33).fill("#F5EFE3");
      doc.fillColor("#281044").font("LuqmaArabic").fontSize(13).text(text, 51, y + 6, { width: width - 26, align: "right", lineBreak: false });
      y += 44;
    }
    function table(spec: TableSpec) {
      section(spec.title);
      if (!spec.rows.length) {
        ensure(32);
        doc.fillColor("#877594").fontSize(10).text("لا توجد بيانات في الفترة المختارة", 50, y, { width: width - 24, align: "right" });
        y += 30;
        return;
      }
      const sum = spec.widths.reduce((a, b) => a + b, 0);
      const columnWidths = spec.widths.map((w) => w * width / sum);
      const drawCells = (cells: Cell[], height: number, headerRow: boolean, index: number) => {
        ensure(height);
        doc.rect(38, y, width, height).fill(headerRow ? "#3D1A60" : index % 2 === 0 ? "#FFFFFF" : "#F9F6F0");
        let x = 38;
        for (let i = 0; i < cells.length; i++) {
          const w = columnWidths[i];
          const text = String(cells[i] ?? "");
          doc.font("LuqmaArabic").fontSize(headerRow ? 8.5 : 8).fillColor(headerRow ? "#FFFFFF" : "#281044")
            .text(text, x + 5, y + 5, { width: w - 10, height: height - 8, align: "right", lineGap: 1, ellipsis: true });
          x += w;
        }
        y += height;
      };
      drawCells(spec.headers, 31, true, 0);
      spec.rows.forEach((cells, index) => {
        doc.font("LuqmaArabic").fontSize(8);
        const height = Math.max(30, ...cells.map((cell, i) => doc.heightOfString(String(cell ?? ""), { width: columnWidths[i] - 10, lineGap: 1 }) + 10));
        const rowHeight = Math.min(height, bottom - 105);
        if (y + rowHeight > bottom) {
          doc.addPage();
          drawCells(spec.headers, 31, true, 0);
        }
        drawCells(cells, rowHeight, false, index);
      });
      y += 12;
    }
    for (const spec of tables) table(spec);
    if (cancellations) {
      section("السجل التفصيلي للطلبات الملغاة والمرفوضة");
      if (!cancellations.length) {
        ensure(30);
        doc.font("LuqmaArabic").fontSize(10).fillColor("#877594")
          .text("لا توجد طلبات ملغاة خلال هذه الفترة", 50, y, { width: width - 24, align: "right" });
        y += 30;
      }
      const paragraph = (value: string, color = "#281044") => {
        for (const fragment of value.match(/[\s\S]{1,160}/gu) ?? [""]) {
          doc.font("LuqmaArabic").fontSize(9);
          const height = Math.max(20, doc.heightOfString(fragment, { width: width - 30, lineGap: 2 }) + 5);
          ensure(height);
          doc.fillColor(color).text(fragment, 50, y, { width: width - 30, align: "right", lineGap: 2 });
          y += height;
        }
      };
      for (const record of cancellations) {
        ensure(74);
        doc.rect(38, y, width, 30).fill("#3D1A60");
        doc.font("LuqmaArabic").fontSize(10).fillColor("#FFFFFF")
          .text(`${record.code}  |  ${record.storeName}  |  ${record.statusLabel}  |  ${timestamp(record.placedAt)}`, 48, y + 5, { width: width - 20, height: 20, align: "right", ellipsis: true });
        y += 38;
        paragraph(`العميل: ${record.customerName}  |  الهاتف: ${record.customerPhone || "—"}  |  القيمة: ${fmtFils(record.totalFils)}`);
        paragraph(`أُلغي بواسطة: ${record.cancelledBy}  |  حالة الدفع: ${record.paymentStatus}`);
        paragraph(`السبب: ${record.reason}`, "#B54046");
        paragraph(`العنوان: ${record.address || "—"}`);
        if (record.items.length) for (const item of record.items) paragraph(`الصنف: ${item}`);
        else paragraph("الأصناف: لا يوجد تفصيل محفوظ");
        y += 13;
      }
    }
    doc.end();
  });
}

export function salesPdf(data: SalesReport) {
  const { from, to } = data.filters;
  return pdf(salesTables(data).slice(0, -1), "تقرير المبيعات والطلبات الملغاة", from, to, data.cancellations);
}
export function driverPdf(data: DriverReport) {
  const { from, to } = data.filters;
  return pdf(driverTables(data), "تقرير التوصيل وعمولات المندوبين", from, to);
}
