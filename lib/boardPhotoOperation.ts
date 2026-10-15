/** A durable intent precedes storage; success requires a verified completion receipt. */
export async function uploadBoardFile(
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>,
  upload: () => PromiseLike<{ error: { message?: string } | null }>,
  args: { p_slug: string; p_path: string; p_note?: string; p_session: string | null; p_token: string | null },
): Promise<{ ok: boolean; error?: string }> {
  let operationId: string | undefined;
  try {
    const start = await rpc('board_photo_operation', { ...args, p_operation: 'upload', p_phase: 'started' });
    if (start.error || !start.data?.ok || !start.data?.operation_id) return { ok: false, error: 'Upload did not start: its activity record could not be saved.' };
    operationId = start.data.operation_id;
    let storageError: string | undefined;
    try { storageError = (await upload()).error?.message; } catch { storageError = 'Upload interrupted.'; }
    const finish = await rpc('board_photo_operation', { ...args, p_operation: 'upload', p_phase: storageError ? 'failed' : 'completed', p_operation_id: operationId });
    if (finish.error || !finish.data?.ok) return { ok: false, error: storageError
      ? 'Upload failed. Activity contains an unfinished attempt; refresh before retrying.'
      : 'File uploaded, but completion could not be recorded. Activity contains an unfinished attempt; refresh before retrying.' };
    return storageError ? { ok: false, error: storageError } : { ok: true };
  } catch {
    return { ok: false, error: operationId ? 'Upload status is unconfirmed. Activity contains the attempt; refresh before retrying.' : 'Upload did not start: its activity record could not be saved.' };
  }
}
