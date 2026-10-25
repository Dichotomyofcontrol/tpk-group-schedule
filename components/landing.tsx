import Link from "next/link";
import { Icon } from "./ui";

const CHAPTERS = [
  { n: "01", title: "Sessions that assume yes", body: "The whole party is counted in. Mark yourself out in one tap and the GM sees it instantly." },
  { n: "02", title: "Campaigns with a cover", body: "Players, the usual night, and recaps — typed or as a PDF — live with the story they belong to." },
  { n: "03", title: "Polls for the next arc", body: "Float a few dates, let the table vote, and lock the winner onto the calendar." },
];

function Die() {
  return (
    <svg className="d20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      <polygon points="50,2 93,26 93,74 50,98 7,74 7,26" />
      <polygon points="50,22 76,66 24,66" />
      <path d="M50 2 50 22M93 26 76 66M7 26 24 66M50 98 24 66M50 98 76 66M93 74 76 66M7 74 24 66M50 22 7 26M50 22 93 26M24 66 7 74" />
    </svg>
  );
}

export function Landing() {
  return (
    <div id="content">
      <section className="almanac-hero">
        <Die />
        <p className="kicker">Six in the TPK</p>
        <h1>
          <span>Every session,</span>
          <span className="ghost-type">every saga.</span>
        </h1>
        <p className="voice">One table for the nights you play, the nights you can&apos;t, and the story you write down after.</p>
        <Link className="btn pri" href="/signin"><Icon name="mail" className="ic sm" />Sign in with email</Link>
        <p className="fine">No password. Invite-only — your GM adds you.</p>
      </section>
      <section className="chapters">
        <p className="kicker">How it works</p>
        <h2>Less herding.<span className="ghost-type">More dice.</span></h2>
        {CHAPTERS.map((chapter) => (
          <article className="chapter rise" key={chapter.n}>
            <span className="seal" aria-hidden="true">{chapter.n}</span>
            <h3>{chapter.title}</h3>
            <p>{chapter.body}</p>
          </article>
        ))}
      </section>
      <section className="quote-band">
        <p className="voice">“Finally, nobody asks ‘wait, are we playing this week?’ in the group chat.”</p>
        <span className="kicker">A very tired Dungeon Master</span>
      </section>
      <footer className="foot"><span>© 2026 · Invite-only tables</span><span>Made for the table</span></footer>
    </div>
  );
}
