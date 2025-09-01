import { defaultConfig } from '../config/constants'
export class Metronome {
	private readonly audioContext: AudioContext;
	private readonly gainNode: GainNode;
	private isRunning = false;
	private bpm = 120;
	private lookaheadTimer: number | null = null; // setInterval id
	private nextClickTime = 0;
	private readonly scheduleAheadTime = defaultConfig.metronome.scheduleAheadTimeSec; // seconds to schedule ahead
	private readonly lookaheadMs = defaultConfig.metronome.lookaheadMs; // scheduler tick

	constructor(audioContext: AudioContext) {
		this.audioContext = audioContext;
		this.gainNode = this.audioContext.createGain();
		this.gainNode.gain.value = defaultConfig.audio.defaultMetronomeVolume;
		this.gainNode.connect(this.audioContext.destination);
	}

	get output(): GainNode {
		return this.gainNode;
	}

	setVolume(volume01: number) {
		const v = Math.min(1, Math.max(0, volume01));
		this.gainNode.gain.setTargetAtTime(v, this.audioContext.currentTime, defaultConfig.audio.playerVolumeSlewSec);
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
		osc.frequency.value = defaultConfig.metronome.oscillatorFrequencyHz;
		gain.gain.setValueAtTime(0.0001, time);
		gain.gain.exponentialRampToValueAtTime(1.0, time + defaultConfig.metronome.clickAttackSec);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + defaultConfig.metronome.clickDecaySec);
		osc.connect(gain);
		gain.connect(this.gainNode);
		osc.start(time);
		osc.stop(time + defaultConfig.metronome.clickDurationSec);
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


