// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { setLanguage } from '../../src/i18n/i18n';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import { homeShareUrl, scoreShareUrl } from '../../src/ranking/config';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';
const tags='#タッケウ #ゲーム制作';
const weighted=(value:string)=>[...value.replace(/https?:\/\/\S+/gu,'x'.repeat(23))].reduce((n,c)=>{const p=c.codePointAt(0)!;return n+(p<=0x10ff||(p>=0x2000&&p<=0x200d)||(p>=0x2010&&p<=0x201f)||(p>=0x2032&&p<=0x2037)?1:2)},0);
afterEach(()=>setLanguage('ja'));
it.each(SUPPORTED_LANGUAGES)('$id keeps both formal tags once with localized home/result copy within 280 weight',({id})=>{
 setLanguage(id);for(const raw of [homeShareUrl(0),scoreShareUrl(0),scoreShareUrl(37),scoreShareUrl(Number.MAX_SAFE_INTEGER),scoreShareUrl(3500,true,Number.MAX_SAFE_INTEGER)]){
  const url=new URL(raw!),text=url.searchParams.get('text')!;expect(text.endsWith('\n'+tags)).toBe(true);expect(text.match(/#[^\s]+/gu)).toEqual(tags.split(' '));expect(weighted(text)+(url.searchParams.has('url')?24:0)).toBeLessThanOrEqual(280);
 }
});
it('removes only ordinary home/result copy panels and retains valid result links',()=>{
 const root=document.createElement('div');document.body.append(root);const noop=()=>{};const screens=createScreens(root,{start:noop,pause:noop,resume:noop,retry:noop,home:noop,toggleSound:noop,volume:noop});
 try{expect(root.querySelectorAll('.share-copy,[data-share-home-copy],[data-share-result-copy]')).toHaveLength(0);expect(root.querySelector('[data-share-home-x]')).not.toBeNull();screens.render({...scenario(37).snapshot(),phase:'gameover'});expect(root.querySelector('[data-share-x]')!.getAttribute('href')).toBe(scoreShareUrl(37));}finally{screens.dispose();root.remove()}
});
