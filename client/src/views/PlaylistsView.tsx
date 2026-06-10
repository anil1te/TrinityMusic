import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Playlist } from '../store/usePlayerStore';
import { apiFetch } from '../apiClient';
import { getProxiedImageUrl } from '../utils/imageUrl';
import type { Variants } from 'framer-motion';

interface Props {
  itemVariants: Variants;
  containerVariants: Variants;
  openPlaylist: (pl: Playlist) => void;
}

export const PlaylistsView: React.FC<Props> = ({ itemVariants, containerVariants, openPlaylist }) => {
  const { playlists, setPlaylists, user, playWithQueue } = usePlayerStore();
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName) return;
    try {
      const res = await apiFetch('/api/playlists', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId: user?.id, name: newPlaylistName })
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists([...playlists, data.playlist]);
        setNewPlaylistName('');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка при создании плейлиста');
    }
  };

  const handlePlayPlaylist = async (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/playlists/${pl.id}/tracks`);
      const data = await res.json();
      if (data.success && data.tracks.length > 0) {
        playWithQueue(data.tracks[0], data.tracks);
      } else {
        alert("Плейлист пуст!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 32, margin: 0 }}>Мои Плейлисты</h2>
      </header>

      <div style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
        <input 
          type="text" 
          placeholder="Новый плейлист..." 
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--color-surface-elevated)', color: 'white' }}
        />
        <button onClick={handleCreatePlaylist} style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: 'var(--color-surface-hover)' }}>
          Создать
        </button>
      </div>

      <motion.div className="responsive-grid" variants={containerVariants} initial="hidden" animate="show">
        {playlists.map((pl) => (
          <motion.div 
            key={pl.id} 
            variants={itemVariants}
            className="card"
            style={{ backgroundColor: 'var(--color-surface-elevated)', padding: 16, borderRadius: 8 }}
          >
            <div 
              onClick={(e) => handlePlayPlaylist(e, pl)}
              title="Воспроизвести плейлист"
              style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#333', borderRadius: 4, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
            >
              {pl.cover_url || pl.first_track_cover ? (
                <img src={getProxiedImageUrl(pl.cover_url || pl.first_track_cover)} alt={pl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ListMusic size={48} color="var(--color-text-secondary)" />
              )}
              {/* Play icon overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0'}>
                <Play size={48} fill="white" />
              </div>
            </div>
            <h4 
              onClick={() => openPlaylist(pl)}
              title="Открыть плейлист"
              style={{ marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}
            >
              {pl.name}
            </h4>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
