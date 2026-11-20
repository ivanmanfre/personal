import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProfileAuditSection} from './ProfileAudit';

describe('profile audit source pictures',()=>{
  it('shows the saved banner and profile photo beside the findings',()=>{
    const html=renderToStaticMarkup(<ProfileAuditSection audit={{
      avatarUrl:'https://assets.example/piotr.jpg',bannerUrl:'https://assets.example/banner.jpg',
      findings:[{area:'banner',label:'Banner',state:'present',today:'Custom banner',quote:'',fix:'Write one line.'}]
    }}/>);
    expect(html).toContain('src="https://assets.example/banner.jpg"');
    expect(html).toContain('src="https://assets.example/piotr.jpg"');
    expect(html).toContain('Write one line.');
  });
});

describe('profile audit reads clean',()=>{
  const mira={findings:[
    {area:'booking',label:'How a buyer books',state:'present',quote:'https://quillmarsh.example',
      today:'Buyers can also send a proposal request from your LinkedIn Services page. A link a buyer can find on your profile:',
      fix:'Add a call booking page to https://quillmarsh.example. Then put that link at the end of your headline and About with: Book a call at https://quillmarsh.example.'},
    {area:'banner',label:'Banner',state:'present',today:'Your banner reads:',
      quote:"SHAPE THE PLAN WITH US · ByteHarbor Labs · IT SERVICES · Practical IT Planning · Bespoke Software Builds · Search & Growth Team · mira@byteharbor.example · Let's build the next one together",
      fix:'Rewrite the top line to name the buyer and the work. Put https://www.quillmarsh.example/ next to your email.'},
  ]};
  const html=renderToStaticMarkup(<ProfileAuditSection audit={mira}/>);
  it('shows web addresses without https:// or www',()=>{
    expect(html).not.toContain('https://quillmarsh');
    expect(html).not.toContain('www.quillmarsh');
    expect(html).toContain('Book a call at quillmarsh.example.');
    expect(html).toContain('Put quillmarsh.example next to your email.');
  });
  it('puts the booking link before the Services note so a 2-line clamp never hides it',()=>{
    expect(html).toContain('<q>quillmarsh.example</q>. You also get proposal requests on Services.');
    expect(html).not.toContain('Buyers can also send');
    expect(html).toContain('A link a buyer can find on your profile: <q>quillmarsh.example</q>');
  });
  it('quotes only the banner top line, the image already shows the rest',()=>{
    expect(html).toContain('Your banner top line reads: <q>SHAPE THE PLAN WITH US</q>');
    expect(html).not.toContain('mira@byteharbor.example');
  });
  it('keeps a short banner quote whole',()=>{
    const out=renderToStaticMarkup(<ProfileAuditSection audit={{findings:[{area:'banner',label:'Banner',state:'present',
      today:'Your banner reads:',quote:'Creator Campaign Studio · for software brands',fix:'Put one line.'}]}}/>);
    expect(out).toContain('Your banner reads: <q>Creator Campaign Studio · for software brands</q>');
  });
});
