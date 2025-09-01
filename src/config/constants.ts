export type Config = {
  ui: {
    updateFps: number
    progressSegments: number[]
  }
  audio: {
    sampleRate: number
    bytesPerSample: number
    defaultTrackVolume: number
    defaultMetronomeVolume: number
    playerVolumeSlewSec: number
    playScheduleDelaySec: number
    topLevelPlayDelaySec: number
    metronomeStartDelaySec: number
    volumeMin: number
    volumeMax: number
    volumeStep: number
  }
  metronome: {
    scheduleAheadTimeSec: number
    lookaheadMs: number
    oscillatorFrequencyHz: number
    clickAttackSec: number
    clickDecaySec: number
    clickDurationSec: number
  }
  upload: {
    accept: string
    allowedLabels: string[]
  }
  storage: {
    bucket: string
    cacheControlSeconds: number
  }
  polling: {
    profileIntervalMs: number
  }
  labels: {
    saveProjectPrompt: string
    saveChoicePrompt: string
    saveChoiceRecording: string
    saveChoiceCombined: string
    saveChoiceBoth: string
    mustSignIn: string
    saveSuccess: string
    saveFailure: string
  }
}

export const defaultConfig: Config = {
  ui: {
    updateFps: 30,
    progressSegments: [0, 25, 50, 75, 100],
  },
  audio: {
    sampleRate: 44100,
    bytesPerSample: 2,
    defaultTrackVolume: 0.9,
    defaultMetronomeVolume: 0.7,
    playerVolumeSlewSec: 0.01,
    playScheduleDelaySec: 0.02,
    topLevelPlayDelaySec: 0.03,
    metronomeStartDelaySec: 0.02,
    volumeMin: 0,
    volumeMax: 1,
    volumeStep: 0.01,
  },
  metronome: {
    scheduleAheadTimeSec: 0.1,
    lookaheadMs: 25,
    oscillatorFrequencyHz: 1000,
    clickAttackSec: 0.001,
    clickDecaySec: 0.05,
    clickDurationSec: 0.06,
  },
  upload: {
    accept: 'audio/mpeg, audio/wav, .mp3, .wav, audio/*',
    allowedLabels: ['MP3', 'WAV'],
  },
  storage: {
    bucket: 'Project-Audio',
    cacheControlSeconds: 3600,
  },
  polling: {
    profileIntervalMs: 5000,
  },
  labels: {
    saveProjectPrompt: 'Project name?',
    saveChoicePrompt: 'Save which audio? Type: recording, combined, or both',
    saveChoiceRecording: 'recording',
    saveChoiceCombined: 'combined',
    saveChoiceBoth: 'both',
    mustSignIn: 'Please sign in to save projects.',
    saveSuccess: 'Project saved successfully!',
    saveFailure: 'Failed to save project.',
  },
}


