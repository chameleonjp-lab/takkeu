const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const file=require('node:path').join(__dirname,'../../src/ui/shareLink.ts'),raw=fs.readFileSync(file,'utf8');
const source=stripTypeScriptTypes(raw,{mode:'strip'}).replace('export function activateShareLink','function activateShareLink');
const context={URL};vm.createContext(context,{codeGeneration:{strings:false,wasm:false}});vm.runInContext(source+';this.run=activateShareLink',context,{timeout:1000});
const canonical='https://chameleonjp-lab.github.io/takkeu/',text='タッケウで37ラリー達成！\n'+canonical+'\n#タッケウ #ゲーム制作';
function fixture(fail='',eventPatch={},separate=false){
 const events=[],prompts=[],calls=[];let opener={};
 const url=new URL('https://twitter.com/intent/tweet');url.searchParams.set('text',text);if(separate)url.searchParams.set('url',canonical);
 const step=name=>{events.push(name);if(fail===name)throw Error('mock '+name)};
 const nav={click(){step('navigate');assert.equal(nav.target,'_self');assert.equal(nav.rel,'noreferrer');assert.equal(nav.referrerPolicy,'no-referrer');assert.equal(nav.href,url.href);assert.equal(opener,null)},remove(){step('detach')}};
 const popup={document:{createElement(tag){step('create');assert.equal(tag,'a');return nav},body:{append(node){step('append');assert.equal(node,nav)}}},close(){step('close')}};
 Object.defineProperty(popup,'opener',{set(value){step('set-opener');if(fail!=='opener-nonnull')opener=value},get(){step('read-opener');return opener}});
 const host={open(...args){calls.push(args);step('open');return fail==='null'?null:popup},prompt(title,value){prompts.push({title,value})}};
 const link={href:url.href,hasAttribute:()=>true,getAttribute:()=>null,closest:()=>null};
 let prevented=0;const event={button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,preventDefault(){prevented++},...eventPatch};
 return{host,link,event,calls,prompts,events,prevented:()=>prevented,copyText:separate?text+'\n'+canonical:text};
}
const results=[];
for(const fail of ['', 'null','open','set-opener','read-opener','opener-nonnull','create','append','navigate','detach']){
 const f=fixture(fail);assert.equal(context.run(f.event,f.link,f.host,'共有文をコピー'),true);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],['about:blank','_blank']);assert.equal(f.prevented(),1);
 if(fail)assert.deepEqual(f.prompts,[{title:'共有文をコピー',value:f.copyText}]);else{assert.deepEqual(f.prompts,[]);assert.ok(f.events.indexOf('read-opener')<f.events.indexOf('navigate'));}
 results.push({case:fail||'success',passed:true});
}
for(const patch of [{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}]){const f=fixture('',patch);assert.equal(context.run(f.event,f.link,f.host,'copy'),false);assert.equal(f.calls.length,0);assert.equal(f.prevented(),0);results.push({case:'native-modifier',passed:true});}
const home=fixture('null',{},true);context.run(home.event,home.link,home.host,'copy');assert.equal(home.prompts[0].value,home.copyText);results.push({case:'separate-home-url-copy',passed:true});
console.log(JSON.stringify({sourceSHA256:crypto.createHash('sha256').update(raw).digest('hex'),transform:'node:module.stripTypeScriptTypes mode strip plus export removal only',networkRequests:0,cases:results.length,results},null,2));
