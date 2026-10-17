import type { BoardComment, BoardMember, BoardMention } from './team';

export function mentionLabel(member: BoardMember, members: BoardMember[]): string {
  const label = member.name?.trim() || member.email;
  return members.filter(m=>(m.name?.trim() || m.email)===label).length>1 ? `${label} (${member.email})` : label;
}

const word = (char: string) => !!char && /[\p{L}\p{N}_]/u.test(char);
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Match selected identities only; a partial/deleted name must never notify someone. */
export function mentionParts(text: string, mentions: BoardMention[] = []): { text: string; mention?: BoardMention }[] {
  const byTag = new Map(mentions.filter(m => m.label).map(m => ['@' + m.label, m]));
  if (!byTag.size) return [{ text }];
  const pattern = new RegExp([...byTag.keys()].sort((a,b) => b.length-a.length).map(escaped).join('|'), 'g');
  const parts: { text: string; mention?: BoardMention }[] = [];
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!, end = start + match[0].length;
    if (word(text[start-1]) || word(text[end])) continue;
    if (start > from) parts.push({ text: text.slice(from,start) });
    parts.push({ text: match[0], mention: byTag.get(match[0]) });
    from = end;
  }
  if (from < text.length || !parts.length) parts.push({ text: text.slice(from) });
  return parts;
}

export function mentionsInText(text: string, mentions: BoardMention[]): BoardMention[] {
  const emails = new Set(mentionParts(text,mentions).flatMap(p => p.mention ? [p.mention.email] : []));
  return mentions.filter(m => emails.has(m.email));
}

export function openCommentThreads(comments: BoardComment[], ref: string, me: string): { open: number; mentioned: number } {
  const roots = comments.filter(c => c.ref===ref && !c.parent && !c.resolved_at);
  const viewer = me.toLowerCase();
  const mentioned = roots.filter(root => viewer && comments.some(c => c.ref===ref && (c.id===root.id || c.parent===root.id)
    && c.mentions?.some(m => m.email.toLowerCase()===viewer))).length;
  return { open: roots.length, mentioned };
}
