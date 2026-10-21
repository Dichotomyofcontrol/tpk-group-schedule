/** Continue URL for Firebase email-link sign-in. The host is the site that started the link. */
export function magicLinkContinueUrl(origin: string, inviteToken?: string): string {
  const url = new URL("/auth/finish", origin);
  if (inviteToken) url.searchParams.set("invite", inviteToken);
  return url.toString();
}
