import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for offline app shell and push notifications
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Auto-check for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New content is available
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[Lumenfield PWA] SW registration notice:', err.message);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
