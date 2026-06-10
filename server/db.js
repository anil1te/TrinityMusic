const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(process.cwd(), 'trinity.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS global_tracks (
    id TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    url TEXT,
    coverArt TEXT
  );

  CREATE TABLE IF NOT EXISTS user_tracks (
    user_id TEXT,
    track_id TEXT,
    UNIQUE(user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT,
    track_id TEXT,
    UNIQUE(playlist_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT,
    invite_code TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT,
    user_id TEXT,
    UNIQUE(group_id, user_id)
  );
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN nickname TEXT;');
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');
} catch (e) {
  // Ignore if columns already exist
}

try {
  db.exec('ALTER TABLE groups ADD COLUMN owner_id TEXT;');
} catch (e) {
  // Ignore if column already exists
}

try {
  db.exec('ALTER TABLE playlists ADD COLUMN cover_url TEXT;');
} catch (e) {
  // Ignore if column already exists
}

try {
  db.exec('ALTER TABLE playlists ADD COLUMN is_shared INTEGER DEFAULT 1;');
} catch (e) {
  // Ignore if column already exists
}

function generateCode() {
  return crypto.randomBytes(2).toString('hex') + '-' + crypto.randomBytes(2).toString('hex');
}

function registerUser() {
  let code = generateCode();
  const id = crypto.randomUUID();
  const nickname = 'User_' + code;
  db.prepare('INSERT INTO users (id, code, nickname) VALUES (?, ?, ?)').run(id, code, nickname);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByCode(code) {
  return db.prepare('SELECT * FROM users WHERE code = ?').get(code);
}

function saveUserTrack(userId, track) {
  db.prepare(`
    INSERT INTO global_tracks (id, title, artist, url, coverArt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      title = excluded.title, 
      artist = excluded.artist, 
      coverArt = excluded.coverArt, 
      url = excluded.url
  `).run(track.id, track.title, track.artist, track.url, track.coverArt);

  db.prepare('INSERT OR IGNORE INTO user_tracks (user_id, track_id) VALUES (?, ?)').run(userId, track.id);
}

function getUserTracks(userId) {
  return db.prepare(`
    SELECT t.* FROM global_tracks t
    JOIN user_tracks ut ON t.id = ut.track_id
    WHERE ut.user_id = ?
  `).all(userId);
}

function removeUserTrack(userId, trackId) {
  db.prepare('DELETE FROM user_tracks WHERE user_id = ? AND track_id = ?').run(userId, trackId);
}

function createPlaylist(userId, name) {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, name);
  return { id, user_id: userId, name };
}

function getUserPlaylists(userId) {
  return db.prepare(`
    SELECT p.*, 
           (SELECT t.coverArt 
            FROM playlist_tracks pt 
            JOIN global_tracks t ON pt.track_id = t.id 
            WHERE pt.playlist_id = p.id 
            LIMIT 1) as first_track_cover
    FROM playlists p 
    WHERE p.user_id = ?
  `).all(userId);
}

function updatePlaylistCover(playlistId, coverUrl) {
  db.prepare('UPDATE playlists SET cover_url = ? WHERE id = ?').run(coverUrl, playlistId);
}

function updatePlaylistName(playlistId, name) {
  db.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(name, playlistId);
}

function updatePlaylistShared(playlistId, isShared) {
  db.prepare('UPDATE playlists SET is_shared = ? WHERE id = ?').run(isShared ? 1 : 0, playlistId);
}

function deletePlaylist(playlistId) {
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId);
  db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
}

function addTrackToPlaylist(playlistId, track) {
  db.prepare(`
    INSERT INTO global_tracks (id, title, artist, url, coverArt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      title = excluded.title, 
      artist = excluded.artist, 
      coverArt = excluded.coverArt, 
      url = excluded.url
  `).run(track.id, track.title, track.artist, track.url, track.coverArt);

  db.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)').run(playlistId, track.id);
}

function getPlaylistTracks(playlistId) {
  return db.prepare(`
    SELECT t.* FROM global_tracks t
    JOIN playlist_tracks pt ON t.id = pt.track_id
    WHERE pt.playlist_id = ?
  `).all(playlistId);
}

function removePlaylistTrack(playlistId, trackId) {
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
}

function createGroup(name, userId) {
  const id = crypto.randomUUID();
  const inviteCode = crypto.randomBytes(3).toString('hex');
  db.prepare('INSERT INTO groups (id, name, invite_code, owner_id) VALUES (?, ?, ?, ?)').run(id, name, inviteCode, userId);
  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(id, userId);
  return { id, name, inviteCode, owner_id: userId };
}

function joinGroup(userId, inviteCode) {
  const group = db.prepare('SELECT * FROM groups WHERE invite_code = ?').get(inviteCode);
  if (!group) throw new Error('Группа не найдена');
  db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, userId);
  return group;
}

function getUserGroups(userId) {
  return db.prepare(`
    SELECT g.* FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `).all(userId);
}

function getGroupPlaylists(groupId) {
  return db.prepare(`
    SELECT p.id, p.name, p.user_id, p.cover_url, p.is_shared, u.code as owner_code, u.nickname as owner_nickname, u.avatar_url as owner_avatar, g.name as group_name,
           (SELECT t.coverArt 
            FROM playlist_tracks pt 
            JOIN global_tracks t ON pt.track_id = t.id 
            WHERE pt.playlist_id = p.id 
            LIMIT 1) as first_track_cover
    FROM playlists p
    JOIN group_members gm ON p.user_id = gm.user_id
    JOIN groups g ON gm.group_id = g.id
    JOIN users u ON p.user_id = u.id
    WHERE gm.group_id = ? AND p.is_shared = 1
  `).all(groupId);
}

function getGroupMembers(groupId) {
  return db.prepare(`
    SELECT u.id, u.code, u.nickname, u.avatar_url,
           CASE WHEN g.owner_id = u.id THEN 'owner' ELSE 'member' END as role
    FROM users u
    JOIN group_members gm ON u.id = gm.user_id
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.group_id = ?
  `).all(groupId);
}

function updateUserProfile(userId, nickname, avatarUrl) {
  db.prepare('UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?').run(nickname, avatarUrl, userId);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function leaveGroup(groupId, userId) {
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
}

function kickMember(groupId, ownerId, targetUserId) {
  const group = db.prepare('SELECT owner_id FROM groups WHERE id = ?').get(groupId);
  if (group && group.owner_id === ownerId) {
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetUserId);
    return true;
  }
  return false;
}

module.exports = {
  registerUser, getUserByCode, updateUserProfile,
  saveUserTrack, getUserTracks, removeUserTrack,
  createPlaylist, getUserPlaylists, updatePlaylistCover, updatePlaylistName, updatePlaylistShared, deletePlaylist, addTrackToPlaylist, getPlaylistTracks, removePlaylistTrack,
  createGroup, joinGroup, getUserGroups, getGroupPlaylists, getGroupMembers,
  leaveGroup, kickMember
};
