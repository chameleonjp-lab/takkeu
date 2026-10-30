import { expect, it } from 'vitest';
import { TRANSLATIONS } from '../../src/i18n/translations';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import { t, setLanguage } from '../../src/i18n/i18n';
import { resultComment } from '../../src/ui/resultComments';
import { resultBands } from '../helpers/resultCases';
const placeholders=(s:string)=>[...s.matchAll(/\{[a-zA-Z0-9_]+\}/gu)].map(x=>x[0]).sort();
const source=Object.keys(TRANSLATIONS.ja);
it.each(SUPPORTED_LANGUAGES)('$id has every message, exact parameters and no untranslated source', ({id})=>{
  const catalog: Readonly<Record<string,string>>=TRANSLATIONS[id];
  expect(Object.keys(catalog).sort()).toEqual([...source].sort());
  for(const key of source) {
    expect(catalog[key]?.trim(),`${id}: ${key}`).toBeTruthy();
    expect(placeholders(catalog[key]!)).toEqual(placeholders(key));
    if(id!=='ja') {
      expect(catalog[key],`${id}: ${key}`).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      // Identical Chinese words and pure parameter/punctuation strings are genuine translations.
      const identical = key === '{percent}%' || (id === 'zh-Hant' && ['設定','標準'].includes(key)) || (id === 'zh-Hans' && key === '第{number}号　{name}　{date}（UTC）');
      if (!identical) expect(catalog[key],`${id}: ${key}`).not.toBe(key);
    }
    const numbers=(s:string)=>s.replace(/\{[^}]+\}/gu,'').match(/\d+/gu)?.filter(n => ['3500','3000','100','30','20','50','200'].includes(n)).sort() ?? [];
    expect(numbers(catalog[key]!),`${id}: protected numeric constants in ${key}`).toEqual(numbers(key));
  }
});
it('covers the 44 immutable score bands in every language and restores Japanese',()=>{
  expect(resultBands).toHaveLength(44);
  for(const {id} of SUPPORTED_LANGUAGES){
    setLanguage(id);
    for(const [min,max,key] of resultBands) {
      expect(resultComment(min)).toBe(t(key));expect(resultComment(max)).toBe(t(key));
    }
  }
  setLanguage('ja');
  for(const [min,,key] of resultBands) expect(resultComment(min)).toBe(key);
});
