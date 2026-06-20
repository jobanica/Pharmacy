import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/** Signed URLs for private attendance selfies, keyed by storage path. */
export async function signAttendancePhotos(
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;

  const service = createServiceClient();
  const { data } = await service.storage
    .from("attendance")
    .createSignedUrls(unique, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
