import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { useStory } from './context';
import { RichText } from './RichText';
import { BrandMark, brandFont, brandPalette } from './BrandSlide';
import { zip } from './zip';

type Skill = {name: string; title: string; when: string; body: string; tryIt: string};
const skillFile = (s: Skill) => `---\nname: ${s.name}\ndescription: ${s.when.replace(/\n/g, ' ')}\n---\n\n# ${s.title}\n\n${s.body.trim()}\n`;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'claude-skills';

/** SKILL.md read as a page: its "## " headings become section titles, the "# " title line (already shown) and bold markers drop. */
function SkillBody({body}: {body: string}) {
  const blocks = body.replace(/\*\*/g, '').replace(/^#\s[^\n]*\n?/, '').split(/^##\s+/m).map(b => b.trim()).filter(Boolean);
  return <>{blocks.map((b, i) => { const [head, ...rest] = b.split('\n'), titled = i > 0 || /^##/.test(body.replace(/^#\s[^\n]*\n?/, '').trim());
    return <section key={i} className="skill-kit-block">{titled && <h5>{head}</h5>}<RichText text={titled ? rest.join('\n').trim() : b} className="brand-resource-body"/></section>; })}</>;
}

/** The lead magnet as a Claude skill kit: pick a skill, read its SKILL.md, copy it, or take the whole kit as a zip. */
export function SkillKit() {
  const plan = useStory(), r = plan.resource, p = brandPalette(r.brand), skills = (r.options[0]?.skills || []) as Skill[];
  const [index, setIndex] = useState(0), [copied, setCopied] = useState(''), [error, setError] = useState(false);
  const s = skills[Math.min(index, skills.length - 1)];
  async function copy(what: 'skill' | 'prompt') {
    try { await navigator.clipboard.writeText(what === 'skill' ? skillFile(s) : s.tryIt); setCopied(what); setError(false); } catch { setError(true); }
  }
  function download() {
    const root = slugify(r.title);
    const readme = `# ${r.title}\n\nBy ${plan.brand}. ${skills.length} Claude skills.\n\nClaude Code: copy each folder into ~/.claude/skills/ (for example \`cp -R ${root}/* ~/.claude/skills/\`).\nClaude.ai: Settings > Capabilities > Skills, upload each folder as a zip.\n\n${skills.map(k => `- ${k.title}: ${k.when}`).join('\n')}\n`;
    const bytes = zip([{path: `${root}/README.md`, text: readme}, ...skills.map(k => ({path: `${root}/${k.name}/SKILL.md`, text: skillFile(k)}))]);
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'}));
    const a = document.createElement('a'); a.href = url; a.download = `${root}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!s) return null;
  return <article className="brand-resource skill-kit" aria-label="Lead magnet sample" style={{ '--res-dark': p.dark, '--res-light': p.light, '--res-accent': p.accent, '--res-accent-ink': p.accentInk, '--res-mark': p.accentOnLight, '--res-font': brandFont(r.brand.font) } as React.CSSProperties}>
    <header className="brand-resource-bar"><BrandMark ground={p.dark} height={24}/><span>{plan.magnet}</span></header>
    <div className="brand-resource-grid">
      <aside className="brand-resource-side">
        <h3>{r.title}</h3>
        <ol className="skill-kit-list">{skills.map((k, i) => <li key={k.name}><button aria-pressed={i === index} onClick={() => { setIndex(i); setCopied(''); setError(false); }}><span>{String(i + 1).padStart(2, '0')}</span><b>{k.title}</b></button></li>)}</ol>
        <div className="brand-resource-actions"><button onClick={download}><Download size={16}/><span>Download the kit (.zip)</span></button></div>
        <p className="skill-kit-install">Works in Claude.ai and Claude Code. Drop the folders into your skills and Claude runs them when the job comes up.</p>
        {error && <p role="status">Copy is unavailable here. Use the download button.</p>}
      </aside>
      <div className="brand-resource-doc" tabIndex={0} aria-label={s.title}>
        <p className="brand-resource-kicker">Skill {String(index + 1).padStart(2, '0')} · {s.name}</p>
        <h4 className="skill-kit-title">{s.title}</h4>
        <p className="skill-kit-when">{s.when}</p>
        <div className="skill-kit-try"><span>Try it: paste this into Claude</span><p>{s.tryIt}</p><button onClick={() => copy('prompt')}>{copied === 'prompt' ? <Check size={14}/> : <Copy size={14}/>}<span aria-live="polite">{copied === 'prompt' ? 'Copied' : 'Copy prompt'}</span></button></div>
        <div className="skill-kit-file"><header><span>SKILL.md</span><button onClick={() => copy('skill')}>{copied === 'skill' ? <Check size={14}/> : <Copy size={14}/>}<span aria-live="polite">{copied === 'skill' ? 'Copied' : 'Copy SKILL.md'}</span></button></header><div className="skill-kit-md"><SkillBody body={s.body}/></div></div>
        <small>Example skills built for this page. Businesses and numbers inside are illustrative.</small>
      </div>
    </div>
  </article>;
}
