import React from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play, User } from 'lucide-react';
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

export const SharedPlaylistsView: React.FC<Props> = ({ itemVariants, containerVariants, openPlaylist }) => {
  const { sharedPlaylists, playWithQueue } = usePlayerStore();

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
        <h2 style={{ fontSize: 32, margin: 0 }}>Общие Плейлисты</h2>
      </header>

      <motion.div className="responsive-grid" variants={containerVariants} initial="hidden" animate="show">
        {sharedPlaylists.map((pl) => (
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
            {pl.owner_code && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={pl.owner_code}>
                  <span style={{ whiteSpace: 'nowrap' }}>Создал:</span>
                  {pl.owner_avatar ? (
                    <img src={getProxiedImageUrl(pl.owner_avatar)} alt="Avatar" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <User size={16} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.owner_nickname || pl.owner_code}</span>
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Группа: {pl.group_name}</span>
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
