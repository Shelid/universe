import { BodyCategory } from '../types/astronomy';

export interface SpaceAudioFrameParams {
  dt: number;
  clockTime: number;
  mode: 'OBSERVATORY' | 'WARP' | 'SPACECRAFT';
  cameraView?: 'COCKPIT' | 'EXTERNAL';
  throttle?: number; // 0..1
  speedNorm?: number; // 0..1.5+
  boostBlend?: number; // 0..1
  isBraking?: boolean;
  rcsIntensity?: number; // 0..1
  warpProgress?: number; // 0..1
  warpStage?: string;
}

/**
 * Procedural Real-Time Web Audio Sound Engine for Universe Explorer & SR-7 Spacecraft.
 * Synthesizes multi-layered space ambience, dynamic turbine/ion propulsion, cold-gas RCS jets,
 * warp resonance, plasma pulse cannons, radar sonar sweeps, and tactile cockpit switches
 * with zero external audio assets or loading latency.
 */
class SpaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Continuous Observatory Space Ambience
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private ambientNoiseSource: AudioBufferSourceNode | null = null;

  // Continuous SR-7 Engine & Reactor Rig
  private shipMasterGain: GainNode | null = null;
  private shipPerspectiveFilter: BiquadFilterNode | null = null;
  private reactorOscLow: OscillatorNode | null = null;
  private reactorOscHarmonic: OscillatorNode | null = null;
  private reactorGain: GainNode | null = null;
  private jetNoiseSource: AudioBufferSourceNode | null = null;
  private jetFilter: BiquadFilterNode | null = null;
  private jetGain: GainNode | null = null;
  private turbineOsc: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;

  // Continuous Warp Drive Rig
  private warpMasterGain: GainNode | null = null;
  private warpOscLow: OscillatorNode | null = null;
  private warpOscHigh: OscillatorNode | null = null;
  private warpNoiseSource: AudioBufferSourceNode | null = null;
  private warpFilter: BiquadFilterNode | null = null;

  // Acoustic Space Delay Tail
  private echoDelay: DelayNode | null = null;
  private echoFilter: BiquadFilterNode | null = null;
  private echoFeedback: GainNode | null = null;
  private echoBus: GainNode | null = null;

  private muted = false;
  private masterVolume = 0.72;
  private isInitialized = false;
  private lastRcsBurstTime = 0;

  private createSoftSaturationCurve(amount = 18): Float32Array {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private ensureInitialized(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isInitialized && this.ctx) return true;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Dynamics compressor guarantees clean, warm mix even with stacked cannons + warp + engines
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4.5;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.18;

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.muted ? 0 : this.masterVolume;

      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);
      this.compressor = compressor;
      this.masterGain = masterGain;

      // Subtle Deep-Space Acoustic Echo Bus
      const echoBus = ctx.createGain();
      echoBus.gain.value = 0.3;
      const echoDelay = ctx.createDelay(0.5);
      echoDelay.delayTime.value = 0.145;
      const echoFilter = ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.value = 1150;
      const echoFeedback = ctx.createGain();
      echoFeedback.gain.value = 0.24;

      echoBus.connect(echoDelay);
      echoDelay.connect(echoFilter);
      echoFilter.connect(echoFeedback);
      echoFeedback.connect(echoDelay);
      echoFilter.connect(compressor);
      this.echoBus = echoBus;
      this.echoDelay = echoDelay;
      this.echoFilter = echoFilter;
      this.echoFeedback = echoFeedback;

      // Generate 3-second seamless pink/brown cosmic noise buffer
      const bufferLen = ctx.sampleRate * 3;
      const noiseBuf = ctx.createBuffer(2, bufferLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = noiseBuf.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferLen; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
          b6 = white * 0.115926;
          data[i] = Math.max(-1, Math.min(1, pink));
        }
      }
      this.noiseBuffer = noiseBuf;

      // 1. Deep Cosmic Space Ambience Rig
      const ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.14;
      const ambientFilter = ctx.createBiquadFilter();
      ambientFilter.type = 'lowpass';
      ambientFilter.frequency.value = 210;
      ambientFilter.Q.value = 1.4;

      const droneOscA = ctx.createOscillator();
      droneOscA.type = 'sine';
      droneOscA.frequency.value = 44.0;
      const droneGainA = ctx.createGain();
      droneGainA.gain.value = 0.28;
      droneOscA.connect(droneGainA);
      droneGainA.connect(ambientFilter);

      const droneOscB = ctx.createOscillator();
      droneOscB.type = 'triangle';
      droneOscB.frequency.value = 66.25;
      const droneGainB = ctx.createGain();
      droneGainB.gain.value = 0.09;
      droneOscB.connect(droneGainB);
      droneGainB.connect(ambientFilter);

      const ambientNoiseSource = ctx.createBufferSource();
      ambientNoiseSource.buffer = noiseBuf;
      ambientNoiseSource.loop = true;
      const ambNoiseGain = ctx.createGain();
      ambNoiseGain.gain.value = 0.42;
      ambientNoiseSource.connect(ambNoiseGain);
      ambNoiseGain.connect(ambientFilter);

      ambientFilter.connect(ambientGain);
      ambientGain.connect(compressor);

      droneOscA.start();
      droneOscB.start();
      ambientNoiseSource.start();
      this.ambientGain = ambientGain;
      this.ambientFilter = ambientFilter;
      this.droneOscA = droneOscA;
      this.droneOscB = droneOscB;
      this.ambientNoiseSource = ambientNoiseSource;

      // 2. Dynamic SR-7 Fusion Reactor & Ion Thruster Rig
      const shipMasterGain = ctx.createGain();
      shipMasterGain.gain.value = 0.0;
      const shipPerspectiveFilter = ctx.createBiquadFilter();
      shipPerspectiveFilter.type = 'lowpass';
      shipPerspectiveFilter.frequency.value = 2600;
      shipPerspectiveFilter.Q.value = 0.65;

      // Warm sub-harmonic core with subtle overdrive curve
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.createSoftSaturationCurve(14);
      shaper.oversample = '2x';

      const reactorOscLow = ctx.createOscillator();
      reactorOscLow.type = 'sawtooth';
      reactorOscLow.frequency.value = 52;
      const reactorOscHarmonic = ctx.createOscillator();
      reactorOscHarmonic.type = 'triangle';
      reactorOscHarmonic.frequency.value = 104.5;

      const reactorLP = ctx.createBiquadFilter();
      reactorLP.type = 'lowpass';
      reactorLP.frequency.value = 180;
      reactorLP.Q.value = 2.1;

      const reactorGain = ctx.createGain();
      reactorGain.gain.value = 0.25;

      reactorOscLow.connect(reactorLP);
      reactorOscHarmonic.connect(reactorLP);
      reactorLP.connect(shaper);
      shaper.connect(reactorGain);
      reactorGain.connect(shipPerspectiveFilter);

      // Turbulent Plasma Jet Roar
      const jetNoiseSource = ctx.createBufferSource();
      jetNoiseSource.buffer = noiseBuf;
      jetNoiseSource.loop = true;
      const jetFilter = ctx.createBiquadFilter();
      jetFilter.type = 'bandpass';
      jetFilter.frequency.value = 260;
      jetFilter.Q.value = 0.85;
      const jetGain = ctx.createGain();
      jetGain.gain.value = 0.16;

      jetNoiseSource.connect(jetFilter);
      jetFilter.connect(jetGain);
      jetGain.connect(shipPerspectiveFilter);

      // Ion Turbine Spool Whine (Smooth crystalline harmonic)
      const turbineOsc = ctx.createOscillator();
      turbineOsc.type = 'sine';
      turbineOsc.frequency.value = 190;
      const turbineGain = ctx.createGain();
      turbineGain.gain.value = 0.02;
      turbineOsc.connect(turbineGain);
      turbineGain.connect(shipPerspectiveFilter);

      shipPerspectiveFilter.connect(shipMasterGain);
      shipMasterGain.connect(compressor);

      reactorOscLow.start();
      reactorOscHarmonic.start();
      jetNoiseSource.start();
      turbineOsc.start();

      this.shipMasterGain = shipMasterGain;
      this.shipPerspectiveFilter = shipPerspectiveFilter;
      this.reactorOscLow = reactorOscLow;
      this.reactorOscHarmonic = reactorOscHarmonic;
      this.reactorGain = reactorGain;
      this.jetNoiseSource = jetNoiseSource;
      this.jetFilter = jetFilter;
      this.jetGain = jetGain;
      this.turbineOsc = turbineOsc;
      this.turbineGain = turbineGain;

      // 3. Interplanetary Warp Drive Tunnel Rig
      const warpMasterGain = ctx.createGain();
      warpMasterGain.gain.value = 0.0;
      const warpFilter = ctx.createBiquadFilter();
      warpFilter.type = 'bandpass';
      warpFilter.frequency.value = 340;
      warpFilter.Q.value = 1.6;

      const warpOscLow = ctx.createOscillator();
      warpOscLow.type = 'sawtooth';
      warpOscLow.frequency.value = 74;
      const warpOscHigh = ctx.createOscillator();
      warpOscHigh.type = 'sine';
      warpOscHigh.frequency.value = 222;
      const warpNoiseSource = ctx.createBufferSource();
      warpNoiseSource.buffer = noiseBuf;
      warpNoiseSource.loop = true;

      const warpOscMix = ctx.createGain();
      warpOscMix.gain.value = 0.22;
      const warpNoiseMix = ctx.createGain();
      warpNoiseMix.gain.value = 0.55;

      warpOscLow.connect(warpOscMix);
      warpOscHigh.connect(warpOscMix);
      warpOscMix.connect(warpFilter);
      warpNoiseSource.connect(warpNoiseMix);
      warpNoiseMix.connect(warpFilter);

      warpFilter.connect(warpMasterGain);
      warpMasterGain.connect(compressor);
      warpMasterGain.connect(echoBus);

      warpOscLow.start();
      warpOscHigh.start();
      warpNoiseSource.start();

      this.warpMasterGain = warpMasterGain;
      this.warpOscLow = warpOscLow;
      this.warpOscHigh = warpOscHigh;
      this.warpNoiseSource = warpNoiseSource;
      this.warpFilter = warpFilter;

      this.isInitialized = true;
      return true;
    } catch {
      return false;
    }
  }

  public unlock(): void {
    if (!this.ensureInitialized() || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.04);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Smooth per-frame telemetry modulation for space ambience, engine plumes, RCS jets & warp tunnel.
   */
  public updateFrame(params: SpaceAudioFrameParams): void {
    if (!this.isInitialized || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Subtle organic slow sweep on deep cosmic pad
    if (this.ambientFilter && this.ambientGain) {
      const slowBreath = 180 + Math.sin(params.clockTime * 0.25) * 45;
      this.ambientFilter.frequency.setTargetAtTime(slowBreath, now, 0.15);
      const ambLevel = params.mode === 'OBSERVATORY' ? 0.22 : params.mode === 'SPACECRAFT' ? 0.11 : 0.06;
      this.ambientGain.gain.setTargetAtTime(ambLevel, now, 0.18);
    }

    // Spacecraft engine & ion turbine modulation
    if (
      this.shipMasterGain &&
      this.shipPerspectiveFilter &&
      this.reactorOscLow &&
      this.reactorOscHarmonic &&
      this.reactorGain &&
      this.jetFilter &&
      this.jetGain &&
      this.turbineOsc &&
      this.turbineGain
    ) {
      if (params.mode === 'SPACECRAFT') {
        const thr = Math.min(1.2, Math.max(0, params.throttle || 0));
        const spd = Math.min(1.5, Math.max(0, params.speedNorm || 0));
        const boost = Math.min(1, Math.max(0, params.boostBlend || 0));
        const energy = Math.min(1.2, Math.max(thr, spd * 0.72));

        // Perspective acoustics: muffled warm insulation inside cockpit vs wide thruster roar in 3rd-person
        const perspFreq = params.cameraView === 'COCKPIT' ? 920 + boost * 650 : 3400 + boost * 1600;
        const perspGain = params.cameraView === 'COCKPIT' ? 0.34 : 0.48;
        this.shipMasterGain.gain.setTargetAtTime(perspGain, now, 0.09);
        this.shipPerspectiveFilter.frequency.setTargetAtTime(perspFreq, now, 0.09);

        // Deep fusion core pitch rises smoothly with engine burn
        const baseHz = 44 + energy * 34 + boost * 28;
        this.reactorOscLow.frequency.setTargetAtTime(baseHz, now, 0.08);
        this.reactorOscHarmonic.frequency.setTargetAtTime(baseHz * 2.01, now, 0.08);
        this.reactorGain.gain.setTargetAtTime(0.14 + energy * 0.22 + boost * 0.12, now, 0.08);

        // Plasma exhaust noise wash
        const jetFreq = 160 + energy * 950 + boost * 1350;
        this.jetFilter.frequency.setTargetAtTime(jetFreq, now, 0.08);
        this.jetGain.gain.setTargetAtTime(0.08 + energy * 0.34 + boost * 0.24, now, 0.08);

        // Ion turbine crystal spool whine
        const turbHz = 165 + energy * 240 + boost * 260;
        this.turbineOsc.frequency.setTargetAtTime(turbHz, now, 0.09);
        this.turbineGain.gain.setTargetAtTime(0.012 + energy * 0.045 + boost * 0.065, now, 0.09);

        // Cold-gas Reaction Control System (RCS) micro-thruster bursts when maneuvering!
        const rcs = params.rcsIntensity || 0;
        if (rcs > 0.16 && now - this.lastRcsBurstTime > 0.14) {
          this.lastRcsBurstTime = now;
          this.triggerRcsPuff(Math.min(1, rcs), params.cameraView === 'COCKPIT');
        }
      } else {
        this.shipMasterGain.gain.setTargetAtTime(0, now, 0.12);
      }
    }

    // Interplanetary Warp Tunnel Acoustic Sweep
    if (this.warpMasterGain && this.warpOscLow && this.warpOscHigh && this.warpFilter) {
      if (params.mode === 'WARP') {
        const p = Math.min(1, Math.max(0, params.warpProgress || 0));
        const bell = Math.sin(p * Math.PI);
        this.warpMasterGain.gain.setTargetAtTime(0.15 + bell * 0.45, now, 0.07);
        this.warpOscLow.frequency.setTargetAtTime(58 + bell * 82, now, 0.08);
        this.warpOscHigh.frequency.setTargetAtTime(175 + bell * 420, now, 0.08);
        this.warpFilter.frequency.setTargetAtTime(220 + bell * 1650, now, 0.08);
      } else {
        this.warpMasterGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  private triggerRcsPuff(intensity: number, isCockpit: boolean): void {
    if (!this.ctx || !this.noiseBuffer || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1.2 + Math.random() * 0.45;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isCockpit ? 640 + Math.random() * 180 : 1080 + Math.random() * 320, now);
    bp.Q.value = 1.6;

    const gain = this.ctx.createGain();
    const peak = (isCockpit ? 0.055 : 0.095) * intensity;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.compressor);

    src.start(now, Math.random() * 1.5, 0.13);
  }

  public playShipStartup(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Fusion Turbine Spool-up Sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(38, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.95);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(140, now);
    lp.frequency.exponentialRampToValueAtTime(1400, now + 0.9);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    osc.connect(lp);
    lp.connect(g);
    g.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 1.3);

    // 2. Pneumatic Hydraulic Air Release
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const nBp = this.ctx.createBiquadFilter();
    nBp.type = 'bandpass';
    nBp.frequency.setValueAtTime(1800, now + 0.05);
    nBp.frequency.exponentialRampToValueAtTime(620, now + 0.55);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.11, now + 0.06);
    nGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.62);
    nSrc.connect(nBp);
    nBp.connect(nGain);
    nGain.connect(this.compressor);
    nSrc.start(now, 0, 0.65);

    // 3. Soft Ascending Avionics Chime
    [523.25, 783.99].forEach((freq, idx) => {
      if (!this.ctx || !this.compressor) return;
      const t0 = now + 0.28 + idx * 0.12;
      const bell = this.ctx.createOscillator();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq, t0);
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.001, t0);
      bGain.gain.linearRampToValueAtTime(0.065, t0 + 0.015);
      bGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.45);
      bell.connect(bGain);
      bGain.connect(this.compressor);
      if (this.echoBus) bGain.connect(this.echoBus);
      bell.start(t0);
      bell.stop(t0 + 0.48);
    });
  }

  public playShipShutdown(): void {
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.75);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.78);

    osc.connect(g);
    g.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  public playBrakeRetro(): void {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(980, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + 0.48);
    lp.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.compressor);
    src.start(now, 0.2, 0.55);

    // Sub impact thump
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.32);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.2, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    sub.connect(subG);
    subG.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 0.36);
  }

  public playPlasmaPulse(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Punchy Sci-Fi Plasma Core Sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.19);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.22);
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    if (this.echoBus) gain.connect(this.echoBus);
    osc.start(now);
    osc.stop(now + 0.26);

    // 2. High-energy Plasma Arc Crack
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const nHp = this.ctx.createBiquadFilter();
    nHp.type = 'bandpass';
    nHp.frequency.setValueAtTime(2200, now);
    nHp.Q.value = 1.1;
    const nG = this.ctx.createGain();
    nG.gain.setValueAtTime(0.15, now);
    nG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    nSrc.connect(nHp);
    nHp.connect(nG);
    nG.connect(this.compressor);
    nSrc.start(now, Math.random(), 0.14);
  }

  public playRadarScan(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    [
      { delay: 0, freq: 920, vol: 0.11 },
      { delay: 0.26, freq: 1380, vol: 0.06 },
      { delay: 0.56, freq: 920, vol: 0.03 },
    ].forEach(({ delay, freq, vol }) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + delay;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + 0.35);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.42);

      osc.connect(g);
      g.connect(this.compressor);
      if (this.echoBus) g.connect(this.echoBus);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playCameraSwitch(toView: 'COCKPIT' | 'EXTERNAL'): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(toView === 'COCKPIT' ? 1400 : 480, now);
    bp.frequency.exponentialRampToValueAtTime(toView === 'COCKPIT' ? 320 : 1200, now + 0.18);
    bp.Q.value = 1.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(now, 0.3, 0.22);
  }

  public playCockpitSwitch(active = true): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(active ? 640 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(active ? 860 : 300, now + 0.045);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(g);
    g.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playAutopilotLock(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    [493.88, 739.99].forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
      osc.connect(g);
      g.connect(this.compressor);
      if (this.echoBus) g.connect(this.echoBus);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playAutopilotArrived(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + i * 0.095;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
      osc.connect(g);
      g.connect(this.compressor);
      if (this.echoBus) g.connect(this.echoBus);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  public playSelectBody(category: BodyCategory): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const baseFreq =
      category === 'galaxy' ? 293.66 : category === 'star' ? 392.0 : 440.0;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.06, now + 0.14);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);

    osc.connect(g);
    g.connect(this.compressor);
    if (this.echoBus) g.connect(this.echoBus);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playWarpEngage(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(42, now);
    sub.frequency.exponentialRampToValueAtTime(240, now + 0.85);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, now);
    lp.frequency.exponentialRampToValueAtTime(2400, now + 0.8);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    sub.connect(lp);
    lp.connect(g);
    g.connect(this.compressor);
    if (this.echoBus) g.connect(this.echoBus);
    sub.start(now);
    sub.stop(now + 0.98);
  }

  public playWarpArrival(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Deep Sub-Bass Gravity Drop
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(86, now);
    boom.frequency.exponentialRampToValueAtTime(26, now + 0.72);
    const bGain = this.ctx.createGain();
    bGain.gain.setValueAtTime(0.32, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
    boom.connect(bGain);
    bGain.connect(this.compressor);
    boom.start(now);
    boom.stop(now + 0.8);

    // Wash Shockwave Release
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, now);
    lp.frequency.exponentialRampToValueAtTime(150, now + 0.65);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    nSrc.connect(lp);
    lp.connect(nGain);
    nGain.connect(this.compressor);
    if (this.echoBus) nGain.connect(this.echoBus);
    nSrc.start(now, 0.1, 0.7);
  }

  public dispose(): void {
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
      this.ambientNoiseSource?.stop();
      this.reactorOscLow?.stop();
      this.reactorOscHarmonic?.stop();
      this.jetNoiseSource?.stop();
      this.turbineOsc?.stop();
      this.warpOscLow?.stop();
      this.warpOscHigh?.stop();
      this.warpNoiseSource?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
      }
    } catch {
      // Ignore already stopped oscillators
    }
    this.isInitialized = false;
  }
}

export const spaceAudio = new SpaceAudioEngine();
