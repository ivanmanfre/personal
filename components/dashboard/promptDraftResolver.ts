export interface DraftState {
  body: string;
  title: string;
  externalUpdate: null | { updatedAt: string; updatedBy: string | null };
}
export function resolveDraft(
  prev: DraftState,
  row: { id: string; body: string; title: string; updatedAt: string; updatedBy: string | null } | null,
  dirty: boolean,
): DraftState {
  if (!row) return { body: '', title: '', externalUpdate: null };
  if (dirty) return { ...prev, externalUpdate: { updatedAt: row.updatedAt, updatedBy: row.updatedBy } };
  return { body: row.body, title: row.title, externalUpdate: null };
}
