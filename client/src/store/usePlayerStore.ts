import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { createStore, get, set, del } from 'idb-keyval';

const customStore = createStore('trinity-player-db', 'trinity-store');

// Throttled IDB write — prevents spamming IndexedDB during playback
// (setCurrentTime fires ~4x/sec, each set() triggers persist → IDB write)
let _idbWriteTimer: ReturnType<typeof setTimeout> | null = null;
let _idbPending: { name: string; value: string } | null = null;

const _flushIdbWrite = async () => {
  if (!_idbPending) return;
  const { name, value } = _idbPending;
  _idbPending = null;
  try {
    await set(name, value, customStore);
  } catch (e) {
    console.warn('IDB setItem failed, falling back to localStorage:', e);
    localStorage.setItem(name, value);
  }
};

// Custom storage engine for Zustand using IndexedDB with fallback to localStorage
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return (await get(name, customStore)) || null;
    } catch (e) {
      console.warn('IDB getItem failed, falling back to localStorage:', e);
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // Coalesce rapid writes: flush at most once every 2 seconds
    _idbPending = { name, value };
    if (!_idbWriteTimer) {
      _idbWriteTimer = setTimeout(() => {
        _idbWriteTimer = null;
        _flushIdbWrite();
      }, 2000);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    // Cancel any pending write before removing
    if (_idbWriteTimer) {
      clearTimeout(_idbWriteTimer);
      _idbWriteTimer = null;
      _idbPending = null;
    }
    try {
      await del(name, customStore);
    } catch (e) {
      console.warn('IDB removeItem failed, falling back to localStorage:', e);
      localStorage.removeItem(name);
    }
  },
};

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  coverArt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  user_id: string;
  cover_url?: string;
  first_track_cover?: string;
  owner_code?: string;
  owner_nickname?: string;
  owner_avatar?: string;
  group_name?: string;
  is_shared?: boolean;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  owner_id?: string;
}

export interface GroupMember {
  id: string;
  code: string;
  nickname?: string;
  avatar_url?: string;
  role?: 'owner' | 'member';
}

export interface DownloadItem {
  id: string;
  title: string;
  url: string;
  status: 'pending' | 'downloading' | 'saved' | 'error';
  errorMsg?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  sleepTimerEnd: number | null;
  eqBands: number[]; // 5 bands: 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz (values -12 to 12)
  isEqOpen: boolean;
  library: Track[];
  playlists: Playlist[];
  groups: Group[];
  groupMembers: Record<string, GroupMember[]>;
  sharedPlaylists: Playlist[];
  user: { id: string; code: string; nickname?: string; avatar_url?: string } | null;
  playQueue: Track[];
  trackToAdd: Track | null;
  isExtracting: boolean;
  downloadQueue: DownloadItem[];
  
  // Actions
  playTrack: (track: Track) => void;
  playWithQueue: (track: Track, queue: Track[]) => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSleepTimer: (minutes: number | null) => void;
  setEqBand: (index: number, value: number) => void;
  setEqBands: (bands: number[]) => void;
  setIsEqOpen: (isOpen: boolean) => void;
  addToLibrary: (track: Track) => void;
  setLibrary: (tracks: Track[]) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  setGroups: (groups: Group[]) => void;
  setGroupMembers: (members: Record<string, GroupMember[]>) => void;
  setSharedPlaylists: (shared: Playlist[]) => void;
  setUser: (user: { id: string, code: string, nickname?: string, avatar_url?: string } | null) => void;
  setPlayQueue: (queue: Track[]) => void;
  setTrackToAdd: (track: Track | null) => void;
  setIsExtracting: (isExtracting: boolean) => void;
  setDownloadQueue: (queue: DownloadItem[] | ((prev: DownloadItem[]) => DownloadItem[])) => void;
}

const savedUser = localStorage.getItem('trinity_user');
const initialUser = savedUser ? JSON.parse(savedUser) : null;

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.5,
  currentTime: 0,
  duration: 0,
  sleepTimerEnd: null,
  eqBands: [0, 0, 0, 0, 0],
  isEqOpen: false,
  library: [],
  playlists: [],
  groups: [],
  groupMembers: {},
  sharedPlaylists: [],
  user: initialUser,
  playQueue: [],
  trackToAdd: null,
  isExtracting: false,
  downloadQueue: [],

  playTrack: (track) => set({ currentTrack: track, isPlaying: true, currentTime: 0 }),
  playWithQueue: (track, queue) => set({ currentTrack: track, isPlaying: true, currentTime: 0, playQueue: queue }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying && state.currentTrack !== null })),
  setVolume: (volume) => set({ volume }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSleepTimer: (minutes) => set({ 
    sleepTimerEnd: minutes ? Date.now() + minutes * 60000 : null 
  }),
  setEqBand: (index, value) => set((state) => {
    const newBands = [...state.eqBands];
    newBands[index] = value;
    return { eqBands: newBands };
  }),
  setEqBands: (bands) => set({ eqBands: bands }),
  setIsEqOpen: (isOpen) => set({ isEqOpen: isOpen }),
  addToLibrary: (track) => set((state) => {
    if (state.library.some(t => t.id === track.id)) return state;
    return { library: [...state.library, track] };
  }),
  setLibrary: (tracks) => set({ 
    library: tracks.filter((t, index, self) => index === self.findIndex(track => track.id === t.id)) 
  }),
  setPlaylists: (playlists) => set({ playlists }),
  setGroups: (groups) => set({ groups }),
  setGroupMembers: (groupMembers) => set({ groupMembers }),
  setSharedPlaylists: (sharedPlaylists) => set({ sharedPlaylists }),
  setUser: (user) => {
    if (user) localStorage.setItem('trinity_user', JSON.stringify(user));
    else localStorage.removeItem('trinity_user');
    set({ user });
  },
  setPlayQueue: (queue) => set({ playQueue: queue }),
  setTrackToAdd: (track) => set({ trackToAdd: track }),
  setIsExtracting: (isExtracting) => set({ isExtracting }),
  setDownloadQueue: (queue) => set((state) => ({
    downloadQueue: typeof queue === 'function' ? queue(state.downloadQueue) : queue
  })),
}),
  {
    name: 'trinity-player-storage',
    storage: createJSONStorage(() => idbStorage),
    partialize: (state) => ({
      library: state.library,
      playlists: state.playlists,
      groups: state.groups,
      groupMembers: state.groupMembers,
      sharedPlaylists: state.sharedPlaylists,
      // user is NOT persisted here — stored in localStorage for synchronous access
      volume: state.volume,
      eqBands: state.eqBands,
      currentTrack: state.currentTrack,
      playQueue: state.playQueue,
    }),
  }
));
