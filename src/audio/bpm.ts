/* eslint-disable @typescript-eslint/no-explicit-any */
export async function detectBpmFromAudioBuffer(audioBuffer: AudioBuffer): Promise<number> {
	// Lazy-load Essentia.js to keep initial bundle small and ensure WASM initializes after user gesture
	const { Essentia, EssentiaWASM } = await import('essentia.js');
	// Some builds expose EssentiaWASM as a factory; support both usages
	const wasmModule: any = typeof (EssentiaWASM as unknown as () => Promise<any>) === 'function'
		? await (EssentiaWASM as unknown as () => Promise<any>)()
		: (EssentiaWASM as unknown as any);
	const essentia: any = new (Essentia as unknown as new (mod: any) => any)(wasmModule);

	// Downmix to mono
	const numChannels = audioBuffer.numberOfChannels;
	const length = audioBuffer.length;
	const mono = new Float32Array(length);
	for (let ch = 0; ch < numChannels; ch++) {
		const channelData = audioBuffer.getChannelData(ch);
		for (let i = 0; i < length; i++) {
			mono[i] += channelData[i] / numChannels;
		}
	}

	// Optional: normalize to avoid clipping impacting detectors
	let maxAbs = 0;
	for (let i = 0; i < mono.length; i++) {
		const v = Math.abs(mono[i]);
		if (v > maxAbs) maxAbs = v;
	}
	if (maxAbs > 0) {
		const inv = 1 / maxAbs;
		for (let i = 0; i < mono.length; i++) mono[i] *= inv;
	}

	const sr = audioBuffer.sampleRate;

	// Convert to Essentia vector
	const vec = essentia.arrayToVector(mono);

	// Try RhythmExtractor2013 first; if unavailable, fall back to MusicExtractor
	let bpm: number | undefined;
	try {
		if (typeof essentia.RhythmExtractor2013 === 'function') {
			const res = essentia.RhythmExtractor2013(vec, sr);
			// Most builds expose bpm under `bpm`
			bpm = Number((res && (res.bpm ?? res.tempo ?? res.estimated_bpm)) || NaN);
		}
	} catch {
		// fall through to MusicExtractor
	}
	if (!bpm || Number.isNaN(bpm)) {
		try {
			if (typeof essentia.MusicExtractor === 'function') {
				const res = essentia.MusicExtractor(vec, sr);
				bpm = Number((res && (res.bpm ?? res.tempo ?? res.estimated_bpm)) || NaN);
			}
		} catch {
			// ignore
		}
	}

	if (!bpm || !Number.isFinite(bpm)) {
		throw new Error('BPM detection failed');
	}
	return bpm;
}


