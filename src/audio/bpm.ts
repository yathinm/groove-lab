/* eslint-disable @typescript-eslint/no-explicit-any */
// Ensure Vite copies the WASM asset and gives us a URL
// @ts-expect-error Vite url query import for asset
import wasmUrl from 'essentia.js/dist/essentia-wasm.web.wasm?url';

export async function detectBpmFromAudioBuffer(audioBuffer: AudioBuffer): Promise<number> {
	// Use browser-friendly ESM builds
	const wasmFactoryMod = await import('essentia.js/dist/essentia-wasm.web.js');
	const coreMod = await import('essentia.js/dist/essentia.js-core.es.js');
	const wasmFactory: (config?: any) => Promise<any> = (wasmFactoryMod as any).default ?? (wasmFactoryMod as any).EssentiaWASM;
	const EssentiaCtor: new (mod: any) => any = (coreMod as any).Essentia ?? (coreMod as any).default;
	if (typeof wasmFactory !== 'function' || typeof EssentiaCtor !== 'function') {
		throw new Error('Failed to initialize Essentia.js (browser builds not found)');
	}
	const wasm = await wasmFactory({
		locateFile: () => wasmUrl,
	});
	const essentia: any = new EssentiaCtor(wasm);

	// Downmix entire buffer to mono (no max duration; we'll process in windows)
	const numChannels = audioBuffer.numberOfChannels;
	const sr = audioBuffer.sampleRate;
	const totalLen = audioBuffer.length;
	const mono = new Float32Array(totalLen);
	for (let ch = 0; ch < numChannels; ch++) {
		const channelData = audioBuffer.getChannelData(ch);
		for (let i = 0; i < totalLen; i++) {
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

	// Segment the audio and estimate BPM per-window to support arbitrary length without huge allocations
	const windowSeconds = 8;
	const hopSeconds = 4;
	const windowSize = Math.max(15, windowSeconds) * sr; // min 15s
	const hopSize = Math.max(5, hopSeconds) * sr;
	const bpms: number[] = [];
	const confidences: number[] = [];

	for (let start = 0; start < mono.length; start += hopSize) {
		const end = Math.min(mono.length, start + windowSize);
		if (end - start < 10 * sr) continue; // skip too-short tail
		let segmentVec = essentia.arrayToVector(mono.subarray(start, end));
		// Keep original sample rate for RhythmExtractor; we'll resample only if 2013 fallback is needed
		let segmentSr = sr;

		if (typeof essentia.RhythmExtractor2013 !== 'function') {
			segmentVec.delete?.();
			throw new Error('Essentia RhythmExtractor2013 is unavailable');
		}
		try {
			// 1) Prefer RhythmExtractor with explicit sampleRate (avoids internal assumptions)
			const re1 = essentia.RhythmExtractor(
				segmentVec,
				1024, // frameHop
				1024, // frameSize
				256,  // hopSize
				0.1,  // lastBeatInterval
				208,  // maxTempo
				40,   // minTempo
				1024, // numberFrames
				segmentSr, // sampleRate
				[],   // tempoHints
				0.24, // tolerance
				true, // useBands
				true  // useOnset
			);
			let bpmVal = Number((re1 && (re1.bpm ?? re1.tempo ?? re1.estimated_bpm)) || NaN);
			try { (re1 as any).ticks?.delete?.(); } catch {}
			try { (re1 as any).estimates?.delete?.(); } catch {}
			try { (re1 as any).bpmIntervals?.delete?.(); } catch {}
			if (!Number.isFinite(bpmVal) || bpmVal <= 0) {
				// 2) Fallback to 2013 'degara' (resample to 44.1k first)
				if (segmentSr !== 44100) {
					const resampled = essentia.Resample(segmentVec, segmentSr, 44100, 1);
					segmentVec.delete?.();
					segmentVec = resampled.signal;
					segmentSr = 44100;
				}
				const re2 = essentia.RhythmExtractor2013(segmentVec, 208, 'degara', 40);
				bpmVal = Number((re2 && (re2.bpm ?? re2.tempo ?? re2.estimated_bpm)) || NaN);
				try { (re2 as any).ticks?.delete?.(); } catch {}
				try { (re2 as any).estimates?.delete?.(); } catch {}
				try { (re2 as any).bpmIntervals?.delete?.(); } catch {}
			}
			if (Number.isFinite(bpmVal) && bpmVal > 0) {
				bpms.push(bpmVal);
				confidences.push(1);
			}
		} catch (err) {
			// eslint-disable-next-line no-console
			console.warn('[BPM] window failed', { startSamples: start, endSamples: end, durationSec: (end - start) / sr }, err);
		} finally {
			segmentVec.delete?.();
		}
	}

	if (bpms.length === 0) throw new Error('BPM detection failed');

	// Weighted median by confidence
	const indices = bpms.map((_, i) => i).sort((a, b) => bpms[a] - bpms[b]);
	const totalWeight = confidences.reduce((a, b) => a + (b > 0 ? b : 1), 0);
	let acc = 0;
	for (const idx of indices) {
		const w = confidences[idx] > 0 ? confidences[idx] : 1;
		acc += w;
		if (acc >= totalWeight / 2) return Math.round(bpms[idx]);
	}
	return Math.round(bpms[indices[Math.floor(indices.length / 2)]]);
}


