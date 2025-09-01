import { defaultConfig } from '../config/constants'
export class AudioPlayer {
	private readonly audioContext: AudioContext;
	private readonly gainNode: GainNode;
	private bufferSource: AudioBufferSourceNode | null = null;
	private loadedBuffer: AudioBuffer | null = null;
	private startCtxTime: number | null = null;
	private startOffsetSec: number = 0;
	private sourceCounter = 0;
	private currentSourceId: number | null = null;
	private audioEl: HTMLAudioElement | null = null;
	private mediaSourceNode: MediaElementAudioSourceNode | null = null;
	private objectUrl: string | null = null;

	constructor(audioContext: AudioContext) {
		this.audioContext = audioContext;
		this.gainNode = this.audioContext.createGain();
		this.gainNode.gain.value = defaultConfig.audio.defaultTrackVolume;
		this.gainNode.connect(this.audioContext.destination);
	}

	get output(): GainNode {
		return this.gainNode;
	}

	setVolume(volume01: number) {
		const v = Math.min(1, Math.max(0, volume01));
		this.gainNode.gain.setTargetAtTime(v, this.audioContext.currentTime, defaultConfig.audio.playerVolumeSlewSec);
	}

	setBuffer(buffer: AudioBuffer) {
		this.loadedBuffer = buffer;
		this.startOffsetSec = 0;
		this.startCtxTime = null;
	}

	setMediaFile(file: File) {
		// Clean up previous element
		if (this.audioEl) {
			try { this.audioEl.pause(); } catch {}
		}
		if (this.mediaSourceNode) {
			try { this.mediaSourceNode.disconnect(); } catch {}
			this.mediaSourceNode = null;
		}
		if (this.objectUrl) {
			try { URL.revokeObjectURL(this.objectUrl); } catch {}
			this.objectUrl = null;
		}
		this.audioEl = new Audio();
		this.audioEl.preload = 'auto';
		this.objectUrl = URL.createObjectURL(file);
		this.audioEl.src = this.objectUrl;
		this.audioEl.crossOrigin = 'anonymous';
		this.mediaSourceNode = this.audioContext.createMediaElementSource(this.audioEl);
		this.mediaSourceNode.connect(this.gainNode);
	}

	playAt(startTime: number, offsetSec: number = 0) {
		if (!this.loadedBuffer) throw new Error('No buffer loaded');
		if (this.bufferSource) {
			try { this.bufferSource.stop(); } catch {}
			this.bufferSource.disconnect();
		}
		const src = this.audioContext.createBufferSource();
		src.buffer = this.loadedBuffer;
		src.connect(this.gainNode);
		const clampedOffset = Math.max(0, Math.min(offsetSec, this.loadedBuffer.duration));
		// If startTime is extremely close, Chrome can flake; prefer scheduling slightly ahead
		if (startTime <= this.audioContext.currentTime) {
			// eslint-disable-next-line no-console
			console.log('[PLAYER] start adjusted to immediate', { startTime, currentTime: this.audioContext.currentTime, offset: clampedOffset });
			src.start(0, clampedOffset);
		} else {
			// eslint-disable-next-line no-console
			console.log('[PLAYER] schedule start', { startTime, currentTime: this.audioContext.currentTime, offset: clampedOffset });
			src.start(startTime, clampedOffset);
		}
		this.bufferSource = src;
		const id = ++this.sourceCounter;
		this.currentSourceId = id;
		this.startCtxTime = startTime;
		this.startOffsetSec = clampedOffset;
		this.bufferSource.onended = () => {
			// eslint-disable-next-line no-console
			console.log('[PLAYER] ended', { id: this.currentSourceId });
			this.bufferSource?.disconnect();
			this.bufferSource = null;
		};
	}

	playImmediate(offsetSec: number = 0) {
		if (!this.loadedBuffer) throw new Error('No buffer loaded');
		if (this.bufferSource) {
			try { this.bufferSource.stop(); } catch {}
			this.bufferSource.disconnect();
		}
		const src = this.audioContext.createBufferSource();
		src.buffer = this.loadedBuffer;
		src.connect(this.gainNode);
		const clampedOffset = Math.max(0, Math.min(offsetSec, this.loadedBuffer.duration));
		// eslint-disable-next-line no-console
		console.log('[PLAYER] immediate start', { currentTime: this.audioContext.currentTime, offset: clampedOffset });
		src.start(0, clampedOffset);
		this.bufferSource = src;
		const id = ++this.sourceCounter;
		this.currentSourceId = id;
		this.startCtxTime = this.audioContext.currentTime;
		this.startOffsetSec = clampedOffset;
		this.bufferSource.onended = () => {
			// eslint-disable-next-line no-console
			console.log('[PLAYER] ended', { id: this.currentSourceId });
			this.bufferSource?.disconnect();
			this.bufferSource = null;
		};
	}

	stop() {
		if (this.bufferSource) {
			try { this.bufferSource.stop(); } catch {}
			this.bufferSource.disconnect();
			this.bufferSource = null;
		}
		this.startCtxTime = null;
		if (this.audioEl) {
			try { this.audioEl.pause(); } catch {}
		}
	}

//

	getDurationSeconds(): number {
		if (this.audioEl && isFinite(this.audioEl.duration)) return this.audioEl.duration;
		return this.loadedBuffer?.duration ?? 0;
	}

	getPlaybackOffsetSeconds(now: number): number {
		if (this.audioEl) return this.audioEl.currentTime || 0;
		if (!this.loadedBuffer) return 0;
		if (this.startCtxTime == null) return this.startOffsetSec;
		const elapsed = Math.max(0, now - this.startCtxTime);
		return Math.min(this.startOffsetSec + elapsed, this.loadedBuffer.duration);
	}

	// MediaElement controls
	hasMedia(): boolean {
		return !!this.audioEl;
	}

	playMediaAt(offsetSec: number) {
		if (!this.audioEl) throw new Error('No media element');
		const dur = isFinite(this.audioEl.duration) ? this.audioEl.duration : undefined;
		const clamped = dur ? Math.max(0, Math.min(offsetSec, dur)) : Math.max(0, offsetSec);
		try { this.audioEl.currentTime = clamped; } catch {}
		void this.audioEl.play();
	}

	pauseMedia() {
		if (this.audioEl) {
			try { this.audioEl.pause(); } catch {}
		}
	}
}


