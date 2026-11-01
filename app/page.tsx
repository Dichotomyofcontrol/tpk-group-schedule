import type { Metadata } from "next";
import { Landing } from "@/components/landing";
import { HomeRedirect } from "@/components/home-redirect";
import { TextSize } from "@/components/text-size";
import { Brand } from "@/components/ui";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return (
    <>
      <header className="hdr clear">
        <Brand href="/" />
        <span className="sp" />
        <TextSize />
      </header>
      <Landing />
      <HomeRedirect />
    </>
  );
}
