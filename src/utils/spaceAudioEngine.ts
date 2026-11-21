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
  miningIntensity?: number; // 0..1
  miningDrilling?: boolean;
  miningHotspotMult?: number;
}

/**
 * Procedural Real-Time Web Audio Sound Engine for Universe Explorer & SR-7 Spacecraft.
 * Synthesizes multi-layered space ambience, dynamic turbine/ion propulsion, cold-gas RCS jets,
 * warp resonance, plasma pulse cannons, radar sonar sweeps, orbital mining extractor laser,
 * and tactile cockpit switches with zero external audio assets or loading latency.
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
  private engineSubOsc: OscillatorNode | null = null;
  private engineSubGain: GainNode | null = null;
  private reactorOscLow: OscillatorNode | null = null;
  private reactorOscHarmonic: OscillatorNode | null = null;
  private reactorFilter: BiquadFilterNode | null = null;
  private reactorGain: GainNode | null = null;
  private jetNoiseSource: AudioBufferSourceNode | null = null;
  private jetLowFilter: BiquadFilterNode | null = null;
  private jetLowGain: GainNode | null = null;
  private jetFilter: BiquadFilterNode | null = null;
  private jetGain: GainNode | null = null;
  private jetFlutterLfo: OscillatorNode | null = null;
  private jetFlutterGain: GainNode | null = null;
  private turbineOsc: OscillatorNode | null = null;
  private turbineOscHigh: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;
  private brakeNoiseFilter: BiquadFilterNode | null = null;
  private brakeNoiseGain: GainNode | null = null;

  // Continuous Warp Drive Rig
  private warpMasterGain: GainNode | null = null;
  private warpOscLow: OscillatorNode | null = null;
  private warpOscHigh: OscillatorNode | null = null;
  private warpNoiseSource: AudioBufferSourceNode | null = null;
  private warpFilter: BiquadFilterNode | null = null;

  // Continuous Orbital Mining Laser Rig
  private miningMasterGain: GainNode | null = null;
  private miningFilter: BiquadFilterNode | null = null;
  private miningSubOsc: OscillatorNode | null = null;
  private miningOscLow: OscillatorNode | null = null;
  private miningOscMid: OscillatorNode | null = null;
  private miningLfoOsc: OscillatorNode | null = null;
  private miningLfoGain: GainNode | null = null;
  private miningNoiseSource: AudioBufferSourceNode | null = null;
  private miningSizzleFilter: BiquadFilterNode | null = null;
  private miningSizzleGain: GainNode | null = null;
  private lastMiningCrackleTime = 0;

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
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
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

      // 2. Dynamic SR-7 Twin Fusion Turbine & Rocket Afterburner Rig
      const shipMasterGain = ctx.createGain();
      shipMasterGain.gain.value = 0.0;
      const shipPerspectiveFilter = ctx.createBiquadFilter();
      shipPerspectiveFilter.type = 'lowpass';
      shipPerspectiveFilter.frequency.value = 3200;
      shipPerspectiveFilter.Q.value = 0.7;

      // Dedicated Chest-Thumping Sub-Bass Thrust Core (bypasses aggressive band filters)
      const engineSubOsc = ctx.createOscillator();
      engineSubOsc.type = 'sine';
      engineSubOsc.frequency.value = 40;
      const engineSubGain = ctx.createGain();
      engineSubGain.gain.value = 0.18;
      engineSubOsc.connect(engineSubGain);
      engineSubGain.connect(shipPerspectiveFilter);

      // Warm sub-harmonic core with saturation overdrive growl
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.createSoftSaturationCurve(22);
      shaper.oversample = '2x';

      const reactorOscLow = ctx.createOscillator();
      reactorOscLow.type = 'sawtooth';
      reactorOscLow.frequency.value = 54;
      const reactorOscHarmonic = ctx.createOscillator();
      reactorOscHarmonic.type = 'sawtooth';
      reactorOscHarmonic.frequency.value = 81.4; // Powerful fifth growl

      const reactorLP = ctx.createBiquadFilter();
      reactorLP.type = 'lowpass';
      reactorLP.frequency.value = 220;
      reactorLP.Q.value = 1.9;

      const reactorGain = ctx.createGain();
      reactorGain.gain.value = 0.22;

      reactorOscLow.connect(reactorLP);
      reactorOscHarmonic.connect(reactorLP);
      reactorLP.connect(shaper);
      shaper.connect(reactorGain);
      reactorGain.connect(shipPerspectiveFilter);

      // Dual-Band Turbulent Rocket Combustion + Afterburner Jet Wash + LFO Flutter
      const jetNoiseSource = ctx.createBufferSource();
      jetNoiseSource.buffer = noiseBuf;
      jetNoiseSource.loop = true;

      // Low combustion chamber thunder
      const jetLowFilter = ctx.createBiquadFilter();
      jetLowFilter.type = 'lowpass';
      jetLowFilter.frequency.value = 260;
      jetLowFilter.Q.value = 1.1;
      const jetLowGain = ctx.createGain();
      jetLowGain.gain.value = 0.24;

      // High-velocity plasma exhaust whoosh
      const jetFilter = ctx.createBiquadFilter();
      jetFilter.type = 'bandpass';
      jetFilter.frequency.value = 460;
      jetFilter.Q.value = 0.72;
      const jetGain = ctx.createGain();
      jetGain.gain.value = 0.18;

      // Retro-braking forward exhaust hiss
      const brakeNoiseFilter = ctx.createBiquadFilter();
      brakeNoiseFilter.type = 'bandpass';
      brakeNoiseFilter.frequency.value = 780;
      brakeNoiseFilter.Q.value = 1.25;
      const brakeNoiseGain = ctx.createGain();
      brakeNoiseGain.gain.value = 0;

      // Organic 21Hz combustion pressure flutter modulating low-jet cutoff & roar
      const jetFlutterLfo = ctx.createOscillator();
      jetFlutterLfo.type = 'triangle';
      jetFlutterLfo.frequency.value = 21;
      const jetFlutterGain = ctx.createGain();
      jetFlutterGain.gain.value = 55;
      jetFlutterLfo.connect(jetFlutterGain);
      jetFlutterGain.connect(jetLowFilter.frequency);

      jetNoiseSource.connect(jetLowFilter);
      jetLowFilter.connect(jetLowGain);
      jetLowGain.connect(shipPerspectiveFilter);

      jetNoiseSource.connect(jetFilter);
      jetFilter.connect(jetGain);
      jetGain.connect(shipPerspectiveFilter);

      jetNoiseSource.connect(brakeNoiseFilter);
      brakeNoiseFilter.connect(brakeNoiseGain);
      brakeNoiseGain.connect(shipPerspectiveFilter);

      // Twin Ion Turbine Spool Whine (Smooth dual-spool harmonic)
      const turbineOsc = ctx.createOscillator();
      turbineOsc.type = 'triangle';
      turbineOsc.frequency.value = 180;
      const turbineOscHigh = ctx.createOscillator();
      turbineOscHigh.type = 'sine';
      turbineOscHigh.frequency.value = 360;
      const turbineHighMix = ctx.createGain();
      turbineHighMix.gain.value = 0.35;
      const turbineGain = ctx.createGain();
      turbineGain.gain.value = 0.025;
      turbineOsc.connect(turbineGain);
      turbineOscHigh.connect(turbineHighMix);
      turbineHighMix.connect(turbineGain);
      turbineGain.connect(shipPerspectiveFilter);

      shipPerspectiveFilter.connect(shipMasterGain);
      shipMasterGain.connect(compressor);

      engineSubOsc.start();
      reactorOscLow.start();
      reactorOscHarmonic.start();
      jetNoiseSource.start();
      jetFlutterLfo.start();
      turbineOsc.start();
      turbineOscHigh.start();

      this.shipMasterGain = shipMasterGain;
      this.shipPerspectiveFilter = shipPerspectiveFilter;
      this.engineSubOsc = engineSubOsc;
      this.engineSubGain = engineSubGain;
      this.reactorOscLow = reactorOscLow;
      this.reactorOscHarmonic = reactorOscHarmonic;
      this.reactorFilter = reactorLP;
      this.reactorGain = reactorGain;
      this.jetNoiseSource = jetNoiseSource;
      this.jetLowFilter = jetLowFilter;
      this.jetLowGain = jetLowGain;
      this.jetFilter = jetFilter;
      this.jetGain = jetGain;
      this.jetFlutterLfo = jetFlutterLfo;
      this.jetFlutterGain = jetFlutterGain;
      this.turbineOsc = turbineOsc;
      this.turbineOscHigh = turbineOscHigh;
      this.turbineGain = turbineGain;
      this.brakeNoiseFilter = brakeNoiseFilter;
      this.brakeNoiseGain = brakeNoiseGain;

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

      // 3B. Continuous Multi-Layer Orbital Mining Extractor & Ablation Rig
      const miningMasterGain = ctx.createGain();
      miningMasterGain.gain.value = 0;

      const miningFilter = ctx.createBiquadFilter();
      miningFilter.type = 'lowpass';
      miningFilter.frequency.value = 1450;
      miningFilter.Q.value = 3.2;

      const miningSubOsc = ctx.createOscillator();
      miningSubOsc.type = 'sine';
      miningSubOsc.frequency.value = 58;
      const miningSubGain = ctx.createGain();
      miningSubGain.gain.value = 0.42;

      const miningOscLow = ctx.createOscillator();
      miningOscLow.type = 'sawtooth';
      miningOscLow.frequency.value = 96;
      const miningLowGain = ctx.createGain();
      miningLowGain.gain.value = 0.34;

      const miningOscMid = ctx.createOscillator();
      miningOscMid.type = 'triangle';
      miningOscMid.frequency.value = 288;
      const miningMidGain = ctx.createGain();
      miningMidGain.gain.value = 0.24;

      // Pulsating magnetic drill LFO modulation
      const miningLfoOsc = ctx.createOscillator();
      miningLfoOsc.type = 'sine';
      miningLfoOsc.frequency.value = 14.5;
      const miningLfoGain = ctx.createGain();
      miningLfoGain.gain.value = 220;
      miningLfoOsc.connect(miningLfoGain);
      miningLfoGain.connect(miningFilter.frequency);

      const miningNoiseSource = ctx.createBufferSource();
      miningNoiseSource.buffer = this.noiseBuffer;
      miningNoiseSource.loop = true;

      const miningNoiseGain = ctx.createGain();
      miningNoiseGain.gain.value = 0.36;

      // High-energy rock/ice ablation plasma sizzle (bypass main lowpass into crisp bandpass)
      const miningSizzleFilter = ctx.createBiquadFilter();
      miningSizzleFilter.type = 'bandpass';
      miningSizzleFilter.frequency.value = 1750;
      miningSizzleFilter.Q.value = 1.15;
      const miningSizzleGain = ctx.createGain();
      miningSizzleGain.gain.value = 0;

      miningSubOsc.connect(miningSubGain);
      miningSubGain.connect(miningMasterGain);

      miningOscLow.connect(miningLowGain);
      miningLowGain.connect(miningFilter);
      miningOscMid.connect(miningMidGain);
      miningMidGain.connect(miningFilter);
      miningNoiseSource.connect(miningNoiseGain);
      miningNoiseGain.connect(miningFilter);

      miningNoiseSource.connect(miningSizzleFilter);
      miningSizzleFilter.connect(miningSizzleGain);
      miningSizzleGain.connect(miningMasterGain);

      miningFilter.connect(miningMasterGain);
      miningMasterGain.connect(compressor);
      miningMasterGain.connect(echoBus);

      miningSubOsc.start();
      miningOscLow.start();
      miningOscMid.start();
      miningLfoOsc.start();
      miningNoiseSource.start();

      this.miningMasterGain = miningMasterGain;
      this.miningFilter = miningFilter;
      this.miningSubOsc = miningSubOsc;
      this.miningOscLow = miningOscLow;
      this.miningOscMid = miningOscMid;
      this.miningLfoOsc = miningLfoOsc;
      this.miningLfoGain = miningLfoGain;
      this.miningNoiseSource = miningNoiseSource;
      this.miningSizzleFilter = miningSizzleFilter;
      this.miningSizzleGain = miningSizzleGain;

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

    // Spacecraft engine & ion afterburner modulation
    if (
      this.shipMasterGain &&
      this.shipPerspectiveFilter &&
      this.engineSubOsc &&
      this.engineSubGain &&
      this.reactorOscLow &&
      this.reactorOscHarmonic &&
      this.reactorFilter &&
      this.reactorGain &&
      this.jetLowFilter &&
      this.jetLowGain &&
      this.jetFilter &&
      this.jetGain &&
      this.jetFlutterLfo &&
      this.jetFlutterGain &&
      this.turbineOsc &&
      this.turbineOscHigh &&
      this.turbineGain &&
      this.brakeNoiseGain
    ) {
      if (params.mode === 'SPACECRAFT') {
        const thr = Math.min(1.2, Math.max(0, params.throttle || 0));
        const spd = Math.min(1.5, Math.max(0, params.speedNorm || 0));
        const boost = Math.min(1, Math.max(0, params.boostBlend || 0));
        const braking = Boolean(params.isBraking);
        const energy = Math.min(1.3, Math.max(thr * 0.95 + boost * 0.35, spd * 0.58));
        const activeThrust = Math.min(1.25, Math.max(thr, boost * 0.9));

        // Perspective acoustics: warm insulated cockpit rumble vs wide roaring exhaust outside
        const perspFreq =
          params.cameraView === 'COCKPIT'
            ? 840 + activeThrust * 540 + boost * 420
            : 3200 + activeThrust * 1600 + boost * 1400;
        const perspGain =
          params.cameraView === 'COCKPIT'
            ? 0.26 + activeThrust * 0.16 + boost * 0.1
            : 0.34 + activeThrust * 0.28 + boost * 0.16;
        this.shipMasterGain.gain.setTargetAtTime(perspGain, now, 0.08);
        this.shipPerspectiveFilter.frequency.setTargetAtTime(perspFreq, now, 0.08);

        // Chest-thumping sub-bass core scales smoothly from gentle idle to thunderous boost
        this.engineSubOsc.frequency.setTargetAtTime(34 + energy * 24 + boost * 18, now, 0.08);
        this.engineSubGain.gain.setTargetAtTime(0.08 + energy * 0.24 + boost * 0.18, now, 0.08);

        // Dual-detuned reactor/rocket growl + harmonic filter opening with throttle
        const baseHz = 44 + energy * 38 + boost * 32;
        this.reactorOscLow.frequency.setTargetAtTime(baseHz, now, 0.07);
        this.reactorOscHarmonic.frequency.setTargetAtTime(baseHz * 1.498, now, 0.07);
        this.reactorFilter.frequency.setTargetAtTime(175 + energy * 680 + boost * 620, now, 0.08);
        this.reactorGain.gain.setTargetAtTime(0.09 + energy * 0.24 + boost * 0.14, now, 0.08);

        // Low combustion thunder + combustion LFO flutter
        this.jetLowFilter.frequency.setTargetAtTime(190 + activeThrust * 340 + boost * 320, now, 0.08);
        this.jetLowGain.gain.setTargetAtTime(0.09 + activeThrust * 0.38 + boost * 0.26, now, 0.08);
        this.jetFlutterLfo.frequency.setTargetAtTime(17 + activeThrust * 10 + boost * 9, now, 0.1);
        this.jetFlutterGain.gain.setTargetAtTime(35 + activeThrust * 85 + boost * 75, now, 0.09);

        // High-velocity plasma exhaust whoosh
        const jetFreq = 300 + activeThrust * 1150 + boost * 1450;
        this.jetFilter.frequency.setTargetAtTime(jetFreq, now, 0.08);
        this.jetGain.gain.setTargetAtTime(0.05 + activeThrust * 0.36 + boost * 0.32, now, 0.08);

        // Twin ion turbine spool whine (crisp turbine climb)
        const turbHz = 148 + energy * 235 + boost * 195;
        this.turbineOsc.frequency.setTargetAtTime(turbHz, now, 0.09);
        this.turbineOscHigh.frequency.setTargetAtTime(turbHz * 2.0, now, 0.09);
        this.turbineGain.gain.setTargetAtTime(0.012 + energy * 0.055 + boost * 0.068, now, 0.09);

        // Retro-braking forward exhaust hiss
        this.brakeNoiseGain.gain.setTargetAtTime(
          braking && spd > 0.04 ? (params.cameraView === 'COCKPIT' ? 0.12 : 0.22) : 0,
          now,
          0.07
        );

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

    // Continuous Orbital Mining Extractor Laser & Surface Ablation Sizzle
    if (
      this.miningMasterGain &&
      this.miningFilter &&
      this.miningSubOsc &&
      this.miningOscLow &&
      this.miningOscMid &&
      this.miningLfoOsc &&
      this.miningLfoGain &&
      this.miningSizzleFilter &&
      this.miningSizzleGain
    ) {
      const mInt =
        params.mode === 'SPACECRAFT' ? Math.max(0, Math.min(1, params.miningIntensity || 0)) : 0;
      const isDrilling = params.mode === 'SPACECRAFT' && Boolean(params.miningDrilling);
      const isCockpit = params.cameraView === 'COCKPIT';
      const spotMult = Math.max(1, Math.min(2.6, params.miningHotspotMult || 1));
      const baseVol = isDrilling ? (isCockpit ? 0.24 : 0.38) : isCockpit ? 0.12 : 0.18;
      const targetGain = mInt > 0.02 ? baseVol * mInt : 0;
      this.miningMasterGain.gain.setTargetAtTime(targetGain, now, 0.055);
      if (mInt > 0.02) {
        const drillBoost = isDrilling ? 1 : 0.25;
        this.miningFilter.frequency.setTargetAtTime(
          740 + mInt * 780 + (spotMult - 1) * 260 + Math.sin(params.clockTime * 11.5) * 180,
          now,
          0.05
        );
        this.miningSubOsc.frequency.setTargetAtTime(52 + mInt * 18 + drillBoost * 8, now, 0.05);
        this.miningOscLow.frequency.setTargetAtTime(84 + mInt * 32 + (spotMult - 1) * 14, now, 0.05);
        this.miningOscMid.frequency.setTargetAtTime(
          252 + mInt * 96 + (spotMult - 1) * 42 + Math.sin(params.clockTime * 8.2) * 22,
          now,
          0.05
        );
        this.miningLfoOsc.frequency.setTargetAtTime(isDrilling ? 15 + spotMult * 2.5 : 8.5, now, 0.08);
        this.miningLfoGain.gain.setTargetAtTime(isDrilling ? 290 : 110, now, 0.08);
        this.miningSizzleFilter.frequency.setTargetAtTime(
          isDrilling ? 1600 + spotMult * 350 : 1200,
          now,
          0.06
        );
        this.miningSizzleGain.gain.setTargetAtTime(isDrilling ? 0.42 : 0.05, now, 0.06);

        // Occasional hot rock/ice fracturing crackle when ablating planetary surface
        const cracklePeriod = spotMult > 1.3 ? 0.19 : 0.28;
        if (isDrilling && now - this.lastMiningCrackleTime > cracklePeriod) {
          this.lastMiningCrackleTime = now;
          this.triggerMiningCrackle(isCockpit, spotMult);
        }
      } else {
        this.miningSizzleGain.gain.setTargetAtTime(0, now, 0.05);
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

  private triggerMiningCrackle(isCockpit: boolean, hotspotMult: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.9;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((isCockpit ? 980 : 1850) + Math.random() * 950, now);
    bp.Q.value = 2.4;

    const gain = this.ctx.createGain();
    const peak = (isCockpit ? 0.05 : 0.095) * (0.85 + Math.min(1.5, hotspotMult - 1) * 0.35);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.085);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.compressor);
    if (this.echoBus) gain.connect(this.echoBus);
    src.start(now, Math.random() * 1.8, 0.095);
  }

  public playMiningEngage(isDrilling = false): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Magnetic Laser Capacitor Charge Sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(76, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.24);
    osc.frequency.exponentialRampToValueAtTime(isDrilling ? 132 : 112, now + 0.44);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(320, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.22);
    bp.Q.value = 3.6;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.045);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    if (this.echoBus) g.connect(this.echoBus);
    osc.start(now);
    osc.stop(now + 0.5);

    // 2. Plasma Lens Aperture Snap
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const nBp = this.ctx.createBiquadFilter();
    nBp.type = 'bandpass';
    nBp.frequency.setValueAtTime(2200, now);
    nBp.Q.value = 1.4;
    const nG = this.ctx.createGain();
    nG.gain.setValueAtTime(0.16, now);
    nG.gain.exponentialRampToValueAtTime(0.0006, now + 0.16);
    nSrc.connect(nBp);
    nBp.connect(nG);
    nG.connect(this.compressor);
    nSrc.start(now, Math.random(), 0.18);
  }

  public playMiningSurfaceLock(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Sub-seismic crater contact thump + ablation hiss burst
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.24);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.26, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sub.connect(subG);
    subG.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 0.3);

    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(920, now + 0.26);
    const nG = this.ctx.createGain();
    nG.gain.setValueAtTime(0.18, now);
    nG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    nSrc.connect(bp);
    bp.connect(nG);
    nG.connect(this.compressor);
    nSrc.start(now, 0.15, 0.3);
  }

  public playMiningDisengage(): void {
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.32);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.35);

    osc.connect(g);
    g.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playAfterburnerIgnite(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Rocket / Ion Afterburner Detonation Punch
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(98, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.42);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.32, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    sub.connect(subG);
    subG.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 0.48);

    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2800, now);
    lp.frequency.exponentialRampToValueAtTime(420, now + 0.52);
    const nG = this.ctx.createGain();
    nG.gain.setValueAtTime(0.28, now);
    nG.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    nSrc.connect(lp);
    lp.connect(nG);
    nG.connect(this.compressor);
    if (this.echoBus) nG.connect(this.echoBus);
    nSrc.start(now, 0.05, 0.58);
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

  public playProvisionUse(kind: 'food' | 'water' | 'cell' | 'repair'): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const notes =
      kind === 'food'
        ? [523.25, 659.25]
        : kind === 'water'
          ? [587.33, 783.99]
          : kind === 'cell'
            ? [440, 660, 880]
            : [392, 523.25];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + i * 0.065;
      const osc = this.ctx.createOscillator();
      osc.type = kind === 'cell' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
      osc.connect(g);
      g.connect(this.compressor);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playRestChime(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    [349.23, 440, 523.25].forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + i * 0.09;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.065, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 0.42);
      osc.connect(g);
      g.connect(this.compressor);
      if (this.echoBus) g.connect(this.echoBus);
      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  public playRadiatorToggle(deployed: boolean): void {
    this.unlock();
    if (!this.ctx || !this.compressor || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(deployed ? 420 : 920, now);
    bp.frequency.exponentialRampToValueAtTime(deployed ? 980 : 340, now + 0.22);
    bp.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(now, 0.05, 0.28);
  }

  public playMiningYieldChime(
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC' = 'COMMON'
  ): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    const chord =
      rarity === 'EXOTIC'
        ? [659.25, 987.77, 1318.51, 1760]
        : rarity === 'RARE'
          ? [587.33, 880, 1174.66, 1567.98]
          : rarity === 'UNCOMMON'
            ? [523.25, 783.99, 1046.5]
            : [493.88, 739.99, 987.77];

    chord.forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + i * 0.042;
      const osc = this.ctx.createOscillator();
      osc.type = i === chord.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.015, t + 0.22);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.072, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 0.28);

      osc.connect(g);
      g.connect(this.compressor);
      if (this.echoBus) g.connect(this.echoBus);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playSynthesisSuccess(): void {
    this.unlock();
    if (!this.ctx || !this.compressor || this.muted) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      if (!this.ctx || !this.compressor) return;
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.068, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.34);
      osc.connect(g);
      g.connect(this.compressor);
      if (this.echoBus) g.connect(this.echoBus);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public dispose(): void {
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
      this.ambientNoiseSource?.stop();
      this.engineSubOsc?.stop();
      this.reactorOscLow?.stop();
      this.reactorOscHarmonic?.stop();
      this.jetNoiseSource?.stop();
      this.jetFlutterLfo?.stop();
      this.turbineOsc?.stop();
      this.turbineOscHigh?.stop();
      this.warpOscLow?.stop();
      this.warpOscHigh?.stop();
      this.warpNoiseSource?.stop();
      this.miningSubOsc?.stop();
      this.miningOscLow?.stop();
      this.miningOscMid?.stop();
      this.miningLfoOsc?.stop();
      this.miningNoiseSource?.stop();
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
