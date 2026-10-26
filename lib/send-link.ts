import { brandedSignInLink, signInEmailHtml, signInEmailText, SIGNIN_SUBJECT } from "./signin-email";

export const DEFAULT_EMAIL_FROM = "Taverning <noreply@mail.taverning.com>";

export type ResendSendResult = { ok: true } | { ok: false; status: number; reason: string };

export function emailFromAddress(): string {
  return process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
}

export async function sendViaResend(to: string, link: string, code: string, fetchImpl: typeof fetch = fetch): Promise<ResendSendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = emailFromAddress();
  if (!key) return { ok: false, status: 0, reason: "RESEND_API_KEY is not set" };
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: SIGNIN_SUBJECT,
      html: signInEmailHtml(link, code),
      text: signInEmailText(link, code),
    }),
  });
  if (res.ok) return { ok: true };
  let reason = res.statusText || "Resend rejected the message";
  try {
    const body = await res.json() as { message?: unknown; name?: unknown };
    if (typeof body.message === "string" && body.message.trim()) reason = body.message.trim().slice(0, 300);
  } catch { /* A non-JSON rejection still has a status. */ }
  return { ok: false, status: res.status, reason };
}

export { brandedSignInLink };
