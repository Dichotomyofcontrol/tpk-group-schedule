import { brandedSignInLink, signInEmailHtml, signInEmailText, SIGNIN_SUBJECT } from "./signin-email";

export async function sendViaResend(to: string, link: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Six in the TPK <noreply@mail.sixinthetpk.com>";
  if (!key) return false;
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: SIGNIN_SUBJECT, html: signInEmailHtml(link), text: signInEmailText(link) }),
  });
  return res.ok;
}

export { brandedSignInLink };
