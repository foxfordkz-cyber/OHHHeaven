import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './ui/tokens.css';
import { App } from './app/App';
// The visual layer (both themes) comes last so it wins over ui.css and the screens' own styles (build/DESIGN.md).
import './ui/glass.css';
import { initTheme } from './ui/theme';
import { initLang } from './ui/i18n';

initTheme();
initLang();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
