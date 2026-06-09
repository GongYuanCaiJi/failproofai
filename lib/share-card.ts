/**
 * Copy a captured share-card PNG to the system clipboard, or fall back to a
 * download if the browser doesn't support image clipboard writes (or the user
 * denied permission). Used by the /audit share flow so the user can paste the
 * image directly into their X / LinkedIn / etc. post — X and LinkedIn intent
 * URLs cannot carry image attachments themselves, so clipboard is the most
 * direct "image automatically added to post" path on the web.
 *
 * The caller MUST be inside an active user gesture (click handler) when
 * awaiting this — Chromium-based browsers gate `navigator.clipboard.write`
 * on a recent user activation. The current /audit share handlers already
 * call this from inside a button onClick so that constraint is naturally
 * satisfied.
 */
export type ShareCardMethod = "clipboard" | "download" | "failed";

export async function copyOrDownloadCard(
  blob: Blob,
  filename: string,
): Promise<ShareCardMethod> {
  // 1. Clipboard write (preferred). ClipboardItem is the cross-browser shape;
  //    fall through silently on any rejection so we don't fail the share.
  if (
    typeof ClipboardItem !== "undefined"
    && typeof navigator !== "undefined"
    && navigator.clipboard
    && typeof navigator.clipboard.write === "function"
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return "clipboard";
    } catch {
      /* permission denied, secure-context issue, browser fence, … */
    }
  }

  // 2. Fallback: trigger a local download.
  try {
    if (typeof document === "undefined" || typeof URL === "undefined") {
      return "failed";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a microtask to start the download before revoking.
    queueMicrotask(() => URL.revokeObjectURL(url));
    return "download";
  } catch {
    return "failed";
  }
}

/** Human-readable toast copy keyed by share method. */
export function shareCardToastMessage(method: ShareCardMethod): string {
  switch (method) {
    case "clipboard":
      return "📋 image copied — paste it in the post (⌘/Ctrl+V)";
    case "download":
      return "⬇ image downloaded — attach it to your post";
    case "failed":
      return "couldn't capture image — opening text-only share";
  }
}
