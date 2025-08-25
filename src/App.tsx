// src/App.tsx

import './App.css';
//
import { HeaderInfo } from './components/HeaderInfo';
import { FileUpload } from './components/FileUpload';
import { BPMCard } from './components/BPMCard';
import { PlaybackControls } from './components/PlaybackControls';
import { VolumeControls } from './components/VolumeControls';
import { MusicScroll } from './components/MusicScroll';
import { useAudioEngine } from './hooks/useAudioEngine';
import { usePositionTicker } from './hooks/usePositionTicker';

export default function App() {
  const { state, actions } = useAudioEngine();
  const { positionSec, setPositionSec } = usePositionTicker(actions.getPositionSec, state.isPlaying);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeaderInfo />

      <FileUpload disabled={false} processing={state.processing} error={state.error} onSelect={actions.onSelectFile} />

      <section style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <BPMCard bpm={state.bpm} processing={state.processing} />
        <PlaybackControls
          isPlaying={state.isPlaying}
          disabled={!state.durationSec || state.processing}
          onPlayPause={actions.playPause}
          onSkip={(d) => actions.skip(d)}
        />
      </section>

      <VolumeControls
        trackVolume={state.trackVolume}
        metroVolume={state.metroVolume}
        onTrackVolume={actions.setTrackVolume}
        onMetroVolume={actions.setMetroVolume}
      />
      <div style={{ maxWidth: 560 }}>
        <MusicScroll
          positionSec={positionSec}
          durationSec={state.durationSec}
          disabled={!state.durationSec || state.processing}
          onSeek={(v) => { setPositionSec(v); actions.seekTo(v); }}
        />
      </div>
    </div>
  );
}