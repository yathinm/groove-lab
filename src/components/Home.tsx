import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { HeaderInfo } from './HeaderInfo';
import { FileUpload } from './FileUpload';
import { BPMCard } from './BPMCard';
import { PlaybackControls } from './PlaybackControls';
import { RecordedRow } from './RecordedRow';
import { OriginalRow } from './OriginalRow';
import { CombinedRow } from './CombinedRow';
import { VolumeControls } from './VolumeControls';
import { MusicScroll } from './MusicScroll';
import { selectFile, playPause, seekTo, setTrackVolume, setMetroVolume, setPositionSec, armRecording, disarmRecording, pausePlayback, toggleMetronome } from '../store/audioSlice';
import { engineService } from '../store/engineService';
import { supabase } from '../supabaseClient';
import { handleSaveProject, type SaveChoices } from '../api/projects';
import { LogOut, Save, Timer } from 'lucide-react'

export default function Home() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.audio);
  const positionSec = state.positionSec;

  // Keep UI position in sync while playing
  useEffect(() => {
    if (!state.isPlaying) return;
    const intervalMs = 1000 / 30; // ~30fps
    const id = setInterval(() => {
      const pos = engineService.getPositionSec();
      dispatch(setPositionSec(pos));
    }, intervalMs);
    return () => clearInterval(id);
  }, [state.isPlaying, dispatch]);

  // Reflect duration when mode or tracks change
  useEffect(() => {
    const dur = (engineService as any).getDurationForMode ? (engineService as any).getDurationForMode(state.playMode) : state.durationSec;
    if (dur && Math.abs(dur - state.durationSec) > 0.01) {
      dispatch({ type: 'audio/selectFile/fulfilled', payload: { durationSec: dur, bpm: state.bpm } });
    }
  }, [state.playMode, state.recordingUrl, state.recordingMp3Url]);

  const metronomeButtonClass = state.metronomeOn
    ? 'inline-flex items-center gap-2 rounded-md border border-orange-500 bg-orange-500/20 px-3 py-2 text-sm font-medium text-orange-700 shadow-sm hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <HeaderInfo />
        <div className="flex items-center justify-end gap-3">
          <button
            className="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <Save className="mr-2 h-4 w-4" /> Save Project
          </button>
          <button
            className="inline-flex items-center rounded-md border border-orange-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-orange-50"
            onClick={async () => {
              try { await supabase.auth.signOut(); } catch {}
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-orange-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Upload</h2>
            <FileUpload disabled={false} processing={state.processing} error={state.error} onSelect={(f) => dispatch(selectFile(f) as any)} />
          </div>

          {/* Timeline */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-orange-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Timeline</h2>
            <div className="max-w-2xl">
              <MusicScroll
                positionSec={positionSec}
                durationSec={state.durationSec}
                disabled={!state.durationSec || state.processing}
                onSeek={(v) => { dispatch(setPositionSec(v)); dispatch(seekTo(v) as any); }}
              />
            </div>
          </div>

          {/* Tracks */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-orange-200">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Tracks</h2>
            <div className="grid gap-3">
              <RecordedRow />
              <OriginalRow />
              <CombinedRow />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Playback & Metronome */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-orange-200">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Playback</h2>
            <div className="flex flex-wrap items-center gap-4">
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
                recordArmed={state.recordArmed}
                isRecording={state.isRecording}
                onArm={() => dispatch(armRecording() as any)}
                onDisarm={() => dispatch(disarmRecording() as any)}
              />
              <button
                className={metronomeButtonClass}
                onClick={() => dispatch(toggleMetronome())}
                disabled={!state.durationSec}
              >
                <Timer className="mr-2 h-4 w-4" />
                {state.metronomeOn ? 'Metronome Off' : 'Metronome On'}
              </button>
            </div>
          </div>

          {/* Levels */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-orange-200">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Levels</h2>
            <VolumeControls
              trackVolume={state.trackVolume}
              metroVolume={state.metroVolume}
              onTrackVolume={(v) => dispatch(setTrackVolume(v))}
              onMetroVolume={(v) => dispatch(setMetroVolume(v))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


