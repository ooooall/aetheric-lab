/**
 * Aetheric Lab — Sound engine (Tone.js)
 * All sounds synthesized in real time. Unlocks on first user gesture.
 */

const Tone = window.Tone;

if (!Tone) {
  console.warn('Tone.js not loaded; sound disabled.');
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const MAX_POLYPHONY_MOBILE = 3;
const DOT_PING_MAX_PER_100MS = 8;
const ASSEMBLY_DURATION = 1.8;

let masterGain;
let limiter;
let masterReverb;
let masterEq;
let droneSynth1;
let droneSynth2;
let droneSynth3;
let droneLfo;
let assemblySynth;
let assemblyReverb;
let particleNoise;
let particleFilter;
let particleReverb;
let snapSynth;
let singingBowlSynth;
let singingBowlChorus;
let singingBowlReverb;
let dotPingSynth;
let scrollWhooshSynth;
let scrollShimmerSynth;
let ctaHoverNoise;
let ctaHoverFilter;
let ctaClickThud;
let ctaClickChime;
let sphereHoverBoom;
let sphereHoverShimmer;
let sphereClickLow;
let sphereClickMetal;

let ready = false;
let muted = false;
let particleRepelActive = false;
let lastDotPingTime = 0;
let dotPingCount = 0;
let dotPingResetTime = 0;
let activeVoices = 0;
const MAX_VOICES = isMobile ? MAX_POLYPHONY_MOBILE : 12;

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function createMasterChain() {
  if (!Tone) return;
  masterGain = new Tone.Gain(1);
  limiter = new Tone.Limiter(-6);
  masterReverb = new Tone.Reverb({ decay: 4, wet: 0.25 });
  masterEq = new Tone.EQ3({ low: 2, mid: 0, high: -1 });
  masterGain.chain(limiter, masterReverb, masterEq, Tone.getDestination());
}

function createDrone() {
  if (!Tone || isMobile) return;
  const reverb = new Tone.Reverb({ decay: 12, wet: 0.9 }).connect(masterGain);
  const autoFilter = new Tone.AutoFilter({ frequency: '0.1n', depth: 0.4 }).start().connect(reverb);
  droneSynth1 = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 4, decay: 0, sustain: 1, release: 6 },
  });
  droneSynth1.volume.value = -28;
  droneSynth1.connect(autoFilter);
  droneSynth2 = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 4, decay: 0, sustain: 1, release: 6 },
  });
  droneSynth2.volume.value = -28 - 18;
  droneSynth2.connect(autoFilter);
  droneSynth3 = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 4, decay: 0, sustain: 1, release: 6 },
  });
  droneSynth3.volume.value = -28;
  droneSynth3.connect(autoFilter);
  droneLfo = new Tone.LFO({ frequency: 0.08, min: 36, max: 42 }).start();
  droneLfo.connect(droneSynth3.frequency);
}

function createAssemblySound() {
  if (!Tone) return;
  assemblyReverb = new Tone.Reverb({ decay: 8, wet: 0.95 }).connect(masterGain);
  assemblySynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.1, decay: ASSEMBLY_DURATION, sustain: 0, release: 3 },
  });
  assemblySynth.connect(assemblyReverb);
}

function createParticleSounds() {
  if (!Tone) return;
  particleFilter = new Tone.BiquadFilter({ frequency: 200, type: 'bandpass' }).connect(masterGain);
  particleReverb = new Tone.Reverb({ decay: 2, wet: 0.7 }).connect(particleFilter);
  particleNoise = new Tone.Noise('pink').connect(particleReverb);
  particleNoise.volume.value = -24;
  snapSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.05 },
  });
  snapSynth.volume.value = -20;
  snapSynth.connect(masterGain);
}

function createSphereSounds() {
  if (!Tone) return;
  singingBowlReverb = new Tone.Reverb({ decay: 6, wet: 0.85 }).connect(masterGain);
  singingBowlChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7 }).start().connect(singingBowlReverb);
  singingBowlSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.5, decay: 0, sustain: 1, release: 1.5 },
  });
  singingBowlSynth.volume.value = -18;
  singingBowlSynth.connect(singingBowlChorus);
  dotPingSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
  });
  dotPingSynth.volume.value = -30;
  dotPingSynth.connect(masterGain);
  const boomReverb = new Tone.Reverb({ decay: 2, wet: 0.8 }).connect(masterGain);
  sphereHoverBoom = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0, decay: 0.6, sustain: 0, release: 0.2 },
  });
  sphereHoverBoom.volume.value = -22;
  sphereHoverBoom.connect(boomReverb);
  sphereHoverShimmer = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
  });
  sphereHoverShimmer.volume.value = -25;
  sphereHoverShimmer.connect(boomReverb);
  const clickReverb = new Tone.Reverb({ decay: 10, wet: 0.9 }).connect(masterGain);
  sphereClickLow = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.5 },
  });
  sphereClickLow.volume.value = -12;
  sphereClickLow.connect(clickReverb);
  sphereClickMetal = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.3 },
  });
  sphereClickMetal.volume.value = -18;
  sphereClickMetal.connect(clickReverb);
}

function createScrollSounds() {
  if (!Tone) return;
  const whooshReverb = new Tone.Reverb({ decay: 2, wet: 0.6 }).connect(masterGain);
  scrollWhooshSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.2 },
  });
  scrollWhooshSynth.volume.value = -20;
  scrollWhooshSynth.connect(whooshReverb);
  scrollShimmerSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  });
  scrollShimmerSynth.volume.value = -28;
  scrollShimmerSynth.connect(whooshReverb);
}

