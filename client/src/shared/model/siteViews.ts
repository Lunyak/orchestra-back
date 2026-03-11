const apiBase = () =>
  String(process.env.REACT_APP_API_BASE_URL ?? "/api").replace(/\/$/, "");

export async function hitSiteEventView(eventSlug: string): Promise<void> {
  const slug = String(eventSlug ?? "").trim();
  if (!slug) return;

  try {
    await fetch(`${apiBase()}/site/events/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      // keepalive helps when user leaves quickly (best-effort).
      keepalive: true,
    });
  } catch {
    // Best-effort analytics: ignore errors.
  }
}

