// src/App.tsx

import './App.css';
//
import { useEffect, useState } from 'react';
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
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import NavBar from './components/NavBar';
import { handleSaveProject, type SaveChoices } from './api/projects';

export default function App() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.audio);
  const positionSec = state.positionSec;
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [page, setPage] = useState<'home' | 'profile'>('home');

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <NavBar current={page} onNavigate={setPage} />
      <HeaderInfo />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={async () => {
            const projectName = window.prompt('Project name?')?.trim();
            if (!projectName) return;
            const choice = window.prompt('Save which audio? Type: recording, combined, or both')?.trim().toLowerCase();
            if (!choice) return;
            const choices: SaveChoices = {
              saveRecording: choice === 'recording' || choice === 'both',
              saveCombined: choice === 'combined' || choice === 'both',
            };
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              alert('Please sign in to save projects.');
              return;
            }
            const ok = await handleSaveProject(projectName, user, choices);
            alert(ok ? 'Project saved successfully!' : 'Failed to save project.');
          }}
          disabled={!state.durationSec || state.processing}
        >
          Save Project
        </button>
        <button
          onClick={async () => {
            try {
              await supabase.auth.signOut();
            } catch {}
          }}
          style={{ marginLeft: 8 }}
        >
          Log out
        </button>
      </div>

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
      {page === 'home' ? (
        <section style={{ display: 'grid', gap: 10 }}>
          <RecordedRow />
          <OriginalRow />
          <CombinedRow />
        </section>
      ) : (
        <section>
          <h3>Profile</h3>
          <p>You are signed in.</p>
        </section>
      )}

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