// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';

const bands: [number, number, string][] = [
  [0,4,'次こそ決めよう！'],[5,9,'ラリー、開幕！'],[10,14,'いいぞ、つながる！'],[15,19,'コツをつかんだ！'],
  [20,24,'返球センスあり！'],[25,29,'いい手応え！'],[30,34,'打ち返し上手！'],[35,39,'リズムに乗ってきた！'],
  [40,44,'ラリーが止まらない！'],[45,49,'50が見えてきた！'],[50,59,'50の壁、突破！'],[60,69,'ラケットが冴える！'],
  [70,79,'反応速度がすごい！'],[80,89,'流れを完全につかんだ！'],[90,99,'100まであと少し！'],[100,109,'3桁の世界へ突入！'],
  [110,119,'止まらない絶好調！'],[120,129,'驚異の集中力！'],[130,139,'返球マスター！'],[140,149,'全部返すつもり！？'],
  [150,159,'完全にゾーン突入！'],[160,169,'目が追いつかない！'],[170,179,'ここまで来るか！'],[180,189,'反射神経、覚醒！'],
  [190,199,'200目前の猛攻！'],[200,299,'ここから超人級！'],[300,399,'ラリーの猛者、現る！'],[400,499,'人間離れしてきた！'],
  [500,599,'卓球の化身！'],[600,699,'卓球台が休みたがってる！'],[700,799,'無限ラリーモード！'],[800,899,'反射神経、異常値！'],
  [900,999,'伝説まであと一歩！'],[1000,1099,'4桁の怪物、誕生！'],[1100,1199,'常識を置き去り！'],[1200,1299,'ボールを完全支配！'],
  [1300,1399,'未来が見えてる！？'],[1400,1499,'重力さえ味方する！'],[1500,1599,'卓球の次元を突破！'],[1600,1699,'これは記録じゃない、事件！'],
  [1700,1799,'人類の限界を更新！'],[1800,1899,'神速ラリーの領域！'],[1900,1999,'神話まで、あと一歩！'],[2000,100000000,'ラリーの神、降臨。'],
];
let dispose: () => void = () => {};
afterEach(() => dispose());
it.each(bands)('shows the exact comment at both ends of %i–%i', (min, max, comment) => {
  const root = document.createElement('div'); document.body.append(root);
  const noop = () => {};
  const screens = createScreens(root, { start: noop, pause: noop, resume: noop, retry: noop, home: noop, toggleSound: noop, volume: noop });
  dispose = () => { screens.dispose(); root.remove(); };
  const snapshot = scenario(0).snapshot();
  for (const score of [min, max]) {
    screens.render({ ...snapshot, score, phase: 'gameover' });
    const heading = root.querySelector('[data-result] h2')!;
    expect(heading.textContent).toBe(comment);
    expect(heading.closest('[hidden], [aria-hidden="true"]')).toBeNull();
    expect(root.querySelector('[data-result-score]')!.textContent).toBe(String(score));
  }
});
