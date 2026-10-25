import { expect,test,waitForStart } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

for(const from of ['pause','result','home'] as const){
  test(`準備済みなら${from}から次のRAFを待たず、案内を一度も出さずに開始する`,async({page})=>{
    await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
    await page.goto('/tests/fixtures/stage3.html');
    await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);
    const previous=await page.evaluate(()=>window.stage3.snapshot());
    if(from==='result'){
      await page.evaluate(()=>window.stage3.finish());await page.clock.runFor(16);
      await expect(page.locator('[data-result] h2')).toBeVisible();
    }else{
      await page.keyboard.press('Escape');
      if(from==='home')await page.getByRole('button',{name:'ホームへ',exact:true}).click();
    }
    await page.evaluate(()=>{
      const loader=document.querySelector<HTMLElement>('[data-loading-screen]')!;
      document.body.dataset.loadingFlashed='false';
      const observer=new MutationObserver(records=>{
        // Setting hidden=true again also emits a mutation. Detect an actual
        // visible state, including a removal/addition in the same microtask.
        if(!loader.hidden||records.some(record=>record.oldValue===null))document.body.dataset.loadingFlashed='true';
      });
      observer.observe(loader,{attributes:true,attributeOldValue:true,attributeFilter:['hidden']});
    });
    await page.getByRole('button',{name:from==='home'?'はじめる':from==='result'?'もう一度':'最初からやり直す',exact:true}).click();
    // Browser audio resume may settle asynchronously. The virtual RAF clock
    // remains paused: no display frames or fixed display duration are needed.
    await expect.poll(()=>page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
    const next=await page.evaluate(()=>window.stage3.snapshot());
    expect(next.simTime).toBe(0);expect(next.score).toBe(0);expect(next.lostBallCount).toBe(0);
    expect(next.balls).toHaveLength(1);expect(next.runId).not.toBe(previous.runId);
    expect(await page.locator('body').getAttribute('data-loading-flashed')).toBe('false');
    expect(await page.evaluate(()=>window.stage3.metrics().viewPrepares)).toBe(1);
    // The new run also has a working, fresh input mapping immediately.
    const surface=page.getByTestId('input-surface');
    await expect(surface).not.toHaveAttribute('inert','');
    const rect=await surface.boundingBox();
    await page.mouse.click(rect!.x+rect!.width*.7,rect!.y+rect!.height*.6);await page.clock.runFor(16);
    expect((await page.evaluate(()=>window.stage3.snapshot())).paddle).not.toEqual(next.paddle);
  });
}

test('描画の準備中は進捗と中央のルールを表示し、ゲームと入力は開始しない',async({page},info)=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html?loading=hold');
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await expect(page.locator('[data-loading-screen]')).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.locator('[data-loading-screen]')).toContainText('100');
  await page.clock.runFor(500);
  const before=await page.evaluate(()=>window.stage3.snapshot());
  expect(before.phase).toBe('ready');expect(before.simTime).toBe(0);
  await page.mouse.click(300,500);await page.clock.runFor(100);
  expect(await page.evaluate(()=>window.stage3.snapshot())).toEqual(before);
  await page.screenshot({path:info.outputPath('loading-rules-progress.png')});
  await page.evaluate(()=>window.stage3.releasePreparation());await waitForStart(page);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
  expect(await page.evaluate(()=>window.stage3.metrics().viewPrepares)).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'最初からやり直す',exact:true}).click();await waitForStart(page);
  const replay=await page.evaluate(()=>window.stage3.snapshot());
  expect(replay.score).toBe(0);expect(replay.lostBallCount).toBe(0);expect(replay.balls).toHaveLength(1);
  expect(replay.runId).not.toBe(before.runId);
  expect(await page.evaluate(()=>window.stage3.metrics().viewPrepares)).toBe(1);
});

test('準備をキャンセルしたあと古い完了通知が来ても勝手に開始せず、次は準備済み資源を使う',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html?loading=hold');
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(100);
  await page.locator('[data-loading-action="cancel"]').click();
  await expect(page.getByRole('heading',{name:'タッケウ',exact:true})).toBeVisible();
  await page.evaluate(()=>window.stage3.releasePreparation());await page.clock.runFor(500);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('ready');
  await expect(page.getByTestId('game-screen')).toBeHidden();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
  expect(await page.evaluate(()=>window.stage3.metrics().viewCreates)).toBe(1);
});

