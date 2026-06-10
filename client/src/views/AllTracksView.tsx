import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader, Download, Play, Plus, Trash, DownloadCloud, CheckCircle } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Track, DownloadItem } from '../store/usePlayerStore';
import { apiFetch } from '../apiClient';
import { getProxiedImageUrl } from '../utils/imageUrl';
import type { Variants } from 'framer-motion';

interface Props {
  itemVariants: Variants;
  containerVariants: Variants;
}

export const AllTracksView: React.FC<Props> = ({ itemVariants, containerVariants }) => {
  const { 
    library, setLibrary, user, addToLibrary, playTrack, playlists, setTrackToAdd,
    isExtracting, setIsExtracting, downloadQueue, setDownloadQueue
  } = usePlayerStore();
  const [downloadUrl, setDownloadUrl] = useState('');

  const [cachedTracks, setCachedTracks] = useState<Set<string>>(new Set());
  const [cachingTracks, setCachingTracks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkCache = async () => {
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open('audio-cache');
        const keys = await cache.keys();
        const cachedUrls = new Set(keys.map(req => new URL(req.url).pathname));
        
        const cachedIds = new Set<string>();
        library.forEach(track => {
          const trackUrl = track.url.startsWith('/') ? track.url : `/audio/${track.url}`;
          if (cachedUrls.has(trackUrl)) {
            cachedIds.add(track.id);
          }
        });
        setCachedTracks(cachedIds);
      } catch (err) {
        console.warn('Error checking cache:', err);
      }
    };
    checkCache();
  }, [library]);

  const isProcessing = isExtracting || downloadQueue.some(i => i.status === 'pending' || i.status === 'downloading');

  useEffect(() => {
    if (!isProcessing && downloadQueue.length > 0) {
      const timer = setTimeout(() => {
        setDownloadQueue([]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, downloadQueue.length]);

  const processQueue = async (items: DownloadItem[]) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'saved') continue;
      setDownloadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'downloading' } : it));
      
      try {
        const res = await apiFetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url })
        });
        const data = await res.json();
        if (data.success && data.track) {
          const user = usePlayerStore.getState().user;
          if (user) {
            await apiFetch(`/api/library/${user.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ track: data.track })
            }).catch(console.error);
          }
          usePlayerStore.getState().addToLibrary(data.track);
          // Auto-play if it's a single track
          if (items.length === 1) usePlayerStore.getState().playTrack(data.track);
          
          setDownloadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'saved' } : it));
        } else {
          setDownloadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', errorMsg: data.error } : it));
        }
      } catch (err: any) {
        setDownloadQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', errorMsg: 'Network error' } : it));
      }
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;
    setIsExtracting(true);
    setDownloadQueue([]); // clear previous queue
    try {
      const res = await apiFetch('/api/extract-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: downloadUrl })
      });
      const data = await res.json();
      if (!data.success) {
        alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        return;
      }
      
      let items: DownloadItem[] = [];
      const currentLibrary = usePlayerStore.getState().library;
      
      if (data.isPlaylist) {
        items = data.entries.map((e: any) => ({
          id: e.id,
          title: e.title,
          url: e.url,
          status: currentLibrary.some(t => t.id === e.id) ? 'saved' : 'pending'
        }));
      } else {
        items = [{
          id: data.track.id,
          title: data.track.title,
          url: data.track.url,
          status: currentLibrary.some(t => t.id === data.track.id) ? 'saved' : 'pending'
        }];
      }
      
      setDownloadUrl('');
      setDownloadQueue(items);
      processQueue(items);
    } catch {
      alert('Ошибка соединения с сервером');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDeleteTrack = async (track: Track) => {
    if (!user) return;
    if (!confirm('Точно удалить этот трек?')) return;
    try {
      await apiFetch(`/api/library/${user.id}/${track.id}`, { method: 'DELETE' });
      setLibrary(library.filter((t: Track) => t.id !== track.id));
    } catch (e) {
      console.error(e);
      alert('Ошибка при удалении');
    }
  };

  const handleMakeOffline = async (track: Track) => {
    if (cachedTracks.has(track.id)) return;
    try {
      setCachingTracks(prev => new Set(prev).add(track.id));
      const url = track.url.startsWith('/') ? track.url : `/audio/${track.url}`;
      if ('caches' in window) {
        // Write directly to Cache API — works even if SW isn't intercepting
        const cache = await caches.open('audio-cache');
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok) {
          await cache.put(url, res.clone());
        } else {
          throw new Error(`Bad response status: ${res.status}`);
        }
      } else {
        // Fallback: fetch and hope SW intercepts
        await fetch(url);
      }
      setCachedTracks(prev => new Set(prev).add(track.id));
    } catch (e) {
      console.error(e);
      alert('Не удалось закэшировать трек');
    } finally {
      setCachingTracks(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  const handlePlayWithQueue = (track: Track) => {
    usePlayerStore.getState().setPlayQueue(library);
    playTrack(track);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 32, margin: 0 }}>Все треки</h2>
        
        <div className="desktop-add-track" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Paste YouTube, SoundCloud link..." 
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            disabled={isProcessing}
            style={{ 
              padding: '10px 16px', borderRadius: 20, border: 'none', width: 300,
              backgroundColor: 'var(--color-surface-elevated)', color: 'white', outline: 'none',
              opacity: isProcessing ? 0.5 : 1
            }}
          />
          <button 
            onClick={handleDownload}
            disabled={isProcessing || !downloadUrl}
            style={{ 
              padding: '10px 20px', borderRadius: 20, backgroundColor: 'var(--color-accent)', 
              color: 'black', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              opacity: (isProcessing || !downloadUrl) ? 0.5 : 1
            }}
          >
            {isExtracting ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
            {isExtracting ? 'Поиск...' : 'Добавить'}
          </button>
        </div>
      </header>

      {/* Mobile Add Track */}
      <div className="mobile-add-track" style={{ marginBottom: 24, gap: 8, width: '100%', flexDirection: 'column', display: 'none' }}>
        <input 
          type="text" 
          placeholder="Paste YouTube, SoundCloud link..." 
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
          disabled={isProcessing}
          style={{ 
            padding: '12px 16px', borderRadius: 12, border: 'none', width: '100%', boxSizing: 'border-box',
            backgroundColor: 'var(--color-surface-elevated)', color: 'white', outline: 'none',
            opacity: isProcessing ? 0.5 : 1
          }}
        />
        <button 
          onClick={handleDownload}
          disabled={isProcessing || !downloadUrl}
          style={{ 
            padding: '12px 20px', borderRadius: 12, backgroundColor: 'var(--color-accent)', 
            color: 'black', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: (isProcessing || !downloadUrl) ? 0.5 : 1, width: '100%', boxSizing: 'border-box'
          }}
        >
          {isExtracting ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
          {isExtracting ? 'Поиск...' : 'Добавить'}
        </button>
      </div>

      {/* Download Status Area */}
      {downloadQueue.length > 0 && (
        <div style={{ marginBottom: 32, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text-secondary)' }}>
              Статус загрузки ({downloadQueue.filter(i => i.status === 'saved').length} / {downloadQueue.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 8 }}>
            {downloadQueue.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, padding: '8px 12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                <span style={{ color: item.status === 'error' ? '#ff4444' : 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 16 }}>
                  {item.title}
                </span>
                <span style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }}>
                  {item.status === 'pending' && 'В очереди ⏳'}
                  {item.status === 'downloading' && <span style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>Загрузка... <Loader size={12} className="animate-spin" /></span>}
                  {item.status === 'saved' && <span style={{ color: '#00C851' }}>Сохранено</span>}
                  {item.status === 'error' && <span title={item.errorMsg}>Ошибка ❌</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <motion.div className="responsive-grid" variants={containerVariants} initial="hidden" animate="show">
        {library.map((track) => (
          <motion.div 
            key={track.id} 
            variants={itemVariants}
            className="card"
            style={{ backgroundColor: 'var(--color-surface-elevated)', padding: 16, borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.2s ease', position: 'relative' }}
          >
            <div 
              style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#333', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}
              onClick={() => handlePlayWithQueue(track)}
            >
              {track.coverArt ? (
                <img src={getProxiedImageUrl(track.coverArt)} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={32} color="var(--color-text-secondary)" />
                </div>
              )}
            </div>
            <h4 style={{ marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => handlePlayWithQueue(track)}>{track.title}</h4>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 8 }}>{track.artist}</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              {playlists.length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4 }} title="Добавить в плейлист">
                    <Plus size={20} />
                  </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleMakeOffline(track); }} style={{ background: 'transparent', border: 'none', color: cachedTracks.has(track.id) ? 'var(--color-accent)' : 'var(--color-text-secondary)', cursor: cachedTracks.has(track.id) ? 'default' : 'pointer', padding: 4, marginLeft: playlists.length === 0 ? 'auto' : 0 }} title={cachedTracks.has(track.id) ? "Сохранено" : "Сохранить для оффлайн"}>
                {cachingTracks.has(track.id) ? (
                  <Loader size={20} className="animate-spin" />
                ) : cachedTracks.has(track.id) ? (
                  <CheckCircle size={20} />
                ) : (
                  <DownloadCloud size={20} />
                )}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track); }} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 4, marginLeft: 'auto' }} title={"Удалить трек"}>
                <Trash size={20} />
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
