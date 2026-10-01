/** Personal photo uploads use the board's timestamp filename; Instagram imports
 * retain their ig-date prefix. RISE's root also holds generated post graphics. */
export function isClientLibraryPhoto(file: { id: string | null; name: string }, slug: string): boolean {
  if (file.id === null || /^\./.test(file.name)) return false;
  if (slug !== 'risedtc-com') return true;
  return /^\d{13}-\d+-.+/.test(file.name) || /^ig-\d{4}-\d{2}-\d{2}-.+\.(?:jpe?g|png|webp|heic|heif|avif|gif)$/i.test(file.name);
}
