import { createHash, randomBytes } from "node:crypto";

export const EMAIL_TOKEN_HOURS = 24;

export function createVerification() {
  const token = randomBytes(32).toString("hex");
  return { token, digest: digestToken(token), expiresAt: new Date(Date.now() + EMAIL_TOKEN_HOURS * 60 * 60 * 1000) };
}

export function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicOrigin() {
  const configured = process.env.APP_URL?.trim();
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  const candidate = configured || (vercelDomain ? `https://${vercelDomain.replace(/^https?:\/\//, "")}` : "");
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      return url.origin;
  } catch { /* No trusted public URL configured. */ }
  return null;
}

export function mailConfigurationIssue(): string | null {
  if (!process.env.RESEND_API_KEY?.trim())
    return "خدمة البريد غير مهيأة: أضف RESEND_API_KEY في إعدادات الخادم.";
  const from = process.env.MAIL_FROM?.trim() || "";
  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(from.replace(/^.*<([^<>]+)>$/, "$1")) ||
      (process.env.NODE_ENV === "production" && /@resend\.dev$/i.test(from.replace(/^.*<([^<>]+)>$/, "$1"))))
    return "تحقق من MAIL_FROM: يجب أن يكون بريد مرسل تابعاً لنطاق موثّق في Resend، وليس resend.dev للإرسال العام.";
  if (!publicOrigin())
    return "تعذر تحديد رابط الموقع العام: أضف APP_URL بعنوان HTTPS أو فعّل نطاق Vercel.";
  return null;
}

export function mailConfigured() {
  return mailConfigurationIssue() === null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

export async function sendVerificationMail({ email, name, role, token }: { email: string; name: string; role: "customer" | "driver"; token: string }) {
  const issue = mailConfigurationIssue();
  if (issue) throw new Error(issue);
  const origin = publicOrigin()!;
  const url = `${origin}/verify?role=${role}&token=${encodeURIComponent(token)}`;
  const button = role === "driver" ? "تأكيد بريد المندوب" : "تأكيد بريد العميل";
  const html = `<div dir="rtl" style="background:#19082f;padding:36px 18px;font-family:Arial,sans-serif;color:#fff"><div style="max-width:520px;margin:auto;background:#281044;border-radius:22px;overflow:hidden;border:1px solid #5b367a"><div style="background:linear-gradient(115deg,#ffdf2b,#ff7317);height:7px"></div><div style="padding:32px"><p style="font-size:28px;font-weight:800;margin:0 0 20px;color:#ffc83d">لقمة · Luqma</p><h1 style="font-size:25px;margin:0 0 12px">أهلاً ${escapeHtml(name)}</h1><p style="line-height:1.9;color:#e2d6ed">لتأكيد عنوان بريدك الإلكتروني في لقمة، اضغط الزر أدناه. الرابط صالح لمدة ${EMAIL_TOKEN_HOURS} ساعة ويُستخدم مرة واحدة فقط.</p>${role === "driver" ? '<p style="color:#ffcf56">بعد تأكيد البريد، يبقى حساب المندوب قيد مراجعة إدارة لقمة حتى الموافقة النهائية.</p>' : ''}<p style="margin:30px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#ffbb26;padding:14px 27px;border-radius:11px;color:#24103e;text-decoration:none;font-weight:800">${button}</a></p><p style="font-size:12px;color:#c6b8d5;word-break:break-all">If the button does not work, open: ${escapeHtml(url)}</p><p style="font-size:12px;color:#c6b8d5">If you did not create this account, ignore this message.</p></div></div></div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `luqma-verify-${digestToken(token)}` },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [email],
      subject: "لقمة | تأكيد البريد الإلكتروني · Verify your email",
      html,
      text: `مرحباً ${name}\nيرجى تأكيد بريدك الإلكتروني بالنقر على الرابط التالي خلال ${EMAIL_TOKEN_HOURS} ساعة:\n${url}\n${role === "driver" ? "بعد التأكيد، يظل حساب المندوب قيد موافقة الإدارة.\n" : ""}إذا لم تنشئ هذا الحساب فتجاهل الرسالة.\n\nVerify your email within ${EMAIL_TOKEN_HOURS} hours: ${url}`,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    console.error("[luqma] email provider rejected request", response.status, await response.text());
    throw new Error("MAIL_DELIVERY_FAILED");
  }
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("MAIL_DELIVERY_FAILED");
  return result.id;
}
