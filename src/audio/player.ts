export class AudioPlayer {
	private readonly audioContext: AudioContext;
	private readonly gainNode: GainNode;
	private bufferSource: AudioBufferSourceNode | null = null;
	private loadedBuffer: AudioBuffer | null = null;

	constructor(audioContext: AudioContext) {
		this.audioContext = audioContext;
		this.gainNode = this.audioContext.createGain();
		this.gainNode.gain.value = 0.9;
		this.gainNode.connect(this.audioContext.destination);
	}

	get output(): GainNode {
		return this.gainNode;
	}

	setVolume(volume01: number) {
		const v = Math.min(1, Math.max(0, volume01));
		this.gainNode.gain.setTargetAtTime(v, this.audioContext.currentTime, 0.01);
	}

	setBuffer(buffer: AudioBuffer) {
		this.loadedBuffer = buffer;
	}

	playAt(startTime: number) {
		if (!this.loadedBuffer) throw new Error('No buffer loaded');
		if (this.bufferSource) {
			try { this.bufferSource.stop(); } catch {}
			this.bufferSource.disconnect();
		}
		const src = this.audioContext.createBufferSource();
		src.buffer = this.loadedBuffer;
		src.connect(this.gainNode);
		src.start(startTime);
		this.bufferSource = src;
		this.bufferSource.onended = () => {
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
	}
}


