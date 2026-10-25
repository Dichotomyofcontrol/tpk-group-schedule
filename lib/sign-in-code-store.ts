import type { Firestore } from "firebase-admin/firestore";
import {
  decideSignInCode,
  hashSignInCode,
  SIGNIN_CODE_TTL_MS,
  signInCodeDocId,
  type SignInCodeRecord,
  type SignInCodeResult,
} from "./sign-in-code";

function ref(db: Firestore, email: string) {
  return db.collection("signInCodes").doc(signInCodeDocId(email));
}

export async function saveSignInCode(db: Firestore, email: string, code: string, link: string, now = Date.now()): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const record: SignInCodeRecord = {
    email: normalized,
    codeHash: hashSignInCode(normalized, code),
    link,
    expiresAt: now + SIGNIN_CODE_TTL_MS,
    attempts: 0,
  };
  await ref(db, normalized).set(record);
}

export async function deleteSignInCode(db: Firestore, email: string): Promise<void> {
  await ref(db, email).delete();
}

export async function redeemSignInCode(db: Firestore, email: string, code: string, now = Date.now()): Promise<SignInCodeResult> {
  const normalized = email.trim().toLowerCase();
  const doc = ref(db, normalized);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(doc);
    const record = snap.exists ? snap.data() as SignInCodeRecord : null;
    const decision = decideSignInCode(record, normalized, code, now);
    if (snap.exists) {
      if (decision.next === null) tx.delete(doc);
      else if (decision.next) tx.set(doc, decision.next);
    }
    return decision.result;
  });
}
