/** Branded sign-in email for Six in the TPK. Pure functions so they can be unit tested and rendered offline. */

export const SIGNIN_SUBJECT = "Your sign-in link for Six in the TPK";

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

const PROD_ORIGIN = "https://www.sixinthetpk.com";

/** Only send links back to our own hosts, never to an arbitrary Origin header. */
export function safeOrigin(candidate: string | null | undefined): string {
  if (!candidate) return PROD_ORIGIN;
  try {
    const url = new URL(candidate);
    const host = url.hostname;
    const ok =
      (url.protocol === "https:" && (host === "sixinthetpk.com" || host === "www.sixinthetpk.com" || host.endsWith(".vercel.app"))) ||
      (url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1"));
    return ok ? url.origin : PROD_ORIGIN;
  } catch {
    return PROD_ORIGIN;
  }
}

/**
 * Firebase generates https://<project>.firebaseapp.com/__/auth/action?apiKey&mode=signIn&oobCode&continueUrl&lang.
 * With handleCodeInApp that page only redirects to continueUrl with the same params, so we skip the hop and link
 * straight to our own continue URL with the action params appended. The Firebase JS SDK's isSignInWithEmailLink /
 * signInWithEmailLink accept this form. If anything looks off we fall back to the original link.
 */
export function brandedSignInLink(firebaseLink: string, continueUrl: string): string {
  try {
    const src = new URL(firebaseLink);
    const oobCode = src.searchParams.get("oobCode");
    const apiKey = src.searchParams.get("apiKey");
    if (src.searchParams.get("mode") !== "signIn" || !oobCode || !apiKey) return firebaseLink;
    const out = new URL(continueUrl);
    out.searchParams.set("apiKey", apiKey);
    out.searchParams.set("oobCode", oobCode);
    out.searchParams.set("mode", "signIn");
    out.searchParams.set("lang", src.searchParams.get("lang") || "en");
    return out.toString();
  } catch {
    return firebaseLink;
  }
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function signInEmailText(link: string): string {
  return [
    "Six in the TPK",
    "",
    "Here's your link to sign in to Six in the TPK:",
    link,
    "",
    "It works once and expires soon. If you didn't ask for it, you can ignore this email.",
    "",
    "— Six in the TPK · sixinthetpk.com",
  ].join("\n");
}

export function signInEmailHtml(link: string): string {
  const href = esc(link);
  const ink = "#1D1915";
  const muted = "#7A6E62";
  const parchment = "#f5ecd7";
  const card = "#FBF8F2";
  const rule = "#E2D7C3";
  const vermilion = "#9E2F1F";
  const serif = "Fraunces, Georgia, 'Times New Roman', serif";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(SIGNIN_SUBJECT)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; }
  a { text-decoration:none; }
  @media (max-width:480px) { .card { padding:36px 24px !important; } .wordmark { font-size:30px !important; } }
  @media (prefers-color-scheme: dark) {
    .bg { background:#1d1813 !important; }
    .card { background:#26201a !important; border-color:#3a3127 !important; }
    .ink { color:#f1e6cc !important; }
    .muted { color:#b3a285 !important; }
    .fallback a { color:#e8a58f !important; }
  }
  [data-ogsc] .ink { color:#f1e6cc !important; }
  [data-ogsc] .muted { color:#b3a285 !important; }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${parchment};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Tap the button to sign in. The link expires soon.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${parchment};">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
      <tr><td class="card" align="center" style="background:${card};border:1px solid ${rule};border-radius:14px;padding:48px 40px;">
        <div class="wordmark ink" style="font-family:${serif};font-size:34px;line-height:1.1;font-weight:500;letter-spacing:-0.01em;color:${ink};">Six <i style="font-style:italic;font-weight:400;">in the</i> TPK</div>
        <div style="width:40px;height:2px;background:${vermilion};margin:18px auto 26px;line-height:2px;font-size:0;">&nbsp;</div>
        <p class="ink" style="margin:0 0 28px;font-family:${sans};font-size:16px;line-height:1.5;color:${ink};">Here&rsquo;s your link to sign in to the table.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr><td align="center" bgcolor="${vermilion}" style="border-radius:999px;background:${vermilion};">
            <a href="${href}" target="_blank" style="display:inline-block;padding:14px 44px;font-family:${sans};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">Sign in</a>
          </td></tr>
        </table>
        <p class="muted" style="margin:28px 0 0;font-family:${sans};font-size:13px;line-height:1.55;color:${muted};">This link works once and expires soon.<br>If you didn&rsquo;t ask for it, you can ignore this email.</p>
        <p class="muted fallback" style="margin:18px 0 0;font-family:${sans};font-size:12px;line-height:1.5;color:${muted};">Button not working? <a href="${href}" target="_blank" style="color:${vermilion};text-decoration:underline;">Open the sign-in link</a></p>
      </td></tr>
      <tr><td align="center" class="muted" style="padding:22px 8px 0;font-family:${serif};font-size:12px;line-height:1.5;color:${muted};">Six in the TPK &middot; <a href="https://www.sixinthetpk.com" style="color:${muted};text-decoration:none;" class="muted">sixinthetpk.com</a></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
