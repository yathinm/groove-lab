// src/App.tsx

import './App.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createAudioContext } from './audio/createAudioContext';
import { detectBpmFromAudioBuffer } from './audio/bpm';
import { AudioPlayer } from './audio/player';
import { Metronome } from './audio/metronome';

export default function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackVolume, setTrackVolume] = useState(0.9);
  const [metroVolume, setMetroVolume] = useState(0.7);
  const [positionSec, setPositionSec] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Waveform display removed

  // Lazily create audio context on first user gesture
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }
    return audioContextRef.current;
  };

  const player = useMemo(() => {
    const ctx = ensureAudioContext();
    return new AudioPlayer(ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metronome = useMemo(() => {
    const ctx = ensureAudioContext();
    return new Metronome(ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    player.setVolume(trackVolume);
  }, [player, trackVolume]);
  useEffect(() => {
    metronome.setVolume(metroVolume);
  }, [metronome, metroVolume]);

  // Update the position slider while playing
  useEffect(() => {
    const ctx = ensureAudioContext();
    const tick = () => {
      if (isPlaying) {
        const pos = player.getPlaybackOffsetSeconds(ctx.currentTime);
        setPositionSec((prev) => (Math.abs(prev - pos) > 0.05 ? pos : prev));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, player]);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const onFileChange = async (file: File | null) => {
    // Stop current playback if a new file is selected while playing
    if (isPlaying) {
      metronome.stop();
      player.stop();
      setIsPlaying(false);
    }
    setSelectedFile(file);
    setBpm(null);
    setError(null);
    if (!file) return;
    try {
      setProcessing(true);
      const ctx = ensureAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      player.setBuffer(decoded);
      player.setMediaFile(file);
      // Waveform display removed
      const t0 = performance.now();
      const detected = await detectBpmFromAudioBuffer(decoded);
      const t1 = performance.now();
      // eslint-disable-next-line no-console
      console.log('[BPM] detected', detected, `in ${(t1 - t0).toFixed(0)}ms`, {
        durationSec: decoded.duration,
        sampleRate: decoded.sampleRate,
        length: decoded.length,
      });
      setBpm(Math.round(detected));
      metronome.setBpm(detected);
    } catch (e) {
      const msg = (e as Error).message || 'Failed to process file';
      // eslint-disable-next-line no-console
      console.error('[BPM] detection error:', e);
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const onPlayPause = async () => {
    const ctx = ensureAudioContext();
    // eslint-disable-next-line no-console
    console.log('[PLAY/PAUSE] isPlaying?', isPlaying, 'posSec', positionSec, 'ctx.t', ctx.currentTime);
    if (!isPlaying) {
      // Resume context if suspended
      if (ctx.state === 'suspended') await ctx.resume();
      // Prefer media element when available for robust play/seek
      if ((player as unknown as any).hasMedia?.()) {
        (player as unknown as any).playMediaAt(positionSec);
        const startAt = ctx.currentTime + 0.02;
        if (bpm) metronome.setBpm(bpm);
        metronome.startAt(startAt);
      } else {
        const startAt = ctx.currentTime + 0.03;
        // eslint-disable-next-line no-console
        console.log('[PLAY] startAt', startAt, 'offset', positionSec);
        player.playAt(startAt, positionSec);
        if (bpm) metronome.setBpm(bpm);
        metronome.startAt(startAt);
      }
      setIsPlaying(true);
    } else {
      // eslint-disable-next-line no-console
      console.log('[PAUSE] stopping');
      metronome.stop();
      player.stop();
      setIsPlaying(false);
    }
  };

  const seekTo = async (targetSec: number) => {
    const ctx = ensureAudioContext();
    const duration = player.getDurationSeconds();
    const clamped = Math.max(0, Math.min(targetSec, duration));
    // eslint-disable-next-line no-console
    console.log('[SEEK] request', { targetSec, clamped, duration, ctxTime: ctx.currentTime });
    setPositionSec(clamped);
    // Always play from the new position; prefer media element path
    metronome.stop();
    player.stop();
    if (ctx.state === 'suspended') await ctx.resume();
    if ((player as unknown as any).hasMedia?.()) {
      (player as unknown as any).playMediaAt(clamped);
    } else {
      player.playImmediate(clamped);
    }
    if (bpm) metronome.setBpm(bpm);
    const startAt = ctx.currentTime + 0.02;
    metronome.startAt(startAt);
    setIsPlaying(true);
  };

  const getCurrentPositionSec = (): number => {
    const ctx = ensureAudioContext();
    const pos = player.getPlaybackOffsetSeconds(ctx.currentTime);
    // eslint-disable-next-line no-console
    console.log('[POS] now', ctx.currentTime, 'pos', pos);
    return pos;
  };

  const skipBy = (delta: number) => {
    const base = getCurrentPositionSec();
    seekTo(base + delta);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1>Groove Lab</h1>
        <p>Upload a song, detect BPM, and practice with a synced metronome.</p>
      </header>

      <section>
        <label htmlFor="file">Upload audio (.mp3, .wav)</label>
        <input
          id="file"
          type="file"
          accept="audio/mpeg, audio/wav, .mp3, .wav, audio/*"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {processing && <p>Processing...</p>}
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </section>

      <section style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div style={{ border: '1px solid #ccc', padding: 12, borderRadius: 8, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Detected BPM</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{bpm ?? (processing ? '…' : '-')}</div>
        </div>

        <button onClick={onPlayPause} disabled={!selectedFile || processing}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button onClick={() => { /* eslint-disable-next-line no-console */ console.log('[SKIP] -5'); skipBy(-5); }} disabled={!selectedFile || processing}>
          -5s
        </button>
        <button onClick={() => { /* eslint-disable-next-line no-console */ console.log('[SKIP] +5'); skipBy(5); }} disabled={!selectedFile || processing}>
          +5s
        </button>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 560 }}>
        <div>
          <label>Track Volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={trackVolume}
            onChange={(e) => setTrackVolume(parseFloat(e.target.value))}
          />
        </div>
        <div>
          <label>Metronome Volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={metroVolume}
            onChange={(e) => setMetroVolume(parseFloat(e.target.value))}
          />
        </div>
        <div style={{ gridColumn: '1 / span 2' }}>
          <input
            type="range"
            min={0}
            max={player.getDurationSeconds() || 0}
            step={0.01}
            value={positionSec}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setPositionSec(v);
              seekTo(v);
            }}
            disabled={!selectedFile || processing}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>{formatTime(positionSec)}</span>
            <span>{formatTime(player.getDurationSeconds() || 0)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}