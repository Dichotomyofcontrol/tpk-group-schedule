/** Sign in with Apple inside the iOS app: native Apple sheet -> Firebase Auth (apple.com provider). Web: not offered. */
export async function appleSignInAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch { return false; }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signInWithAppleNative(): Promise<"ok" | "cancelled"> {
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
  const { OAuthProvider, signInWithCredential, updateProfile } = await import("firebase/auth");
  const { getFirebase } = await import("./firebase-client");
  const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  let res;
  try {
    res = await SignInWithApple.authorize({
      clientId: "com.taverning.app",
      redirectURI: "https://taverning.com/auth/finish",
      scopes: "email name",
      nonce: await sha256Hex(rawNonce),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/1001|cancel/i.test(msg)) return "cancelled";
    throw new Error("Sign in with Apple didn't finish. Try again or use email.");
  }
  const credential = new OAuthProvider("apple.com").credential({ idToken: res.response.identityToken, rawNonce });
  const { user } = await signInWithCredential(getFirebase().auth, credential);
  const name = [res.response.givenName, res.response.familyName].filter(Boolean).join(" ").trim();
  if (name && !user.displayName) await updateProfile(user, { displayName: name }).catch(() => undefined);
  return "ok";
}
