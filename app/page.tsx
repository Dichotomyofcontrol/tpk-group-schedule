import { Shell } from "@/components/shell";
import { HomeView } from "@/components/home-view";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return (
    <Shell>
      <HomeView />
    </Shell>
  );
}
