import { createApp } from './app/createApp';
import './ui/styles.css';

const app = createApp(document.querySelector<HTMLDivElement>('#app')!);
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
