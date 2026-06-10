<div align="center">
  <img src="client/public/logo.jpg" alt="TrinityPlayer Logo" width="200" style="border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 20px;" />

  # TrinityPlayer

  **A beautiful, lightning-fast, and deeply integrated personal music streaming platform.**
  Download tracks from YouTube & SoundCloud, listen offline, create shared playlists with friends, and enjoy a premium audio experience.
</div>


## ✨ Features

- 🎧 **Universal Downloader**: Paste any YouTube or SoundCloud link (single track, mix, or playlist) and instantly extract & download it to your personal library using `yt-dlp`.
- ⚡ **Smart Caching & Offline Mode**: Full PWA support with IndexedDB/Cache API integration. Tracks are cached locally for instantaneous, gapless offline playback—even on mobile and iOS!
- 🎛 **Advanced Audio Engine**: Built-in 5-band equalizer, volume controls, and a custom audio unlocker that bypasses iOS/Safari autoplay restrictions.
- 👯 **Groups & Social Sharing**: Create invite-only groups, share playlists, and collaborate on music curation with friends in real-time.
- 🎨 **Premium UI/UX**: Designed with deep aesthetics in mind—glassmorphism, fluid micro-animations (via Framer Motion), and a responsive layout that looks native on desktops and smartphones.
- 🧠 **Smart Deduplication**: Automatically skips downloading tracks you already have in your library, saving both server bandwidth and your time.

## 🛠 Tech Stack

**Frontend:**
- **React 18** + **Vite**
- **Zustand** (Global state management with persistence)
- **Framer Motion** (Fluid animations)
- **Lucide React** (Beautiful iconography)
- **Service Workers & Cache API** (PWA & Offline playback)

**Backend:**
- **Node.js** + **Express**
- **yt-dlp** (Media extraction & downloading)
- **better-sqlite3** (Lightning-fast local database)
- **JWT** (Secure stateless authentication)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3 (required for `yt-dlp`)
- FFmpeg (required for audio conversion)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/anil1te/trinitymusic.git
   cd trinitymusic
   ```

2. **Install Server Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Start the Application (Development Mode):**
   Open two terminal tabs:
   - Terminal 1 (Backend): `cd server && npm start` (Runs on port 3000)
   - Terminal 2 (Frontend): `cd client && npm run dev` (Runs on port 5173)

   Navigate to `http://localhost:5173` in your browser.

### Production Setup (Running in Background with PM2)

To keep the backend running permanently in the background (even after you close the terminal), we recommend using **PM2**.

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Start the backend server:**
   ```bash
   cd server
   pm2 start index.js --name "trinity-backend"
   ```

3. **Build the frontend (Optional, if serving statically):**
   ```bash
   cd ../client
   npm run build
   ```
   *Note: In production, you would typically serve the `client/dist` folder using Nginx or by configuring the Express backend to serve static files.*


## 📱 PWA Installation
To install TrinityPlayer as a native-like app on your phone:
- **iOS:** Open in Safari, tap "Share", and select "Add to Home Screen".
- **Android:** Open in Chrome and tap "Install app" from the bottom prompt or browser menu.

---

<div align="center">
  <i>Crafted with ❤️ for music lovers.</i>
</div>
