import type { Metadata } from "next";
import { Confirm, LegalDoc, type LegalSection } from "@/components/legal-doc";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Taverning stores, who can see a campaign, and which companies process it.",
  alternates: { canonical: `${SITE_ORIGIN}/privacy` },
};

const sections: LegalSection[] = [
  {
    id: "accounts",
    title: "Accounts and sign-in",
    body: (
      <>
        <p>You sign in with an email address. There is no password. You enter the address, and the server asks Firebase Authentication to create a one-time sign-in link. The server also makes a 6-digit code. It stores the email, a hash of the code, the link, an expiry 15 minutes out, and a count of wrong tries. That record is deleted when the code works, when it expires, or after too many wrong tries. The browser app cannot read it.</p>
        <p>Resend delivers the message. The code&apos;s default From address is Taverning &lt;noreply@mail.taverning.com&gt;. A server setting named EMAIL_FROM can replace it. <Confirm /> whether production uses that default.</p>
        <p>Opening the link signs you into Firebase Authentication for the Firebase project tpk-group-8cdc8. The first time, the app writes a user record with your email, an empty display name, the time zone reported by your browser, and an empty list of campaigns hidden from your calendar. It also creates a random calendar token. You set the display name yourself (40 characters at most). That name is what the table sees.</p>
        <p>If a campaign already has a seat or a pending membership with the same email, the first sign-in attaches it to this account.</p>
        <p>The iOS app is a shell that loads this website. Sign-in there is the same email link. The app code does not include Sign in with Apple, and the iOS notes still list it as unfinished, so the app does not receive an Apple ID.</p>
        <p>The legal name of the operator is <Confirm />. The address for privacy requests is <Confirm />.</p>
      </>
    ),
  },
  {
    id: "campaigns",
    title: "Campaigns, sessions, polls, and players",
    body: (
      <>
        <p>A campaign stores its name, system, place, time zone, usual night, cover image, character sheets (name, class, subclass, level, portrait), a short &quot;previously on,&quot; a ledger, and the player list. Each player row has an email, a display name, an optional character name, a role (organizer, co-organizer, or member), optional labels such as &quot;dm,&quot; and whether that person turned off reminder email.</p>
        <p>A session stores the start and end, title, place, notes, who is in or out (and an optional note), and a recap as text or a PDF. An organizer can upload the PDF. A separate import, which requires a server secret, can also write the recap, the PDF, the &quot;previously on&quot; line, and a character summary. Those import routes do not call an AI API.</p>
        <p>A poll stores the dates, each member&apos;s vote, and votes from a public link. A public vote stores the name the person typed and a hash of a token that stays in that browser. The raw token is not stored on the server.</p>
        <p>Before someone has an account, an organizer can add a roster seat: a name, an optional character name, an optional email, and an optional phone number, plus a secret link that claims the seat. Email, phone, and that link are returned to the organizer and co-organizer. Other members of the campaign get the name, the character name, and whether the seat has been claimed.</p>
        <p>The data model has unused fields reserved for a Discord bot. The app does not send campaign data to Discord.</p>
      </>
    ),
  },
  {
    id: "who",
    title: "Who can see campaign data",
    body: (
      <>
        <p>Campaign data is visible only to that campaign&apos;s members, except for the cases below.</p>
        <p>The database rules let a signed-in member read that campaign, its sessions, its polls, its character summaries, and its member list. A signed-out visitor cannot read those documents. A signed-in person who is not a member cannot read them either. The campaign document can also be read by the account stored as its owner. Creating a campaign writes that account in as the organizer, so the owner is a member in ordinary use.</p>
        <p>The player roster is closed to the browser database entirely. The server returns it only after it checks membership, as described above.</p>
        <p>You can read only your own user record. The rules do not let you delete it.</p>
        <p>These links are served by the server with a privileged database key, so the member rule does not apply to them:</p>
        <ul>
          <li>A poll link shows the poll title, the campaign name, the dates, vote counts, the names and character names on the player list, who has not voted, and the names and picks on guest ballots. It does not show email addresses or phone numbers.</li>
          <li>An invite link shows the campaign name, cover, place, who sent the invite, and the role.</li>
          <li>A seat link shows the campaign name and the name and character on that seat.</li>
          <li>A calendar link is a secret URL. Anyone with it can read the session times, titles, and places for the campaigns on that account.</li>
        </ul>
        <p>Recap PDFs and campaign covers can be read by members of that campaign. Portrait files stored under recaps/avatars can be read by any signed-in user, not only members of one campaign.</p>
        <p>Any signed-in user can read the list of emails allowed to create campaigns. That list is not campaign notes. Only those addresses, or an address with a creator record, can create a campaign.</p>
      </>
    ),
  },
  {
    id: "almanac",
    title: "Almanac stats from recordings",
    body: (
      <>
        <p>The Almanac also counts nights, hours, and recaps from the sessions you can already see.</p>
        <p>Separate recorded stats are stored in the app for specific campaigns. They were counted from session recordings. For those campaigns the file includes session counts, hours, word counts, character names, deaths, NPC names, place names, session titles and dates, natural 20 and natural 1 counts, and speaker labels that pair a person&apos;s name with a character and a word count. Short quoted moments cite a transcript or a handout.</p>
        <p>The server returns a campaign&apos;s recorded stats only to a signed-in member of that campaign. A pending membership does not receive them. The file is not included in the browser bundle.</p>
        <p>The recording files themselves are not in this repository. <Confirm /> where those recordings and transcripts are stored, who can open them, and how long they are kept.</p>
      </>
    ),
  },
  {
    id: "mail",
    title: "Email, push, and the iOS app",
    body: (
      <>
        <p>Sign-in email is described above. Resend receives the recipient address, the link, and the 6-digit code in order to send that message.</p>
        <p>A route can email members three days before a session and again three hours before. It skips anyone marked out, and anyone who turned reminders off for that campaign. The message includes the campaign name, the session time and place, the note, who is out, and the &quot;previously on&quot; line. It sends only when the server has a Resend key and a reminder From address, and only when something calls the route with the cron secret. This repository does not schedule that call. <Confirm /> whether production sends reminder email, and the From address it uses.</p>
        <p>If you allow notifications in the iOS app, the app sends an Apple push device token to the server. The server stores it on your user record with the platform set to iOS. You can turn that off, which deletes the stored token. This repository does not include the code that sends the pushes. <Confirm /> whether a sender runs outside this repository.</p>
        <p>The iOS app also opens this site, plays a short haptic tap, and follows links for taverning.com inside the app. Subscribing to the calendar link hands that URL to the calendar app you choose. A place link opens Apple Maps or Google Maps on your device. The server does not send a separate copy of the campaign to Apple for those links.</p>
      </>
    ),
  },
  {
    id: "device",
    title: "What stays on your device",
    body: (
      <>
        <p>Firebase Authentication keeps the sign-in session in IndexedDB, or in local storage when the site is installed to a home screen. The app also stores, in this browser only:</p>
        <ul>
          <li>the email you typed, so the sign-in link can be finished</li>
          <li>a display-name draft, the theme, and a larger-text choice</li>
          <li>the public-poll token and the name you voted under</li>
          <li>which recaps this browser has already opened</li>
        </ul>
        <p>Session storage holds in-progress join details and which tab you came from. It is cleared when the tab closes.</p>
        <p>A cookie named __tpk_token is read only for the paths /maloren and /iven. This repository does not set that cookie. <Confirm /> whether anything still sets it.</p>
      </>
    ),
  },
  {
    id: "waitlist",
    title: "Invite requests and rate limits",
    body: (
      <>
        <p>The home page can store an invite request: your email, an optional line about the table (140 characters), the word &quot;landing,&quot; the deploy environment, the time, and how many times that email was submitted. A hidden field is ignored. The browser cannot read this list.</p>
        <p>Sign-in, invite requests, roster edits, and public votes are rate limited. The limit uses the IP address from the request, and sometimes the email, the poll, or the guest token. The server stores a hash of that key, a count, and an expiry time. It does not store the raw IP in the document. <Confirm /> whether the database is set to delete those rows when the expiry time passes. The rules file does not turn that on.</p>
      </>
    ),
  },
  {
    id: "processors",
    title: "Who processes this",
    body: (
      <>
        <ul>
          <li>Google Firebase, project tpk-group-8cdc8, provides Authentication, Cloud Firestore, and Cloud Storage. The server uses the Firebase Admin SDK to read and write the same project.</li>
          <li>Vercel hosts the site and runs the server routes. A request includes the IP address, the URL, and the usual browser headers Vercel needs to answer it.</li>
          <li>Resend sends the sign-in email and, when the reminder route runs, the session email.</li>
          <li>Apple provides the iOS shell and, if you allow notifications, the push token. The app does not use Sign in with Apple.</li>
        </ul>
        <p>No other processor is named in this repository.</p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics",
    body: (
      <>
        <p>The app does not start a product-analytics library. It does not include Vercel Analytics, Google Analytics, or a call that starts Firebase Analytics. The Firebase package ships an analytics module that this app does not import.</p>
        <p><Confirm /> whether Vercel, Google, or Firebase keep request logs or console analytics for the project, and for how long. Nothing in this repository sets that.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long data is kept, and deletion",
    body: (
      <>
        <p>Sign-in codes last 15 minutes and are deleted as described above. <Confirm /> how long accounts, campaigns, sessions, polls, roster rows, invite requests, portraits, PDFs, and calendar tokens are kept. This repository has no retention period and no deletion job for them.</p>
        <p>You can sign out. Signing out does not delete the account. The account screen has no delete control, and the database rules reject a client delete of the user record. A player who is not the organizer can leave a campaign. The organizer can remove a player, archive the campaign, or delete it. <Confirm /> how to ask for the rest of an account, an invite request, or a recording to be deleted, and how long that takes.</p>
        <p>The site does not ask for a date of birth and does not check an age. <Confirm /> the minimum age.</p>
        <p><Confirm /> the governing law. See the <a href="/terms">terms</a>.</p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy"
      current="privacy"
      description="Items marked [TO CONFIRM] are not settled by the product code."
      sections={sections}
    />
  );
}
