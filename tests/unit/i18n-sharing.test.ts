import { afterEach, expect, it } from 'vitest';
import { setLanguage } from '../../src/i18n/i18n';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import { homeShareUrl, scoreShareUrl } from '../../src/ranking/config';
import { resultComment } from '../../src/ui/resultComments';
import { resultBands } from '../helpers/resultCases';
afterEach(()=>setLanguage('ja'));
it.each(SUPPORTED_LANGUAGES)('$id translates home, result and all 44 comment bands', ({id})=>{
  setLanguage(id);
  const home=new URL(homeShareUrl(3500)), result=new URL(scoreShareUrl(3500,true,35)!);
  expect(home.searchParams.get('url')).toBe('https://chameleonjp-lab.github.io/takkeu/');
  const text=result.searchParams.get('text')!;
  expect(text).toContain('3500'); expect(text).toContain('35'); expect(text).toContain('https://chameleonjp-lab.github.io/takkeu/');
  if(id!=='ja') {
    expect(home.searchParams.get('text')).not.toMatch(/[ぁ-んァ-ヶ]/u);
    expect(text).not.toMatch(/[ぁ-んァ-ヶ]/u);
  }
  // X weights CJK and many non-Latin characters as 2, and URLs as 23.
  const weighted=(value:string)=>[...value.replace(/https?:\/\/\S+/gu, 'x'.repeat(23))].reduce((sum,c)=>{const n=c.codePointAt(0)!;return sum+(n<=0x10ff||(n>=0x2000&&n<=0x200d)||(n>=0x2010&&n<=0x201f)||(n>=0x2032&&n<=0x2037)?1:2);},0);
  expect(weighted(text)).toBeLessThanOrEqual(280);
  expect(weighted(new URL(scoreShareUrl(3500,true,Number.MAX_SAFE_INTEGER)!).searchParams.get('text')!)).toBeLessThanOrEqual(280);
  expect(weighted(new URL(homeShareUrl(Number.MAX_SAFE_INTEGER)).searchParams.get('text')!)+24).toBeLessThanOrEqual(280);
  for(const [min,max,source] of resultBands) {
    expect(resultComment(min)).toBe(resultComment(max));
    expect(resultComment(min).trim()).not.toBe('');
    if(id!=='ja') expect(resultComment(min)).not.toBe(source);
  }
  expect(scoreShareUrl(3000,true,35)).toBeNull();
  expect(new URL(scoreShareUrl(3500,false,35)!).searchParams.get('text')).not.toContain('35\n');
});
