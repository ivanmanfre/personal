type Result = { ok: boolean; error?: string; uncertain?: boolean };
type SetSchedule = (id: string, at: string | null) => Promise<Result>;

/** Clear the old slot first so two posts are never deliberately queued together. */
export async function swapScheduledPost(id: string, replacementId: string, at: string, setSchedule: SetSchedule): Promise<Result> {
  if (id === replacementId) return { ok: false, error: 'Choose another post.' };
  const cleared = await setSchedule(id, null);
  if (!cleared.ok) return cleared;
  const placed = await setSchedule(replacementId, at);
  if (placed.ok) return placed;
  // A lost response may follow a committed write. Restoring would risk two posts.
  if (placed.uncertain) return { ok: false, error: 'Could not confirm the swap. Refresh and check both posts before scheduling again.' };
  const restored = await setSchedule(id, at);
  return {
    ok: false,
    error: restored.ok
      ? 'Could not swap posts. Your original post is still scheduled.'
      : 'Could not finish the swap or restore the original date. Refresh and check both posts before scheduling again.',
  };
}
