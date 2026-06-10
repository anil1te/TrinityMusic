import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListMusic, Play, Plus, Trash, Eye, EyeOff, X, Minus } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Track } from '../store/usePlayerStore';
import { apiFetch } from '../apiClient';
import { getProxiedImageUrl } from '../utils/imageUrl';
import type { Variants } from 'framer-motion';

interface Props {
  itemVariants: Variants;
  containerVariants: Variants;
}

export const PlaylistDetailsView: React.FC<Props> = ({ itemVariants, containerVariants }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playlists, setPlaylists, sharedPlaylists, user, playWithQueue, setTrackToAdd } = usePlayerStore();
  
  const playlist = playlists.find(p => p.id === id) || sharedPlaylists.find(p => p.id === id);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isHoveringCover, setIsHoveringCover] = useState(false);

  useEffect(() => {
    if (!id || !playlist) return;
    const fetchTracks = async (playlistId: string) => {
      try {
        const res = await apiFetch(`/api/playlists/${playlistId}/tracks`);
        const data = await res.json();
        if (data.success) {
          setTracks(data.tracks);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTracks(playlist.id);
  }, [id, playlist?.id]);

  const handleDeleteTrack = async (track: Track) => {
    if (!playlist) return;
    if (!confirm('Точно удалить этот трек из плейлиста?')) return;
    try {
      await apiFetch(`/api/playlists/${playlist.id}/tracks/${track.id}`, { method: 'DELETE' });
      setTracks(tracks.filter(t => t.id !== track.id));
    } catch (e) {
      console.error(e);
      alert('Ошибка при удалении');
    }
  };

  const handleRenamePlaylist = async () => {
    if (!playlist) return;
    setIsEditing(false);
    if (!editName || editName === playlist.name) return;
    try {
      await apiFetch(`/api/playlists/${playlist.id}`, {
        method: 'PATCH', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name: editName })
      });
      setPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, name: editName } : p));
    } catch (e) {
      console.error(e);
      alert('Ошибка при переименовании');
    }
  };

  const handleToggleShared = async () => {
    if (!playlist) return;
    const currentShared = playlist.is_shared === undefined ? true : Boolean(playlist.is_shared);
    const newVal = !currentShared;
    try {
      await apiFetch(`/api/playlists/${playlist.id}`, {
        method: 'PATCH', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ is_shared: newVal })
      });
      setPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, is_shared: newVal } : p));
    } catch (e) {
      console.error(e);
      alert('Ошибка изменения доступа');
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    if (!confirm('Вы уверены, что хотите удалить этот плейлист?')) return;
    try {
      await apiFetch(`/api/playlists/${playlist.id}`, { method: 'DELETE' });
      setPlaylists(playlists.filter(p => p.id !== playlist.id));
      navigate('/playlists');
    } catch (e) {
      console.error(e);
      alert('Ошибка при удалении');
    }
  };

  const handlePlaylistCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playlist) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('cover', file);
    formData.append('playlistId', playlist.id);

    try {
      const res = await apiFetch('/api/upload/playlist-cover', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, cover_url: data.url } : p));
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при загрузке обложки');
    }
  };

  const handleResetPlaylistCover = async () => {
    if (!playlist) return;
    if (!confirm('Удалить обложку?')) return;
    try {
      const res = await apiFetch(`/api/playlists/${playlist.id}/reset-cover`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPlaylists(playlists.map(p => p.id === playlist.id ? { ...p, cover_url: undefined } : p));
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при сбросе обложки');
    }
  };

  if (!playlist) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
          <div 
            style={{ width: 120, height: 120, backgroundColor: '#333', borderRadius: 8, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={() => setIsHoveringCover(true)}
            onMouseLeave={() => setIsHoveringCover(false)}
          >
            {playlist.cover_url || playlist.first_track_cover ? (
              <img src={getProxiedImageUrl(playlist.cover_url || playlist.first_track_cover)} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <ListMusic size={64} color="var(--color-text-secondary)" />
            )}
            {/* Overlay */}
            {playlist.user_id === user?.id && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 2, opacity: isHoveringCover ? 1 : 0, pointerEvents: isHoveringCover ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                <label style={{ cursor: 'pointer', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={16} /> Изменить
                  <input type="file" accept="image/png, image/jpeg, image/gif" style={{ display: 'none' }} onChange={handlePlaylistCoverUpload} />
                </label>
                {playlist.cover_url && (
                  <button onClick={handleResetPlaylistCover} style={{ background: 'transparent', border: 'none', color: '#ff4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <X size={16} /> Сбросить
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  onBlur={handleRenamePlaylist}
                  onKeyDown={e => e.key === 'Enter' && handleRenamePlaylist()}
                  autoFocus
                  style={{ fontSize: 32, fontWeight: 'bold', background: 'transparent', border: 'none', borderBottom: '2px solid white', color: 'white', outline: 'none', width: '100%', maxWidth: 400 }} 
                />
              ) : (
                <h2 
                  style={{ fontSize: 32, cursor: playlist.user_id === user?.id ? 'pointer' : 'default', margin: 0 }}
                  onClick={() => {
                    if (playlist.user_id === user?.id) {
                      setIsEditing(true);
                      setEditName(playlist.name);
                    }
                  }}
                  title={playlist.user_id === user?.id ? "Нажмите, чтобы переименовать" : ""}
                >
                  {playlist.name}
                </h2>
              )}
              {playlist.user_id === user?.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button onClick={handleToggleShared} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }} title={(playlist.is_shared === undefined ? true : Boolean(playlist.is_shared)) ? "Скрыть от группы" : "Показать группе"}>
                    {(playlist.is_shared === undefined ? true : Boolean(playlist.is_shared)) ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                  <button onClick={handleDeletePlaylist} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4444', padding: 4 }} title="Удалить плейлист">
                    <Trash size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <motion.div className="responsive-grid" variants={containerVariants} initial="hidden" animate="show">
        {tracks.map((track) => (
          <motion.div 
            key={track.id} 
            variants={itemVariants}
            className="card"
            style={{ backgroundColor: 'var(--color-surface-elevated)', padding: 16, borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.2s ease', position: 'relative' }}
          >
            <div 
              style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#333', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}
              onClick={() => playWithQueue(track, tracks)}
            >
              {track.coverArt ? (
                <img src={getProxiedImageUrl(track.coverArt)} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={32} color="var(--color-text-secondary)" />
                </div>
              )}
            </div>
            <h4 style={{ marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => playWithQueue(track, tracks)}>{track.title}</h4>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 8 }}>{track.artist}</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              {playlists.length > 0 && playlist.user_id !== user?.id && (
                  <button onClick={(e) => { e.stopPropagation(); setTrackToAdd(track); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4 }} title="Добавить в плейлист">
                    <Plus size={20} />
                  </button>
              )}
              {playlist.user_id === user?.id && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track); }} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 4, marginLeft: 'auto' }} title={"Удалить из плейлиста"}>
                    <Minus size={20} />
                  </button>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
