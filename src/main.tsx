import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/700.css';
import '@/i18n';
import '@/index.css';
import { App } from '@/App';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) {
      reloading = true;
      window.location.reload();
    }
  });

  const checkForSwUpdate = () => {
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}));
  };

  window.addEventListener('load', checkForSwUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForSwUpdate();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
