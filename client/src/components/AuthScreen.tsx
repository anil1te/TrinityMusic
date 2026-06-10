import React, { useState, useEffect } from 'react';
import { X, User, Plus, DownloadCloud, Info } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { apiFetch } from '../apiClient';

interface AuthScreenProps {
  onClose: () => void;
  canClose: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onClose, canClose }) => {
  const { user, setUser } = usePlayerStore();
  const [authInput, setAuthInput] = useState('');
  const [profileNickname, setProfileNickname] = useState(user?.nickname || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatar_url || '');
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(navigator.userAgent);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileNickname(user.nickname || '');
      setProfileAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleRegister = async () => {
    try {
      const res = await apiFetch('/api/auth/register', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('token', data.token);
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authInput })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('token', data.token);
        setAuthInput('');
        onClose();
      } else {
        alert('Неверный код доступа');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiFetch('/api/upload/avatar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setProfileAvatarUrl(data.url);
      } else {
        alert('Ошибка при загрузке: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при загрузке файла');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, nickname: profileNickname, avatarUrl: profileAvatarUrl })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (profileNickname === (user.nickname || '') && profileAvatarUrl === (user.avatar_url || '')) return;

    const timer = setTimeout(() => {
      handleSaveProfile();
    }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [profileNickname, profileAvatarUrl, user]);


  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header style={{ padding: '24px 40px', display: 'flex', alignItems: 'center' }}>
        {canClose && (
          <button 
            onClick={() => {
              if (user && (profileNickname !== (user.nickname || '') || profileAvatarUrl !== (user.avatar_url || ''))) {
                handleSaveProfile();
              }
              onClose();
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-secondary)', fontSize: 16, transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            <X size={24} /> Вернуться к плееру
          </button>
        )}
      </header>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', paddingBottom: '10vh' }}>
        <div style={{
          backgroundColor: 'var(--color-surface-elevated)', padding: '48px 40px', borderRadius: 16, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 24, border: '1px solid var(--color-divider)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', boxSizing: 'border-box'
        }}>
          <h2 style={{ fontSize: 32, textAlign: 'center', fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>Trinity Sync</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: -16 }}>Синхронизируй свою библиотеку</p>
          
          {/* PWA Install Notification */}
          {(isIOS || isAndroid) && (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Info size={20} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {isAndroid ? 'Установите приложение для работы в оффлайне и быстрого доступа.' : 'Для работы в оффлайне добавьте приложение на экран "Домой" (Нажмите "Поделиться" -> "На экран Домой").'}
                </p>
              </div>
              {isAndroid && deferredPrompt && (
                <button 
                  onClick={handleInstallClick}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', backgroundColor: 'var(--color-accent)', color: 'black', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }}
                >
                  <DownloadCloud size={20} /> Установить приложение
                </button>
              )}
            </div>
          )}
          
          {user ? (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 32, textAlign: 'left', alignItems: 'center' }}>
                <div 
                  style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: '2px solid var(--color-surface-hover)' }}
                  onMouseEnter={() => setIsHoveringAvatar(true)}
                  onMouseLeave={() => setIsHoveringAvatar(false)}
                >
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={32} />
                    </div>
                  )}
                  
                  <label style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isHoveringAvatar ? 1 : 0, transition: 'opacity 0.2s', cursor: 'pointer', color: 'white' }} title="Изменить аватарку">
                    <Plus size={24} />
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleAvatarUpload} 
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-secondary)', fontSize: 12 }}>Никнейм</label>
                  <input 
                    type="text" 
                    value={profileNickname} 
                    onChange={e => setProfileNickname(e.target.value)} 
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', boxSizing: 'border-box', fontSize: 16 }}
                    placeholder="Введите никнейм"
                  />
                </div>
              </div>
              
              <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Твой уникальный код для доступа к библиотеке:</p>
              <div 
                onClick={() => {
                  navigator.clipboard.writeText(user.code);
                  alert('Код скопирован!');
                }}
                title="Нажмите, чтобы скопировать"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 12, margin: '16px 0', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              >
                <h2 style={{ fontSize: 40, letterSpacing: 6, color: 'var(--color-accent)', margin: 0 }}>{user.code}</h2>
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>Сохрани его, чтобы войти с другого устройства.</p>
              <button 
                onClick={() => { setUser(null); localStorage.removeItem('token'); }}
                style={{ padding: '12px 32px', borderRadius: 24, backgroundColor: 'var(--color-surface-hover)', marginTop: 32, fontWeight: 600, fontSize: 16, cursor: 'pointer', color: 'white', border: 'none' }}
              >Выйти из аккаунта</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <button 
                onClick={handleRegister}
                style={{ padding: '16px', borderRadius: 12, backgroundColor: 'var(--color-accent)', color: 'black', fontWeight: 600, fontSize: 16, transition: 'transform 0.1s', boxSizing: 'border-box', width: '100%', border: 'none', cursor: 'pointer' }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >Создать новый профиль</button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0' }}>
                <div style={{ height: 1, flex: 1, backgroundColor: 'var(--color-divider)' }} />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>или войти по коду</span>
                <div style={{ height: 1, flex: 1, backgroundColor: 'var(--color-divider)' }} />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <input 
                  type="text" 
                  placeholder="S3Hf-B2dh" 
                  value={authInput}
                  onChange={(e) => setAuthInput(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '16px', borderRadius: 12, border: '2px solid var(--color-divider)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', fontSize: 16, textAlign: 'center', letterSpacing: 2, boxSizing: 'border-box' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-divider)'}
                />
                <button 
                  onClick={handleLogin}
                  disabled={!authInput}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 32px', borderRadius: 12, backgroundColor: 'var(--color-surface-hover)', fontWeight: 600, fontSize: 16, opacity: authInput ? 1 : 0.5, cursor: authInput ? 'pointer' : 'default', border: 'none', color: 'white', boxSizing: 'border-box', flexShrink: 0 }}
                >Войти</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
