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
  expect([...text].length).toBeLessThan(280);
  for(const [min,max,source] of resultBands) {
    expect(resultComment(min)).toBe(resultComment(max));
    expect(resultComment(min).trim()).not.toBe('');
    if(id!=='ja') expect(resultComment(min)).not.toBe(source);
  }
  expect(scoreShareUrl(3000,true,35)).toBeNull();
  expect(new URL(scoreShareUrl(3500,false,35)!).searchParams.get('text')).not.toContain('35\n');
});
