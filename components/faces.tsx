"use client";

import type { Member } from "@/lib/types";

export function Face({
  hue = 24,
  name,
  out = false,
  maybe = false,
  size = 32,
}: {
  hue?: number;
  name: string;
  out?: boolean;
  maybe?: boolean;
  size?: number;
}) {
  const label = out ? `${name}, out` : maybe ? `${name}, maybe` : name;
  return (
    <svg
      className={`face${out ? " out" : ""}${maybe ? " maybe" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
    >
      <circle cx="32" cy="32" r="32" fill={`hsl(${hue} 42% 38%)`} />
      <path d="M10 36c4-16 14-22 22-22s18 8 22 22c-6-6-14-8-22-8s-16 2-22 8z" fill={`hsl(${hue} 28% 18%)`} />
      <ellipse cx="32" cy="40" rx="13" ry="14" fill={`hsl(${hue} 32% 78%)`} />
      <circle cx="27" cy="40" r="1.7" fill="#241c16" />
      <circle cx="37" cy="40" r="1.7" fill="#241c16" />
      <path d="M28 46c2.2 2 6 2 8.2 0" stroke="#241c16" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Stack({
  members,
  grey,
  maybe,
  color,
}: {
  members: Member[];
  grey: Set<string>;
  maybe?: Set<string>;
  color: string;
}) {
  const shown = members.slice(0, 6);
  return (
    <span className="stack" style={{ ["--c" as string]: color }}>
      {shown.map((m) => (
        <Face
          key={m.id}
          hue={m.hue}
          name={m.characterName || m.displayName}
          out={grey.has(m.id)}
          maybe={maybe?.has(m.id)}
          size={30}
        />
      ))}
    </span>
  );
}
