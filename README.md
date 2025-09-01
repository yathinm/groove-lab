## Groove Lab

A browser-based practice lab for musicians. Upload a track, auto-detect its BPM, play with a synced metronome, record yourself, and mix your take with the original.

Important: for best results, wear headphones while using this application to avoid microphone bleed and feedback during recording.

### Features
- **Upload audio (MP3/WAV)**: Drag-and-drop or browse to load a song.
- **Automatic BPM detection**: Uses Essentia.js WASM to estimate tempo.
- **Synced metronome**: Toggle an accurate, scheduled metronome that follows detected BPM.
- **Timeline scrubbing**: Seek through the track with a smooth progress bar.
- **Recording**: Arm your mic and record directly in the browser (PCM WAV, optional MP3 creation).
- **Track mixing modes**: Instantly switch between Original, Recorded, and Combined.
- **Volume controls**: Independent levels for track and metronome.
- **Project saving**: Save your recording and/or a rendered combined mix to cloud storage.
- **Profile library**: Browse and play saved tracks, scrub each with its own mini timeline.
- **Auth with Google**: Sign in to sync projects across devices.

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite 7
- **State**: Redux Toolkit, React-Redux
- **UI**: Tailwind CSS 4, lucide-react, Radix primitives
- **Audio**: Web Audio API, Essentia.js (WASM) for BPM, lamejs for MP3 encoding
- **Backend-as-a-service**: Supabase (Auth, Postgres, Storage)

### How it works (high level)
- Uploading decodes audio to an AudioBuffer and seeds the multi-track engine.
- BPM is estimated client-side via Essentia.js WASM.
- Playback is fully Web Audio–driven; the metronome is sample-accurate and independently toggled.
- Recording captures mic input, builds a WAV (and tries MP3), and appends the take as a new track.
- Saving renders a combined mix offline (OfflineAudioContext) and uploads to Supabase Storage, then writes a row to the `Projects` table.

## Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- A Supabase project with Google OAuth enabled

### Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file `.env.local` in the project root with your Supabase values:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the app, sign in with Google, and begin.

### Production build
```bash
npm run build
npm run preview
```

## Supabase Configuration

### 1) Authentication (Google)
- In Supabase Dashboard → Authentication → Providers, enable Google.
- Set Authorized Redirect URLs to your app origin (the app uses `window.location.origin` as the redirect target).

### 2) Storage
- Create a public storage bucket named `Project-Audio`.

### 3) Database
Create a `Projects` table to store project metadata and file URLs. A recommended minimal schema:
```sql
create table if not exists public."Projects" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamp with time zone default now()
);

create unique index if not exists projects_user_name_unique on public."Projects" (user_id, name);
```

Row-Level Security example (adjust to your needs):
```sql
alter table public."Projects" enable row level security;

create policy "Owners can read"
  on public."Projects" for select
  using (auth.uid() = user_id);

create policy "Owners can insert"
  on public."Projects" for insert
  with check (auth.uid() = user_id);

create policy "Owners can delete"
  on public."Projects" for delete
  using (auth.uid() = user_id);
```

## Usage
1. **Sign in** with Google.
2. **Upload** an MP3/WAV. The app decodes audio and detects BPM.
3. **Play** from the top control; optionally toggle the **Metronome**.
4. **Scrub** the timeline to seek. Use **Original / Recorded / Combined** rows to audition specific mixes.
5. **Record**: Arm recording, then play. Disarm to finalize the take; your recording appears as a track.
6. **Adjust levels**: Use Track and Metronome sliders.
7. **Save project**: Click Save, choose what to save (recording, combined, or both). Visit **Profile** to view and play saved tracks.

Tip: wear headphones to prevent your speakers from bleeding into the mic while recording.

## Project Structure
```
src/
  audio/           # player, metronome, recorder, BPM detection
  api/             # Supabase upload/save flows
  components/      # UI (Home, Profile, rows, controls, timeline)
  config/          # UI/audio constants and provider
  store/           # Redux slice + engine service facade
```

## Troubleshooting
- **No audio until click**: Browsers require user interaction to start audio. Click Play once.
- **Mic not recording**: Make sure you granted microphone permission. Headphones recommended to avoid feedback.
- **BPM not detected**: Very short or very noisy audio might fail detection. Try another file.
- **CORS/Storage errors**: Verify bucket name `Project-Audio` exists and is public; check your Supabase URL/key.
- **Google sign-in redirect**: Ensure your app origin is listed in Supabase’s authorized redirect URLs.

## Acknowledgements
- Essentia.js (WASM) for tempo estimation
- lamejs for client-side MP3 encoding
- Supabase for Auth, DB, and Storage
- Vite, Tailwind CSS, lucide-react


