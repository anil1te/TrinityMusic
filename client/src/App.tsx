import { apiFetch } from "./apiClient";
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Loader, X, ChevronDown, ListMusic, FileText, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore, type GroupMember } from './store/usePlayerStore';
import { AudioEngine } from './components/AudioEngine';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { formatTime } from './utils/formatTime';
import { getProxiedImageUrl } from './utils/imageUrl';
import { ScrollingText } from './components/ScrollingText';
import { GroupsView } from './views/GroupsView';
import { AllTracksView } from './views/AllTracksView';
import { PlaylistsView } from './views/PlaylistsView';
import { SharedPlaylistsView } from './views/SharedPlaylistsView';
import { PlaylistDetailsView } from './views/PlaylistDetailsView';
import './App.css';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};



function App() {
  const { 
    currentTrack, 
    isPlaying, 
    duration,
    sleepTimerEnd,
    eqBands,
    isEqOpen,
    user,
    togglePlay,
    setSleepTimer,
    setEqBand,
    setIsEqOpen,
    setLibrary,
    playlists, 
    setPlaylists,
    setGroups,
    setSharedPlaylists,
    setGroupMembers,
    trackToAdd,
    setTrackToAdd
  } = usePlayerStore(useShallow(state => ({
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    duration: state.duration,
    sleepTimerEnd: state.sleepTimerEnd,
    eqBands: state.eqBands,
    isEqOpen: state.isEqOpen,
    user: state.user,
    togglePlay: state.togglePlay,
    setSleepTimer: state.setSleepTimer,
    setEqBand: state.setEqBand,
    setIsEqOpen: state.setIsEqOpen,
    setLibrary: state.setLibrary,
    playlists: state.playlists,
    setPlaylists: state.setPlaylists,
    setGroups: state.setGroups,
    setSharedPlaylists: state.setSharedPlaylists,
    setGroupMembers: state.setGroupMembers,
    trackToAdd: state.trackToAdd,
    setTrackToAdd: state.setTrackToAdd
  })));

  const [lyrics, setLyrics] = useState('');
  const [isLyricsSynced, setIsLyricsSynced] = useState(false);
  const [parsedLyrics, setParsedLyrics] = useState<{time: number, text: string}[]>([]);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [currentView, setCurrentView] = useState<'player' | 'auth'>('player');
  const [isFullScreenPlayer, setIsFullScreenPlayer] = useState(false);
  const navigate = useNavigate();

  // Fetch all data
  useEffect(() => {
    if (user) {
      Promise.all([
        apiFetch(`/api/library/${user.id}`).then(async r => { const t = await r.text(); try { return JSON.parse(t); } catch(e) { console.error('Library HTML:', t.substring(0,200)); throw e; } }),
        apiFetch(`/api/playlists/${user.id}`).then(async r => { const t = await r.text(); try { return JSON.parse(t); } catch(e) { console.error('Playlists HTML:', t.substring(0,200)); throw e; } }),
        apiFetch(`/api/groups/${user.id}`).then(async r => { const t = await r.text(); try { return JSON.parse(t); } catch(e) { console.error('Groups HTML:', t.substring(0,200)); throw e; } })
      ]).then(([libRes, plRes, grRes]) => {
        if (libRes.success) setLibrary(libRes.tracks);
        if (plRes.success) setPlaylists(plRes.playlists);
        if (grRes.success) {
          setGroups(grRes.groups);
          Promise.all(grRes.groups.map((g: any) => 
            apiFetch(`/api/groups/${g.id}/playlists`).then(async r => { const t = await r.text(); try { return JSON.parse(t); } catch(e) { console.error('GroupPlaylists HTML:', t.substring(0,200)); throw e; } })
          )).then(sharedRes => {
            const allShared = sharedRes.flatMap(r => r.playlists);
            setSharedPlaylists(allShared.filter(p => p.user_id !== user.id));
          });
          
          Promise.all(grRes.groups.map((g: any) => 
            apiFetch(`/api/groups/${g.id}/members`).then(async r => { const t = await r.text(); try { return JSON.parse(t); } catch(e) { throw e; } })
          )).then(membersRes => {
            const membersMap: Record<string, GroupMember[]> = {};
            grRes.groups.forEach((g: any, i: number) => {
              if (membersRes[i].success) membersMap[g.id] = membersRes[i].members;
            });
            setGroupMembers(membersMap);
          });
        }
      });
    } else {
      setLibrary([]); setPlaylists([]); setGroups([]); setSharedPlaylists([]);
    }
  }, [user?.id, setLibrary, setPlaylists, setGroups, setSharedPlaylists]);

  // Фетч текстов песен (Lyrics)
  useEffect(() => {
    let ignore = false;
    const abortController = new AbortController();

    if (currentTrack && isLyricsOpen) {
      setIsFetchingLyrics(true);
      setLyrics('');
      setIsLyricsSynced(false);
      setParsedLyrics([]);
      
      apiFetch(`/api/lyrics?artist=${encodeURIComponent(currentTrack.artist)}&title=${encodeURIComponent(currentTrack.title)}`, {
        signal: abortController.signal
      })
        .then(res => res.json())
        .then(data => {
          if (ignore) return;
          if (data.success && data.lyrics) {
            setLyrics(data.lyrics);
            setIsLyricsSynced(data.isSynced || false);
            if (data.isSynced) {
              const lines = data.lyrics.split('\n');
              const parsed = [];
              const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
              for (const line of lines) {
                const match = timeRegex.exec(line);
                if (match) {
                  const m = parseInt(match[1], 10);
                  const s = parseInt(match[2], 10);
                  const ms = parseInt(match[3], 10);
                  const time = m * 60 + s + (match[3].length === 2 ? ms / 100 : ms / 1000);
                  const text = line.replace(timeRegex, '').trim();
                  parsed.push({ time, text });
                }
              }
              setParsedLyrics(parsed);
            }
          }
          else setLyrics("Текст песни не найден :(");
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (!ignore) setLyrics("Текст песни не найден :(");
        })
        .finally(() => {
          if (!ignore) setIsFetchingLyrics(false);
        });
    }

    return () => {
      ignore = true;
      abortController.abort();
    };
  }, [currentTrack, isLyricsOpen]);

  // Handle next/prev track skipping
  useEffect(() => {
    const handleNextTrack = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      const direction = customEvent.detail || 1;
      const { playQueue, currentTrack, playTrack } = usePlayerStore.getState();
      if (playQueue.length === 0) return;
      
      const currentIndex = playQueue.findIndex(t => t.id === currentTrack?.id);
      if (currentIndex === -1) {
        playTrack(playQueue[0]);
        return;
      }
      
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = playQueue.length - 1;
      if (nextIndex >= playQueue.length) nextIndex = 0; // loop
      
      playTrack(playQueue[nextIndex]);
    };

    window.addEventListener('player:nextTrack', handleNextTrack);
    return () => window.removeEventListener('player:nextTrack', handleNextTrack);
  }, []);
  const isAuthView = currentView === 'auth' || !user;

  // Helper to calculate remaining sleep timer minutes
  const now = Date.now();
  const remainingSleepMinutes = sleepTimerEnd 
    ? Math.ceil((sleepTimerEnd - now) / 60000) 
    : null;

  const cycleSleepTimer = () => {
    // Cycle: null -> 15 -> 30 -> 45 -> 60 -> null
    if (!sleepTimerEnd) setSleepTimer(15);
    else if (remainingSleepMinutes && remainingSleepMinutes <= 15) setSleepTimer(30);
    else if (remainingSleepMinutes && remainingSleepMinutes <= 30) setSleepTimer(45);
    else if (remainingSleepMinutes && remainingSleepMinutes <= 45) setSleepTimer(60);
    else setSleepTimer(null);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    window.dispatchEvent(new CustomEvent('player:seek', { detail: Number(e.target.value) }));
  };

  const handleSkip = (direction: -1 | 1) => {
    window.dispatchEvent(new CustomEvent('player:nextTrack', { detail: direction }));
  };

  return (
    <>
      <AudioEngine />
      {isAuthView ? (
        <AuthScreen onClose={() => setCurrentView('player')} canClose={!!user} />
      ) : (
        <div className="app-container">
      
      <Sidebar setCurrentView={setCurrentView} />

      {/* Основной контент */}
      <main className="main-view">
            <Routes>
              <Route path="/" element={<AllTracksView itemVariants={itemVariants} containerVariants={containerVariants} />} />
              <Route path="/playlists" element={<PlaylistsView itemVariants={itemVariants} containerVariants={containerVariants} openPlaylist={(pl) => navigate(`/playlist/${pl.id}`)} />} />
              <Route path="/shared" element={<SharedPlaylistsView itemVariants={itemVariants} containerVariants={containerVariants} openPlaylist={(pl) => navigate(`/playlist/${pl.id}`)} />} />
              <Route path="/groups" element={<GroupsView />} />
              <Route path="/playlist/:id" element={<PlaylistDetailsView itemVariants={itemVariants} containerVariants={containerVariants} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

      </main>

      {/* Модалка Добавить в плейлист */}
      <AnimatePresence>
      {trackToAdd && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTrackToAdd(null)}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="card" style={{ backgroundColor: 'var(--color-surface-elevated)', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Добавить в плейлист</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {playlists.map(p => (
                <li key={p.id}>
                  <button 
                    onClick={async () => { 
                      try {
                        const res = await apiFetch(`/api/playlists/${p.id}/tracks`, {
                          method: 'POST', headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ track: trackToAdd })
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert('Добавлено в плейлист!');
                          usePlayerStore.getState().setPlaylists(playlists.map(pl => {
                            if (pl.id === p.id && !pl.first_track_cover && trackToAdd.coverArt) {
                              return { ...pl, first_track_cover: trackToAdd.coverArt };
                            }
                            return pl;
                          }));
                        }
                      } catch (e) {
                        console.error(e);
                      }
                      setTrackToAdd(null); 
                    }}
                    style={{ width: '100%', padding: '12px', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer' }}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setTrackToAdd(null)} style={{ marginTop: 16, width: '100%', padding: '12px', backgroundColor: 'transparent', border: '1px solid var(--color-divider)', color: 'white', borderRadius: 8, cursor: 'pointer' }}>
              Отмена
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Панель плеера (Футер) */}
      <PlayerBar 
        handleSkip={(d) => window.dispatchEvent(new CustomEvent('player:nextTrack', { detail: d }))} 
        handleSeek={handleSeek} 
        cycleSleepTimer={cycleSleepTimer} 
        remainingSleepMinutes={remainingSleepMinutes} 
        setIsFullScreenPlayer={setIsFullScreenPlayer} 
        isLyricsOpen={isLyricsOpen}
        setIsLyricsOpen={setIsLyricsOpen}
      />

      {/* Модалка эквалайзера */}
      <AnimatePresence>
        {!isFullScreenPlayer && isEqOpen && (
          <motion.div 
            className="eq-modal"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              padding: 24, borderRadius: 12, border: '1px solid var(--color-divider)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 2000
            }}
          >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Эквалайзер</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => usePlayerStore.getState().setEqBands([0, 0, 0, 0, 0])}
                style={{ background: 'var(--color-surface-hover)', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer' }}
              >
                Сброс
              </button>
              <button onClick={() => setIsEqOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={16} color="var(--color-text-secondary)"/>
              </button>
            </div>
          </div>
          
          {/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              Эквалайзер не поддерживается на устройствах iOS (ограничения системы).
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {Object.entries({
                  'Бас': [6, 4, 0, -2, -4],
                  'Акустика': [4, 2, 0, 2, 4],
                  'Электроника': [4, 0, -2, 2, 4],
                  'Вокал': [-2, -1, 4, 3, 0]
                }).map(([name, bands]) => (
                  <button
                    key={name}
                    onClick={() => usePlayerStore.getState().setEqBands(bands)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-divider)',
                      borderRadius: 16, padding: '4px 10px', fontSize: 11, color: 'var(--color-text-secondary)',
                      cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >
                    {name}
                  </button>
                ))}
              </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'].map((label, index) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <input 
                  type="range" 
                  min="-12" max="12" step="0.1" 
                  {...({ orient: 'vertical' } as any)}
                  value={eqBands[index]}
                  onChange={(e) => setEqBand(index, parseFloat(e.target.value))}
                  style={{
                    appearance: 'slider-vertical' as any,
                    WebkitAppearance: 'slider-vertical' as any,
                    width: 16,
                    height: 120,
                    accentColor: 'var(--color-accent)', 
                    cursor: 'pointer',
                    margin: 0
                  }}
                />
                <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
          </>
          )}
        </motion.div>
        )}
      </AnimatePresence>

      {/* Модалка Текстов песен (Lyrics) */}
      <AnimatePresence>
        {!isFullScreenPlayer && isLyricsOpen && (
          <motion.div 
            className="lyrics-modal" 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              padding: 24, borderRadius: 12, border: '1px solid var(--color-divider)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', flexDirection: 'column'
            }}
          >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
            <h3 style={{ fontSize: 16 }}>{currentTrack?.title} - Текст</h3>
            <button onClick={() => setIsLyricsOpen(false)}><X size={16} color="var(--color-text-secondary)"/></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {isFetchingLyrics ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader size={24} className="animate-spin" />
              </div>
            ) : isLyricsSynced && parsedLyrics.length > 0 ? (
              <SyncedLyrics parsedLyrics={parsedLyrics} />
            ) : (
              lyrics || "Выберите трек, чтобы увидеть текст"
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Полноэкранный плеер */}
      <AnimatePresence>
        {isFullScreenPlayer && currentTrack && (
          <motion.div 
            className="fullscreen-player"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
          <AnimatePresence>
            {currentTrack.coverArt && (
              <motion.div 
                key={currentTrack.id + '-bg'}
                className="fullscreen-bg" 
                style={{ backgroundImage: `url(${getProxiedImageUrl(currentTrack.coverArt)})` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            )}
          </AnimatePresence>
          <div className="fullscreen-blur-overlay" />
          <div className="fullscreen-player-header">
            <button onClick={() => setIsFullScreenPlayer(false)} style={{ color: 'white' }}>
              <ChevronDown size={32} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Сейчас играет
            </span>
            <div style={{ width: 32 }} /> {/* Spacer */}
          </div>
          
          <div className="fullscreen-player-cover">
            {isLyricsOpen ? (
              <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: 20, marginBottom: 16, textAlign: 'center', color: 'white', flexShrink: 0 }}>Текст песни</h3>
                <div className="fullscreen-lyrics-container">
                  {isFetchingLyrics ? <Loader size={32} className="animate-spin" style={{ margin: '0 auto' }} /> : 
                   isLyricsSynced && parsedLyrics.length > 0 ? (
                    <SyncedLyrics parsedLyrics={parsedLyrics} isFullscreen />
                  ) : (lyrics || "Текст не найден")}
                </div>
              </div>
            ) : isEqOpen ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ fontSize: 20, marginBottom: 24, color: 'white' }}>Эквалайзер</h3>
                {/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? (
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' }}>
                    Не поддерживается на iOS
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {Object.entries({
                        'Бас': [6, 4, 0, -2, -4],
                        'Акустика': [4, 2, 0, 2, 4],
                        'Электроника': [4, 0, -2, 2, 4],
                        'Вокал': [-2, -1, 4, 3, 0]
                      }).map(([name, bands]) => (
                        <button
                          key={name}
                          onClick={() => usePlayerStore.getState().setEqBands(bands)}
                          style={{
                            background: 'rgba(255,255,255,0.1)', border: 'none',
                            borderRadius: 16, padding: '6px 12px', fontSize: 12, color: 'white', cursor: 'pointer'
                          }}
                        >
                          {name}
                        </button>
                      ))}
                      <button
                        onClick={() => usePlayerStore.getState().setEqBands([0, 0, 0, 0, 0])}
                        style={{
                          background: 'rgba(255,255,255,0.2)', border: 'none',
                          borderRadius: 16, padding: '6px 12px', fontSize: 12, color: 'white', cursor: 'pointer'
                        }}
                      >
                        Сброс
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
                      {['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'].map((label, index) => (
                        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <input 
                            type="range" 
                            min="-12" max="12" step="0.1" 
                            {...({ orient: 'vertical' } as any)}
                            value={eqBands[index]}
                            onChange={(e) => setEqBand(index, parseFloat(e.target.value))}
                            style={{
                              appearance: 'slider-vertical' as any,
                              WebkitAppearance: 'slider-vertical' as any,
                              width: 24, height: 160, accentColor: 'var(--color-accent)', cursor: 'pointer', margin: 0
                            }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentTrack.id + '-cover'}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {currentTrack.coverArt ? (
                    <img src={getProxiedImageUrl(currentTrack.coverArt)} alt="Cover" />
                  ) : (
                    <div className="placeholder-cover"><ListMusic size={64} color="var(--color-text-secondary)" /></div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
          
          <div className="fullscreen-player-right">
            <div className="fullscreen-player-info">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentTrack.id + '-info'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <ScrollingText 
                    text={currentTrack.title} 
                    style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 4 }} 
                  />
                  <ScrollingText 
                    text={currentTrack.artist || '-'} 
                    style={{ fontSize: 18, color: 'var(--color-text-secondary)' }} 
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="fullscreen-player-controls">
              <FullscreenProgress handleSeek={handleSeek} duration={duration} />

              <div className="main-buttons">
                <button onClick={() => handleSkip(-1)}><SkipBack size={36} fill="currentColor" /></button>
                <button 
                  className="play-pause-btn"
                  onClick={togglePlay}
                >
                  {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                </button>
                <button onClick={() => handleSkip(1)}><SkipForward size={36} fill="currentColor" /></button>
              </div>
              
              <div className="extra-buttons">
                <button 
                  onClick={() => { setIsLyricsOpen(!isLyricsOpen); setIsEqOpen(false); }}
                  style={{ color: isLyricsOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
                  title="Текст песни"
                >
                  <FileText size={24} />
                </button>
                <button 
                  onClick={() => { setIsEqOpen(!isEqOpen); setIsLyricsOpen(false); }}
                  style={{ color: isEqOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
                  title="Эквалайзер"
                >
                  <SlidersHorizontal size={24} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
        </div>
      )}
    </>
  );
}

export default App;

const FullscreenProgress = ({ handleSeek, duration }: { handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void, duration: number }) => {
  const currentTime = usePlayerStore(s => s.currentTime);
  return (
    <div className="progress-bar-container">
      <input 
        type="range" 
        min={0} 
        max={duration || 100} 
        value={currentTime} 
        onChange={handleSeek}
        className="fullscreen-progress"
      />
      <div className="time-labels">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

const SyncedLyrics = ({ parsedLyrics, isFullscreen }: { parsedLyrics: {time: number, text: string}[], isFullscreen?: boolean }) => {
  const currentTime = usePlayerStore(s => s.currentTime);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (parsedLyrics.length > 0) {
      const adjustedTime = currentTime + 0.4;
      const index = parsedLyrics.findIndex((lyric, i) => {
        const next = parsedLyrics[i + 1];
        return adjustedTime >= lyric.time && (!next || adjustedTime < next.time);
      });
      setCurrentLyricIndex(index);
      
      if (index !== -1 && lyricsScrollRef.current) {
        const container = lyricsScrollRef.current;
        const activeLine = container.children[index + 1] as HTMLElement;
        if (activeLine) {
          const containerHalfHeight = container.clientHeight / 2;
          const lineOffset = activeLine.offsetTop;
          const lineHalfHeight = activeLine.clientHeight / 2;
          container.scrollTo({
            top: lineOffset - containerHalfHeight + lineHalfHeight,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentTime, parsedLyrics]);

  return (
    <div ref={lyricsScrollRef} className={`synced-lyrics-container ${isFullscreen ? 'fullscreen-sync' : ''}`}>
      <div className={isFullscreen ? 'lyrics-padding-top-fs' : 'lyrics-padding-top'} />
      {parsedLyrics.map((lyric, idx) => (
        <div 
          key={idx} 
          className={`synced-lyric-line ${idx === currentLyricIndex ? 'active' : ''}`}
          onClick={() => {
            const audio = document.querySelector('audio');
            if (audio) audio.currentTime = lyric.time;
          }}
        >
          {lyric.text || '...'}
        </div>
      ))}
      <div className={isFullscreen ? 'lyrics-padding-bottom-fs' : 'lyrics-padding-bottom'} />
    </div>
  );
};
