// lib/clientBoardImageActions.ts
//
// Board-scoped image commit for the /client board (Task 12 — PERSISTED per
// Ivan's decision 2026-07-04). Distinct from studioActions' commitImageEdit,
// which patches carousel_drafts.image_urls: this patches an item embedded in
// client_boards.board (jsonb), so a client fixing a garbled number stays
// fixed on refresh.

/** Pure jsonb-swap: finds the item with id === itemId in board.queue,
 * board.ideas, board.lead_magnets (arrays) or board.lm (a single object),
 * and returns a clone with `field` set to `url` on that item. No-op clone
 * (new top-level object, unchanged contents) when the item isn't found.
 * Never mutates the input. */
export function swapBoardItemImage(
  board: any,
  itemId: string,
  field: 'media_url' | 'cover_url',
  url: string,
): any {
  if (!board || typeof board !== 'object') return board;
  const next: any = { ...board };

  const swapInArray = (arr: any): any => {
    if (!Array.isArray(arr)) return { arr, found: false };
    let found = false;
    const out = arr.map((item) => {
      if (item && typeof item === 'object' && item.id === itemId) {
        found = true;
        return { ...item, [field]: url };
      }
      return item;
    });
    return { arr: out, found };
  };

  let matched = false;

  if (Array.isArray(next.queue)) {
    const { arr, found } = swapInArray(next.queue);
    if (found) { next.queue = arr; matched = true; }
  }
  if (!matched && Array.isArray(next.ideas)) {
    const { arr, found } = swapInArray(next.ideas);
    if (found) { next.ideas = arr; matched = true; }
  }
  if (!matched && Array.isArray(next.lead_magnets)) {
    const { arr, found } = swapInArray(next.lead_magnets);
    if (found) { next.lead_magnets = arr; matched = true; }
  }
  if (!matched && next.lm && typeof next.lm === 'object' && !Array.isArray(next.lm) && next.lm.id === itemId) {
    next.lm = { ...next.lm, [field]: url };
    matched = true;
  }

  return next;
}

/**
 * Commit a kept/undone image edit on a /client board item. client_boards is
 * RLS deny-all for the anon key the frontend uses, so the read-modify-write of
 * board (jsonb) + the image_edit_versions log run in the `img-board-commit`
 * edge function under the service role. Logs draft_id = `${boardId}:${itemId}`,
 * op prefixed `board:`. Throws on any error. (swapBoardItemImage above stays as
 * the tested reference for the swap the edge fn mirrors server-side.)
 */
export async function commitClientBoardImage(a: {
  slug: string;
  token: string;
  itemId: string;
  field: 'media_url' | 'cover_url';
  prevUrl: string;
  newUrl: string;
  op: string;
  prompt?: string;
}): Promise<void> {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.functions.invoke('img-board-commit', {
    body: {
      slug: a.slug,
      token: a.token,
      itemId: a.itemId,
      field: a.field,
      prevUrl: a.prevUrl,
      newUrl: a.newUrl,
      op: a.op,
      prompt: a.prompt,
    },
  });
  if (error) throw new Error(error.message || 'board commit failed');
  if (!data?.ok) throw new Error(data?.error || 'board commit failed');
}
