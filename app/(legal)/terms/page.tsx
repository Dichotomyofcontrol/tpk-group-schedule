import type { Metadata } from "next";
import { Confirm, LegalDoc, type LegalSection } from "@/components/legal-doc";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "The rules for using Taverning, including accounts, campaigns, and Oregon law.",
  alternates: { canonical: `${SITE_ORIGIN}/terms` },
};

const sections: LegalSection[] = [
  {
    id: "service",
    title: "The service",
    body: (
      <>
        <p>Taverning is a website, and an iOS shell around that website, for a tabletop group to schedule sessions, track who is coming, vote on dates, keep a player list, and store recaps. Seth Thomas operates it. These terms are a draft and are not in effect until they are published.</p>
        <p>The product behavior below is what the code does today. It is not a promise that a feature will stay. When these terms change in a material way, the date at the top of this page is updated and players are emailed.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <>
        <p>You sign in with an email link from noreply@mail.taverning.com, sent through Resend, unless the server&apos;s EMAIL_FROM setting replaces that address. There is no password. The iOS app uses the same email sign-in. It does not offer Sign in with Apple.</p>
        <p>You must be 13 or older to have an account. The site does not ask for a date of birth.</p>
        <p>You choose a display name. That name is shown to the campaigns you belong to. You can sign out from the account screen. Signing out ends the session in this browser and does not delete the account. Delete my account, on that same screen, removes the account after you type DELETE. Details are on the <a href="/privacy">privacy page</a>.</p>
      </>
    ),
  },
  {
    id: "campaigns",
    title: "Campaigns and players",
    body: (
      <>
        <p>Creating a campaign requires an account whose email is on the creator list. The organizer can add players, name a co-organizer, transfer the organizer role, archive the campaign, or delete it. A player who is not the organizer can leave.</p>
        <p>Campaign data is visible only to that campaign&apos;s members, with the exceptions on the privacy page: the owner&apos;s read of the campaign document, portrait files any signed-in user can open, and the poll, invite, seat, and calendar links.</p>
        <p>An organizer can add a seat before that person has an account. The seat can include a name, a character name, an email, and a phone number. Email, phone, and the claim link are shown to the organizer and co-organizer.</p>
      </>
    ),
  },
  {
    id: "links",
    title: "Links that work without an account",
    body: (
      <>
        <p>A poll link lets someone vote without an account. Anyone with the URL can see the poll, the campaign name, and the player names, as described on the privacy page.</p>
        <p>An invite link and a seat link show enough to join that campaign. Joining still requires the email sign-in.</p>
        <p>A calendar link is a secret. Anyone with the URL can read that account&apos;s session times. Do not pass a calendar link, a seat link, or an invite link to someone who should not have it. The app treats the URL as the permission.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "What you write",
    body: (
      <>
        <p>You own the text you write: session notes, recaps, character names, attendance, and votes. Taverning only hosts that text so the members of the campaign can read it. Campaign recaps and stats are visible only to that campaign&apos;s members. Account and campaign data is kept until that account or that campaign is deleted.</p>
        <p>The app does not send campaign data to Discord. Fields for a Discord bot exist and are unused.</p>
      </>
    ),
  },
  {
    id: "stop",
    title: "Stopping and availability",
    body: (
      <>
        <p>You may stop using the site at any time. Leave a campaign from that campaign&apos;s page if you are not the organizer. Delete the whole account from the account page. If you organize a campaign that still has other players, the account is not deleted until you transfer that campaign. If you are the only player, that campaign is deleted with the account.</p>
        <p>These terms are governed by the laws of Oregon. A dispute is heard in the courts of Oregon. <Confirm /> any warranty and any limit on liability. This draft sets neither.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>Write to Seth Thomas at <a href="mailto:privacy@taverning.com">privacy@taverning.com</a>. That is the contact for these terms and for the privacy page.</p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms"
      current="terms"
      description="Items marked [TO CONFIRM] are not settled by the product code."
      sections={sections}
    />
  );
}
