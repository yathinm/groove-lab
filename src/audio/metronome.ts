export class Metronome {
	private readonly audioContext: AudioContext;
	private readonly gainNode: GainNode;
	private isRunning = false;
	private bpm = 120;
	private lookaheadTimer: number | null = null; // setInterval id
	private nextClickTime = 0;
	private readonly scheduleAheadTime = 0.1; // seconds to schedule ahead
	private readonly lookaheadMs = 25; // scheduler tick

	constructor(audioContext: AudioContext) {
		this.audioContext = audioContext;
		this.gainNode = this.audioContext.createGain();
		this.gainNode.gain.value = 0.7;
		this.gainNode.connect(this.audioContext.destination);
	}

	get output(): GainNode {
		return this.gainNode;
	}

	setVolume(volume01: number) {
		const v = Math.min(1, Math.max(0, volume01));
		this.gainNode.gain.setTargetAtTime(v, this.audioContext.currentTime, 0.01);
	}

	setBpm(bpm: number) {
		if (bpm > 0 && Number.isFinite(bpm)) this.bpm = bpm;
	}

	startAt(startTime: number) {
		if (this.isRunning) this.stop();
		this.isRunning = true;
		this.nextClickTime = startTime;
		this.schedulerTick();
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		this.lookaheadTimer = setInterval(() => this.schedulerTick(), this.lookaheadMs) as unknown as number;
	}

	private schedulerTick() {
		if (!this.isRunning) return;
		const secondsPerBeat = 60 / this.bpm;
		while (this.nextClickTime < this.audioContext.currentTime + this.scheduleAheadTime) {
			this.scheduleClick(this.nextClickTime);
			this.nextClickTime += secondsPerBeat;
		}
	}

	private scheduleClick(time: number) {
		const osc = this.audioContext.createOscillator();
		const gain = this.audioContext.createGain();
		osc.type = 'square';
		osc.frequency.value = 1000;
		gain.gain.setValueAtTime(0.0001, time);
		gain.gain.exponentialRampToValueAtTime(1.0, time + 0.001);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
		osc.connect(gain);
		gain.connect(this.gainNode);
		osc.start(time);
		osc.stop(time + 0.06);
		osc.onended = () => {
			osc.disconnect();
			gain.disconnect();
		};
	}

	stop() {
		if (this.lookaheadTimer !== null) {
			clearInterval(this.lookaheadTimer);
			this.lookaheadTimer = null;
		}
		this.isRunning = false;
	}
}


