import Link from "next/link";
import { Icon } from "./ui";
import { WaitlistForm } from "./waitlist-form";

const CHAPTERS = [
  { title: "Sessions that assume yes", body: "The whole party is counted in. Mark yourself out in one tap and the GM sees it right away." },
  { title: "Campaigns with a cover", body: "Players, the usual night, and recaps, typed or as a PDF, live with the story they belong to." },
  { title: "Polls for the next arc", body: "Float a few dates, let the table vote, and put the winner on the calendar." },
];

/* Sample table for the demo. Invented names and campaign, no real data. */
const DEMO_SEATS = [
  { name: "Mira", role: "GM", state: "in" },
  { name: "Tobin", role: "Bard", state: "in" },
  { name: "Ash", role: "Ranger", state: "in" },
  { name: "Rook", role: "Cleric", state: "out" },
  { name: "Jun", role: "Wizard", state: "in" },
] as const;

const DEMO_POLL = [
  { day: "Fri Nov 13", votes: 4 },
  { day: "Sat Nov 14", votes: 2 },
  { day: "Sun Nov 15", votes: 1 },
];

function Die() {
  return (
    <svg className="d20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      <g className="d20-roll">
        <polygon points="50,2 93,26 93,74 50,98 7,74 7,26" />
        <polygon points="50,22 76,66 24,66" />
        <path d="M50 2 50 22M93 26 76 66M7 26 24 66M50 98 24 66M50 98 76 66M93 74 76 66M7 74 24 66M50 22 7 26M50 22 93 26M24 66 7 74" />
      </g>
    </svg>
  );
}

function Demo() {
  const going = DEMO_SEATS.filter((s) => s.state === "in").length;
  return (
    <section className="demo" aria-labelledby="demo-h">
      <p className="kicker">Sample table</p>
      <h2 id="demo-h">What your group sees</h2>
      <p className="demo-note">A made-up campaign so you can see the shape of it.</p>
      <div className="demo-grid">
        <article className="demo-card">
          <p className="kicker">Next session</p>
          <h3>The Sunken Bell, part 7</h3>
          <p className="demo-when">Friday, Nov 13 at 7:00 PM</p>
          <p className="demo-count"><b>{going} of {DEMO_SEATS.length}</b> are in</p>
          <ul className="demo-seats">
            {DEMO_SEATS.map((s) => (
              <li key={s.name} className={s.state}>
                <span>{s.name}</span>
                <span className="demo-role">{s.role}</span>
                <span className="demo-state">{s.state === "in" ? "In" : "Out"}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="demo-card">
          <p className="kicker">Poll</p>
          <h3>When do we finish the arc?</h3>
          <ul className="demo-poll">
            {DEMO_POLL.map((p) => (
              <li key={p.day}>
                <span>{p.day}</span>
                <span className="bar" style={{ ["--v" as string]: p.votes / 5 }} aria-hidden="true" />
                <span>{p.votes} {p.votes === 1 ? "vote" : "votes"}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="demo-card">
          <p className="kicker">Recap</p>
          <h3>Last time</h3>
          <p className="demo-recap">The bell rang under the lake and the village lights went out one by one. Tobin kept the clapper. Nobody agrees on whether that was smart.</p>
          <p className="demo-by">Written by Ash</p>
        </article>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <main id="content" className="landing">
      <section className="almanac-hero">
        <Die />
        <p className="kicker">Taverning</p>
        <h1>
          <span>Every session,</span>
          <span className="ghost-type">every saga.</span>
        </h1>
        <p className="voice">One table for the nights you play, the nights you can&apos;t, and the story you write down after.</p>
        <div className="hero-ctas">
          <a className="btn pri" href="#invite">Request an invite</a>
          <Link className="btn ghost-btn" href="/signin"><Icon name="mail" className="ic sm" />Sign in with email</Link>
        </div>
        <p className="fine">No password. Already have a table? Your GM adds you.</p>
      </section>
      <section className="chapters">
        <p className="kicker">How it works</p>
        <h2>Less herding.<span className="ghost-type">More dice.</span></h2>
        {CHAPTERS.map((chapter) => (
          <article className="chapter" key={chapter.title}>
            <h3>{chapter.title}</h3>
            <p>{chapter.body}</p>
          </article>
        ))}
      </section>
      <Demo />
      <section className="quote-band">
        <p className="voice">“Finally, nobody asks ‘wait, are we playing this week?’ in the group chat.”</p>
        <span className="kicker">A very tired Dungeon Master</span>
      </section>
      <section className="invite" id="invite" aria-labelledby="invite-h">
        <p className="kicker">Invite only for now</p>
        <h2 id="invite-h">Request an invite</h2>
        <p className="invite-note">We open seats a few groups at a time. Leave your email and we&apos;ll write when yours is ready.</p>
        <WaitlistForm />
      </section>
      <footer className="foot">
        <span>© 2026 Taverning</span>
        <nav className="foot-nav" aria-label="Footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
