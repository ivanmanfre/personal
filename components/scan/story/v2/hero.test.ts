import {describe,it,expect} from 'vitest';
import {heroSentence,countLine,pageShape,bookUrl,teamUrl,shortDate,windowWords} from './hero';
import type {HeroRow} from '../../../dev/scan-walkthrough/journey/model';

const hollis:HeroRow={name:'Hollis Fernwhistle',role:'Head of Growth at Pebblefold',headline:'Head of Growth at Pebblefold',source:'competitor',how:'commented',author:'Brindlemoor Partners',postExcerpt:'',date:'2026-11-10',dateKind:'comment',reason:''};
describe('heroSentence',()=>{
 it('builds the spec sentence',()=>expect(heroSentence(hollis)).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, commented on a post by Brindlemoor Partners on 10 Nov.'));
 it("says the date is the post's when that is what we hold",()=>expect(heroSentence({...hollis,dateKind:'post'})).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, commented on a 10 Nov post by Brindlemoor Partners.'));
 it('liked with a date',()=>expect(heroSentence({...hollis,how:'liked',dateKind:'post'})).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, liked a 10 Nov post by Brindlemoor Partners.'));
 it('reads without a date',()=>expect(heroSentence({...hollis,date:undefined,dateKind:undefined,how:'liked'})).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, liked a post by Brindlemoor Partners.'));
 it('own engager without a date',()=>expect(heroSentence({...hollis,source:'own',author:undefined,how:'engaged',date:undefined})).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, engages with your posts.'));
 it('own engager with a date',()=>expect(heroSentence({...hollis,source:'own',author:undefined,how:'commented'})).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, commented on your 10 Nov post.'));
 it('topic source reads like a competitor',()=>expect(heroSentence({...hollis,source:'topic'})).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, commented on a post by Brindlemoor Partners on 10 Nov.'));
 it('never prints undefined or a dangling comma without a role or author',()=>{const s=heroSentence({...hollis,role:'',author:undefined});expect(s).toBe('Hollis Fernwhistle commented on a post on 10 Nov.');expect(s).not.toMatch(/undefined|, ,|,\s*\./)});
});
describe('countLine',()=>{
 it('counts both sources',()=>expect(countLine({buyers:27,own:12,outside:15,windowDays:14,authors:['Brindlemoor Partners','Quillreach']},'competitor')).toBe('27 buyers within reach: 12 engage with your posts, 15 engaged with Brindlemoor Partners and Quillreach in the last two weeks.'));
 it('outside only',()=>expect(countLine({buyers:14,own:0,outside:14,windowDays:14,authors:['Tansy Thread Collective']},'competitor')).toBe('13 more buyers did the same in the last two weeks.'));
 it('one own buyer never prints as a 1',()=>expect(countLine({buyers:6,own:1,outside:5,windowDays:14,authors:['Larchmere Studio']},'competitor')).toBe('4 more buyers did the same in the last two weeks.'));
 it('own only',()=>expect(countLine({buyers:18,own:18,outside:0,authors:[]},'own')).toBe('17 more buyers engage with your posts.'));
 it('never prints a count below 2',()=>{expect(countLine({buyers:3,own:1,outside:2,windowDays:14,authors:['Larchmere Studio']},'competitor')).toBeNull();expect(countLine({buyers:1,own:1,outside:0,authors:[]},'own')).toBeNull()});
 it('three or four authors join with commas and and',()=>expect(countLine({buyers:9,own:4,outside:5,windowDays:30,authors:['A','B','C']},'competitor')).toBe('9 buyers within reach: 4 engage with your posts, 5 engaged with A, B and C in the last 30 days.'));
});
describe('helpers',()=>{
 it('shape by firm size',()=>{expect(pageShape({band:'larger',staff:30})).toBe('considered');expect(pageShape({band:'unknown'})).toBe('fast');expect(pageShape({band:'small',staff:4})).toBe('fast')});
 it('booking links carry the placement',()=>expect(bookUrl('marta-quillfeather-fx1','after-buyers')).toBe('https://calendly.com/im-ivanmanfredi/30min?utm_source=scan&utm_medium=page&utm_campaign=marta-quillfeather-fx1&utm_content=after-buyers'));
 it('team url',()=>expect(teamUrl('marta-quillfeather-fx1')).toBe('/scan/marta-quillfeather-fx1/team/'));
 it('short date is en-GB UTC and empty for junk',()=>{expect(shortDate('2026-11-03')).toBe('3 Nov');expect(shortDate('nope')).toBe('')});
 it('window words',()=>{expect(windowWords(14)).toBe('in the last two weeks');expect(windowWords(30)).toBe('in the last 30 days');expect(windowWords()).toBe('recently')});
});
