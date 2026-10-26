const TOKEN = /^[A-Za-z0-9_-]{1,128}$/;

/** Where the sign-in link should bring someone back to: an email invite or a roster seat link. */
export type MagicLinkReturn = { invite?: string; seat?: string };

/** Continue URL for Firebase email-link sign-in. The host is the site that started the link. */
export function magicLinkContinueUrl(origin: string, inviteToken?: string, seatToken?: string): string {
  const url = new URL("/auth/finish", origin);
  if (seatToken && TOKEN.test(seatToken)) url.searchParams.set("seat", seatToken);
  else if (inviteToken && TOKEN.test(inviteToken)) url.searchParams.set("invite", inviteToken);
  return url.toString();
}

/** Page to open once the email link signs someone in. Seat links go back to /join, invites to /invite. */
export function finishDestination(params: { get(name: string): string | null }, storedSeat?: string | null): string {
  const seat = params.get("seat") || "";
  if (TOKEN.test(seat)) return `/join/${encodeURIComponent(seat)}`;
  const invite = params.get("invite") || "";
  if (TOKEN.test(invite)) return `/invite/${encodeURIComponent(invite)}`;
  if (storedSeat && TOKEN.test(storedSeat)) return `/join/${encodeURIComponent(storedSeat)}`;
  return "/";
}