test('準備の失敗はルール付きの再試行画面になり、手動の再試行で開始できる',async({page},info)=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');await page.evaluate(()=>window.stage3.failNextView());
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(100);
  await expect(page.locator('[data-loading-screen] [role="alert"]')).toContainText('renderer creation failed');
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('ready');
  await page.screenshot({path:info.outputPath('loading-error-retry.png')});
  await page.getByRole('button',{name:'もう一度準備する',exact:true}).click();await waitForStart(page);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
});

test('ウィンドウのresizeがなくてもコートの表示サイズ変更後にラケットを動かせる',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await waitForStart(page);
  await page.evaluate(()=>{document.querySelector<HTMLElement>('.canvas-wrap')!.style.height='calc(100% - 2px)';});
  await page.clock.runFor(32);
  const point=await page.evaluate(async()=>{
    const cameraUrl='/src/render/camera.ts',configUrl='/src/game/config.ts';
    const {createCamera,fitCamera}=await import(cameraUrl),{DEFAULT_CONFIG}=await import(configUrl);
    const rect=document.querySelector('canvas')!.getBoundingClientRect(),camera=createCamera();fitCamera(camera,rect.width,rect.height,DEFAULT_CONFIG);
    const p=camera.position.clone().set(.6,.5,DEFAULT_CONFIG.paddleZ).project(camera);
    return{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
  });
  await page.mouse.click(point.x,point.y);await page.clock.runFor(32);
  const s=await page.evaluate(()=>window.stage3.snapshot());
  expect(s.phase).toBe('running');expect(s.paddle.x).toBeCloseTo(.6,2);
});

test('準備中の描画喪失から復旧しても手動の再試行まで開始しない',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html?loading=hold');
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(100);
  await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.locator('[data-loading-screen] [role="alert"]')).toContainText('描画の復旧');
  await page.evaluate(()=>{window.stage3.restore();window.stage3.releasePreparation();});await page.clock.runFor(100);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('ready');
  await page.getByRole('button',{name:'もう一度準備する',exact:true}).click();await waitForStart(page);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
  expect(await page.evaluate(()=>window.stage3.metrics().viewCreates)).toBe(2);
});

test('ドラッグ中にコートだけのサイズが変わっても指を離すまでラケットが追従する',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);
  const canvas=page.locator('canvas'),finger={pointerId:61,pointerType:'touch',isPrimary:true,button:0};
  await canvas.dispatchEvent('pointerdown',{...finger,clientX:300,clientY:400});await page.clock.runFor(16);
  const point=await page.evaluate(async()=>{
    document.querySelector<HTMLElement>('.canvas-wrap')!.style.height='calc(100% - 2px)';
    const cameraUrl='/src/render/camera.ts',configUrl='/src/game/config.ts';
    const {createCamera,fitCamera}=await import(cameraUrl),{DEFAULT_CONFIG}=await import(configUrl);
    const rect=document.querySelector('canvas')!.getBoundingClientRect(),camera=createCamera();fitCamera(camera,rect.width,rect.height,DEFAULT_CONFIG);
    const p=camera.position.clone().set(-.6,.5,DEFAULT_CONFIG.paddleZ).project(camera);
    return{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
  });
  // Deliver the gesture before another RAF gets a chance to repair the mapping.
  await canvas.dispatchEvent('pointermove',{...finger,clientX:point.x,clientY:point.y});await page.clock.runFor(16);
  expect(await page.evaluate(()=>window.stage3.snapshot().paddle.x)).toBeCloseTo(-.6,2);
  await canvas.dispatchEvent('pointerup',{...finger,clientX:point.x,clientY:point.y});
});

test('狭い画面と文字200%でも中央の案内・進捗・終了条件・中断操作を読める',async({page},info)=>{
  await page.setViewportSize({width:280,height:360});
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html?loading=hold');
  await page.addStyleTag({content:'html{font-size:200%}'});
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(100);
  const screen=page.locator('[data-loading-screen]');
  expect(await screen.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
  expect(await page.locator('[data-loading-rules]').evaluate(node=>getComputedStyle(node).textAlign)).toBe('center');
  await page.locator('[data-loading-progress]').scrollIntoViewIfNeeded();
  await expect(page.getByRole('progressbar')).toBeInViewport();
  await page.screenshot({path:info.outputPath('loading-narrow-progress.png')});
  await page.clock.runFor(11000);
  await expect(page.locator('[data-loading-eta]')).toContainText('秒経過');
  await page.locator('[data-loading-end]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-loading-end]')).toBeInViewport();
  await expect(page.locator('[data-loading-end]')).toContainText('累計100球');
  await page.screenshot({path:info.outputPath('loading-narrow-rules.png')});
  await page.locator('[data-loading-action="cancel"]').click();
  await expect(page.getByRole('heading',{name:'タッケウ',exact:true})).toBeVisible();
});
