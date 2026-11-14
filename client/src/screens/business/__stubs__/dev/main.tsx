// Standalone entry for `npm run dev` in this folder. The real app mounts DevBiz at /dev/biz.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DevBiz } from '../../DevBiz';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevBiz />
  </StrictMode>,
);
