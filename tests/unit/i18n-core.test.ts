import { afterEach, expect, it, vi } from 'vitest';
import { SUPPORTED_LANGUAGES, languageFromLocale } from '../../src/i18n/languages';
import { createI18n, setLanguage, t, LANGUAGE_STORAGE_KEY } from '../../src/i18n/i18n';
afterEach(() => setLanguage('ja'));
it('offers exactly the same 15 IDs in native names as Sainome', () => {
  expect(SUPPORTED_LANGUAGES.map(x => x.id)).toEqual(['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th']);
  expect(new Set(SUPPORTED_LANGUAGES.map(x => x.name)).size).toBe(15);
});
it.each([['ja-JP','ja'],['en-GB','en'],['es-MX','es'],['pt-PT','pt-BR'],['pt-BR','pt-BR'],['zh-TW','zh-Hant'],['zh-HK','zh-Hant'],['zh-MO','zh-Hant'],['zh-CN','zh-Hans'],['zh-Hans-TW','zh-Hans'],['zh-Hant-CN','zh-Hant'],['xx',null]])('maps %s to %s', (tag, expected) => expect(languageFromLocale(tag)).toBe(expected));
it.each([
  [{languages:['es-MX','ja'],language:'en'},'es'],
  [{languages:['xx'],language:'fr-FR'},'fr'],
  [{languages:['xx'],language:'xx'},'en'],
  [{languages:[]},'ja'], [{},'ja'],
])('uses browser preference order and distinct missing-language fallback', (navigatorObject, language) => {
  expect(createI18n({storage:null,navigatorObject}).getLanguage()).toBe(language);
});
it('honors only supported saved manual preferences and writes only the new dedicated key', () => {
  let saved = 'th'; const setItem=vi.fn((_key:string,value:string)=>{saved=value;});
  const storage={getItem:vi.fn(()=>saved),setItem};
  const i18n=createI18n({storage,navigatorObject:{languages:['ja']}});
  expect(i18n.getLanguage()).toBe('th'); i18n.setLanguage('de');
  expect(setItem).toHaveBeenCalledExactlyOnceWith('takkeu.language.v1','de');
  saved='invalid'; expect(createI18n({storage,navigatorObject:{language:'es'}}).getLanguage()).toBe('es');
  expect(LANGUAGE_STORAGE_KEY).toBe('takkeu.language.v1');
});
it('switches in memory when both storage methods throw, notifies once and unsubscribes', () => {
  const storage={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
  const i18n=createI18n({storage,navigatorObject:{language:'en'}}); const listener=vi.fn();
  const off=i18n.onLanguageChange(listener); i18n.setLanguage('es'); i18n.setLanguage('es'); i18n.setLanguage('xx');
  expect(i18n.getLanguage()).toBe('es'); expect(listener).toHaveBeenCalledTimes(1);
  off();i18n.setLanguage('ja');expect(listener).toHaveBeenCalledTimes(1);
});
it('never displays an unresolved placeholder when a required value is missing', () => {
  expect(t('あと約{seconds}秒（目安）')).not.toContain('{seconds}');
});
it('localizes unexpected technical failures at the presentation boundary and keeps known error details', async()=>{
  const { translateError }=await import('../../src/i18n/i18n');setLanguage('de');
  expect(translateError('Unexpected WebGL failure')).not.toContain('Unexpected WebGL failure');
  expect(translateError('予期しない描画エラー。')).not.toMatch(/[ぁ-んァ-ヶ]/u);
  expect(translateError('ランキング通信に失敗しました（503）。')).toContain('503');
  setLanguage('ja');expect(translateError('Unexpected WebGL failure')).toBe('準備を完了できませんでした。もう一度お試しください。');
});
