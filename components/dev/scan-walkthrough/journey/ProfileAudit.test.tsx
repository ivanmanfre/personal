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
