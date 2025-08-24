// Minimal onset detection in an AudioWorkletProcessor
// - Computes an EMA energy envelope
// - Uses a dynamic threshold from a noise floor and sensitivity
// - Detects peaks when slope flips while above threshold
// - Posts 'hit' and 'signal' messages to the main thread

class OnsetProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.sensitivity = typeof opts.sensitivity === 'number' ? opts.sensitivity : 1.5;
    this.debounceMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : 180;

    this.emaEnergy = 0;
    this.lastEnvelope = 0;
    this.lastSlope = 0;
    this.noiseFloor = 0.004;
    this.lastHitTimeMs = 0;
    this.lastHitEnvelope = 0;
    this.postHitDropSatisfied = true;
  }

  static get parameterDescriptors() {
    return [];
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channel = input[0];
    if (!channel || channel.length === 0) {
      return true;
    }

    // Compute frame energy (RMS)
    let sumSquares = 0;
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i];
      sumSquares += x * x;
    }
    const currentEnergy = Math.sqrt(sumSquares / channel.length);

    // Initialize on first frame
    if (this.emaEnergy === 0) {
      this.emaEnergy = currentEnergy;
      this.lastEnvelope = currentEnergy;
      this.noiseFloor = Math.max(this.noiseFloor, currentEnergy);
      this.postHitDropSatisfied = true;
    }

    const alpha = 0.92;
    this.emaEnergy = alpha * this.emaEnergy + (1 - alpha) * currentEnergy;
    const envelope = this.emaEnergy;
    const slope = envelope - this.lastEnvelope;

    const dynamicThreshold = this.noiseFloor * this.sensitivity;
    const nowMs = (currentFrame / sampleRate) * 1000;
    const refractory = nowMs - this.lastHitTimeMs < this.debounceMs;

    if (!this.postHitDropSatisfied) {
      const rearmLevel = Math.max(this.noiseFloor * 1.2, this.lastHitEnvelope * 0.4);
      if (envelope <= rearmLevel) {
        this.postHitDropSatisfied = true;
      }
    }

    const peakDetected = this.lastSlope > 0 && slope <= 0 && envelope > dynamicThreshold;
    if (!refractory && this.postHitDropSatisfied && peakDetected) {
      this.lastHitTimeMs = nowMs;
      this.lastHitEnvelope = envelope;
      this.postHitDropSatisfied = false;
      this.port.postMessage({ type: 'hit', timeMs: nowMs });
    }

    // Update last signal time whenever envelope exceeds threshold
    if (envelope > dynamicThreshold) {
      this.port.postMessage({ type: 'signal', timeMs: nowMs });
    }

    // Adapt noise floor (fast up, slow down)
    const upRate = 0.08;
    const downRate = 0.005;
    if (currentEnergy > this.noiseFloor) {
      this.noiseFloor = (1 - upRate) * this.noiseFloor + upRate * currentEnergy;
    } else {
      this.noiseFloor = (1 - downRate) * this.noiseFloor + downRate * currentEnergy;
    }

    // Pass-through silence to keep the node active
    if (output && output.length > 0 && output[0] && output[0].length > 0) {
      const outChannel = output[0];
      for (let c = 0; c < outChannel.length; c++) {
        outChannel[c] = 0;
      }
    }

    this.lastEnvelope = envelope;
    this.lastSlope = slope;
    return true;
  }
}

registerProcessor('onset-processor', OnsetProcessor);


