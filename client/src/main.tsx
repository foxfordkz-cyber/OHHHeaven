import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './ui/tokens.css';
import { App } from './app/App';
// Liquid Glass comes last so it wins over ui.css and the screens' own styles (build/DESIGN.md).
import './ui/glass.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