function createCTASounds() {
  if (!Tone) return;
  ctaHoverFilter = new Tone.BiquadFilter({ frequency: 1200, type: 'bandpass' }).connect(masterGain);
  const ctaHoverReverb = new Tone.Reverb({ decay: 1.5, wet: 0.7 }).connect(ctaHoverFilter);
  ctaHoverNoise = new Tone.Noise('white').connect(ctaHoverReverb);
  ctaHoverNoise.volume.value = -22;
  ctaClickThud = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
  });
  ctaClickThud.volume.value = -18;
  ctaClickThud.connect(masterGain);
  ctaClickChime = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
  });
  ctaClickChime.volume.value = -20;
  ctaClickChime.connect(masterGain);
}

export function initSound() {
  if (!Tone || ready) return;
  Tone.start();
  createMasterChain();
  createAssemblySound();
  createParticleSounds();
  createSphereSounds();
  createScrollSounds();
  createCTASounds();
  if (!isMobile) createDrone();
  ready = true;
}

export function startDrone() {
  if (!droneSynth1 || muted || isMobile) return;
  droneSynth1.triggerAttack(36);
  droneSynth2.triggerAttack(54);
  if (droneSynth3) droneSynth3.triggerAttack(36);
}

export function playAssemblySound() {
  if (!assemblySynth || muted) return;
  const now = Tone.now();
  assemblySynth.frequency.setValueAtTime(80, now);
  assemblySynth.frequency.exponentialRampToValueAtTime(440, now + ASSEMBLY_DURATION);
  assemblySynth.triggerAttack(80, now);
  assemblySynth.triggerRelease(now + ASSEMBLY_DURATION + 2);
}

export function particleRepelStart() {
  if (!particleNoise || muted) return;
  particleRepelActive = true;
  particleNoise.start();
}

export function particleRepelUpdate(velocityNorm, distFromCenterNorm) {
  if (!particleFilter || !particleRepelActive) return;
  const freq = 120 + velocityNorm * (800 - 120);
  particleFilter.frequency.rampTo(freq, 0.05);
  const vol = -24 + distFromCenterNorm * 6;
  particleNoise.volume.rampTo(vol, 0.05);
}

export function particleRepelStop() {
  if (!particleNoise) return;
  particleRepelActive = false;
  particleNoise.stop();
  playParticleSnapBack();
}

function playParticleSnapBack() {
  if (!snapSynth || muted) return;
  const now = Tone.now();
  snapSynth.triggerAttackRelease(320, 0.08, now);
  snapSynth.triggerAttackRelease(180, 0.08, now + 0.08);
  snapSynth.triggerAttackRelease(90, 0.08, now + 0.16);
}

export function sphereSingingBowl(mouseXNorm) {
  if (!singingBowlSynth || muted) return;
  const freq = 55 + mouseXNorm * (220 - 55);
  if (!singingBowlSynth._lastFreq) singingBowlSynth._lastFreq = 55;
  singingBowlSynth.frequency.rampTo(freq, 0.08);
  singingBowlSynth._lastFreq = freq;
  if (singingBowlSynth.state !== 'started') {
    singingBowlSynth.triggerAttack(55);
  }
}

export function sphereSingingBowlStop() {
  if (singingBowlSynth) singingBowlSynth.triggerRelease();
}

export function sphereDotPing(yNorm) {
  if (!dotPingSynth || muted || isMobile) return;
  const now = Tone.now();
  if (now - dotPingResetTime > 0.1) {
    dotPingCount = 0;
    dotPingResetTime = now;
  }
  if (dotPingCount >= DOT_PING_MAX_PER_100MS) return;
  dotPingCount++;
  const baseFreq = 200 + yNorm * 600;
  const freq = baseFreq * (0.85 + Math.random() * 0.3);
  dotPingSynth.triggerAttackRelease(freq, 0.04, now);
}

export function sphereHoverEnter() {
  if (!sphereHoverBoom || muted) return;
  sphereHoverBoom.triggerAttackRelease(40, 0.6);
  if (sphereHoverShimmer) sphereHoverShimmer.triggerAttackRelease(2000, 0.25);
}

export function sphereClick() {
  if (!sphereClickLow || muted) return;
  sphereClickLow.triggerAttackRelease(28, 0.8);
  if (sphereClickMetal) sphereClickMetal.triggerAttackRelease(1760, 0.15);
}

export function scrollSection() {
  if (!scrollWhooshSynth || muted) return;
  const now = Tone.now();
  scrollWhooshSynth.triggerAttackRelease(200, 0.4, now);
  scrollWhooshSynth.frequency.exponentialRampToValueAtTime(60, now + 0.4);
  scrollShimmerSynth.triggerAttackRelease(4000, 0.06, now);
}

export function ctaHover() {
  if (!ctaHoverNoise || muted) return;
  ctaHoverNoise.start();
  setTimeout(() => {
    if (ctaHoverNoise) ctaHoverNoise.stop();
  }, 200);
}

export function ctaClick() {
  if (!ctaClickThud || muted) return;
  const now = Tone.now();
  ctaClickThud.triggerAttackRelease(60, 0.08, now);
  ctaClickChime.triggerAttackRelease(1320, 0.2, now);
}

export function toggleMute() {
  if (!masterGain) return;
  muted = !muted;
  masterGain.gain.rampTo(muted ? 0 : 1, 0.1);
  return muted;
}

export function isMuted() {
  return muted;
}

export function isReady() {
  return ready;
}
