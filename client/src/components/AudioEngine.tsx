import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../store/usePlayerStore';
import { getProxiedImageUrl } from '../utils/imageUrl';

export const AudioEngine = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const { 
    currentTrack, 
    isPlaying, 
    volume, 
    setCurrentTime, 
    setDuration,
    setIsPlaying,
    sleepTimerEnd,
    setSleepTimer,
    eqBands
  } = usePlayerStore(useShallow(state => ({
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    volume: state.volume,
    setCurrentTime: state.setCurrentTime,
    setDuration: state.setDuration,
    setIsPlaying: state.setIsPlaying,
    sleepTimerEnd: state.sleepTimerEnd,
    setSleepTimer: state.setSleepTimer,
    eqBands: state.eqBands
  })));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);

  // Initialize Web Audio API for EQ and unlock audio on first user gesture
  useEffect(() => {
    if (!audioRef.current) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const initAudioAndUnlock = async () => {
      // 1. Create Audio Context on user gesture to prevent browser warnings
      if (!audioCtxRef.current && !isIOS) {
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;

          // Note: This requires CORS headers on the audio source
          const source = ctx.createMediaElementSource(audioRef.current!);
          
          const freqs = [60, 230, 910, 3600, 14000];
          const filters = freqs.map((freq, i) => {
            const filter = ctx.createBiquadFilter();
            if (i === 0) filter.type = 'lowshelf';
            else if (i === freqs.length - 1) filter.type = 'highshelf';
            else filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.gain.value = 0;
            return filter;
          });
          filtersRef.current = filters;

          // Chain connections
          let currentConnection: AudioNode = source;
          filters.forEach(f => {
            currentConnection.connect(f);
            currentConnection = f;
          });
          currentConnection.connect(ctx.destination);
        } catch (e) {
          console.warn("Failed to init AudioContext", e);
        }
      }

      // 2. Resume if suspended
      if (audioCtxRef.current?.state === 'suspended') {
        try { await audioCtxRef.current.resume(); } catch (e) { console.warn(e); }
      }

      // 3. iOS/Safari Audio Unlocker using valid silent WAV base64
      if (audioRef.current && !audioRef.current.src) {
        try {
          const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
          audioRef.current.src = silentWav;
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              audioRef.current?.pause();
              audioRef.current?.removeAttribute('src');
              audioRef.current?.load();
            }).catch(e => {
              console.warn('Silent audio play failed:', e);
            });
          }
        } catch (err) {
          console.warn('Failed to unlock audio', err);
        }
      }

      document.removeEventListener('touchstart', initAudioAndUnlock);
      document.removeEventListener('click', initAudioAndUnlock);
    };

    document.addEventListener('touchstart', initAudioAndUnlock, { passive: true });
    document.addEventListener('click', initAudioAndUnlock, { passive: true });

    return () => {
      document.removeEventListener('touchstart', initAudioAndUnlock);
      document.removeEventListener('click', initAudioAndUnlock);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.warn);
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Sync EQ values
  useEffect(() => {
    filtersRef.current.forEach((filter, index) => {
      // Ensure smooth transition or just set value
      filter.gain.value = eqBands[index];
    });
  }, [eqBands]);

  // Handle URL change
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      let src = currentTrack.url;
      // Check if src already ends with the path to avoid reloading
      if (!audioRef.current.src.endsWith(currentTrack.url)) {
        audioRef.current.src = src;
        audioRef.current.load();
      } else {
        // Track is the same, but currentTrack object changed (e.g. user clicked Play again)
        // Reset time to start from beginning
        audioRef.current.currentTime = 0;
      }
    } else if (audioRef.current && !currentTrack) {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [currentTrack]);

  // Handle Play/Pause
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Audio playback failed", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentTrack, isPlaying, setIsPlaying]);

  // MediaSession API (Для заблокированного экрана iOS/Android)
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || 'Trinity',
        artwork: currentTrack.coverArt ? [
          { src: getProxiedImageUrl(currentTrack.coverArt)!, sizes: '512x512', type: 'image/jpeg' },
          { src: getProxiedImageUrl(currentTrack.coverArt)!, sizes: '256x256', type: 'image/jpeg' }
        ] : []
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        window.dispatchEvent(new CustomEvent('player:nextTrack', { detail: 1 }));
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        window.dispatchEvent(new CustomEvent('player:nextTrack', { detail: -1 }));
      });
      
      return () => {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      };
    }
  }, [currentTrack, setIsPlaying]);

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Global event listener for seeking can be added here later
  useEffect(() => {
    const handleSeek = (e: CustomEvent<number>) => {
      if (audioRef.current) {
        audioRef.current.currentTime = e.detail;
      }
    };
    window.addEventListener('player:seek', handleSeek as EventListener);
    return () => window.removeEventListener('player:seek', handleSeek as EventListener);
  }, []);

  // Sleep Timer logic
  useEffect(() => {
    if (!sleepTimerEnd) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerEnd) {
        setIsPlaying(false);
        setSleepTimer(null); // Reset timer
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEnd, setIsPlaying, setSleepTimer]);

  return (
    <audio 
      ref={audioRef}
      crossOrigin="anonymous"
      playsInline={true}
      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      onEnded={() => window.dispatchEvent(new CustomEvent('player:nextTrack'))}
    />
  );
};
