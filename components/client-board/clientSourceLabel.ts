// Client-facing source labels. Shared by every client panel view so an operator note never
// reaches a client through one view while another view hides it.

const SOURCE_LABEL_CLIENT: Record<string, string> = {
  // Honest, concrete labels only — never a vague "Picked by Ivan". Call-grounded and
  // launch/own-post posts carry richer provenance via source_detail (see sourceChip).
  'Hand-picked': 'RISE DTC content strategy',
  'From your sales calls': 'From your sales call',
  'Needs your client material': 'Needs a client story from you',
};
/** Operator notes that leaked into source labels (goal-run ids, ballots, rebuild notes,
 *  review stamps). The client sees no source line for these; other labels keep only their
 *  readable head (before the first "(", ";" or " - "), dropping raw links and run notes. */
const INTERNAL_SOURCE_LABEL = /goal-run|ballot|ivan-directed|per ivan|picked by ivan|approved by ivan|for davorin|tournament|elevation run|inbox selection|top-performer mining|\bbrief \d{4}-\d{2}-\d{2}/i;
export function srcLabelClient(label?: string | null): string {
  if (!label) return '';
  if (SOURCE_LABEL_CLIENT[label]) return SOURCE_LABEL_CLIENT[label];
  if (INTERNAL_SOURCE_LABEL.test(label)) return '';
  if (/^format adapted from a post by/i.test(label)) return "Format adapted from another creator's post";
  return label.split(/\s\(|;\s|\s-\s/)[0].trim();
}
