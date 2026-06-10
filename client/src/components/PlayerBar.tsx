import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../store/usePlayerStore';
import { SkipBack, SkipForward, Play, Pause, FileText, SlidersHorizontal, Timer, Volume2 } from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import { getProxiedImageUrl } from '../utils/imageUrl';
import { ScrollingText } from './ScrollingText';

interface PlayerBarProps {
  handleSkip: (direction: -1 | 1) => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cycleSleepTimer: () => void;
  remainingSleepMinutes: number | null;
  setIsFullScreenPlayer: (val: boolean) => void;
  isLyricsOpen: boolean;
  setIsLyricsOpen: (val: boolean) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  handleSkip,
  handleSeek,
  cycleSleepTimer,
  remainingSleepMinutes,
  setIsFullScreenPlayer,
  isLyricsOpen,
  setIsLyricsOpen
}) => {
  const { 
    currentTrack, isPlaying, togglePlay, volume, setVolume, 
    currentTime, duration, 
    isEqOpen, setIsEqOpen, sleepTimerEnd
  } = usePlayerStore(useShallow(state => ({
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    togglePlay: state.togglePlay,
    volume: state.volume,
    setVolume: state.setVolume,
    currentTime: state.currentTime,
    duration: state.duration,
    isEqOpen: state.isEqOpen,
    setIsEqOpen: state.setIsEqOpen,
    sleepTimerEnd: state.sleepTimerEnd
  })));

  return (
    <footer className="player-bar">
      {/* Информация о текущем треке */}
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: 16, width: '30%', cursor: currentTrack ? 'pointer' : 'default' }}
        onClick={() => currentTrack && setIsFullScreenPlayer(true)}
      >
        <div style={{ width: 56, height: 56, minWidth: 56, minHeight: 56, flexShrink: 0, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' }}>
          {currentTrack?.coverArt && (
            <img src={getProxiedImageUrl(currentTrack.coverArt)} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <ScrollingText 
            text={currentTrack ? currentTrack.title : 'No track playing'} 
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }} 
          />
          <ScrollingText 
            text={currentTrack ? currentTrack.artist : '-'} 
            style={{ fontSize: 12, color: 'var(--color-text-secondary)' }} 
          />
        </div>
      </div>

      {/* Элементы управления */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleSkip(-1)}>
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button 
            onClick={togglePlay}
            style={{ 
              width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--color-text-primary)', 
              color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: currentTrack ? 1 : 0.5, cursor: currentTrack ? 'pointer' : 'default', border: 'none'
            }}
            disabled={!currentTrack}
          >
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleSkip(1)}>
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
        {/* Прогресс-бар */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 500 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 35, textAlign: 'right' }}>
            {formatTime(currentTime)}
          </span>
          <input 
            type="range" 
            min={0} 
            max={duration || 100} 
            value={currentTime} 
            onChange={handleSeek}
            style={{ flex: 1, height: 4, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
            disabled={!currentTrack}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 35 }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Экстра элементы (Текст, Таймер, EQ, Громкость) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '30%', gap: 16 }}>
        
        <button 
          onClick={() => setIsLyricsOpen(!isLyricsOpen)}
          style={{ color: isLyricsOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          title="Текст песни"
          disabled={!currentTrack}
        >
          <FileText size={18} />
        </button>

        <button 
          onClick={() => setIsEqOpen(!isEqOpen)}
          style={{ color: isEqOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          title="Эквалайзер"
        >
          <SlidersHorizontal size={18} />
        </button>

        <button 
          onClick={cycleSleepTimer}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 4,
            color: sleepTimerEnd ? 'var(--color-accent)' : 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer'
          }}
          title="Таймер сна"
        >
          <Timer size={18} />
          {sleepTimerEnd && <span style={{ fontSize: 12 }}>{remainingSleepMinutes}m</span>}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Volume2 size={20} color="var(--color-text-secondary)" />
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.01} 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: 100, height: 4, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
          />
        </div>
      </div>
    </footer>
  );
};
