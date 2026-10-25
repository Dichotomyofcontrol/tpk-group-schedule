import Link from "next/link";
import { Icon } from "./ui";

export function Landing() {
  return (
    <>
      <section className="hero-land">
        <div className="hart">
          <img className="art" src="/brand/cover-emberfall.svg" alt="Illustration of a castle below a solar eclipse over misty mountains" />
        </div>
        <div className="hin">
          <div className="eyebrow">For tabletop groups</div>
          <h1>Every session, <em>every saga,</em> in one place.</h1>
          <p className="lead">Six in the TPK keeps your party&apos;s sessions, RSVPs and recaps together. Everyone&apos;s in by default; you just say when you can&apos;t make it.</p>
          <Link className="btn pri" href="/signin"><Icon name="mail" className="ic sm" />Sign in with email</Link>
          <div className="note">No password. Invite-only — your GM adds you.</div>
        </div>
      </section>
      <section className="feat">
        <div className="eyebrow">How it works</div>
        <h2>Less herding cats. More rolling dice.</h2>
        <div className="fg">
          <article className="card fc">
            <span className="fi"><Icon name="dates" /></span>
            <h3>Sessions that assume yes</h3>
            <p>The whole party is counted in. Mark yourself out in one tap and the GM sees it instantly.</p>
            <div className="vig">
              <div className="dt"><span className="dw">Thu</span><span className="dn">23</span></div>
              <div style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>Curse of Strahd</b><br /><span className="status">5 of 6 in</span></div>
            </div>
          </article>
          <article className="card fc">
            <span className="fi"><Icon name="camp" /></span>
            <h3>Campaigns with a cover</h3>
            <p>Players, the usual night and recaps — typed or as a PDF — live with the story they belong to.</p>
            <div className="mini">
              <img className="art" src="/brand/cover-drowned-crown.svg" alt="" />
              <b>The Drowned Crown</b>
            </div>
          </article>
          <article className="card fc">
            <span className="fi"><Icon name="polls" /></span>
            <h3>Polls for the next arc</h3>
            <p>Float a few dates, let the table vote, lock the winner onto the calendar.</p>
            <div className="pr">
              <div><span>Sat, Nov 7</span><b>5</b></div>
              <div className="bar"><i style={{ width: "83%" }} /></div>
              <div style={{ marginTop: 10 }}><span>Sun, Nov 8</span><b>2</b></div>
              <div className="bar"><i style={{ width: "33%", background: "var(--rule2)" }} /></div>
            </div>
          </article>
        </div>
      </section>
      <section className="quote">
        <p>“Finally, nobody asks ‘wait, are we playing this week?’ in the group chat.”</p>
        <span className="note">— a very tired Dungeon Master</span>
      </section>
      <footer className="foot"><span>© 2026 · Invite-only tables</span><span>Made for the table</span></footer>
    </>
  );
}
