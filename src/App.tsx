// src/App.tsx

import './App.css';
//
import { useEffect } from 'react';
import { HeaderInfo } from './components/HeaderInfo';
import { FileUpload } from './components/FileUpload';
import { BPMCard } from './components/BPMCard';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControls } from './components/VolumeControls';
import { MusicScroll } from './components/MusicScroll';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store';
import { selectFile, playPause, seekTo, setTrackVolume, setMetroVolume, setPositionSec, armRecording, disarmRecording, setPlayMode, playModeOnly, pausePlayback } from './store/audioSlice';
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
          isPlaying={state.isPlaying}
          disabled={!state.durationSec || state.processing}
          onPlayPause={() => dispatch(playPause() as any)}
          onSkip={(d) => dispatch(seekTo(engineService.getPositionSec() + d) as any)}
          recordArmed={state.recordArmed}
          isRecording={state.isRecording}
          onArm={() => dispatch(armRecording() as any)}
          onDisarm={() => dispatch(disarmRecording() as any)}
        />
      </section>

      {/* Three explicit playback rows: Recorded, Original, Combined */}
      <section style={{ display: 'grid', gap: 10 }}>
        {(() => {
          const hasOriginal = !!engineService.getOriginalTrack();
          const hasRecording = !!engineService.getLatestRecordingTrack();
          const Row = ({ label, mode, disabled }: { label: string; mode: 'original' | 'recording' | 'combined'; disabled: boolean }) => {
            const isThisMode = state.playMode === mode;
            const isPlayingThis = engineService.isAnyPlaying() && (engineService.getCurrentMode() === mode);
            const onClick = async () => {
              if (isPlayingThis) {
                await dispatch(pausePlayback() as any);
                return;
              }
              if (state.isPlaying) {
                await dispatch(pausePlayback() as any);
              }
              dispatch(setPlayMode(mode));
              await Promise.resolve();
              await dispatch(playModeOnly(mode) as any);
            };
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={onClick} disabled={disabled}>
                  {isPlayingThis ? 'Pause' : 'Play'}
                </button>
                <strong style={{ minWidth: 100 }}>{label}</strong>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{disabled ? 'Unavailable' : (isPlayingThis ? 'Now playing' : 'Ready')}</span>
              </div>
            );
          };
          return (
            <>
              <Row label="Recorded" mode="recording" disabled={!hasRecording} />
              <Row label="Original" mode="original" disabled={!hasOriginal} />
              <Row label="Combined" mode="combined" disabled={!(hasOriginal || hasRecording)} />
            </>
          );
        })()}
      </section>

      {(state.recordingUrl || state.recordingMp3Url) && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong>Recorded track</strong>
          <audio
            src={state.recordingMp3Url || state.recordingUrl || undefined}
            controls
            style={{ width: '100%' }}
            onCanPlay={() => { /* eslint-disable-next-line no-console */ console.log('[UI] audio element can play recording') }}
            onError={(e) => { /* eslint-disable-next-line no-console */ console.error('[UI] audio element error', e) }}
          />
        </section>
      )}

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