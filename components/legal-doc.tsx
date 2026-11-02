import type { ReactNode } from "react";
import { TextSize } from "./text-size";

export const LEGAL_UPDATED = "November 2, 2026";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/** Inline marker for a fact the repository does not establish. */
export function Confirm() {
  return <strong className="tbc">[TO CONFIRM]</strong>;
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" strokeWidth="1.4" strokeLinejoin="round" />
      <path className="die-face" d="M16 9.5l6.2 10.7H9.8z" />
      <path d="M16 2.5v7M27.7 9.25l-5.5 10.95M4.3 9.25l5.5 10.95M9.8 20.2L4.3 22.75M22.2 20.2l5.5 2.55M9.8 20.2L16 29.5l6.2-9.3M16 9.5L4.3 9.25M16 9.5l11.7-.25" strokeWidth="1" strokeLinejoin="round" />
      <text x="16" y="18.4" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="7" fill="var(--bg)">T</text>
    </svg>
  );
}

export function LegalDoc({
  title,
  description,
  current,
  sections,
}: {
  title: string;
  description: string;
  current: "privacy" | "terms";
  sections: LegalSection[];
}) {
  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header className="hdr">
        <a className="brand" href="/">
          <Mark />
          <span>Taverning</span>
        </a>
        <span className="sp" />
        <TextSize />
      </header>
      <main id="content" className="legal">
        <p className="kicker">Draft</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated <time dateTime="2026-11-02">{LEGAL_UPDATED}</time></p>
        <p className="legal-draft" role="note">
          <strong>Draft.</strong> This page is not in effect. The owner has not approved it. {description}
        </p>
        <nav className="legal-toc" aria-labelledby="toc-h">
          <h2 id="toc-h">Contents</h2>
          <ol>
            {sections.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
            ))}
          </ol>
        </nav>
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id}>{section.title}</h2>
            {section.body}
          </section>
        ))}
      </main>
      <footer className="foot">
        <span>© 2026 Taverning</span>
        <nav className="foot-nav" aria-label="Footer">
          <a href="/">Home</a>
          <a href="/privacy" aria-current={current === "privacy" ? "page" : undefined}>Privacy</a>
          <a href="/terms" aria-current={current === "terms" ? "page" : undefined}>Terms</a>
        </nav>
      </footer>
    </>
  );
}
