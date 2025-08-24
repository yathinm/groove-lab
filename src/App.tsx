// src/App.tsx

import './App.css';
import { useAudioOnset } from './hooks/useAudioOnset'

// const ONSET_THRESHOLD = 0.1; // kept for reference
// const DEBOUNCE_TIME = 50;   // kept for reference

export default function App() {
  const { isRunning, start, stop } = useAudioOnset({
    analyserFftSize: 512,
    bufferSize: 256,
    smoothingTimeConstant: 0.02,
    debounceMs: 20,
    threshold: 0.01,
  })

  return (
    <div className="appContainer">
      <div className="mainContent">
        <h1 className="title">GrooveLab</h1>
        {/* --- Updated Controls Section --- */}
        <div className="controlsPlaceholder">
          <div className="buttonGroup">
             <button onClick={start} disabled={isRunning} className="startButton">Start</button>
             <button onClick={stop} disabled={!isRunning} className="stopButton">Stop</button>
          </div>
        </div>

        {/* Stats Display Section */}
        <div className="statsGrid">
          <div className="statCard">
            <h3>Current BPM</h3>
            <p className="bpmValue">-</p>
          </div>
          <div className="statCard">
            <h3>Accuracy</h3>
            <p className="accuracyValue">-</p>
          </div>
          <div className="statCard">
            <h3>Feedback</h3>
            <p className="feedbackValue">-</p>
          </div>
        </div>
      </div>
    </div>
  );
}