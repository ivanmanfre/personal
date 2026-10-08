import React, {useId, useState} from 'react';
import {Paragraphs} from '../../dev/scan-walkthrough/journey/ReadingChapter';

/** Keep the complete opening paragraph visible at every card width. */
export function StudioPostText({text}: {text: string}) {
 const [open, setOpen] = useState(false), id = useId();
 const normalized = text.replace(/\r\n/g, '\n').trim();
 const paragraphs = normalized.split(/\n[ \t]*\n+/);
 const hook = paragraphs[0];
 return <div className="studio-post-text">
  <div id={id}><Paragraphs text={open ? normalized : hook}/></div>
  {paragraphs.length > 1 && <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>{open ? 'Show less' : '…see more'}</button>}
 </div>;
}
