// DEV-ONLY: renders a saved content-system scan row through the real adapter, validator and page.
import React from 'react';
import ScanStoryReport from '../../scan/story/ScanStoryReport';
import { toStoryFixture } from '../../scan/story/adapter';
import { validateEdition } from '../../scan/story/validate';

export default function StoryLab({ load, view, hero }: { load: () => Promise<unknown>; view: 'main' | 'team'; hero: boolean }) {
  const [row, setRow] = React.useState<any>(null);
  React.useEffect(() => { load().then(setRow); }, [load]);
  if (!row) return null;
  const cs = row.report_json.content_system;
  const r = hero ? row : { ...row, report_json: { ...row.report_json, content_system: { ...cs, hero: undefined } } };
  const fixture = toStoryFixture(r);
  const { edition, errors } = validateEdition(cs.story_v1, fixture, true);
  if (!edition) return <pre style={{ padding: 40 }}>{errors.join('\n')}</pre>;
  return <ScanStoryReport fixture={fixture} edition={edition} view={view} />;
}
