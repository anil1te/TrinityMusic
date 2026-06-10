const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const https = require('https');
const http = require('http');
const Genius = require("genius-lyrics");
const GeniusClient = new Genius.Client();

const app = express();
app.use(cors());
app.use(express.json());

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Serve static audio files so the frontend can play them
app.use('/audio', express.static(downloadsDir));

// Ensure uploads directory exists for avatars
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.'));
    }
  }
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'trinity_super_secret';

// =======================
// AUTHENTICATION API
// =======================
app.post('/api/auth/register', (req, res) => {
  try {
    const user = db.registerUser();
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ success: true, user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { code } = req.body;
  const user = db.getUserByCode(code);
  if (user) {
    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ success: true, user, token });
  } else {
    res.status(401).json({ error: 'Invalid code' });
  }
});

app.use('/api', (req, res, next) => {
  const publicRoutes = ['/download', '/extract-info', '/lyrics', '/auth/login', '/auth/register', '/proxy-image'];
  if (publicRoutes.includes(req.path)) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    // Auto-override body user IDs to prevent forgery
    if (req.body && req.body.userId) req.body.userId = user.id;
    if (req.body && req.body.ownerId) req.body.ownerId = user.id;
    next();
  });
});

app.param('userId', (req, res, next, id) => {
  if (req.user && req.user.id !== id) {
    return res.status(403).json({ error: 'Forbidden: Cannot access other user data' });
  }
  next();
});

app.get('/api/proxy-image', (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('URL required');
  
  try {
    const urlObj = new URL(imageUrl);
    const host = urlObj.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.')) {
      return res.status(403).send('SSRF forbidden');
    }
  } catch {
    return res.status(400).send('Invalid URL format');
  }

  const client = imageUrl.startsWith('https') ? https : http;
  
  client.get(imageUrl, (imageRes) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    if (imageRes.headers['content-type']) {
      res.setHeader('Content-Type', imageRes.headers['content-type']);
    }
    if (imageRes.headers['content-length']) {
      res.setHeader('Content-Length', imageRes.headers['content-length']);
    }
    
    imageRes.pipe(res);
  }).on('error', (err) => {
    res.status(500).send('Failed to fetch image');
  });
});

