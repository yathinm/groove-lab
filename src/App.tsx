// src/App.tsx

import './App.css';
//
import { useEffect } from 'react';
import { HeaderInfo } from './components/HeaderInfo';
import { FileUpload } from './components/FileUpload';
import { BPMCard } from './components/BPMCard';
import { PlaybackControls } from './components/PlaybackControls';
import { RecordedRow } from './components/RecordedRow';
import { OriginalRow } from './components/OriginalRow';
import { CombinedRow } from './components/CombinedRow';
import { VolumeControls } from './components/VolumeControls';
import { MusicScroll } from './components/MusicScroll';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store';
import { selectFile, playPause, seekTo, setTrackVolume, setMetroVolume, setPositionSec, armRecording, disarmRecording, pausePlayback, toggleMetronome } from './store/audioSlice';
import { engineService } from './store/engineService';

export default function App() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.audio);
  const positionSec = state.positionSec;

  // Keep UI position in sync while playing
  useEffect(() => {
    if (!state.isPlaying) return;
    const intervalMs = 1000 / 30; // ~30fps
    const id = setInterval(() => {
      const pos = engineService.getPositionSec();
      // Dispatch frequently to keep slider smooth
      dispatch(setPositionSec(pos));
    }, intervalMs);
    return () => clearInterval(id);
  }, [state.isPlaying, dispatch]);

  // Reflect duration when mode or tracks change (approx via store updates)
  useEffect(() => {
    // No direct tracks signal; update when recording URL changes or mode changes
    // This ensures the scroll bar has correct max for each mode
    // eslint-disable-next-line no-console
    const dur = (engineService as any).getDurationForMode ? (engineService as any).getDurationForMode(state.playMode) : state.durationSec;
    if (dur && Math.abs(dur - state.durationSec) > 0.01) {
      dispatch({ type: 'audio/selectFile/fulfilled', payload: { durationSec: dur, bpm: state.bpm } });
    }
  }, [state.playMode, state.recordingUrl, state.recordingMp3Url]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeaderInfo />

      <FileUpload disabled={false} processing={state.processing} error={state.error} onSelect={(f) => dispatch(selectFile(f) as any)} />

      <section style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <BPMCard bpm={state.bpm} processing={state.processing} />
        <PlaybackControls
          isPlaying={state.isPlaying && state.playingMode === 'metronome'}
          disabled={!state.durationSec || state.processing}
          onPlayPause={async () => {
            if (state.isPlaying && state.playingMode !== 'metronome') {
              await dispatch(pausePlayback() as any)
            }
            await dispatch(playPause() as any)
          }}
          onSkip={(d) => dispatch(seekTo(engineService.getPositionSec() + d) as any)}
          recordArmed={state.recordArmed}
          isRecording={state.isRecording}
          onArm={() => dispatch(armRecording() as any)}
          onDisarm={() => dispatch(disarmRecording() as any)}
        />
        <button onClick={() => dispatch(toggleMetronome())} disabled={!state.durationSec}>
          {state.metronomeOn ? 'Metronome Off' : 'Metronome On'}
        </button>
      </section>

      {/* Three explicit playback rows: Recorded (no metronome), Original (no metronome), Combined (no metronome) */}
      <section style={{ display: 'grid', gap: 10 }}>
        <RecordedRow />
        <OriginalRow />
        <CombinedRow />
      </section>

      {/* Removed standalone audio element for recorded track to simplify UI */}

      <VolumeControls
        trackVolume={state.trackVolume}
        metroVolume={state.metroVolume}
        onTrackVolume={(v) => dispatch(setTrackVolume(v))}
        onMetroVolume={(v) => dispatch(setMetroVolume(v))}
      />
      <div style={{ maxWidth: 560 }}>
        <MusicScroll
          positionSec={positionSec}
          durationSec={state.durationSec}
          disabled={!state.durationSec || state.processing}
          onSeek={(v) => { dispatch(setPositionSec(v)); dispatch(seekTo(v) as any); }}
        />
      </div>
    </div>
  );
}