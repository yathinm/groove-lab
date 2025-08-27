// src/App.tsx

import './App.css';
//
import { HeaderInfo } from './components/HeaderInfo';
import { FileUpload } from './components/FileUpload';
import { BPMCard } from './components/BPMCard';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControls } from './components/VolumeControls';
import { MusicScroll } from './components/MusicScroll';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from './store';
import { selectFile, playPause, seekTo, setTrackVolume, setMetroVolume, setPositionSec, armRecording, disarmRecording } from './store/audioSlice';
import { engineService } from './store/engineService';

export default function App() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.audio);
  const positionSec = state.positionSec;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeaderInfo />

      <FileUpload disabled={false} processing={state.processing} error={state.error} onSelect={(f) => dispatch(selectFile(f) as any)} />

      <section style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <BPMCard bpm={state.bpm} processing={state.processing} />
        <PlaybackControls
          isPlaying={state.isPlaying}
          disabled={!state.durationSec || state.processing}
          onPlayPause={() => dispatch(playPause() as any)}
          onSkip={(d) => dispatch(seekTo(engineService.getPositionSec() + d) as any)}
          recordArmed={state.recordArmed}
          isRecording={state.isRecording}
          recordingUrl={state.recordingUrl}
          recordingMp3Url={state.recordingMp3Url}
          onArm={() => dispatch(armRecording() as any)}
          onDisarm={() => dispatch(disarmRecording() as any)}
        />
      </section>

      {(state.recordingMp3Url || state.recordingUrl) && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {state.recordingMp3Url && (
            <>
              <button onClick={() => { if (state.recordingMp3Url) window.open(state.recordingMp3Url, '_blank') }}>Save MP3</button>
              <audio src={state.recordingMp3Url} controls />
            </>
          )}
          {state.recordingUrl && (
            <button onClick={() => { if (state.recordingUrl) window.open(state.recordingUrl, '_blank') }}>Save WAV</button>
          )}
        </div>
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