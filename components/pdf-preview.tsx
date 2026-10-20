"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Session, SessionFile } from "@/lib/types";

export function PdfPreview({ session, file }: { session: Session; file?: SessionFile }) {
  const store = useStore();
  const pdfPath = file?.path ?? session.pdfPath;
  const pdfName = file?.name ?? session.pdfName;
  const memory = file ? null : store.pdfPreviewUrl(session.id);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (store.mode !== "live" || !pdfPath || memory) return;
    let cancelled = false;
    let created: string | null = null;
    void (async () => {
      try {
        const { getFirebase } = await import("@/lib/firebase-client");
        const { getBlob, ref } = await import("firebase/storage");
        const blob = await getBlob(ref(getFirebase().storage, pdfPath));
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
  }, [store.mode, session.id, pdfPath, memory]);

  const sample = !file && session.pdfUrl && session.pdfUrl.startsWith("/") && !session.pdfUrl.startsWith("/recaps")
    ? session.pdfUrl
    : null;
  const src = memory || liveUrl || sample;
  if (!pdfPath && !pdfName && !src) return null;
  return (
    <div>
      <div className="pdf-meta">
        <b>{pdfName || "Session PDF"}</b>
        {pdfPath && <span className="tz">{pdfPath}</span>}
      </div>
      {src ? (
        <iframe className="pdf-frame" src={src} title={pdfName || "Session recap PDF"} />
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
