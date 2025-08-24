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

  const onFileChange = async (file: File | null) => {
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
      const detected = await detectBpmFromAudioBuffer(decoded);
      setBpm(Math.round(detected));
      metronome.setBpm(detected);
    } catch (e) {
      setError((e as Error).message || 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  };

  const onPlayPause = async () => {
    const ctx = ensureAudioContext();
    if (!isPlaying) {
      // Resume context if suspended
      if (ctx.state === 'suspended') await ctx.resume();
      const startAt = ctx.currentTime + 0.05;
      player.playAt(startAt);
      if (bpm) metronome.setBpm(bpm);
      metronome.startAt(startAt);
      setIsPlaying(true);
    } else {
      metronome.stop();
      player.stop();
      setIsPlaying(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1>GrooveLab</h1>
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
      </section>
    </div>
  );
}