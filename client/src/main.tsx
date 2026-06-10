import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

const APP_VERSION = '1.0.3'; // Меняй это значение при критических обновлениях (схемы БД и т.д.)
const currentVersion = localStorage.getItem('trinity_app_version');

if (currentVersion !== APP_VERSION) {
  console.log('Версия приложения обновилась. Очистка кэша и локальных данных...');
  
  // Сохраняем данные пользователя
  const savedUser = localStorage.getItem('trinity_user');
  const savedToken = localStorage.getItem('token');
  
  localStorage.clear();
  
  // Восстанавливаем данные пользователя, чтобы не выбивало из аккаунта
  if (savedUser) {
    localStorage.setItem('trinity_user', savedUser);
  }
  if (savedToken) {
    localStorage.setItem('token', savedToken);
  }
  
  localStorage.setItem('trinity_app_version', APP_VERSION);
  
  // Очищаем кэш Service Worker'а и IndexedDB
  const performCleanup = async () => {
    if ('caches' in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      } catch (e) {
        console.error('Error clearing caches:', e);
      }
    }
    try {
      const { clear, createStore: createIdbStore } = await import('idb-keyval');
      const store = createIdbStore('trinity-player-db', 'trinity-store');
      await clear(store);
    } catch (e) {
      console.error('Error clearing idb:', e);
    }
    window.location.reload();
  };
  
  performCleanup();
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
