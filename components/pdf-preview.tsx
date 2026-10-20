"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Session } from "@/lib/types";

export function PdfPreview({ session }: { session: Session }) {
  const store = useStore();
  const memory = store.pdfPreviewUrl(session.id);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (store.mode !== "live" || !session.pdfPath || memory) return;
    let cancelled = false;
    let created: string | null = null;
    void (async () => {
      try {
        const { getFirebase } = await import("@/lib/firebase-client");
        const { getBlob, ref } = await import("firebase/storage");
        const blob = await getBlob(ref(getFirebase().storage, session.pdfPath!));
        created = URL.createObjectURL(blob);
        if (!cancelled) setLiveUrl(created);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [store.mode, session.id, session.pdfPath, memory]);

  const sample = session.pdfUrl && session.pdfUrl.startsWith("/") && !session.pdfUrl.startsWith("/recaps")
    ? session.pdfUrl
    : null;
  const src = memory || liveUrl || sample;
  if (!session.pdfPath && !session.pdfName && !src) return null;
  return (
    <div>
      <div className="pdf-meta">
        <b>{session.pdfName || "Session PDF"}</b>
        {session.pdfPath && <span className="tz">{session.pdfPath}</span>}
      </div>
      {src ? (
        <iframe className="pdf-frame" src={src} title={session.pdfName || "Session recap PDF"} />
      ) : (
        <p className="tz">
          {failed
            ? "Couldn't open that PDF. Campaign members can read it while signed in."
            : "The file name is saved with this preview. Attach it again to see it here. On the live site the bytes stay in Storage at the path above."}
        </p>
      )}
    </div>
  );
}
