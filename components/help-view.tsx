"use client";

import { BackBar, Icon, type IconName } from "./ui";

const ITEMS: { icon: IconName; title: string; body: string }[] = [
  { icon: "dates", title: "Sessions", body: "The next game is up top, with Previously on when there's an opener. Upcoming nights follow, then past nights, newest first. Everyone counts as in unless they tap Can't make it." },
  { icon: "camp", title: "Campaigns", body: "Each table has a usual night, a place and its players. The organizer adds a player and copies a personal link. Until that link is copied, the seat stays not invited. People already at the table show as joined." },
  { icon: "tome", title: "Almanac", body: "One book for every campaign you have joined, and a chapter inside each campaign: the party, the recaps, the places, and anything in the ledger. Tap a character name to read the summary. You only see your own tables." },
  { icon: "polls", title: "Polls", body: "Not sure when? The organizer floats a few dates, everyone taps the ones that work, and the winner goes on the list. A share link lets friends vote without an account, picking their name from the player list." },
  { icon: "inv", title: "Invites", body: "Organizers send a link. Players open it, sign in with their email, and they're at the table." },
  { icon: "doc", title: "Recaps", body: "After a session, add what happened. Recaps stay with the night and on the campaign page." },
];

export function HelpView() {
  return (
    <>
      <BackBar href="/sessions" label="Sessions" />
      <div className="ptitle"><h1 className="lt">How it works</h1></div>
      <div className="card list helpl">
        {ITEMS.map((it) => (
          <div key={it.title} className="hrow">
            <span className="fi"><Icon name={it.icon} /></span>
            <span><b>{it.title}</b><span className="note">{it.body}</span></span>
          </div>
        ))}
      </div>
    </>
  );
}
