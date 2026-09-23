import {mkdirSync,writeFileSync} from 'node:fs';
import rows from '../components/scan/story/__fixtures__/review-rows.json';
import {toStoryFixture} from '../components/scan/story/adapter';
import {reviewDraft} from '../components/scan/story/reviewDrafts';
import {validateEdition} from '../components/scan/story/validate';
import {assessAudience} from '../components/scan/story/assessment';
const dir='audits/andrew-scan-design-2026-09-21/revenue-story/release';mkdirSync(dir,{recursive:true});
for(const row of rows){const f=toStoryFixture(row),checked=validateEdition(reviewDraft(f),f);if(!checked.edition)throw new Error(checked.errors.join(' '));writeFileSync(`${dir}/${row.company_slug}.json`,JSON.stringify({company_slug:row.company_slug,assessment:assessAudience(f),story_v1:checked.edition},null,2)+'\n');}
console.log(`Exported ${rows.length} draft release records. No remote data changed.`);
