import useAuthStore from './store/useAuthStore';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// URL Base64 to Uint8Array helper
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      
      const user = useAuthStore.getState().user;
      if (user.id) {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Get VAPID key
          const vapidRes = await fetch('/api/vapidPublicKey');
          const vapidData = await vapidRes.json();
          const convertedVapidKey = urlBase64ToUint8Array(vapidData.publicKey);
          
          // Subscribe to Push
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
          
          // Send to backend
          await fetch('/api/subscribe', {
            method: 'POST',
            body: JSON.stringify({ user_id: user.id, subscription }),
            headers: { 'Content-Type': 'application/json' }
          });
          console.log('Push notification subscribed!');
        }
      }
    } catch (error) {
      console.error('Service Worker Registration Failed:', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
