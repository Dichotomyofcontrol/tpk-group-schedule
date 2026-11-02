/** Opens the iOS share sheet inside the Taverning app. Returns false on the web so callers keep their own path. */
export async function nativeShare(data: { title?: string; text?: string; url: string }): Promise<"shared" | "cancelled" | false> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return false;
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: data.title });
    return "shared";
  } catch (error) {
    return /cancel/i.test(error instanceof Error ? error.message : String(error)) ? "cancelled" : false;
  }
}
