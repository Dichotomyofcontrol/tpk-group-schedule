"use client";

import Link from "next/link";

const TABS = [
  { id: "table", label: "Table" },
  { id: "almanac", label: "Almanac" },
  { id: "recaps", label: "Recaps" },
] as const;

export function CampaignTabs({ cid, current }: { cid: string; current: (typeof TABS)[number]["id"] }) {
  return (
    <nav className="book-tabs" aria-label="This campaign">
      {TABS.map((tab) => {
        const href = tab.id === "table" ? `/campaigns/${cid}` : `/campaigns/${cid}/${tab.id}`;
        const on = tab.id === current;
        return (
          <Link key={tab.id} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
