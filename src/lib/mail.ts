/**
 * Email delivery via Resend API (luqma.store domain).
 * If the API is unreachable (e.g. sandboxed/offline), it degrades gracefully:
 * the message body is returned so the UI can surface the code for demo purposes.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Luqma <onboarding@resend.dev>",
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
        }),
      });
      if (res.ok) return { sent: true };
    } catch {
      /* fall through to offline mode */
    }
  }
  console.log(`[mail:offline] to=${opts.to} :: ${opts.text}`);
  return { sent: false };
}

export function mailShell(title: string, bodyHtml: string) {
  return `
  <div dir="rtl" style="background:#14061F;padding:24px;font-family:Tajawal,Segoe UI,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#24093F;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#3A1163,#24093F);padding:24px;text-align:center">
        <div style="font-size:28px;font-weight:800;color:#F7B500">لقمة Luqma</div>
        <div style="color:#cbb8e6;font-size:13px;margin-top:4px">${title}</div>
      </div>
      <div style="padding:28px 24px;color:#f3ecff">
        ${bodyHtml}
      </div>
      <div style="background:#1b0831;padding:16px;text-align:center;color:#8f7bb3;font-size:12px">
        luqma.store — تم الإرسال تلقائياً
      </div>
    </div>
  </div>`;
}

export function codeBlock(code: string) {
  return `<div style="text-align:center;margin:20px 0">
    <div style="font-size:40px;font-weight:800;letter-spacing:8px;color:#F7B500;background:#1b0831;border:1px dashed #F7B500;border-radius:12px;padding:16px">${code}</div>
  </div>`;
}

export function baseHref() {
  return process.env.BASE_URL || "http://localhost:3000";
}
