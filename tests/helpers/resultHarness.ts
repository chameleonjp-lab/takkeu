import { createScreens } from '../../src/ui/screens';
import { scenario } from './scenarios';
import '../../src/ui/styles.css';
const noop = () => {};
const screens = createScreens(document.querySelector<HTMLElement>('#app')!, { start: noop, pause: noop, resume: noop, retry: hide, home: hide, toggleSound: noop, volume: noop });
const snapshot = scenario(0).snapshot();
function hide() { screens.render({ ...snapshot, phase: 'ready' }); }
function show(score: number) {
  screens.setAudioReady(true); screens.setStorageAvailable(true); screens.setLeaderboard('loaded');
  screens.render({ ...snapshot, score, phase: 'gameover' });
}
const resultHarness = { show, hide, dispose: () => screens.dispose() };
declare global { interface Window { resultHarness: typeof resultHarness } }
window.resultHarness = resultHarness;
