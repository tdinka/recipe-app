export interface UnsplashPhoto {
  id: string;
  thumbUrl: string;
  regularUrl: string;
  photographerName: string;
  // Links to the photographer's Unsplash profile and the photo itself, with the
  // UTM params Unsplash's API guidelines require for attribution links.
  photographerProfileUrl: string;
  unsplashPhotoUrl: string;
  // Must be pinged (via triggerUnsplashDownload) when the photo is actually
  // used, per Unsplash's API guidelines — not just when it's searched/previewed.
  downloadLocation: string;
}

export class UnsplashError extends Error {}

const APP_NAME = "family-recipe-box";

function withUtm(url: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", APP_NAME);
  u.searchParams.set("utm_medium", "referral");
  return u.toString();
}

export async function searchUnsplashPhotos(query: string, count = 5): Promise<UnsplashPhoto[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new UnsplashError(
      "Photo search isn't set up yet — add UNSPLASH_ACCESS_KEY to your .env file to enable it."
    );
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(count));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new UnsplashError("Couldn't reach Unsplash. Check your connection and try again.");
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new UnsplashError("The configured UNSPLASH_ACCESS_KEY was rejected. Double-check it in your .env file.");
    }
    if (res.status === 403) {
      throw new UnsplashError("Unsplash's hourly request limit was hit. Try again in a bit.");
    }
    throw new UnsplashError(`Unsplash returned an error (HTTP ${res.status}).`);
  }

  const json = await res.json();
  const results: unknown[] = Array.isArray(json?.results) ? json.results : [];

  return results.slice(0, count).map((r) => {
    const photo = r as Record<string, any>;
    return {
      id: photo.id,
      thumbUrl: photo.urls?.small ?? photo.urls?.thumb,
      regularUrl: photo.urls?.regular ?? photo.urls?.full,
      photographerName: photo.user?.name ?? "Unknown",
      photographerProfileUrl: withUtm(photo.user?.links?.html ?? "https://unsplash.com"),
      unsplashPhotoUrl: withUtm(photo.links?.html ?? "https://unsplash.com"),
      downloadLocation: photo.links?.download_location,
    };
  });
}

// Required by Unsplash's API guidelines: ping this endpoint when a photo is
// actually selected/used (not just displayed in search results).
export async function triggerUnsplashDownload(downloadLocation: string): Promise<void> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !downloadLocation) return;
  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-critical — don't fail the recipe save if this tracking ping fails.
  }
}
