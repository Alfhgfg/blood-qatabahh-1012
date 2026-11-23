import {createRoot} from 'react-dom/client';
import './services/securityShield';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline PWA support & seamless update detection
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('APP_SW_UPDATE_AVAILABLE', { detail: { registration } }));
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('APP_SW_UPDATE_AVAILABLE', { detail: { registration } }));
            }
          });
        });
      })
      .catch((err) => {
        // In development or if SW is restricted, safely handle
        console.debug('ServiceWorker registration notice:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
