import type { Metadata } from "next";
import { Confirm, LegalDoc, type LegalSection } from "@/components/legal-doc";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "The rules Taverning actually enforces today, and the legal terms the owner still has to set.",
  alternates: { canonical: `${SITE_ORIGIN}/terms` },
};

const sections: LegalSection[] = [
  {
    id: "service",
    title: "The service",
    body: (
      <>
        <p>Taverning is a website, and an iOS shell around that website, for a tabletop group to schedule sessions, track who is coming, vote on dates, keep a player list, and store recaps. The operator&apos;s legal name is <Confirm />. These terms are a draft and are not in effect.</p>
        <p>The product behavior below is what the code does today. It is not a promise that a feature will stay. <Confirm /> how changes to these terms will be announced. This page shows the date it was last updated.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <>
        <p>You sign in with an email link from noreply@mail.taverning.com, sent through Resend, unless the server&apos;s EMAIL_FROM setting replaces that address. There is no password. The iOS app uses the same email sign-in. It does not offer Sign in with Apple.</p>
        <p>The site does not ask your age. <Confirm /> the minimum age required to have an account.</p>
        <p>You choose a display name. That name is shown to the campaigns you belong to. You can sign out from the account screen. Signing out ends the session in this browser and does not delete the account. <Confirm /> the process for deleting an account. Details of what is stored are on the <a href="/privacy">privacy page</a>.</p>
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
        <p>The table writes session notes, recaps, character names, attendance, and votes. The site stores that so the members of the campaign can read it. <Confirm /> who owns that text, and what permission the operator has to host it and show it to those members.</p>
        <p>Recorded Almanac numbers and short quotes are taken from session recordings and stored for the members of those campaigns. The recordings themselves are not in this repository. <Confirm /> the basis for keeping the recordings, the transcripts, and the stats made from them.</p>
        <p>The app does not send campaign data to Discord. Fields for a Discord bot exist and are unused.</p>
      </>
    ),
  },
  {
    id: "stop",
    title: "Stopping and availability",
    body: (
      <>
        <p>You may stop using the site at any time. Leave a campaign from that campaign&apos;s page if you are not the organizer. Sign out from the account page. Neither step deletes the Firebase account. <Confirm /> how to request deletion.</p>
        <p>The repository states no uptime, support hours, or backup guarantee. <Confirm /> any warranty, any limit on liability, the governing law, and the place where a dispute would be heard. This draft sets none of those.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>Write to the owner at <Confirm />. That is the contact for these terms and for the privacy page. No other address is published in the app.</p>
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