app.post('/api/auth/profile', (req, res) => {
  const { userId, nickname, avatarUrl } = req.body;
  try {
    const user = db.updateUserProfile(userId, nickname, avatarUrl);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  res.json({ success: true, url: avatarUrl });
});

app.post('/api/upload/playlist-cover', upload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = '/uploads/avatars/' + req.file.filename;
  try {
    db.updatePlaylistCover(req.body.playlistId, url);
    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/library/:userId', (req, res) => {
  try {
    const tracks = db.getUserTracks(req.params.userId);
    res.json({ success: true, tracks });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/library/:userId', (req, res) => {
  try {
    db.saveUserTrack(req.params.userId, req.body.track);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/library/:userId/:trackId', (req, res) => {
  try {
    db.removeUserTrack(req.params.userId, req.params.trackId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// PLAYLISTS API
// =======================
app.get('/api/playlists/:userId', (req, res) => {
  res.json({ success: true, playlists: db.getUserPlaylists(req.params.userId) });
});

app.post('/api/playlists', (req, res) => {
  const { userId, name } = req.body;
  const pl = db.createPlaylist(userId, name);
  pl.is_shared = 1;
  res.json({ success: true, playlist: pl });
});

app.delete('/api/playlists/:id', (req, res) => {
  try {
    db.deletePlaylist(req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/playlists/:id', (req, res) => {
  try {
    if (req.body.name !== undefined) {
      db.updatePlaylistName(req.params.id, req.body.name);
    }
    if (req.body.is_shared !== undefined) {
      db.updatePlaylistShared(req.params.id, req.body.is_shared);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/playlists/:id/reset-cover', (req, res) => {
  try {
    db.updatePlaylistCover(req.params.id, null);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/playlists/:playlistId/tracks', (req, res) => {
  res.json({ success: true, tracks: db.getPlaylistTracks(req.params.playlistId) });
});

app.post('/api/playlists/:playlistId/tracks', (req, res) => {
  try {
    db.addTrackToPlaylist(req.params.playlistId, req.body.track);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/playlists/:playlistId/tracks/:trackId', (req, res) => {
  try {
    db.removePlaylistTrack(req.params.playlistId, req.params.trackId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// GROUPS API
// =======================
app.get('/api/groups/:userId', (req, res) => {
  res.json({ success: true, groups: db.getUserGroups(req.params.userId) });
});

app.post('/api/groups', (req, res) => {
  const { userId, name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const group = db.createGroup(name, userId);
  const members = db.getGroupMembers(group.id);
  res.json({ success: true, group, members });
});

app.post('/api/groups/join', (req, res) => {
  const { userId, inviteCode } = req.body || {};
  if (!inviteCode) return res.status(400).json({ error: 'Invite code required' });
  try {
    const group = db.joinGroup(userId, inviteCode);
    const members = db.getGroupMembers(group.id);
    res.json({ success: true, group, members });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/groups/:groupId/playlists', (req, res) => {
  res.json({ success: true, playlists: db.getGroupPlaylists(req.params.groupId) });
});

app.get('/api/groups/:groupId/members', (req, res) => {
  try {
    res.json({ success: true, members: db.getGroupMembers(req.params.groupId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/:groupId/leave', (req, res) => {
  try {
    db.leaveGroup(req.params.groupId, req.body.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/:groupId/kick', (req, res) => {
  try {
    const success = db.kickMember(req.params.groupId, req.body.ownerId, req.body.targetUserId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Not authorized or group not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// MEDIA DOWNLOAD API
// =======================
app.post('/api/extract-info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'soundcloud.com', 'www.soundcloud.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return res.status(400).json({ error: 'Unsupported URL. Only YouTube and SoundCloud are allowed.' });
    }

    console.log(`[YT-DLP] Extracting info for ${url}...`);
    const metadata = await youtubedl(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
    });

    if (metadata._type === 'playlist') {
      const entries = (metadata.entries || []).map(entry => ({
        id: entry.id,
        title: entry.title || entry.track || 'Unknown Title',
        url: entry.url || entry.webpage_url || (parsedUrl.hostname.includes('youtube') ? `https://www.youtube.com/watch?v=${entry.id}` : url),
        duration: entry.duration
      })).filter(e => e.title && !e.title.toLowerCase().includes('[deleted]') && !e.title.toLowerCase().includes('[private]'));
      
      return res.json({ 
        success: true, 
        isPlaylist: true, 
        title: metadata.title || 'Playlist',
        entries 
      });
    } else {
      return res.json({
        success: true,
        isPlaylist: false,
        track: {
          id: metadata.id,
          title: metadata.title || metadata.track || 'Unknown Title',
          url: metadata.webpage_url || url
        }
      });
    }

  } catch (error) {
    console.error('Extract info error:', error);
    res.status(500).json({ error: 'Failed to extract info. Check URL.' });
  }
});

app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'soundcloud.com', 'www.soundcloud.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return res.status(400).json({ error: 'Unsupported URL. Only YouTube and SoundCloud are allowed.' });
    }

    console.log(`[YT-DLP] Fetching metadata for ${url}...`);
    // 1. Get metadata first
    const metadata = await youtubedl(url, {
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
    });

    const trackId = metadata.id || Date.now().toString();
    let title = metadata.track || metadata.title || 'Unknown Title';
    let artist = metadata.artist || metadata.uploader || 'Unknown';
    
    // If the platform didn't provide a specific artist tag and the title looks like "Artist - Track"
    if (!metadata.artist && title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
    const coverArt = metadata.thumbnail;

    const fileName = `${trackId}.mp3`;
    const outputPath = path.join(downloadsDir, fileName);

    // 2. Download audio if not already downloaded
    if (!fs.existsSync(outputPath)) {
      console.log(`[YT-DLP] Downloading and converting audio...`);
      await youtubedl(url, {
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: 0, // Best quality
        output: outputPath,
        noPlaylist: true,
      });
      console.log(`[YT-DLP] Download complete!`);
    } else {
      console.log(`[YT-DLP] File already exists, skipping download.`);
    }

    const track = {
      id: trackId,
      title,
      artist,
      // URL must point to our express static file server
      url: `/audio/${fileName}`,
      coverArt
    };

    // 3. Return track info
    res.json({ success: true, track });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to process URL. Check terminal logs.' });
  }
});

// =======================
// LYRICS API (Genius)
// =======================
app.get('/api/lyrics', async (req, res) => {
  const { artist, title } = req.query;
  if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });
  
  try {
    console.log(`[LRCLIB] Searching for: ${artist} - ${title}`);
    const lrcRes = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': 'TrinityPlayer v1.0.0 (https://github.com/haze/trinityplayer)' }
    });
    
    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      if (lrcData.syncedLyrics || lrcData.plainLyrics) {
        console.log(`[LRCLIB] Found lyrics (Synced: ${!!lrcData.syncedLyrics})`);
        return res.json({ 
          success: true, 
          lyrics: lrcData.syncedLyrics || lrcData.plainLyrics,
          isSynced: !!lrcData.syncedLyrics
        });
      }
    }
  } catch (err) {
    console.error('[LRCLIB] Error:', err.message);
  }

  // Fallback to Genius
  try {
    const query = `${artist} ${title}`;
    console.log(`[GENIUS] Fallback searching for: ${query}`);
    const searches = await GeniusClient.songs.search(query);
    
    if (searches.length === 0) {
      return res.json({ success: false, error: 'Lyrics not found' });
    }
    
    const firstSong = searches[0];
    const lyrics = await firstSong.lyrics();
    
    res.json({ success: true, lyrics, isSynced: false });
  } catch (error) {
    console.error('[GENIUS] API Error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch lyrics' });
  }
});

// =======================
// SERVE FRONTEND (PRODUCTION)
// =======================
// Раздаем статику React (скомпилированный PWA)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Любые другие GET запросы отдаем React-приложению (для корректной работы роутера)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`=====================================`);
  console.log(`🎵 Trinity Backend running on port ${PORT}`);
  console.log(`=====================================`);
});
