import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './App.css';

const HERO_VIDEO_SRC = '/hero-jungle-voice.mp4';

// ==========================================================================
// WEB AUDIO API SYNTHESIZER ENGINE
// ==========================================================================
class SafariAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.ambientNode = null;
    this.windNode = null;
    this.jeepNode = null;
    this.cricketInterval = null;
    this.forestInterval = null;
    this.ambientPlaying = false;
    this.ambientSuppressed = false;
    this.masterGain = null;
  }

  _applyMasterGain() {
    if (!this.masterGain || !this.ctx) return;
    const audible = !this.isMuted && !this.ambientSuppressed;
    this.masterGain.gain.setValueAtTime(audible ? 0.6 : 0, this.ctx.currentTime);
  }

  setAmbientSuppressed(suppressed) {
    this.ambientSuppressed = suppressed;
    this._applyMasterGain();
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  toggleMute(muteState) {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isMuted = muteState !== undefined ? muteState : !this.isMuted;

    this._applyMasterGain();

    if (!this.isMuted && !this.ambientSuppressed && !this.ambientPlaying) {
      this.startAmbient();
    }
    return this.isMuted;
  }

  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  startAmbient() {
    this.init();
    if (this.ambientPlaying) return;
    this.ambientPlaying = true;

    const noiseSource = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.Q.value = 3.0;
    windFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.08;

    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);
    noiseSource.start();
    this.windNode = { source: noiseSource, filter: windFilter };

    const modulateWind = () => {
      if (!this.ambientPlaying || this.isMuted) return;
      const targetFreq = 150 + Math.random() * 200;
      const duration = 2 + Math.random() * 3;
      if (this.windNode && this.windNode.filter) {
        this.windNode.filter.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + duration);
      }
      setTimeout(modulateWind, duration * 1000);
    };
    modulateWind();
    this.startCrickets();
    this.startForestVoices();
  }

  startCrickets() {
    const playCricketChirp = () => {
      if (this.isMuted || !this.ambientPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(3800 + Math.random() * 300, now);

      const mod = this.ctx.createOscillator();
      mod.type = 'sawtooth';
      mod.frequency.setValueAtTime(55, now);

      const modGain = this.ctx.createGain();
      modGain.gain.value = 1500;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3900, now);
      filter.Q.value = 5;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.012, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.012, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      mod.start(now);
      carrier.start(now);

      mod.stop(now + 0.3);
      carrier.stop(now + 0.3);
    };

    this.cricketInterval = setInterval(() => {
      if (Math.random() > 0.3) {
        playCricketChirp();
      }
    }, 400);
  }

  startForestVoices() {
    const playBirdChirp = () => {
      if (this.isMuted || !this.ambientPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const count = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const delay = i * (0.12 + Math.random() * 0.1);
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200 + Math.random() * 800, now + delay);
        osc.frequency.exponentialRampToValueAtTime(2600 + Math.random() * 400, now + delay + 0.14);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.015, now + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.18);
      }
    };

    this.forestInterval = setInterval(() => {
      if (Math.random() > 0.35) {
        playBirdChirp();
      }
    }, 3500);
  }

  startJeep() {
    this.init();
    if (this.jeepNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, now);

    const mod = this.ctx.createOscillator();
    mod.type = 'sawtooth';
    mod.frequency.setValueAtTime(14, now);

    const modGain = this.ctx.createGain();
    modGain.gain.value = 8;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, now);
    filter.Q.value = 1.0;

    const jeepGain = this.ctx.createGain();
    jeepGain.gain.setValueAtTime(0, now);
    jeepGain.gain.linearRampToValueAtTime(0.06, now + 0.2);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(jeepGain);
    jeepGain.connect(this.masterGain);

    osc.start(now);
    mod.start(now);

    this.jeepNode = { osc, mod, gainNode: jeepGain, filter };
  }

  updateJeepSpeed(progress) {
    if (!this.jeepNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    const baseFreq = 45 + progress * 25;
    const modFreq = 14 + progress * 10;
    const vol = 0.06 + progress * 0.04;

    this.jeepNode.osc.frequency.setTargetAtTime(baseFreq, now, 0.1);
    this.jeepNode.mod.frequency.setTargetAtTime(modFreq, now, 0.1);
    this.jeepNode.gainNode.gain.setTargetAtTime(vol, now, 0.1);
  }

  stopJeep() {
    if (!this.jeepNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    const node = this.jeepNode;
    this.jeepNode = null;

    node.gainNode.gain.cancelScheduledValues(now);
    node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, now);
    node.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    setTimeout(() => {
      try {
        node.osc.stop();
        node.mod.stop();
      } catch (e) { }
    }, 400);
  }

  playGateSound() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const rumble = this.ctx.createOscillator();
    rumble.type = 'triangle';
    rumble.frequency.setValueAtTime(55, now);
    rumble.frequency.linearRampToValueAtTime(35, now + 1.8);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.12, now + 0.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    rumble.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumble.start(now);
    rumble.stop(now + 1.9);

    const squeak = this.ctx.createOscillator();
    squeak.type = 'sawtooth';
    squeak.frequency.setValueAtTime(800, now + 0.2);
    squeak.frequency.exponentialRampToValueAtTime(450, now + 1.2);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.value = 6;
    bandpass.frequency.setValueAtTime(800, now + 0.2);
    bandpass.frequency.exponentialRampToValueAtTime(450, now + 1.2);

    const squeakGain = this.ctx.createGain();
    squeakGain.gain.setValueAtTime(0, now);
    squeakGain.gain.linearRampToValueAtTime(0.04, now + 0.3);
    squeakGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    squeak.connect(bandpass);
    bandpass.connect(squeakGain);
    squeakGain.connect(this.masterGain);
    squeak.start(now + 0.2);
    squeak.stop(now + 1.5);
  }

  playLionRoar() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(65, now + 0.4);
    osc.frequency.linearRampToValueAtTime(40, now + 1.5);

    const mod = this.ctx.createOscillator();
    mod.type = 'sawtooth';
    mod.frequency.setValueAtTime(55, now);
    mod.frequency.linearRampToValueAtTime(35, now + 1.5);

    const modGain = this.ctx.createGain();
    modGain.gain.value = 180;

    const noise = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(220, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 1.2);
    noiseFilter.Q.value = 2.0;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.3, now + 0.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    const roarGain = this.ctx.createGain();
    roarGain.gain.setValueAtTime(0, now);
    roarGain.gain.linearRampToValueAtTime(0.35, now + 0.15);
    roarGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(roarGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    roarGain.connect(this.masterGain);
    noiseGain.connect(this.masterGain);

    osc.start(now);
    mod.start(now);
    noise.start(now);

    osc.stop(now + 1.9);
    mod.stop(now + 1.9);
    noise.stop(now + 1.9);
  }

  playElephantTrumpet() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.1);
    osc.frequency.linearRampToValueAtTime(260, now + 0.6);

    const vib = this.ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.setValueAtTime(45, now);

    const vibGain = this.ctx.createGain();
    vibGain.gain.value = 50;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(1600, now + 0.15);
    filter.frequency.linearRampToValueAtTime(600, now + 0.7);
    filter.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    vib.start(now);

    osc.stop(now + 0.9);
    vib.stop(now + 0.9);
  }

  playDeerCall() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playPeacockCall() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(950, now);
    osc1.frequency.linearRampToValueAtTime(1050, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(450, now + 0.55);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(475, now);
    osc2.frequency.linearRampToValueAtTime(525, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(225, now + 0.55);

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(500, now);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.03, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  }

  playLeopardRoar() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(75, now + 0.5);

    const mod = this.ctx.createOscillator();
    mod.type = 'sawtooth';
    mod.frequency.setValueAtTime(65, now);

    const modGain = this.ctx.createGain();
    modGain.gain.value = 140;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.5);
    filter.Q.value = 2.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    mod.start(now);

    osc.stop(now + 0.55);
    mod.stop(now + 0.55);
  }

  playBearGrowl() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.8);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(16, now);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.1, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, now);

    const outGain = this.ctx.createGain();
    outGain.gain.setValueAtTime(0, now);
    outGain.gain.linearRampToValueAtTime(0.28, now + 0.15);
    outGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(outGain);
    outGain.connect(this.masterGain);

    osc.start(now);
    lfo.start(now);

    osc.stop(now + 0.9);
    lfo.stop(now + 0.9);
  }

  playReptileHiss() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5.0;
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.7);
  }
}

// Global Static Audio instance keeps sound running seamlessly on route switches
const audio = new SafariAudioEngine();

function playHeroVideoWithSound(video) {
  if (!video) return;
  video.muted = false;
  video.volume = 1;
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }
}

function muteHeroVideo(video) {
  if (!video) return;
  video.muted = true;
}

function SiteEntryGate({ onEnter, visible, leaving }) {
  if (!visible) return null;

  return createPortal(
    <div
      className={`site-entry-gate${leaving ? ' site-entry-gate--leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Enter Gir Jungle Safari"
    >
      <div className="site-entry-gate__backdrop" aria-hidden="true" />
      <div className="site-entry-gate__vignette" aria-hidden="true" />
      <div className="site-entry-gate__rays" aria-hidden="true" />
      <div className="site-entry-gate__frame" aria-hidden="true" />

      <div className="site-entry-gate__content">
        <div className="site-entry-gate__brand">
          <svg className="site-entry-gate__logo" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
            <path d="M50 5C25.1 5 5 25.1 5 50c0 14.1 6.5 26.7 16.7 35L24 75c-1.8-4.1-3-8.6-3.6-13.3 3.6 2.4 7.8 3.9 12.3 4.3 1.2-4.5 3.3-8.6 6.3-12-1.9-2.3-3-5.2-3-8.4 0-7.2 5.8-13 13-13s13 5.8 13 13c0 3.2-1.1 6.1-3 8.4 3 3.4 5.1 7.5 6.3 12 4.5-.4 8.7-1.9 12.3-4.3-.6 4.7-1.8 9.2-3.6 13.3l2.3 10c10.2-8.3 16.7-20.9 16.7-35C95 25.1 74.9 5 50 5zm0 18c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7zm-14 27c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4zm28 0c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" />
          </svg>
          <p className="site-entry-gate__eyebrow">Welcome to</p>
          <h1 className="site-entry-gate__title cinzel">Gir Jungle Safari</h1>
          <p className="site-entry-gate__subtitle">Sasan Gir · Gujarat</p>
        </div>

        <p className="site-entry-gate__desc">
          Enter the wild with cinematic visuals and immersive jungle sound.
        </p>

        <button type="button" className="site-entry-gate__cta btn-gold" onClick={onEnter}>
          <span>Enter the Wild</span>
          <span className="site-entry-gate__cta-icon" aria-hidden="true">&#128062;</span>
        </button>

        <p className="site-entry-gate__hint site-entry-gate__hint--desktop">Click to start your safari experience</p>
        <p className="site-entry-gate__hint site-entry-gate__hint--mobile">Tap to start your safari experience</p>
      </div>
    </div>,
    document.body
  );
}

// ==========================================================================
// MASTER REACT APP ENTRYPOINT
// ==========================================================================
export default function App() {
  const [hasEnteredSite, setHasEnteredSite] = useState(false);
  const [gateLeaving, setGateLeaving] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [isMuted, setIsMuted] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroAudioSyncRef = useRef(null);

  const showEntryGate = currentPage === 'home' && (!hasEnteredSite || gateLeaving);

  const handleEnterSite = () => {
    setGateLeaving(true);
    setHasEnteredSite(true);

    audio.init();
    if (audio.ctx?.state === 'suspended') {
      audio.ctx.resume();
    }
    audio.toggleMute(false);
    setIsMuted(false);
    heroAudioSyncRef.current?.enableHeroVoice?.();

    window.setTimeout(() => setGateLeaving(false), 700);
  };

  useEffect(() => {
    sessionStorage.removeItem('gir-jungle-entered');
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (!showEntryGate) {
      html.classList.remove('site-gate-open');
      body.classList.remove('site-gate-open');
      body.style.removeProperty('overflow');
      html.style.removeProperty('overflow');
      return undefined;
    }

    html.classList.add('site-gate-open');
    body.classList.add('site-gate-open');

    return () => {
      html.classList.remove('site-gate-open');
      body.classList.remove('site-gate-open');
      body.style.removeProperty('overflow');
      html.style.removeProperty('overflow');
    };
  }, [showEntryGate]);

  const triggerSound = (species) => {
    audio.init();
    if (audio.isMuted) {
      audio.toggleMute(false);
      setIsMuted(false);
    }
    if (species === 'lion') audio.playLionRoar();
    else if (species === 'elephant') audio.playElephantTrumpet();
    else if (species === 'deer') audio.playDeerCall();
    else if (species === 'peacock') audio.playPeacockCall();
    else if (species === 'leopard') audio.playLeopardRoar();
    else if (species === 'bear') audio.playBearGrowl();
    else if (species === 'crocodile' || species === 'python') audio.playReptileHiss();
  };

  const handleMuteToggle = () => {
    audio.init();
    const willUnmute = audio.isMuted;

    if (willUnmute && currentPage === 'home') {
      heroAudioSyncRef.current?.enableHeroVoice?.();
    } else if (!willUnmute) {
      heroAudioSyncRef.current?.disableHeroVoice?.();
    }

    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  const handleHeroAudioUnmute = () => {
    audio.init();
    heroAudioSyncRef.current?.enableHeroVoice?.();
    const muted = audio.toggleMute(false);
    setIsMuted(muted);
  };

  const navigateTo = (pageId) => {
    setCurrentPage(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, [currentPage]);

  return (
    <div className="bg-[#050f08] text-gray-200 min-h-screen flex flex-col justify-between selection:bg-[#8a7344] selection:text-black overflow-x-hidden w-full max-w-full">

      <SiteEntryGate
        visible={showEntryGate}
        leaving={gateLeaving}
        onEnter={handleEnterSite}
      />

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 glass-nav site-nav transition-all duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between relative">
          <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('home'); setMobileMenuOpen(false); }} className="site-nav__brand flex items-center gap-2 sm:gap-3 group min-w-0">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#c2aa72] shrink-0 transition-transform duration-500 group-hover:rotate-[360deg]" viewBox="0 0 100 100" fill="currentColor">
              <path d="M50 5C25.1 5 5 25.1 5 50c0 14.1 6.5 26.7 16.7 35L24 75c-1.8-4.1-3-8.6-3.6-13.3 3.6 2.4 7.8 3.9 12.3 4.3 1.2-4.5 3.3-8.6 6.3-12-1.9-2.3-3-5.2-3-8.4 0-7.2 5.8-13 13-13s13 5.8 13 13c0 3.2-1.1 6.1-3 8.4 3 3.4 5.1 7.5 6.3 12 4.5-.4 8.7-1.9 12.3-4.3-.6 4.7-1.8 9.2-3.6 13.3l2.3 10c10.2-8.3 16.7-20.9 16.7-35C95 25.1 74.9 5 50 5zm0 18c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7zm-14 27c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4zm28 0c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" />
            </svg>
            <div className="flex flex-col text-left min-w-0 leading-tight">
              <span className="text-[11px] sm:text-[13px] font-bold tracking-[0.12em] sm:tracking-widest text-[#c2aa72] cinzel uppercase truncate">Gir</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.15em] text-white font-bold font-sans truncate">Jungle Safari</span>
            </div>
          </a>

          <div className="hidden lg:flex items-center gap-8 font-bold text-[10px] tracking-[0.2em] uppercase text-gray-300">
            <button onClick={() => navigateTo('home')} className={`hover:text-[#c2aa72] transition-all duration-300 relative py-1 uppercase cursor-pointer ${currentPage === 'home' ? 'text-[#c2aa72]' : ''}`}>
              Home
              {currentPage === 'home' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c2aa72]"></span>}
            </button>
            <button onClick={() => navigateTo('about')} className={`hover:text-[#c2aa72] transition-all duration-300 relative py-1 uppercase cursor-pointer ${currentPage === 'about' ? 'text-[#c2aa72]' : ''}`}>
              About Us
              {currentPage === 'about' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c2aa72]"></span>}
            </button>
            <button onClick={() => navigateTo('experiences')} className={`hover:text-[#c2aa72] transition-all duration-300 relative py-1 uppercase cursor-pointer ${currentPage === 'experiences' ? 'text-[#c2aa72]' : ''}`}>
              Safari
              {currentPage === 'experiences' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c2aa72]"></span>}
            </button>
            <button onClick={() => navigateTo('wildlife')} className={`hover:text-[#c2aa72] transition-all duration-300 relative py-1 uppercase cursor-pointer ${currentPage === 'wildlife' ? 'text-[#c2aa72]' : ''}`}>
              Attractions
              {currentPage === 'wildlife' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c2aa72]"></span>}
            </button>
            <button onClick={() => navigateTo('gallery')} className={`hover:text-[#c2aa72] transition-all duration-300 relative py-1 uppercase cursor-pointer ${currentPage === 'gallery' ? 'text-[#c2aa72]' : ''}`}>
              Gallery
              {currentPage === 'gallery' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c2aa72]"></span>}
            </button>
            <button onClick={() => navigateTo('contact')} className={`hover:text-[#c2aa72] transition-all duration-300 relative py-1 uppercase cursor-pointer ${currentPage === 'contact' ? 'text-[#c2aa72]' : ''}`}>
              Contact Us
              {currentPage === 'contact' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c2aa72]"></span>}
            </button>
          </div>

          <div className="site-nav__actions flex items-center gap-2 sm:gap-4 shrink-0">
            <button onClick={handleMuteToggle} className="p-2 rounded-full border border-[#c2aa72]/20 bg-[#0b1a10]/80 text-[#c2aa72] hover:bg-emerald-950/60 transition-all duration-300 focus:outline-none flex items-center justify-center w-8 h-8 cursor-pointer">
              {!isMuted ? (
                <span className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                </span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l-2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V5.25z" />
                </svg>
              )}
            </button>
            <button onClick={() => { navigateTo('experiences'); setMobileMenuOpen(false); }} className="hidden md:inline-flex px-5 py-2.5 rounded text-[9px] uppercase tracking-widest font-extrabold border border-[#c2aa72] hover:bg-[#c2aa72] hover:text-[#050f08] text-white transition-all duration-300 cursor-pointer">
              Book Now
            </button>

            {/* Mobile Hamburger toggle button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded border border-[#c2aa72]/20 bg-[#0b1a10]/80 text-[#c2aa72] hover:bg-emerald-950/60 transition-all duration-300 focus:outline-none flex items-center justify-center w-8 h-8 cursor-pointer">
              {mobileMenuOpen ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>

          {/* MOBILE DROPDOWN MENU */}
          {mobileMenuOpen && (
            <div className="lg:hidden absolute top-full left-0 w-full bg-[#050f08]/98 border-b border-[#c2aa72]/25 shadow-2xl backdrop-blur-md transition-all duration-300 flex flex-col p-6 gap-4 text-left z-50">
              <button onClick={() => { navigateTo('home'); setMobileMenuOpen(false); }} className={`hover:text-[#c2aa72] text-[10px] font-bold tracking-[0.2em] uppercase text-left py-2 border-b border-emerald-950/20 cursor-pointer ${currentPage === 'home' ? 'text-[#c2aa72]' : 'text-gray-300'}`}>
                Home
              </button>
              <button onClick={() => { navigateTo('about'); setMobileMenuOpen(false); }} className={`hover:text-[#c2aa72] text-[10px] font-bold tracking-[0.2em] uppercase text-left py-2 border-b border-emerald-950/20 cursor-pointer ${currentPage === 'about' ? 'text-[#c2aa72]' : 'text-gray-300'}`}>
                About Us
              </button>
              <button onClick={() => { navigateTo('experiences'); setMobileMenuOpen(false); }} className={`hover:text-[#c2aa72] text-[10px] font-bold tracking-[0.2em] uppercase text-left py-2 border-b border-emerald-950/20 cursor-pointer ${currentPage === 'experiences' ? 'text-[#c2aa72]' : 'text-gray-300'}`}>
                Safari
              </button>
              <button onClick={() => { navigateTo('wildlife'); setMobileMenuOpen(false); }} className={`hover:text-[#c2aa72] text-[10px] font-bold tracking-[0.2em] uppercase text-left py-2 border-b border-emerald-950/20 cursor-pointer ${currentPage === 'wildlife' ? 'text-[#c2aa72]' : 'text-gray-300'}`}>
                Attractions
              </button>
              <button onClick={() => { navigateTo('gallery'); setMobileMenuOpen(false); }} className={`hover:text-[#c2aa72] text-[10px] font-bold tracking-[0.2em] uppercase text-left py-2 border-b border-emerald-950/20 cursor-pointer ${currentPage === 'gallery' ? 'text-[#c2aa72]' : 'text-gray-300'}`}>
                Gallery
              </button>
              <button onClick={() => { navigateTo('contact'); setMobileMenuOpen(false); }} className={`hover:text-[#c2aa72] text-[10px] font-bold tracking-[0.2em] uppercase text-left py-2 border-b border-emerald-950/20 cursor-pointer ${currentPage === 'contact' ? 'text-[#c2aa72]' : 'text-gray-300'}`}>
                Contact Us
              </button>
              <button onClick={() => { navigateTo('experiences'); setMobileMenuOpen(false); }} className="mt-2 w-full py-3 rounded text-[10px] uppercase tracking-[0.2em] font-extrabold border border-[#c2aa72] text-[#c2aa72] hover:bg-[#c2aa72] hover:text-[#050f08] transition-all duration-300 cursor-pointer">
                Book Now
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* DYNAMIC SCREEN ROUTER */}
      <main className="flex-grow overflow-x-clip w-full max-w-full min-w-0 touch-pan-y">
        {currentPage === 'home' && (
          <HomeScreen
            triggerSound={triggerSound}
            navigateTo={navigateTo}
            isMuted={isMuted}
            siteEntered={hasEnteredSite}
            heroAudioSyncRef={heroAudioSyncRef}
            onAudioUnmute={handleHeroAudioUnmute}
          />
        )}
        {currentPage === 'about' && <AboutScreen />}
        {currentPage === 'wildlife' && <WildlifeScreen triggerSound={triggerSound} />}
        {currentPage === 'experiences' && <ExperiencesScreen />}
        {currentPage === 'blog' && <BlogScreen />}
        {currentPage === 'gallery' && <GalleryScreen />}
        {currentPage === 'contact' && <ContactScreen />}
        {currentPage === 'disclaimer' && <DisclaimerScreen />}
        {currentPage === 'privacy' && <PrivacyPolicyScreen />}
        {currentPage === 'terms' && <TermsConditionsScreen />}
      </main>

      {/* RICH FOOTER */}
      <footer className="py-16 bg-[#030704] border-t border-emerald-950/40 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col gap-12 text-left">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col gap-4">
              <span className="text-xl font-bold tracking-widest text-[#c2aa72] cinzel uppercase">Gir Jungle Safari</span>
              <p className="text-gray-500 text-xs leading-relaxed uppercase tracking-wider">
                Explore the wild responsibly. Support the Asiatic lion protection programs and tribal co-habitation forests.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-xs uppercase tracking-wider text-gray-400 font-medium">
              <span className="text-[#c2aa72] font-bold tracking-widest mb-1">Information</span>
              <button onClick={() => navigateTo('disclaimer')} className="hover:text-[#c2aa72] transition-colors text-left">Disclaimer</button>
              <button onClick={() => navigateTo('privacy')} className="hover:text-[#c2aa72] transition-colors text-left">Privacy Policy</button>
              <button onClick={() => navigateTo('about')} className="hover:text-[#c2aa72] transition-colors text-left">About Us</button>
              <button onClick={() => navigateTo('contact')} className="hover:text-[#c2aa72] transition-colors text-left">Contact Us</button>
              <button onClick={() => navigateTo('terms')} className="hover:text-[#c2aa72] transition-colors text-left">Terms & Conditions</button>
            </div>
            <div class="flex flex-col gap-3 text-xs uppercase tracking-wider text-gray-400 font-medium">
              <span class="text-[#c2aa72] font-bold tracking-widest mb-1">Social Networks</span>
              <a href="#" class="hover:text-[#c2aa72] transition-colors">&bull; Instagram</a>
              <a href="#" class="hover:text-[#c2aa72] transition-colors">&bull; YouTube</a>
              <a href="#" class="hover:text-[#c2aa72] transition-colors">&bull; Facebook</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs uppercase tracking-widest text-[#c2aa72] font-bold">Newsletter Signup</span>
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); alert('Newsletter subscribed!'); }}>
                <input type="email" placeholder="you@example.com" required className="bg-[#050f08]/60 border border-emerald-900/40 rounded px-4 py-2 text-xs focus:outline-none focus:border-[#c2aa72] text-white" />
                <button type="submit" className="py-2 rounded font-bold uppercase tracking-widest text-[10px] btn-gold">Subscribe</button>
              </form>
            </div>
          </div>
          <div className="border-t border-emerald-950/45 pt-8 flex flex-col md:flex-row items-center justify-between gap-6 text-[11px] text-gray-600 uppercase tracking-widest">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <div>&copy; 2026 Gir Jungle Safari. All rights reserved.</div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 normal-case tracking-normal">
                <span>design by <a href="https://truetwist.in/" target="_blank" rel="noopener noreferrer" className="hover:text-[#c2aa72] transition-colors underline decoration-emerald-950/40 underline-offset-4">truetwist</a></span>
                <span className="text-gray-800">|</span>
                <span>marketing by <a href="https://369network.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#c2aa72] transition-colors underline decoration-emerald-950/40 underline-offset-4">369network</a></span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-amber-500 font-bold border border-amber-900/35 px-4 py-1 rounded bg-[#030905]">
              <span>Explore the Wild Responsibly</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

const EXPERIENCE_CARDS = [
  {
    id: 'jeep',
    title: 'Jeep Safari',
    subtitle: 'Jungle Trail',
    description: 'Feel the real adventure deep in the jungle.',
    image: '/experiences/jeep-safari.jpg',
    icon: 'jeep',
    route: 'experiences',
  },
  {
    id: 'wildlife',
    title: 'Wildlife Safari',
    subtitle: 'Habitat Expedition',
    description: 'Explore incredible wildlife in their natural habitat.',
    image: '/experiences/wildlife-safari.jpg',
    icon: 'paw',
    route: 'wildlife',
  },
  {
    id: 'night',
    title: 'Night Safari',
    subtitle: 'Nocturnal Tour',
    description: 'Discover the jungle at night when it truly comes alive.',
    image: '/experiences/night-safari.jpg',
    icon: 'moon',
    route: 'experiences',
  },
  {
    id: 'bird',
    title: 'Bird Watching',
    subtitle: 'Avian Sanctuary',
    description: 'Spot exotic birds and enjoy their beautiful moments.',
    image: '/experiences/bird-watching.jpg',
    icon: 'bird',
    route: 'wildlife',
  },
  {
    id: 'nature',
    title: 'Nature Walk',
    subtitle: 'Forest Eco-Trail',
    description: 'Walk close to nature and feel the peace of the forest.',
    image: '/experiences/nature-walk.jpg',
    icon: 'walk',
    route: 'about',
  },
];

const SAFARI_PACKAGES = [
  {
    id: 'ranthambore',
    title: 'Ranthambore Safari',
    subtitle: 'Tiger Territory Expedition',
    location: 'Ranthambore, Rajasthan',
    duration: '2 Nights / 3 Days',
    price: 12999,
    rating: '4.8',
    reviews: 210,
    image: '/experiences/ranthambore_tiger.png',
    badge: 'Best Seller',
    description: 'Track the majestic Bengal tiger through ancient fort ruins, dry deciduous forests, and mirror-still lakes in one of India\'s most celebrated wildlife reserves.',
    highlights: [
      'Morning & evening open Gypsy safaris',
      'Ranthambore Fort heritage viewpoint',
      'Senior naturalist with every drive',
      'Premium forest lodge stay',
    ],
    inclusions: ['Accommodation', 'All meals', 'Park permits', 'Gypsy safaris', 'Guide fees'],
    bestSeason: 'Oct – Jun',
    safaris: '4 Jeep Safaris',
  },
  {
    id: 'jimcorbett',
    title: 'Jim Corbett Escape',
    subtitle: 'Himalayan Foothills Retreat',
    location: 'Uttarakhand',
    duration: '2 Nights / 3 Days',
    price: 10999,
    rating: '4.7',
    reviews: 98,
    image: '/experiences/jim_corbett_elephant.png',
    badge: 'Family Friendly',
    description: 'Wake to misty Sal forests and Ramganga river valleys. Corbett blends elephant corridors, birdlife, and classic tiger country in the Himalayan foothills.',
    highlights: [
      'Dhikala & Bijrani zone drives',
      'River-side nature walks',
      'Birding trails at dawn',
      'Comfortable jungle resort',
    ],
    inclusions: ['Resort stay', 'Breakfast & dinner', 'Safari permits', 'Gypsy rides', 'Forest guide'],
    bestSeason: 'Nov – Jun',
    safaris: '3 Jeep Safaris',
  },
  {
    id: 'bandhavgarh',
    title: 'Bandhavgarh Safari',
    subtitle: 'High-Density Tiger Country',
    location: 'Madhya Pradesh',
    duration: '3 Nights / 4 Days',
    price: 10999,
    rating: '4.8',
    reviews: 110,
    image: '/experiences/bandhavgarh_jeep.png',
    badge: 'Photographer\'s Pick',
    description: 'Among India\'s highest tiger-sighting success rates. Bandhavgarh\'s compact core zone and dramatic escarpments make every safari intensely rewarding.',
    highlights: [
      'Extended core-zone safaris',
      'Bandhavgarh ancient fort trail',
      'Photography-friendly gypsy seating',
      'Extra night for deeper exploration',
    ],
    inclusions: ['3-night lodge', 'All meals', 'Zone permits', '4 safaris', 'Naturalist guide'],
    bestSeason: 'Oct – Jun',
    safaris: '5 Jeep Safaris',
  },
  {
    id: 'kabini',
    title: 'Kabini Wildlife Tour',
    subtitle: 'Leopard & Elephant Haven',
    location: 'Kabini, Karnataka',
    duration: '2 Nights / 3 Days',
    price: 15999,
    rating: '4.9',
    reviews: 110,
    image: '/experiences/kabini_leopard.png',
    badge: 'Premium',
    description: 'Kabini backwaters attract leopards, wild dogs, and large elephant herds. Sunset boat rides and night sounds create an unforgettable southern safari.',
    highlights: [
      'Nagarhole park safaris',
      'Backwater boat cruise',
      'Leopard & elephant tracking',
      'Luxury riverside lodge',
    ],
    inclusions: ['Luxury stay', 'Full board meals', 'Boat & jeep safaris', 'Park entry', 'Expert tracker'],
    bestSeason: 'Oct – May',
    safaris: '4 Safaris + Boat',
  },
  {
    id: 'kaziranga',
    title: 'Kaziranga Adventure',
    subtitle: 'One-Horned Rhino Quest',
    location: 'Assam',
    duration: '2 Nights / 3 Days',
    price: 11999,
    rating: '4.8',
    reviews: 88,
    image: '/experiences/kaziranga_rhino.png',
    badge: 'UNESCO Site',
    description: 'Home to two-thirds of the world\'s great one-horned rhinos. Kaziranga\'s tall elephant grass and Brahmaputra floodplains offer a completely unique safari rhythm.',
    highlights: [
      'Central & Western range drives',
      'Rhino & wild buffalo sightings',
      'Tea-garden cultural stop',
      'Elephant grassland landscapes',
    ],
    inclusions: ['Eco lodge', 'Meals included', 'Safari permits', 'Gypsy safaris', 'Local guide'],
    bestSeason: 'Nov – Apr',
    safaris: '4 Jeep Safaris',
  },
  {
    id: 'girlion',
    title: 'Gir Lion Safari',
    subtitle: 'Asiatic Lion Kingdom',
    location: 'Sasan Gir, Gujarat',
    duration: '2 Nights / 3 Days',
    price: 11499,
    rating: '4.7',
    reviews: 70,
    image: '/experiences/gir_lion.png',
    badge: 'Signature',
    description: 'The only place on Earth to see Asiatic lions in the wild. Gir\'s teak woodlands, Maldhari coexistence, and golden prides define Gujarat\'s living heritage.',
    highlights: [
      'Sasan & Devalia zone safaris',
      'Asiatic lion pride tracking',
      'Kamleshwar reservoir circuit',
      'Tribal forest lodge experience',
    ],
    inclusions: ['Forest lodge', 'All meals', 'Gujarat permits', 'Gypsy safaris', 'Ranger naturalist'],
    bestSeason: 'Dec – Jun',
    safaris: '4 Gypsy Safaris',
  },
];

function ExperienceCardIcon({ type }) {
  if (type === 'jeep') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 14h16l-1.2-4.5H5.2L4 14z" />
        <circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="17" cy="17" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'paw') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="8" r="2.2" />
        <circle cx="12" cy="6" r="2.2" />
        <circle cx="17" cy="8" r="2.2" />
        <circle cx="9" cy="13" r="2" />
        <circle cx="15" cy="13" r="2" />
        <path d="M10 16c1 2.5 3 2.5 4 0 1.2 2.8 3.5 3.2 5 1.5-2.8-.2-5.2-2.5-6.5-2.3 1.3-3.7 3.7-2.5 6.5 1.5-.4 3.8-1.7 5-1.5z" />
      </svg>
    );
  }
  if (type === 'moon') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
      </svg>
    );
  }
  if (type === 'bird') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 12c3-5 8-7 12-6-1 4-4 8-9 10 2-2 3-4 3-4z" />
        <circle cx="16" cy="8" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="6" r="2" />
      <path d="M6 20v-6l2-2h8l2 2v6" />
      <path d="M12 10v4" />
    </svg>
  );
}

const FEATURE_ITEMS = [
  { title: 'Best Price', subtitle: 'Guaranteed' },
  { title: 'Expert Guides', subtitle: 'Trained & Friendly' },
  { title: 'Wildlife Safety', subtitle: 'Our First Priority' },
  { title: 'Memorable', subtitle: 'Experiences' },
  { title: '24/7 Support', subtitle: 'We Are Here' },
];

const TRAVELER_REVIEWS = [
  {
    id: 'ravi',
    name: 'Ravi Sharma',
    city: 'Mumbai',
    text: 'An unforgettable experience! The safari was perfectly organized and we saw so many amazing animals. Highly recommended!',
  },
  {
    id: 'neha',
    name: 'Neha Patel',
    city: 'Ahmedabad',
    text: 'The guides are very knowledgeable and friendly. The jungle stay was awesome. Will visit again!',
  },
  {
    id: 'ankit',
    name: 'Ankit Verma',
    city: 'Delhi',
    text: 'Best safari experience of my life. The jungle views, the animals, everything was just perfect!',
  },
];

function FeatureCard({ item, index, visible, className = '' }) {
  return (
    <div
      role="listitem"
      className={`feature-card feature-card-animated p-4 sm:p-5 lg:p-6 flex items-start gap-2.5 sm:gap-4 ${visible ? 'feature-card-visible' : ''
        } ${className}`}
      style={{ '--feature-delay': `${(index % FEATURE_ITEMS.length) * 0.1}s` }}
    >
      <span className="feature-card-dot shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#c2aa72] cinzel whitespace-nowrap">
          {item.title}
        </h4>
        <p className="text-[8px] sm:text-[10px] text-gray-500 uppercase tracking-wider mt-0.5 sm:mt-1 whitespace-nowrap">
          {item.subtitle}
        </p>
      </div>
    </div>
  );
}

function FeaturesBar() {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const marqueeItems = [...FEATURE_ITEMS, ...FEATURE_ITEMS];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="features-bar features-bar--stacked bg-transparent border-t border-[#c2aa72]/15 relative z-40 overflow-x-hidden overflow-y-visible"
    >
      <div className="section-safari-shadow" aria-hidden="true" />
      <div className="features-bar-shine pointer-events-none" aria-hidden="true" />
      <div className="features-bar-fade-edges md:hidden pointer-events-none" aria-hidden="true" />
      <div className="features-bar__inner max-w-7xl mx-auto px-3 sm:px-6 w-full min-w-0 overflow-x-clip">
        {/* Mobile: infinite auto-scroll marquee */}
        <div
          className={`features-bar-marquee-viewport md:hidden ${visible ? 'is-visible' : ''}`}
          role="list"
          aria-label="Safari highlights"
        >
          <div className="features-bar-marquee-track">
            {marqueeItems.map((item, index) => (
              <FeatureCard
                key={`${item.title}-${index}`}
                item={item}
                index={index}
                visible={visible}
                className="feature-card-marquee"
              />
            ))}
          </div>
        </div>

        {/* Tablet / desktop: static grid */}
        <div className="features-bar-track" role="list" aria-label="Safari highlights">
          {FEATURE_ITEMS.map((item, index) => (
            <FeatureCard
              key={item.title}
              item={item}
              index={index}
              visible={visible}
              className={
                index === FEATURE_ITEMS.length - 1
                  ? 'sm:col-span-2 lg:col-span-1 sm:justify-self-center sm:w-full sm:max-w-xs'
                  : ''
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const EXP_SHAPE_IDS = ['exp-shape-a', 'exp-shape-b', 'exp-shape-c', 'exp-shape-b', 'exp-shape-a'];

function SectionHeading({ eyebrow, title, id, align = 'center', className = '' }) {
  const alignClass = align === 'left' ? 'section-heading--left' : '';

  return (
    <header className={`section-heading ${alignClass}${className ? ` ${className}` : ''}`}>
      <div className="section-heading__eyebrow-row">
        <span className="section-heading__line" aria-hidden="true" />
        <p className="section-heading__eyebrow">{eyebrow}</p>
        <span className="section-heading__line" aria-hidden="true" />
      </div>
      <h2 id={id} className="section-heading__title">{title}</h2>
      <div className="section-heading__divider">
        <span className="section-heading__line" aria-hidden="true" />
        <span className="section-heading__paw" aria-hidden="true">&#128062;</span>
        <span className="section-heading__line" aria-hidden="true" />
      </div>
    </header>
  );
}

function SafariExperiencesSection({ navigateTo }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(2);

  const updateActiveFromScroll = () => {
    const track = trackRef.current;
    if (!track) return;

    const cards = [...track.querySelectorAll('.experience-card')];
    if (!cards.length) return;

    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;
    let closest = 0;
    let minDistance = Infinity;

    cards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(trackCenter - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closest = index;
      }
    });

    setActiveIndex(closest);
  };

  const scrollToIndex = (index) => {
    const track = trackRef.current;
    if (!track) return;

    const cards = track.querySelectorAll('.experience-card');
    const card = cards[index];
    if (!card) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const cardLeft = cardRect.left - trackRect.left + track.scrollLeft;
    const targetLeft = cardLeft - (trackRect.width - cardRect.width) / 2;

    track.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setActiveIndex(index);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const timer = window.setTimeout(() => scrollToIndex(2), 120);
    updateActiveFromScroll();
    track.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    window.addEventListener('resize', updateActiveFromScroll);

    return () => {
      window.clearTimeout(timer);
      track.removeEventListener('scroll', updateActiveFromScroll);
      window.removeEventListener('resize', updateActiveFromScroll);
    };
  }, []);

  const scrollCards = (direction) => {
    const next = Math.max(0, Math.min(EXPERIENCE_CARDS.length - 1, activeIndex + direction));
    scrollToIndex(next);
  };

  return (
    <section className="experience-showcase experience-showcase--stacked relative z-10">
      <svg className="experience-shape-defs" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="exp-shape-a" clipPathUnits="objectBoundingBox">
            <path d="M 0.065 0.115 Q 0.065 0.035 0.14 0.028 Q 0.36 0.012 0.55 0.048 Q 0.68 0.075 0.82 0.055 L 0.88 0.042 Q 0.965 0.075 0.958 0.175 L 0.968 0.875 Q 0.962 0.968 0.855 0.978 L 0.145 0.978 Q 0.038 0.968 0.042 0.865 L 0.052 0.2 Q 0.065 0.115 0.065 0.115 Z" />
          </clipPath>
          <clipPath id="exp-shape-b" clipPathUnits="objectBoundingBox">
            <path d="M 0.058 0.108 Q 0.058 0.03 0.148 0.024 Q 0.42 0.018 0.62 0.04 Q 0.75 0.068 0.865 0.05 L 0.925 0.038 Q 0.972 0.072 0.965 0.168 L 0.972 0.882 Q 0.965 0.972 0.87 0.982 L 0.128 0.982 Q 0.035 0.972 0.038 0.878 L 0.048 0.185 Q 0.058 0.108 0.058 0.108 Z" />
          </clipPath>
          <clipPath id="exp-shape-c" clipPathUnits="objectBoundingBox">
            <path d="M 0.062 0.12 Q 0.062 0.038 0.135 0.032 Q 0.38 0.015 0.6 0.052 Q 0.72 0.082 0.84 0.062 L 0.9 0.048 Q 0.968 0.085 0.96 0.18 L 0.97 0.888 Q 0.958 0.975 0.848 0.985 L 0.152 0.985 Q 0.042 0.975 0.045 0.87 L 0.055 0.195 Q 0.062 0.12 0.062 0.12 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="experience-showcase-bg" aria-hidden="true">
        <div className="experience-showcase-bg-photo" />
        <div className="experience-showcase-bg-overlay" />
      </div>

      <div className="experience-showcase__content max-w-[1400px] mx-auto px-3 sm:px-6 relative z-[1] w-full min-w-0 overflow-x-clip">
        <SectionHeading eyebrow="Explore" title="Safari & Nature" className="experience-showcase-header" />

        <div className="experience-carousel-wrap relative">
          <button
            type="button"
            onClick={() => scrollCards(-1)}
            className="experience-nav-btn experience-nav-btn-left"
            aria-label="Previous experiences"
          >
            &lt;
          </button>

          <div ref={trackRef} className="experience-cards-track">
            {EXPERIENCE_CARDS.map((card, index) => (
              <article
                key={card.id}
                className={`experience-card experience-card--${card.id} ${activeIndex === index ? 'is-active' : ''
                  }`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => navigateTo(card.route)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateTo(card.route);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="experience-card-shell">
                  {/* Beautiful ancient carved stone arch gateway SVG */}
                  <svg className="experience-card-rim" viewBox="0 0 220 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <defs>
                      {/* Unique clip path for this card's inner arch */}
                      <clipPath id={`inner-arch-clip-${card.id}`}>
                        <path d="M 20,280 L 20,110 A 90 90 0 0,1 200,110 L 200,280 Z" />
                      </clipPath>

                      {/* Unique vignette gradient fading the bottom of the photo */}
                      <linearGradient id={`vignette-gradient-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#040a06" stopOpacity="0" />
                        <stop offset="65%" stopColor="#040a06" stopOpacity="0" />
                        <stop offset="95%" stopColor="#040a06" stopOpacity="0.7" />
                      </linearGradient>

                      {/* Beautiful Earthy Stone Texture Filter */}
                      <filter id={`stone-bump-filter-${card.id}`} x="0%" y="0%" width="100%" height="100%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" result="noise" />
                        <feDiffuseLighting in="noise" lighting-color="#f3e3cb" surfaceScale="3" result="light">
                          <feDistantLight azimuth="55" elevation="60" />
                        </feDiffuseLighting>
                        <feBlend mode="multiply" in="SourceGraphic" in2="light" result="blend" />
                        <feColorMatrix type="matrix" values="
                          0.85 0 0 0 0.05
                          0 0.78 0 0 0.03
                          0 0 0.70 0 0.01
                          0 0 0 1 0" result="colored" />
                        <feComposite operator="in" in="colored" in2="SourceGraphic" />
                      </filter>

                      <linearGradient id={`stone-gradient-${card.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#584635" />
                        <stop offset="50%" stopColor="#3b2e20" />
                        <stop offset="100%" stopColor="#251c12" />
                      </linearGradient>
                    </defs>

                    {/* 1. Animal image rendered inside the SVG, clipped to the arch curve */}
                    <image
                      href={card.image}
                      x="20"
                      y="0"
                      width="180"
                      height="280"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#inner-arch-clip-${card.id})`}
                      className="experience-card-img-svg"
                    />

                    {/* No vignette overlay and no blurred rectangular shadow to ensure 100% bright, crisp safari photos */}

                    {/* 2. Closed Textured 3D Stone Arch Block */}
                    <path
                      d="M 18,300 A 18 18 0 0,1 0,282 L 0,110 A 110 110 0 0,1 220,110 L 220,282 A 18 18 0 0,1 202,300 Z M 20,280 L 20,110 A 90 90 0 0,1 200,110 L 200,280 Z"
                      fill={`url(#stone-gradient-${card.id})`}
                      filter={`url(#stone-bump-filter-${card.id})`}
                      fillRule="evenodd"
                    />

                    {/* 3. Gold bevel highlights for heavy 3D rock structure */}
                    <path
                      d="M 20,280 L 20,110 A 90 90 0 0,1 200,110 L 200,280 Z"
                      stroke="#c2aa72"
                      strokeWidth="1.2"
                      opacity="0.45"
                    />
                    <path
                      d="M 18,300 A 18 18 0 0,1 0,282 L 0,110 A 110 110 0 0,1 220,110 L 220,282 A 18 18 0 0,1 202,300 Z"
                      stroke="#ebd19a"
                      strokeWidth="0.8"
                      opacity="0.35"
                    />

                    {/* 4. Carved stone voussoir segment joints (cracks) */}
                    <g stroke="#160e07" strokeWidth="2.8" strokeLinecap="round" opacity="0.95">
                      {/* Straight vertical side joints */}
                      <line x1="0" y1="240" x2="20" y2="240" />
                      <line x1="200" y1="240" x2="220" y2="240" />

                      <line x1="0" y1="180" x2="20" y2="180" />
                      <line x1="200" y1="180" x2="220" y2="180" />

                      <line x1="0" y1="120" x2="20" y2="120" />
                      <line x1="200" y1="120" x2="220" y2="120" />

                      {/* Curved voussoir joints */}
                      <line x1="19" y1="67" x2="5.5" y2="61" />
                      <line x1="43" y1="38" x2="33.5" y2="28" />
                      <line x1="74" y1="19" x2="68" y2="7" />

                      <line x1="146" y1="19" x2="152" y2="7" />
                      <line x1="177" y1="38" x2="186.5" y2="28" />
                      <line x1="201" y1="67" x2="214.5" y2="61" />

                      {/* Bottom horizontal base joints to wrap wood plaque */}
                      <line x1="60" y1="280" x2="60" y2="300" />
                      <line x1="160" y1="280" x2="160" y2="300" />
                    </g>

                    {/* Subtle highlights parallel to joints */}
                    <g stroke="#ffffff" strokeWidth="0.8" opacity="0.22" strokeLinecap="round">
                      <line x1="0" y1="241.5" x2="20" y2="241.5" />
                      <line x1="200" y1="241.5" x2="220" y2="241.5" />
                      <line x1="0" y1="181.5" x2="20" y2="181.5" />
                      <line x1="200" y1="181.5" x2="220" y2="181.5" />
                      <line x1="0" y1="121.5" x2="20" y2="121.5" />
                      <line x1="200" y1="121.5" x2="220" y2="121.5" />
                      <line x1="61.5" y1="280" x2="61.5" y2="300" />
                      <line x1="161.5" y1="280" x2="161.5" y2="300" />
                    </g>
                  </svg>

                  {/* Beautiful wooden plaque text container at the bottom */}
                  <div className="experience-card-plaque">
                    <div className="experience-card-plaque-wood">
                      <h3 className="experience-card-title">{card.title}</h3>
                      <p className="experience-card-subtitle">{card.subtitle}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollCards(1)}
            className="experience-nav-btn experience-nav-btn-right"
            aria-label="Next experiences"
          >
            &gt;
          </button>
        </div>
      </div>
    </section>
  );
}

function PackageModalIcon({ type }) {
  const stroke = 'currentColor';
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: '1.6', 'aria-hidden': true };

  if (type === 'duration') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  if (type === 'safari') {
    return (
      <svg {...common}>
        <path d="M4 14h16l-1.5-5H5.5L4 14z" />
        <circle cx="7.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'price') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.5 8.5c.5-1 2-1 2.5 0 .6 1.2-2 1.2-1.5 2.5.3.8 1.2 1 2 1M12 16v-1" />
      </svg>
    );
  }
  if (type === 'rating') {
    return (
      <svg {...common}>
        <path d="M12 4l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.2l5-.7L12 4z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'pin') {
    return (
      <svg {...common}>
        <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
        <circle cx="12" cy="11" r="2" />
      </svg>
    );
  }
  if (type === 'season') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function PackageDetailModal({ pkg, onClose, onBook }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="package-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`package-modal-title-${pkg.id}`}
      onClick={onClose}
    >
      <div className="package-modal" onClick={(event) => event.stopPropagation()}>
        <div className="package-modal__topo" aria-hidden="true" />

        <button type="button" className="package-modal__close" aria-label="Close package details" onClick={onClose}>
          <span aria-hidden="true">&times;</span>
        </button>

        <div className="package-modal__main">
          <div className="package-modal__left">
            {pkg.badge && (
              <div className="package-modal__badge">
                <span className="package-modal__badge-paw" aria-hidden="true">🐾</span>
                <span>{pkg.badge}</span>
              </div>
            )}

            <div className="package-modal__ring-wrap">
              <div className="package-modal__ring" aria-hidden="true" />
              <div className="package-modal__circle">
                <img src={pkg.image} alt={pkg.title} className="package-modal__circle-image" />
              </div>
            </div>

            <div className="package-modal__emblem">
              <span className="package-modal__emblem-icon" aria-hidden="true">★</span>
              <span className="package-modal__emblem-label">FROM</span>
              <strong className="package-modal__emblem-value">&#8377;{pkg.price.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          <div className="package-modal__right">
            <h2 id={`package-modal-title-${pkg.id}`} className="package-modal__title cinzel">
              {pkg.title}
            </h2>
            <p className="package-modal__subtitle">{pkg.subtitle}</p>

            <p className="package-modal__description">{pkg.description}</p>

            <div className="package-modal__stats">
              <div className="package-modal__stat">
                <span className="package-modal__stat-icon"><PackageModalIcon type="duration" /></span>
                <div>
                  <span className="package-modal__stat-label">Duration</span>
                  <span className="package-modal__stat-value">{pkg.duration}</span>
                </div>
              </div>
              <div className="package-modal__stat">
                <span className="package-modal__stat-icon"><PackageModalIcon type="safari" /></span>
                <div>
                  <span className="package-modal__stat-label">Safaris</span>
                  <span className="package-modal__stat-value">{pkg.safaris}</span>
                </div>
              </div>
              <div className="package-modal__stat">
                <span className="package-modal__stat-icon"><PackageModalIcon type="price" /></span>
                <div>
                  <span className="package-modal__stat-label">From</span>
                  <span className="package-modal__stat-value">&#8377;{pkg.price.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="package-modal__stat">
                <span className="package-modal__stat-icon"><PackageModalIcon type="rating" /></span>
                <div>
                  <span className="package-modal__stat-label">Rating</span>
                  <span className="package-modal__stat-value">{pkg.rating} ({pkg.reviews})</span>
                </div>
              </div>
            </div>

            <div className="package-modal__facts">
              <h3 className="package-modal__facts-title">Safari Highlights</h3>
              <ul className="package-modal__facts-list">
                {pkg.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="package-modal__facts package-modal__facts--includes">
              <h3 className="package-modal__facts-title">Package Includes</h3>
              <ul className="package-modal__facts-list">
                {pkg.inclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <footer className="package-modal__bar">
          <div className="package-modal__bar-item">
            <span className="package-modal__bar-icon"><PackageModalIcon type="pin" /></span>
            <div>
              <span className="package-modal__bar-label">Where to Spot</span>
              <strong className="package-modal__bar-value">{pkg.location}</strong>
            </div>
          </div>

          <div className="package-modal__bar-item">
            <span className="package-modal__bar-icon"><PackageModalIcon type="season" /></span>
            <div>
              <span className="package-modal__bar-label">Best Time</span>
              <strong className="package-modal__bar-value">{pkg.bestSeason}</strong>
            </div>
          </div>

          <button type="button" className="package-modal__book-btn" onClick={onBook}>
            <span className="package-modal__book-icon" aria-hidden="true">🔭</span>
            Book This Safari
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function PopularPackagesSection({ navigateTo }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const updateActiveFromScroll = () => {
    const track = trackRef.current;
    if (!track) return;

    const cards = [...track.querySelectorAll('.package-card-wrap')];
    if (!cards.length) return;

    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;
    let closest = 0;
    let minDistance = Infinity;

    cards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(trackCenter - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closest = index;
      }
    });

    setActiveIndex(closest);
  };

  const scrollToIndex = (index) => {
    const track = trackRef.current;
    if (!track) return;

    const clamped = Math.max(0, Math.min(index, SAFARI_PACKAGES.length - 1));
    const cards = track.querySelectorAll('.package-card-wrap');
    const card = cards[clamped];
    if (!card) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const cardLeft = cardRect.left - trackRect.left + track.scrollLeft;
    const targetLeft = cardLeft - (trackRect.width - cardRect.width) / 2;

    track.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  const scrollPackages = (direction) => {
    scrollToIndex(activeIndex + direction);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateActiveFromScroll();
    track.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    window.addEventListener('resize', updateActiveFromScroll);

    return () => {
      track.removeEventListener('scroll', updateActiveFromScroll);
      window.removeEventListener('resize', updateActiveFromScroll);
    };
  }, []);

  const handleCardClick = (index, pkg) => {
    scrollToIndex(index);
    setSelectedPackage(pkg);
  };

  const handleBookPackage = () => {
    setSelectedPackage(null);
    navigateTo('experiences');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section id="popular-packages" className="packages-section" aria-labelledby="packages-heading">
      <div className="section-safari-shadow" aria-hidden="true" />
      <div className="packages-section-ambient" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 relative z-[1]">
        <SectionHeading eyebrow="Popular" title="Safari Packages" id="packages-heading" className="mb-8 sm:mb-10" />
      </div>

      <div className="packages-carousel-wrap relative">
        <button
          type="button"
          className="packages-nav-btn packages-nav-btn-left"
          onClick={() => scrollPackages(-1)}
          disabled={activeIndex === 0}
          aria-label="Previous safari package"
        >
          &lt;
        </button>

        <div ref={trackRef} className="packages-cards-track">
            {SAFARI_PACKAGES.map((pkg, index) => (
              <div
                key={pkg.id}
                className={`package-card-wrap ${activeIndex === index ? 'is-active' : ''}`}
                onClick={() => handleCardClick(index, pkg)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleCardClick(index, pkg);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${pkg.title}`}
              >
                <article className="package-card relative">
                  {/* The SVG background */}
                  <div className="absolute inset-0 z-0">
                    <svg viewBox="0 0 240 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id={`parchment-grad-${pkg.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ebdcb9" />
                          <stop offset="50%" stopColor="#decfa9" />
                          <stop offset="100%" stopColor="#cdbe99" />
                        </linearGradient>
                        <clipPath id={`parchment-clip-${pkg.id}`}>
                          <path d="M 12 12 L 30 14 L 50 11 L 70 13 L 90 10 L 110 12 L 130 14 L 150 11 L 170 13 L 190 10 L 210 12 L 228 12 L 226 30 L 229 55 L 227 80 L 229 110 L 226 140 L 228 170 L 226 200 L 229 230 L 227 260 L 229 290 L 228 308 L 210 306 L 190 309 L 170 307 L 150 310 L 130 308 L 110 306 L 90 309 L 70 307 L 50 310 L 30 308 L 12 308 L 14 290 L 11 260 L 13 230 L 10 200 L 12 170 L 14 140 L 11 110 L 13 80 L 10 55 L 12 30 Z" />
                        </clipPath>
                      </defs>
                      <path
                        d="M 12 12 L 30 14 L 50 11 L 70 13 L 90 10 L 110 12 L 130 14 L 150 11 L 170 13 L 190 10 L 210 12 L 228 12 L 226 30 L 229 55 L 227 80 L 229 110 L 226 140 L 228 170 L 226 200 L 229 230 L 227 260 L 229 290 L 228 308 L 210 306 L 190 309 L 170 307 L 150 310 L 130 308 L 110 306 L 90 309 L 70 307 L 50 310 L 30 308 L 12 308 L 14 290 L 11 260 L 13 230 L 10 200 L 12 170 L 14 140 L 11 110 L 13 80 L 10 55 L 12 30 Z"
                        fill={`url(#parchment-grad-${pkg.id})`}
                        stroke="#2c1e12"
                        strokeWidth="5.5"
                        strokeLinejoin="round"
                      />
                      <g clipPath={`url(#parchment-clip-${pkg.id})`}>
                        <image
                          href={pkg.image}
                          x="12"
                          y="12"
                          width="216"
                          height="138"
                          preserveAspectRatio="xMidYMid slice"
                        />
                        <path d="M 12 150 L 228 150" stroke="#3a2b1d" strokeWidth="3.2" strokeDasharray="3 3" />
                      </g>
                    </svg>
                  </div>

                  {/* Card Content Overlay */}
                  <div className="relative z-10 flex flex-col h-full justify-between p-[24px_24px_22px_24px]">
                    <div className="h-[126px] pointer-events-none" />

                    <div className="flex-1 flex flex-col justify-between mt-2 text-[#3a2a1a]">
                      <div>
                        <h3 className="font-bold text-[0.82rem] tracking-[0.04em] uppercase cinzel text-[#2d1c10] mb-1 leading-tight">
                          {pkg.title}
                        </h3>
                        <div className="flex items-center gap-1 text-[0.62rem] font-bold text-[#5c4a37]">
                          <span className="text-[0.72rem]">&#128197;</span>
                          <span>{pkg.duration}</span>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="text-[1.05rem] font-extrabold text-[#2a1708] leading-none mb-1">
                          &#8377;{pkg.price.toLocaleString('en-IN')}<span className="text-[0.58rem] font-bold text-[#5c4a37] tracking-wider uppercase"> / Person</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex text-[#d4af37] text-[0.65rem]">
                            &#9733;&#9733;&#9733;&#9733;&#9733;
                          </div>
                          <span className="text-[0.58rem] font-bold text-[#5c4a37]">
                            {pkg.rating} ({pkg.reviews})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            ))}
        </div>

        <button
          type="button"
          className="packages-nav-btn packages-nav-btn-right"
          onClick={() => scrollPackages(1)}
          disabled={activeIndex === SAFARI_PACKAGES.length - 1}
          aria-label="Next safari package"
        >
          &gt;
        </button>
      </div>

      {selectedPackage && (
        <PackageDetailModal
          pkg={selectedPackage}
          onClose={() => setSelectedPackage(null)}
          onBook={handleBookPackage}
        />
      )}
    </section>
  );
}

function TravelersSaySection() {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveFromScroll = () => {
    const track = trackRef.current;
    if (!track) return;

    const cards = [...track.querySelectorAll('.review-card-wrap')];
    if (!cards.length) return;

    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;
    let closest = 0;
    let minDistance = Infinity;

    cards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(trackCenter - cardCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closest = index;
      }
    });

    setActiveIndex(closest);
  };

  const scrollToIndex = (index) => {
    const track = trackRef.current;
    if (!track) return;

    const clamped = Math.max(0, Math.min(index, TRAVELER_REVIEWS.length - 1));
    const cards = track.querySelectorAll('.review-card-wrap');
    const card = cards[clamped];
    if (!card) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardLeft = cardRect.left - trackRect.left + track.scrollLeft;
    const targetLeft = cardLeft - (trackRect.width - cardRect.width) / 2;

    track.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateActiveFromScroll();
    track.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    window.addEventListener('resize', updateActiveFromScroll);

    return () => {
      track.removeEventListener('scroll', updateActiveFromScroll);
      window.removeEventListener('resize', updateActiveFromScroll);
    };
  }, []);

  return (
    <section className="reviews-section relative z-10 border-b border-[#c2aa72]/10" aria-labelledby="reviews-heading">
      <div className="section-safari-shadow" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 relative z-10 w-full min-w-0">
        <SectionHeading
          eyebrow="What Our"
          title="Travelers Say"
          id="reviews-heading"
          className="reviews-section__header"
        />

        <div className="reviews-carousel-wrap">
          <div ref={trackRef} className="reviews-cards-track" role="list" aria-label="Traveler reviews">
            {TRAVELER_REVIEWS.map((review, index) => (
              <div
                key={review.id}
                role="listitem"
                className={`review-card-wrap ${activeIndex === index ? 'is-active' : ''}`}
              >
                <article className="review-card glass-card">
                  <div className="review-card__body">
                    <div className="review-card__stars text-amber-500" aria-label="5 out of 5 stars">
                      <span aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                    </div>
                    <blockquote className="review-card__quote">
                      &ldquo;{review.text}&rdquo;
                    </blockquote>
                  </div>
                  <footer className="review-card__author">
                    <div className="review-card__avatar" aria-hidden="true" />
                    <div className="min-w-0">
                      <cite className="review-card__name not-italic">{review.name}</cite>
                      <span className="review-card__city">{review.city}</span>
                    </div>
                  </footer>
                </article>
              </div>
            ))}
          </div>

          <div className="reviews-controls md:hidden">
            <button
              type="button"
              className="reviews-nav-btn"
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Previous review"
            >
              &lt;
            </button>
            <div className="reviews-dots" role="tablist" aria-label="Review pagination">
              {TRAVELER_REVIEWS.map((review, index) => (
                <button
                  key={review.id}
                  type="button"
                  role="tab"
                  className={`reviews-dot ${activeIndex === index ? 'is-active' : ''}`}
                  aria-label={`Review ${index + 1} of ${TRAVELER_REVIEWS.length}`}
                  aria-selected={activeIndex === index}
                  onClick={() => scrollToIndex(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className="reviews-nav-btn"
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={activeIndex === TRAVELER_REVIEWS.length - 1}
              aria-label="Next review"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================================================
// HOME SCREEN COMPONENT
// ==========================================================================
function HomeScreen({ triggerSound, navigateTo, isMuted, siteEntered, heroAudioSyncRef, onAudioUnmute }) {
  const heroVideoRef = useRef(null);
  const heroSectionRef = useRef(null);
  const isInHeroRef = useRef(true);
  const [isInHero, setIsInHero] = useState(true);
  const [mousePos, setMousePos] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400
  });
  const [isHovered] = useState(true);

  const parallaxBgX = (mousePos.x - (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2) * 0.025;
  const parallaxBgY = (mousePos.y - (typeof window !== 'undefined' ? window.innerHeight : 800) / 2) * 0.025;
  const parallaxTextX = (mousePos.x - (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2) * -0.035;
  const parallaxTextY = (mousePos.y - (typeof window !== 'undefined' ? window.innerHeight : 800) / 2) * -0.035;

  const [leaves, setLeaves] = useState([]);
  const [jeepActive, setJeepActive] = useState(false);

  useEffect(() => {
    // Generate dynamic floating leaf states
    const leafColors = ['#3a5c43', '#8a7344', '#5c4827', '#25422e'];
    const leafArray = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 12}s`,
      duration: `${10 + Math.random() * 10}s`,
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      scale: 0.5 + Math.random() * 0.8
    }));
    setLeaves(leafArray);

    let gateTriggered = false;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const viewHeight = window.innerHeight;
      const progress = Math.min(1, Math.max(0, scrollTop / viewHeight));

      // Gate creak audio trigger
      if (progress > 0.05 && !gateTriggered) {
        gateTriggered = true;
        audio.playGateSound();
      } else if (progress <= 0.05) {
        gateTriggered = false;
      }

      // Check Jeep road progress
      const roadElement = document.getElementById('safari-begins-road');
      if (roadElement) {
        const rect = roadElement.getBoundingClientRect();
        if (rect.top < viewHeight && rect.bottom > 0) {
          if (!jeepActive) {
            audio.startJeep();
            setJeepActive(true);
          }
          const totalDist = rect.height + viewHeight;
          const currentProgress = (viewHeight - rect.top) / totalDist;
          audio.updateJeepSpeed(Math.max(0, Math.min(1, currentProgress)));
        } else {
          if (jeepActive) {
            audio.stopJeep();
            setJeepActive(false);
          }
        }
      }
    };

    const handleGlobalMouseMove = (e) => {
      setMousePos({
        x: e.clientX,
        y: e.clientY
      });
    };
    // Touch move handler for mobile interaction
    const handleGlobalTouchMove = (e) => {
      if (e.touches && e.touches.length) {
        const touch = e.touches[0];
        setMousePos({
          x: touch.clientX,
          y: touch.clientY
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      audio.stopJeep();
    };
  }, [jeepActive]);

  useEffect(() => {
    const heroEl = heroSectionRef.current;
    if (!heroEl) return undefined;

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        setIsInHero(entry.isIntersecting && entry.intersectionRatio > 0.4);
      },
      { threshold: [0, 0.25, 0.4, 0.6, 0.85, 1] }
    );
    heroObserver.observe(heroEl);
    return () => heroObserver.disconnect();
  }, []);

  useEffect(() => {
    isInHeroRef.current = isInHero;
  }, [isInHero]);

  useEffect(() => {
    heroAudioSyncRef.current = {
      enableHeroVoice: () => {
        if (!isInHeroRef.current) return;
        const video = heroVideoRef.current;
        audio.setAmbientSuppressed(true);
        playHeroVideoWithSound(video);
      },
      disableHeroVoice: () => {
        muteHeroVideo(heroVideoRef.current);
        audio.setAmbientSuppressed(false);
      },
    };

    return () => {
      heroAudioSyncRef.current = null;
    };
  }, [heroAudioSyncRef]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return undefined;

    const startMutedVideo = () => {
      video.muted = true;
      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {});
      }
    };

    if (video.readyState >= 2) {
      startMutedVideo();
    } else {
      video.addEventListener('canplay', startMutedVideo, { once: true });
    }

    return () => {
      video.removeEventListener('canplay', startMutedVideo);
    };
  }, []);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const shouldMuteVideo = isMuted || !isInHero || !siteEntered;

    if (shouldMuteVideo) {
      video.muted = true;
      if (!isMuted && !isInHero) {
        audio.setAmbientSuppressed(false);
        audio.init();
        if (!audio.ambientPlaying) {
          audio.startAmbient();
        }
      }
      return;
    }

    audio.setAmbientSuppressed(true);
    playHeroVideoWithSound(video);
  }, [isMuted, isInHero, siteEntered]);

  useEffect(() => () => {
    audio.setAmbientSuppressed(false);
    muteHeroVideo(heroVideoRef.current);
  }, []);

  const handleEnterWild = () => {
    onAudioUnmute?.();
    audio.playGateSound();
    window.scrollTo({ top: window.innerHeight / 2, behavior: 'smooth' });
  };

  const heroVideoMuted = isMuted || !isInHero || !siteEntered;
  const isMobileHero = typeof window !== 'undefined' && window.innerWidth < 768;
  const heroParallaxX = isMobileHero ? 0 : parallaxBgX;
  const heroParallaxY = isMobileHero ? 0 : parallaxBgY;
  const heroParallaxScale = isMobileHero ? 1 : 1.06;
  const heroSpotlightSize = isMobileHero ? '115px' : '220px';

  return (
    <div className="relative bg-[#030905] overflow-x-clip max-w-full w-full">



      {/* 1. Hero Gate Section */}
      <section
        ref={heroSectionRef}
        className="relative w-full min-h-[100svh] md:h-screen overflow-hidden flex flex-col justify-between items-center bg-[#030905] touch-pan-y"
        style={{
          '--mouse-x': `${mousePos.x}px`,
          '--mouse-y': `${mousePos.y}px`
        }}
      >

        {/* 3D Parallax Background Wrapper — jungle walk video */}
        <div
          className="absolute inset-0 z-0 overflow-hidden transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${heroParallaxX}px, ${heroParallaxY}px, 0) scale(${heroParallaxScale})`
          }}
        >
          <video
            ref={heroVideoRef}
            className="hero-bg-video cinematic-bg"
            src={HERO_VIDEO_SRC}
            autoPlay
            loop
            muted={heroVideoMuted}
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="hero-bg-overlay" aria-hidden="true" />

          {/* 1. Animated Flying Birds in the Sky */}
          <div className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden hidden md:block">
            <svg className="bird-fly-animation w-16 h-8 text-black/60 opacity-80 absolute top-[15%] left-0" viewBox="0 0 100 50" fill="currentColor">
              <path d="M 0 20 Q 25 0 50 20 Q 75 0 100 20 Q 75 10 50 30 Q 25 10 0 20 Z" />
            </svg>
            <svg className="bird-fly-animation w-12 h-6 text-black/50 opacity-70 absolute top-[18%] left-0" style={{ animationDelay: '4s', animationDuration: '28s' }} viewBox="0 0 100 50" fill="currentColor">
              <path d="M 0 20 Q 25 0 50 20 Q 75 0 100 20 Q 75 10 50 30 Q 25 10 0 20 Z" />
            </svg>
            <svg className="bird-fly-animation w-14 h-7 text-black/55 opacity-75 absolute top-[12%] left-0" style={{ animationDelay: '8s', animationDuration: '22s' }} viewBox="0 0 100 50" fill="currentColor">
              <path d="M 0 20 Q 25 0 50 20 Q 75 0 100 20 Q 75 10 50 30 Q 25 10 0 20 Z" />
            </svg>
          </div>

        </div>


        {/* Interactive Safari Spotlight Torch Overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-700 ease-in-out"
          style={{
            background: isHovered
              ? `radial-gradient(circle ${heroSpotlightSize} at var(--mouse-x) var(--mouse-y), rgba(194, 170, 114, 0.12) 0%, rgba(12, 28, 18, 0.22) 50%, rgba(3, 9, 5, 0.88) 100%)`
              : 'radial-gradient(circle at 50% 50%, rgba(194, 170, 114, 0.02) 0%, rgba(3, 9, 5, 0.82) 100%)',
            opacity: 0.95
          }}
        />

        <div className="leaves-container">
          {leaves.map(leaf => (
            <div key={leaf.id} className="leaf" style={{
              left: leaf.left,
              animationDelay: leaf.delay,
              animationDuration: leaf.duration,
              backgroundColor: leaf.color,
              transform: `scale(${leaf.scale})`
            }}></div>
          ))}
        </div>

        {/* Hero Content — laptop/desktop with 3D Parallax and Golden Shimmer */}
        <div
          className="hidden md:flex w-full max-w-7xl mx-auto px-16 h-full items-center justify-between relative z-40 select-none pointer-events-none transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${parallaxTextX}px, ${parallaxTextY}px, 0)`
          }}
        >
          <div className="max-w-xl flex flex-col items-start gap-1 pointer-events-auto text-left">
            <span className="hero-copy-explore font-serif italic text-3xl sm:text-4xl tracking-wider leading-none">Explore</span>
            <h1 className="hero-copy-title hero-copy-title-shimmer text-6xl sm:text-7xl font-black leading-none uppercase -ml-1 tracking-wider font-serif">
              THE WILD
            </h1>
            <h3 className="hero-copy-sub text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]">
              AN ADVENTURE OF A LIFETIME
            </h3>
            <button onClick={handleEnterWild} className="hero-copy-cta btn-gold inline-flex items-center uppercase text-black cursor-pointer transition-all duration-300">
              <span>EXPLORE SAFARI</span>
              <span className="text-[8px] leading-none">&#128062;</span>
            </button>
          </div>
        </div>

        {/* Hero Content — mobile only with 3D Parallax */}
        <div
          className="flex md:hidden absolute inset-x-0 top-[4%] z-40 justify-center px-4 select-none pointer-events-none transition-transform duration-700 ease-out"
          style={{
            transform: `translate3d(${parallaxTextX * 0.3}px, ${parallaxTextY * 0.3}px, 0)`
          }}
        >
          <div className="flex flex-col items-center gap-0.5 pointer-events-auto text-center max-w-[200px]">
            <span className="hero-copy-explore font-serif italic text-sm tracking-wide leading-none">Explore</span>
            <h1 className="hero-copy-title hero-copy-title-shimmer text-xl font-black leading-none uppercase tracking-wide font-serif">
              THE WILD
            </h1>
            <h3 className="hero-copy-sub text-[6px] font-bold uppercase tracking-[0.16em]">
              AN ADVENTURE OF A LIFETIME
            </h3>
            <button onClick={handleEnterWild} className="hero-copy-cta btn-gold inline-flex items-center uppercase text-black cursor-pointer transition-all duration-300">
              <span>EXPLORE SAFARI</span>
              <span className="text-[6px] leading-none">&#128062;</span>
            </button>
          </div>
        </div>

        {/* Redesigned Gateway Arch is integrated into the photorealistic background image */}




      </section>

      <div className="seamless-jungle-container home-content-stack">
        <FeaturesBar />

        <SafariExperiencesSection navigateTo={navigateTo} />

        <PopularPackagesSection navigateTo={navigateTo} />

        {/* 5. Horizontal Stats Section */}
        <section className="py-16 bg-transparent border-y border-[#c2aa72]/10 relative z-10">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-black cinzel text-white gold-glow">10+</span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-gray-500 font-bold block mt-2">Years Experience</span>
            </div>
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-black cinzel text-white gold-glow">50K+</span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-gray-500 font-bold block mt-2">Happy Travelers</span>
            </div>
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-black cinzel text-white gold-glow">250+</span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-gray-500 font-bold block mt-2">Wildlife Species</span>
            </div>
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-black cinzel text-white gold-glow">120+</span>
              <span className="text-[9px] uppercase tracking-[0.25em] text-gray-500 font-bold block mt-2">Safari Routes</span>
            </div>
          </div>
        </section>

        {/* 6. Glimpse of Our Jungle */}
        <section className="py-24 bg-transparent border-b border-[#c2aa72]/10 relative z-10">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Text Info */}
              <div className="lg:col-span-3 text-left">
                <SectionHeading eyebrow="Discover" title="Our Jungle" align="left" className="mb-4" />
                <p className="text-sm text-gray-300 font-medium tracking-wide leading-relaxed mb-8 max-w-md">
                  From dense forests to serene waterfalls, every path tells a new story.
                </p>
                <button
                  onClick={() => navigateTo('gallery')}
                  className="px-6 py-3.5 border border-[#c2aa72]/50 text-[10px] tracking-[0.2em] uppercase font-bold text-white bg-transparent rounded hover:bg-[#c2aa72] hover:text-black transition-all duration-300 btn-gold cursor-pointer"
                >
                  Explore More &gt;
                </button>
              </div>

              {/* Right Column: SVG Organic Pebble Collage */}
              <div className="lg:col-span-9 relative w-full" style={{ aspectRatio: '1.5/1', maxWidth: '860px', margin: '0 auto', overflow: 'visible' }}>
                {/* Hidden SVG defs for clip paths */}
                <svg width="0" height="0" style={{ position: 'absolute' }}>
                  <defs>
                    <clipPath id="pebble1" clipPathUnits="objectBoundingBox">
                      <path d="M0.08,0.08 C0.22,0.00 0.60,0.00 0.78,0.10 C0.96,0.20 1.00,0.50 0.90,0.72 C0.80,0.94 0.55,1.00 0.30,0.98 C0.05,0.96 0.00,0.78 0.00,0.52 C0.00,0.28 -0.02,0.14 0.08,0.08 Z" />
                    </clipPath>
                    <clipPath id="pebble2" clipPathUnits="objectBoundingBox">
                      <path d="M0.12,0.04 C0.32,0.00 0.70,0.04 0.88,0.18 C1.00,0.30 1.00,0.60 0.86,0.80 C0.72,0.98 0.42,1.00 0.18,0.94 C0.00,0.88 0.00,0.66 0.02,0.42 C0.04,0.20 0.00,0.08 0.12,0.04 Z" />
                    </clipPath>
                    <clipPath id="pebble3" clipPathUnits="objectBoundingBox">
                      <path d="M0.10,0.10 C0.28,0.00 0.72,0.00 0.90,0.10 C1.00,0.20 1.00,0.50 0.92,0.72 C0.82,0.94 0.58,1.00 0.32,0.98 C0.08,0.96 0.00,0.78 0.00,0.52 C0.00,0.28 -0.02,0.18 0.10,0.10 Z" />
                    </clipPath>
                    <clipPath id="pebble4" clipPathUnits="objectBoundingBox">
                      <path d="M0.05,0.12 C0.18,0.00 0.55,0.02 0.82,0.10 C1.00,0.18 1.00,0.52 0.90,0.76 C0.80,0.96 0.50,1.00 0.22,0.96 C0.00,0.90 0.00,0.68 0.00,0.44 C0.00,0.24 -0.04,0.20 0.05,0.12 Z" />
                    </clipPath>
                    <clipPath id="pebble5" clipPathUnits="objectBoundingBox">
                      <path d="M0.08,0.08 C0.24,0.00 0.68,0.00 0.88,0.14 C1.00,0.24 1.00,0.56 0.88,0.78 C0.76,0.98 0.46,1.00 0.20,0.94 C0.00,0.88 0.00,0.64 0.02,0.38 C0.04,0.16 -0.02,0.14 0.08,0.08 Z" />
                    </clipPath>
                  </defs>
                </svg>

                {/* 1. Top-Left (River/Stream) */}
                <div onClick={() => navigateTo('gallery')} className="pebble-wrap" style={{ position: 'absolute', top: '2%', left: '0%', width: '40%', paddingBottom: '30%', cursor: 'pointer', zIndex: 10 }}>
                  <svg viewBox="0 0 100 75" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <clipPath id="pc1" clipPathUnits="userSpaceOnUse">
                        <path d="M8,6 C22,0 60,0 78,8 C96,16 100,38 90,54 C80,70 55,76 30,74 C5,72 0,58 0,39 C0,21 -1,10 8,6 Z" />
                      </clipPath>
                    </defs>
                    <image href="/gallery_landscape.png" x="0" y="0" width="100" height="75" clipPath="url(#pc1)" preserveAspectRatio="xMidYMid slice" style={{ transition: 'transform 0.6s ease', transformOrigin: '50px 37px' }} className="pebble-img" />
                    <path d="M8,6 C22,0 60,0 78,8 C96,16 100,38 90,54 C80,70 55,76 30,74 C5,72 0,58 0,39 C0,21 -1,10 8,6 Z" fill="none" stroke="#c2aa72" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>

                {/* 2. Bottom-Left (Jeep Safari) */}
                <div onClick={() => navigateTo('gallery')} className="pebble-wrap" style={{ position: 'absolute', bottom: '2%', left: '10%', width: '42%', paddingBottom: '32%', cursor: 'pointer', zIndex: 15 }}>
                  <svg viewBox="0 0 100 78" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <clipPath id="pc2" clipPathUnits="userSpaceOnUse">
                        <path d="M12,4 C32,0 70,4 88,18 C100,28 100,55 86,70 C72,84 42,80 18,74 C0,68 0,50 2,30 C4,14 0,8 12,4 Z" />
                      </clipPath>
                    </defs>
                    <image href="/experiences/bandhavgarh_jeep.png" x="0" y="0" width="100" height="78" clipPath="url(#pc2)" preserveAspectRatio="xMidYMid slice" style={{ transition: 'transform 0.6s ease', transformOrigin: '50px 39px' }} className="pebble-img" />
                    <path d="M12,4 C32,0 70,4 88,18 C100,28 100,55 86,70 C72,84 42,80 18,74 C0,68 0,50 2,30 C4,14 0,8 12,4 Z" fill="none" stroke="#c2aa72" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>

                {/* 3. Center (Tiger) */}
                <div onClick={() => navigateTo('gallery')} className="pebble-wrap" onMouseEnter={() => triggerSound('lion')} style={{ position: 'absolute', top: '15%', left: '32%', width: '38%', paddingBottom: '38%', cursor: 'pointer', zIndex: 20 }}>
                  <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <clipPath id="pc3" clipPathUnits="userSpaceOnUse">
                        <path d="M10,10 C28,0 72,0 90,10 C100,18 100,50 92,72 C82,94 58,102 32,98 C8,94 0,78 0,52 C0,28 -2,18 10,10 Z" />
                      </clipPath>
                    </defs>
                    <image href="/experiences/ranthambore_tiger.png" x="0" y="0" width="100" height="100" clipPath="url(#pc3)" preserveAspectRatio="xMidYMid slice" style={{ transition: 'transform 0.6s ease', transformOrigin: '50px 50px' }} className="pebble-img" />
                    <path d="M10,10 C28,0 72,0 90,10 C100,18 100,50 92,72 C82,94 58,102 32,98 C8,94 0,78 0,52 C0,28 -2,18 10,10 Z" fill="none" stroke="#c2aa72" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>

                {/* 4. Bottom-Right (Forest Path) */}
                <div onClick={() => navigateTo('gallery')} className="pebble-wrap" style={{ position: 'absolute', bottom: '2%', right: '2%', width: '40%', paddingBottom: '30%', cursor: 'pointer', zIndex: 10 }}>
                  <svg viewBox="0 0 100 75" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <clipPath id="pc4" clipPathUnits="userSpaceOnUse">
                        <path d="M5,12 C18,0 55,2 82,10 C100,16 100,48 90,70 C80,90 50,78 22,74 C0,70 0,54 0,38 C0,22 -2,20 5,12 Z" />
                      </clipPath>
                    </defs>
                    <image href="/experiences/nature-walk.jpg" x="0" y="0" width="100" height="75" clipPath="url(#pc4)" preserveAspectRatio="xMidYMid slice" style={{ transition: 'transform 0.6s ease', transformOrigin: '50px 37px' }} className="pebble-img" />
                    <path d="M5,12 C18,0 55,2 82,10 C100,16 100,48 90,70 C80,90 50,78 22,74 C0,70 0,54 0,38 C0,22 -2,20 5,12 Z" fill="none" stroke="#c2aa72" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>

                {/* 5. Top-Right (Waterfall/Gir) */}
                <div onClick={() => navigateTo('gallery')} className="pebble-wrap" style={{ position: 'absolute', top: '2%', right: '0%', width: '36%', paddingBottom: '28%', cursor: 'pointer', zIndex: 15 }}>
                  <svg viewBox="0 0 100 78" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <clipPath id="pc5" clipPathUnits="userSpaceOnUse">
                        <path d="M8,8 C24,0 68,0 88,14 C100,24 100,56 88,76 C76,96 46,82 20,76 C0,70 0,54 2,34 C4,14 -2,14 8,8 Z" />
                      </clipPath>
                    </defs>
                    <image href="/about_gir_bg.png" x="0" y="0" width="100" height="78" clipPath="url(#pc5)" preserveAspectRatio="xMidYMid slice" style={{ transition: 'transform 0.6s ease', transformOrigin: '50px 39px' }} className="pebble-img" />
                    <path d="M8,8 C24,0 68,0 88,14 C100,24 100,56 88,76 C76,96 46,82 20,76 C0,70 0,54 2,34 C4,14 -2,14 8,8 Z" fill="none" stroke="#c2aa72" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. What Our Travelers Say */}
        <TravelersSaySection />
      </div>

    </div>
  );
}





// ==========================================================================
// DEEP JUNGLE SPOTLIGHT COMPONENT
// ==========================================================================
function DeepJungleSection() {
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    containerRef.current.style.setProperty('--torch-x', `${x}px`);
    containerRef.current.style.setProperty('--torch-y', `${y}px`);
  };

  const handleTouchMove = (e) => {
    if (!containerRef.current || !e.touches[0]) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    containerRef.current.style.setProperty('--torch-x', `${x}px`);
    containerRef.current.style.setProperty('--torch-y', `${y}px`);
  };

  return (
    <section ref={containerRef} onMouseMove={handleMouseMove} onTouchMove={handleTouchMove} className="relative w-full h-[600px] overflow-hidden bg-[#020703] flex items-center justify-center cursor-none">
      <div className="torch-overlay"></div>
      <div className="absolute inset-0 z-10 opacity-70 pointer-events-none select-none bg-cover bg-center"
        style={{
          backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="800" viewBox="0 0 1920 800"><rect width="100%" height="100%" fill="%23020603"/><g fill="%23163e23" opacity="0.4"><circle cx="150" cy="200" r="80"/><circle cx="450" cy="500" r="100"/><circle cx="900" cy="150" r="120"/><circle cx="1400" cy="450" r="90"/><circle cx="1700" cy="250" r="110"/></g><g fill="%23ffdf00"><circle cx="300" cy="250" r="3"/><circle cx="316" cy="250" r="3"/><circle cx="1120" cy="420" r="4"/><circle cx="1140" cy="420" r="4"/><circle cx="1560" cy="190" r="3.5"/><circle cx="1574" cy="190" r="3.5"/></g><path d="M650 500 L720 280 L780 280 L850 500 Z M830 500 L880 340 L930 340 L980 500 Z" fill="%23112217"/></svg>')`
        }}></div>
      <div className="torch-content z-30 text-center px-6 max-w-2xl select-none pointer-events-none">
        <span class="text-xs uppercase tracking-[0.6em] text-[#c2aa72] font-bold">Midnight Explorations</span>
        <h2 class="text-4xl sm:text-5xl font-black uppercase text-white tracking-widest cinzel mt-3">Deep Jungle</h2>
        <p class="text-gray-400 text-sm sm:text-base mt-6 leading-relaxed max-w-xl mx-auto">
          Move your mouse pointer (or drag your finger on mobile devices) to direct the high-power tactical spotlight into the pitch-black core zone.
        </p>
        <div class="mt-8 inline-flex items-center gap-3 border border-[#8a7344]/30 px-6 py-3 rounded-full bg-[#050f08]/85 text-xs text-[#c2aa72] tracking-widest uppercase font-semibold">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Spotlight Active</span>
        </div>
      </div>
    </section>
  );
}

// ==========================================================================
// ABOUT SCREEN COMPONENT
// ==========================================================================
const ABOUT_STATS = [
  { value: '1,412', label: 'Area', sublabel: 'Sq. km' },
  { value: '674+', label: 'Lions' },
  { value: '300+', label: 'Bird', sublabel: 'Species' },
  { value: '40+', label: 'Reptiles' },
];

function AboutScreen() {
  return (
    <div className="bg-[#050f08] text-gray-200">
      <div className="about-jungle-container">
        <section className="relative w-full h-[50vh] overflow-hidden flex flex-col justify-center items-center bg-transparent">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="z-20 text-center px-3 sm:px-6 select-none max-w-3xl">
            <span className="text-xs uppercase tracking-[0.5em] text-[#c2aa72] font-semibold">Deciduous Haven</span>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase text-white tracking-widest cinzel gold-glow mt-3">About Gir</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-4 leading-relaxed max-w-xl mx-auto px-1">
              Journey into Sasan Gir's preservation legacy, tracking back to key ban decrees.
            </p>
          </div>
        </section>
        {/* Stats */}
        <section className="about-stats-section relative border-b border-emerald-950/20">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="about-stats-grid max-w-7xl mx-auto px-3 sm:px-6 relative z-10">
            {ABOUT_STATS.map((stat) => (
              <article key={stat.label} className="about-stat-card glass-card">
                <span className="about-stat-card__value cinzel gold-glow">{stat.value}</span>
                <span className="about-stat-card__label">{stat.label}</span>
                {stat.sublabel ? (
                  <span className="about-stat-card__sublabel">{stat.sublabel}</span>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {/* Conservation text */}
        <section className="py-24 bg-transparent border-b border-emerald-950/20 relative">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            <div className="flex flex-col gap-6 text-left">
              <span class="text-xs uppercase tracking-[0.4em] text-[#c2aa72] font-semibold">The Conservation Story</span>
              <h2 class="text-3xl font-bold cinzel text-white leading-tight">From Hunting Reserve to Sanctuary</h2>
              <p class="text-gray-400 text-sm leading-relaxed">
                At the turn of the 20th century, severe trophy hunting had reduced the Asiatic Lion population down to an alarming estimate of just 20 individuals. Identifying the imminent danger of complete extinction, the far-sighted Nawab of Junagadh completely banned all hunting within his state in 1900.
              </p>
              <p class="text-gray-400 text-sm leading-relaxed">
                In 1965, Sasan Gir was officially designated a protected sanctuary. Decades of close collaboration between state authorities and forest herding communities ("Maldharis") have secured a remarkable population rise.
              </p>
            </div>
            <div className="p-2 border border-[#c2aa72]/15 bg-[#0b1a10]/30 rounded-lg overflow-hidden shadow-2xl">
              <img
                src="/conservation_lion.png"
                alt="Majestic Asiatic Lion in Sasan Gir Forest"
                className="w-full h-80 object-cover rounded transition-transform duration-500 hover:scale-105"
              />
            </div>
          </div>
        </section>

        {/* Visual Timeline */}
        <section className="about-timeline-section py-12 sm:py-16 lg:py-24 bg-transparent relative">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="max-w-5xl mx-auto px-3 sm:px-6 relative z-10 w-full min-w-0">
            <header className="about-timeline-header text-center mb-10 sm:mb-14 lg:mb-20">
              <span className="about-timeline-eyebrow">Epochal Chronicles</span>
              <h2 className="about-timeline-title cinzel text-white mt-3">
                <span className="block">Conservation</span>
                <span className="block">Timeline</span>
              </h2>
            </header>

            <div className="relative timeline-container flex flex-col gap-8 sm:gap-12 w-full min-w-0">
              <div className="timeline-item flex flex-col md:flex-row items-center justify-between w-full relative min-w-0">
                <div className="timeline-dot"></div>
                <div className="timeline-item__meta w-full md:w-[45%] text-left md:text-right pr-0 md:pr-10 min-w-0">
                  <span className="timeline-item__year cinzel text-[#c2aa72] block">1900</span>
                  <span className="timeline-item__label block">Game Hunting Banned</span>
                </div>
                <div className="timeline-item__card w-full md:w-[45%] glass-card rounded-lg text-left mt-4 md:mt-0 min-w-0">
                  <p className="text-gray-400 text-xs leading-relaxed">Nawab of Junagadh declares state prohibition on lion trophy hunting as numbers fall under 20.</p>
                </div>
              </div>

              <div className="timeline-item flex flex-col md:flex-row items-center justify-between w-full relative min-w-0">
                <div className="timeline-dot"></div>
                <div className="timeline-item__meta w-full md:w-[45%] text-left md:text-left order-1 md:order-2 pl-0 md:pl-10 min-w-0">
                  <span className="timeline-item__year cinzel text-[#c2aa72] block">1965</span>
                  <span className="timeline-item__label block">Sanctuary Designated</span>
                </div>
                <div className="timeline-item__card w-full md:w-[45%] glass-card rounded-lg text-left order-2 md:order-1 mt-4 md:mt-0 min-w-0">
                  <p className="text-gray-400 text-xs leading-relaxed">State forest department registers core zones spanning deciduous valleys to restrict grazing channels.</p>
                </div>
              </div>

              <div className="timeline-item flex flex-col md:flex-row items-center justify-between w-full relative min-w-0">
                <div className="timeline-dot"></div>
                <div className="timeline-item__meta w-full md:w-[45%] text-left md:text-right pr-0 md:pr-10 min-w-0">
                  <span className="timeline-item__year cinzel text-[#c2aa72] block">1975</span>
                  <span className="timeline-item__label block">National Park Formed</span>
                </div>
                <div className="timeline-item__card w-full md:w-[45%] glass-card rounded-lg text-left mt-4 md:mt-0 min-w-0">
                  <p className="text-gray-400 text-xs leading-relaxed">A strictly prohibited core zone of 258 square kilometers secures absolute shelter rules.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ==========================================================================
// WILDLIFE SCREEN COMPONENT
// ==========================================================================
const WILD_DATA = [
  {
    species: 'lion', category: 'mammal', name: 'Asiatic Lion', sci: 'Panthera leo persica',
    desc: 'The golden ruler of Gir. Asiatic lions possess a prominent skin fold running along their belly and a sparser mane than African lions, exposing their ears.',
    stats: { habitat: 'Deciduous Dry Forest', lifespan: '16-18 Years', diet: 'Carnivore', weight: '160kg - 195kg' },
    facts: ['Sole remaining wild refuge in Asia', 'Lions run in active close-knit family units called prides', 'Belly fold skins are distinctive persica markers'],
    svg: '<path d="M50 15C30.7 15 15 30.7 15 50c0 9.8 4 18.6 10.5 25C26 63.8 30.2 55 42 53c-4.5-3.3-7.5-8.8-7.5-15 0-10.5 8.5-19 19-19s19 8.5 19 19c0 6.2-3 11.7-7.5 15 11.8 2 16 10.8 16.5 22 6.5-6.4 10.5-15.2 10.5-25 0-19.3-15.7-35-35-35z"/>',
    image: '/lion_card.png'
  },
  {
    species: 'leopard', category: 'mammal', name: 'Indian Leopard', sci: 'Panthera pardus',
    desc: 'Adaptable golden felines decorated with black rosettes. Solitary stalkers that excel at scaling canopy forests.',
    stats: { habitat: 'Acacia woodlands', lifespan: '12-15 Years', diet: 'Carnivore', weight: '50kg - 75kg' },
    facts: ['Highly active at dusk and absolute night', 'Excellent tree climbers, hoisting prey safe from jackals', 'Gir holds one of the highest densities in Gujarat'],
    svg: '<circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="40" cy="45" r="4" fill="currentColor"/><circle cx="60" cy="45" r="4" fill="currentColor"/><path d="M45 55 Q50 60 55 55" stroke="currentColor" stroke-width="4" fill="none"/>',
    image: '/leopard_card.png'
  },
  {
    species: 'bear', category: 'mammal', name: 'Sloth Bear', sci: 'Melursus ursinus',
    desc: 'Shaggy, sickle-clawed creatures feeding on termite mounts, honeycomb valleys, and forest fruits.',
    stats: { habitat: 'Grasslands & Caves', lifespan: '20-24 Years', diet: 'Omnivore', weight: '80kg - 145kg' },
    facts: ['Sickle claws are ideal digging tools', 'Absence of front teeth allows clean suction of bugs', 'Elusive but aggressive defensive behaviors'],
    svg: '<path d="M50 15C33 15 20 28 20 45c0 10 5 19 12 25L30 85h40l-2-15c7-6 12-15 12-25 0-17-13-30-30-30z"/>',
    image: '/bear_card.png'
  },
  {
    species: 'deer', category: 'mammal', name: 'Spotted Deer', sci: 'Axis axis',
    desc: 'Beautiful chitals with bright white spots grazing core fields. Form crucial alarm symbiotic bonds with canopy monkeys.',
    stats: { habitat: 'Meadows & Glades', lifespan: '10-13 Years', diet: 'Herbivore', weight: '65kg - 85kg' },
    facts: ['Spots remain intact across all lifespan stages', 'Highly vocal, screaming sharp alarms to alert herds', 'Live in massive groups exceeding 50 deer'],
    svg: '<path d="M50 15C30.7 15 15 30.7 15 50c0 9.8 4 18.6 10.5 25C26 63.8 30.2 55 42 53c-4.5-3.3-7.5-8.8-7.5-15 0-5.5 2.5-10.5 6.5-14l-8.5-8.5 4.2-4.2L49 23.5c.3 0 .7-.1 1-.1s.7.1 1 .1l12.3-12.3 4.2 4.2-8.5 8.5c4 3.5 6.5 8.5 6.5 14 0 6.2-3 11.7-7.5 15 11.8 2 16 10.8 16.5 22 6.5-6.4 10.5-15.2 10.5-25 0-19.3-15.7-35-35-35z"/>',
    image: '/deer_card.png'
  },
  {
    species: 'crocodile', category: 'reptile', name: 'Mugger Crocodile', sci: 'Crocodylus palustris',
    desc: 'Broad-snouted freshwater crocodiles inhabiting dams and deep rivers. Armored armor templates.',
    stats: { habitat: 'Freshwater Dams', lifespan: '60-70 Years', diet: 'Carnivore', weight: '220kg - 450kg' },
    facts: ['Broad mechanical snout holds supreme leverage', 'Can survive drying pools by burrowing into deep mud banks', 'Vital ecological monitoring agents in parks'],
    svg: '<path d="M15 50 C 15 35, 85 35, 85 50 C 85 65, 15 65, 15 50 Z M 25 50 H 75" fill="none" stroke="currentColor" stroke-width="4"/>',
    image: '/crocodile_card.png'
  },
  {
    species: 'python', category: 'reptile', name: 'Indian Python', sci: 'Python molurus',
    desc: 'A massive non-venomous constrictor ambushing animals in scrub borders.',
    stats: { habitat: 'Subterranean Caves', lifespan: '20-25 Years', diet: 'Carnivore', weight: '30kg - 55kg' },
    facts: ['Squeezes mammalian heart circulation completely', 'Heat pits trace warm bird profiles', 'Can skip meals for months post massive feeds'],
    svg: '<path d="M30 20 Q50 10 70 20 T70 80 T30 80 Z" fill="none" stroke="currentColor" stroke-width="4"/>',
    image: '/python_card.png'
  },
  {
    species: 'peacock', category: 'bird', name: 'Indian Peacock', sci: 'Pavo cristatus',
    desc: 'Spectacular blue-green plumage birds. Dance beautifully during cloudy monsoon cycles.',
    stats: { habitat: 'Dry Teak Slopes', lifespan: '15-20 Years', diet: 'Omnivore', weight: '4kg - 6kg' },
    facts: ['Loud high callouts sound warning signals to forest paths', 'Ocelli feathers represent optical wonders', 'Feeds on small toxic reptiles and grass seeds'],
    svg: '<path d="M50 15C30.7 15 15 30.7 15 50c0 9.8 4 18.6 10.5 25 1.5-6.2 5.5-12.5 12.5-17.5-3.5-3.3-5.5-7.8-5.5-13 0-10.5 8.5-19 19-19s19 8.5 19 19c0 5.2-2 9.7-5.5 13 7 5 11 11.3 12.5 17.5 6.5-6.4 10.5-15.2 10.5-25 0-19.3-15.7-35-35-35zm0 14c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z"/>',
    image: '/peacock_card.png'
  }
];

function WildlifeScreen({ triggerSound }) {
  const [filter, setFilter] = useState('all');
  const [activeAnimal, setActiveAnimal] = useState(null);

  const filteredAnimals = WILD_DATA.filter(a => filter === 'all' || a.category === filter);

  useEffect(() => {
    if (!activeAnimal) return undefined;

    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActiveAnimal(null);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeAnimal]);

  return (
    <>
    <div className="wildlife-jungle-container">
      <section className="py-24 bg-transparent relative">
        <div className="section-safari-shadow" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-6 text-left relative z-10">
          <div className="text-center mb-16 select-none">
            <span class="text-xs uppercase tracking-[0.45em] text-[#c2aa72] font-semibold">Fauna Catalog</span>
            <h1 class="text-4xl sm:text-5xl font-bold cinzel text-white mt-3">The Wildlife of Gir</h1>
            <div className="flex justify-center items-center gap-4 mt-10 flex-wrap">
              {['all', 'mammal', 'bird', 'reptile'].map(cat => (
                <button key={cat} onClick={() => setFilter(cat)}
                  className={`px-6 py-2 rounded text-xs uppercase tracking-wider font-bold transition-all duration-300 cursor-pointer ${filter === cat ? 'bg-[#c2aa72] text-black' : 'bg-emerald-950/45 text-[#c2aa72] hover:bg-emerald-900/30'}`}>
                  {cat === 'all' ? 'All Species' : `${cat}s`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredAnimals.map(animal => (
              <div
                key={animal.name}
                onClick={() => { setActiveAnimal(animal); triggerSound(animal.species); }}
                className="relative w-full aspect-[0.58/1] cursor-pointer group select-none overflow-visible"
              >
                {/* SVG Gateway Shield Frame with wooden border and shadows */}
                <svg viewBox="0 0 240 410" className="w-full h-full overflow-visible drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_12px_28px_rgba(163,124,86,0.5)] transition-all duration-500" preserveAspectRatio="none">
                  <defs>
                    {/* Inner clip for the arched animal image */}
                    <clipPath id={`arch-clip-${animal.species}`}>
                      <path d="M 22,86 C 22,86 22,50 120,24 C 218,50 218,86 218,86 L 218,225 C 218,225 218,245 120,245 C 22,245 22,225 22,225 Z" />
                    </clipPath>

                    {/* Dark Green gradient for the top image background */}
                    <linearGradient id="image-bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#040e08" />
                      <stop offset="100%" stopColor="#081c10" />
                    </linearGradient>

                    {/* Dark rich wood gradient for the bottom details panel */}
                    <linearGradient id="wood-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#1e130c" />
                      <stop offset="50%" stopColor="#140c07" />
                      <stop offset="100%" stopColor="#080402" />
                    </linearGradient>

                    {/* Stone/rock border gradient */}
                    <linearGradient id="wood-border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1a1208" />
                      <stop offset="20%" stopColor="#4a3520" />
                      <stop offset="50%" stopColor="#7a5c38" />
                      <stop offset="80%" stopColor="#4a3520" />
                      <stop offset="100%" stopColor="#0e0a04" />
                    </linearGradient>

                    {/* SVG filter for realistic carved stone texture */}
                    <filter id="wood-texture" x="-10%" y="-10%" width="120%" height="120%">
                      <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="6" result="noise" />
                      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5.5" xChannelSelector="R" yChannelSelector="G" />
                    </filter>

                    {/* Curved Nameplate wood gradient */}
                    <linearGradient id="wood-banner-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3d210f" />
                      <stop offset="35%" stopColor="#2c1608" />
                      <stop offset="100%" stopColor="#140702" />
                    </linearGradient>
                  </defs>

                  {/* 1. Main Outer Frame (Gothic Shield Path with 3D Light-Oak Wood Border and Chamfered Corners) */}
                  {/* Dark shadow base layer */}
                  <path
                    d="M 12,85 L 65,35 L 120,15 L 175,35 L 228,85 L 228,340 C 228,340 228,375 120,400 C 12,375 12,340 12,340 Z"
                    fill="url(#image-bg-grad)"
                    stroke="#08050200"
                    strokeWidth="10"
                    strokeLinejoin="round"
                  />
                  {/* Outer dark stone shadow stroke */}
                  <path
                    d="M 12,85 L 65,35 L 120,15 L 175,35 L 228,85 L 228,340 C 228,340 228,375 120,400 C 12,375 12,340 12,340 Z"
                    fill="none"
                    stroke="#100a04"
                    strokeWidth="9"
                    strokeLinejoin="round"
                    filter="url(#wood-texture)"
                  />
                  {/* Main stone carved border */}
                  <path
                    d="M 12,85 L 65,35 L 120,15 L 175,35 L 228,85 L 228,340 C 228,340 228,375 120,400 C 12,375 12,340 12,340 Z"
                    fill="none"
                    stroke="url(#wood-border-grad)"
                    strokeWidth="5.5"
                    strokeLinejoin="round"
                    filter="url(#wood-texture)"
                  />
                  {/* Highlight rim */}
                  <path
                    d="M 12,85 L 65,35 L 120,15 L 175,35 L 228,85 L 228,340 C 228,340 228,375 120,400 C 12,375 12,340 12,340 Z"
                    fill="none"
                    stroke="#c8a070"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                    opacity="0.35"
                    filter="url(#wood-texture)"
                  />

                  {/* 2. Inner Double-Bevel Shadow Line */}
                  <path
                    d="M 16,87 L 67,39 L 120,20 L 173,39 L 224,87 L 224,336 C 224,336 224,370 120,394 C 16,370 16,336 16,336 Z"
                    fill="none"
                    stroke="#040b06"
                    strokeWidth="2.2"
                  />

                  {/* 3. Inner Delicate Wood Highlight Border (Double frame look) */}
                  <path
                    d="M 20,90 L 70,43 L 120,24 L 170,43 L 220,90 L 220,332 C 220,332 220,364 120,388 C 20,364 20,332 20,332 Z"
                    fill="none"
                    stroke="url(#wood-border-grad)"
                    strokeWidth="1.8"
                    opacity="0.85"
                    filter="url(#wood-texture)"
                  />

                  {/* 4. Bottom Rich Deep-Forest Details Panel */}
                  <path
                    d="M 16,245 L 224,245 L 224,336 C 224,336 224,370 120,394 C 16,370 16,336 16,336 Z"
                    fill="#050e08"
                    stroke="#1c0f06"
                    strokeWidth="1.5"
                  />

                  {/* 5. Clipped Animal Image */}
                  <g clipPath={`url(#arch-clip-${animal.species})`}>
                    <image
                      href={animal.image}
                      x="20"
                      y="18"
                      width="200"
                      height="230"
                      preserveAspectRatio="xMidYMid slice"
                      className="transition-transform duration-700 group-hover:scale-110"
                      style={{ transformOrigin: 'center 120px' }}
                    />
                  </g>

                  {/* 6. Inner Image Wood Frame */}
                  <path
                    d="M 22,86 C 22,86 22,50 120,24 C 218,50 218,86 218,86 L 218,225 C 218,225 218,245 120,245 C 22,245 22,225 22,225 Z"
                    fill="none"
                    stroke="#3d210f"
                    strokeWidth="2.0"
                    opacity="0.9"
                  />

                  {/* 7. Curved Wood Nameplate Banner exactly as in Image 2 */}
                  <path
                    d="M 14,244 C 14,244 60,223 120,223 C 180,223 226,244 226,244 L 226,303 C 226,303 180,316 120,316 C 60,316 14,303 14,303 Z"
                    fill="url(#wood-banner-grad)"
                    stroke="#221005"
                    strokeWidth="1.8"
                    filter="url(#wood-texture)"
                  />
                  {/* Wood grain line overlays for realism */}
                  <path d="M 15,262 C 50,246 190,246 225,262" stroke="#120803" strokeWidth="1.2" opacity="0.6" fill="none" />
                  <path d="M 15,280 C 50,266 190,266 225,280" stroke="#120803" strokeWidth="0.8" opacity="0.5" fill="none" />
                  <path d="M 15,294 C 50,280 190,280 225,294" stroke="#120803" strokeWidth="1.2" opacity="0.6" fill="none" />

                  {/* Metallic rivets on left and right sides of wood banner */}
                  <circle cx="26" cy="275" r="3.2" fill="#180a03" stroke="#8b572a" strokeWidth="0.8" />
                  <circle cx="26" cy="275" r="1" fill="#bd8448" />
                  <circle cx="214" cy="275" r="3.2" fill="#180a03" stroke="#8b572a" strokeWidth="0.8" />
                  <circle cx="214" cy="275" r="1" fill="#bd8448" />
                  {/* 8. Shield badge overlapping top-center of wood banner */}
                  <path
                    d="M 108,212 L 132,212 L 132,226 C 132,238 120,246 120,246 C 120,246 108,238 108,226 Z"
                    fill="#261408"
                    stroke="url(#wood-border-grad)"
                    strokeWidth="1.5"
                  />
                  <circle cx="120" cy="226" r="8" fill="#1c0f08" opacity="0.4" />
                  <foreignObject x="111" y="215" width="18" height="18">
                    <div
                      className="w-full h-full text-[#ffe082] flex items-center justify-center p-0.5"
                      dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 100 100" class="w-full h-full text-[#ffe082]">' + animal.svg + '</svg>' }}
                    />
                  </foreignObject>

                  {/* 9. Bottom pointed tip badge (Diamond shape with leaf inside) */}
                  <g transform="translate(120, 368)">
                    <rect x="-12" y="-12" width="24" height="24" rx="2.5" ry="2.5" transform="rotate(45)" fill="#040e08" stroke="#8b572a" strokeWidth="1.8" />
                    <foreignObject x="-9" y="-9" width="18" height="18">
                      <div className="w-full h-full text-[#bd8448] flex items-center justify-center p-0.5">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-[#bd8448]">
                          <path d="M17,8C8,10 5,16 5,16C5,16 7,9 15,6M19,2C19,2 17,5 16,8C15,11 15,16 12,18C9,20 6,19 6,19C6,19 9,18 11,15C13,12 12,8 14,5C16,2 19,2 19,2Z" />
                        </svg>
                      </div>
                    </foreignObject>
                  </g>
                </svg>

                {/* 10. Overlay HTML elements for detailed typography exactly aligned to the name banner */}
                <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
                  {/* Top image area */}
                  <div className="h-[56%] w-full" />

                  {/* Wood Banner Text Area (Y: 244 to 303) */}
                  <div className="h-[18%] w-full flex flex-col justify-center items-center px-6 mt-1">
                    <h3 className="text-[12px] sm:text-[13px] font-sans font-extrabold text-gray-200 uppercase tracking-[0.05em] leading-tight">
                      {animal.name}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#bd8448] font-serif italic mt-0.5 tracking-widest font-medium">
                      {animal.sci}
                    </p>
                  </div>

                  {/* Bottom section (Y: 303 to 400) */}
                  <div className="flex-1 flex flex-col justify-center items-center pb-4">
                    {/* Explore Link */}
                    <div className="flex items-center gap-1 text-[9px] uppercase text-stone-400 tracking-[0.25em] font-extrabold group-hover:text-white transition-colors duration-300">
                      <span>Explore More</span>
                      <span className="group-hover:translate-x-1.5 transition-transform duration-300 text-stone-300">&rarr;</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {activeAnimal && (() => {
            const speciesId =
              activeAnimal.species === 'lion' ? 'WL-001' :
                activeAnimal.species === 'leopard' ? 'WL-023' :
                  activeAnimal.species === 'bear' ? 'WL-012' :
                    activeAnimal.species === 'deer' ? 'WL-007' :
                      activeAnimal.species === 'crocodile' ? 'WL-044' :
                        activeAnimal.species === 'python' ? 'WL-019' :
                          activeAnimal.species === 'peacock' ? 'WL-088' : 'WL-005';

            return createPortal(
              <div
                className="wildlife-modal-overlay modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={activeAnimal.name}
                onClick={() => setActiveAnimal(null)}
              >
                <div
                  className="wildlife-modal-shell modal-content"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setActiveAnimal(null)}
                    className="wildlife-modal__close"
                    aria-label="Close wildlife details"
                  >
                    &times;
                  </button>

                  <div className="wildlife-modal__grid">
                    <div className="wildlife-modal-page wildlife-modal-page--photo">
                      <div className="wildlife-modal__species-tag font-typewriter">
                        <span className="wildlife-modal__species-tag-label">Species No.</span>
                        {speciesId}
                      </div>

                      <div className="wildlife-modal-photo">
                        {activeAnimal.image ? (
                          <img src={activeAnimal.image} alt={activeAnimal.name} className="wildlife-modal-photo__image" />
                        ) : (
                          <div className="wildlife-modal-photo__fallback" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" class="w-2/3 h-2/3 text-[#c2aa72]/30">${activeAnimal.svg}</svg>` }} />
                        )}
                      </div>
                    </div>

                    <div className="wildlife-modal-page wildlife-modal-page--info">
                      <style dangerouslySetInnerHTML={{
                        __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Special+Elite&family=Architects+Daughter&family=Shadows+Into+Light&display=swap');
                    .font-handwritten { font-family: 'Caveat', cursive; }
                    .font-typewriter { font-family: 'Special Elite', monospace; }
                    .font-journal-title { font-family: 'Architects Daughter', cursive; }
                  `}} />

                      <div className="wildlife-modal__header">
                        <span className="wildlife-modal__eyebrow">Field Journal</span>
                        <h2 className="wildlife-modal__title font-handwritten">{activeAnimal.name}</h2>
                        <span className="wildlife-modal__sci">{activeAnimal.sci}</span>
                      </div>

                      <div className="wildlife-modal-stamp" aria-hidden="true">
                        <span>Sasan Gir</span>
                        <span>🐾</span>
                        <span>Wild & Free</span>
                      </div>

                      <p className="wildlife-modal__desc">{activeAnimal.desc}</p>

                      <div className="wildlife-modal-specs">
                        <div className="wildlife-modal-spec">
                          <span className="wildlife-modal-spec__label">Habitat</span>
                          <span className="wildlife-modal-spec__value">{activeAnimal.stats.habitat.replace('Deciduous ', '')}</span>
                        </div>
                        <div className="wildlife-modal-spec">
                          <span className="wildlife-modal-spec__label">Lifespan</span>
                          <span className="wildlife-modal-spec__value">{activeAnimal.stats.lifespan.replace(' Years', '')} yrs</span>
                        </div>
                        <div className="wildlife-modal-spec">
                          <span className="wildlife-modal-spec__label">Diet</span>
                          <span className="wildlife-modal-spec__value">{activeAnimal.stats.diet}</span>
                        </div>
                        <div className="wildlife-modal-spec">
                          <span className="wildlife-modal-spec__label">Weight</span>
                          <span className="wildlife-modal-spec__value">{activeAnimal.stats.weight}</span>
                        </div>
                      </div>

                      <div className="wildlife-modal__middle">
                        <div className="wildlife-modal-facts">
                          <span className="wildlife-modal-facts__title">Fun Facts</span>
                          <ul className="wildlife-modal-facts__list">
                            {activeAnimal.facts.map((fact, index) => (
                              <li key={index}>{fact}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="wildlife-modal-polaroid" aria-hidden="true">
                          <div className="wildlife-modal-polaroid__image">
                            {activeAnimal.image ? (
                              <img src={activeAnimal.image} alt="" />
                            ) : (
                              <div dangerouslySetInnerHTML={{ __html: activeAnimal.svg }} />
                            )}
                          </div>
                          <span>Stealth & survival</span>
                        </div>
                      </div>

                      <div className="wildlife-modal-map-row">
                        <div className="wildlife-modal-spots">
                          <div className="wildlife-modal-spot">
                            <span>📍</span>
                            <div>
                              <span className="wildlife-modal-spot__label">Where to Spot</span>
                              <strong>Sasan Gir, Gujarat</strong>
                            </div>
                          </div>
                          <div className="wildlife-modal-spot">
                            <span>📅</span>
                            <div>
                              <span className="wildlife-modal-spot__label">Best Time</span>
                              <strong>October – June</strong>
                            </div>
                          </div>
                          <div className="wildlife-modal-spot">
                            <span>🔭</span>
                            <div>
                              <span className="wildlife-modal-spot__label">Spotting Chance</span>
                              <strong>Moderate</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="wildlife-modal-note font-typewriter">
                        <span className="wildlife-modal-note__title">Ranger&apos;s Note</span>
                        <p>
                          &ldquo;{activeAnimal.species === 'lion' ? 'Listen for deep vocalizations near the Kamleshwar reservoir at first light.' :
                            activeAnimal.species === 'leopard' ? 'Leopards are highly elusive and mysterious. Be patient, quiet, and keep search speeds low.' :
                              'Respect nesting zones, keep voice levels down, and watch for warning call signs in monkeys.'}&rdquo;
                        </p>
                        <span className="wildlife-modal-note__sign font-handwritten">– Gir Ranger</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            );
          })()}
        </div>
      </section>
    </div>
    </>
  );
}

// ==========================================================================
// EXPERIENCES SCREEN COMPONENT
// ==========================================================================
const PACKAGES = [
  { id: 'half', title: 'Half Day Safari', price: 4500, type: 'Slot', desc: '4-hour search tracks in a classic open Gypsy vehicle at sunrise.' },
  { id: 'full', title: 'Full Day Safari', price: 12500, type: 'Slot', desc: 'Sunrise-to-sunset complete entry across Sasan zones for photographers.', tag: 'Exclusive' },
  { id: 'jeep', title: 'Jeep Safari', price: 15000, type: 'Vehicle', desc: 'Private open off-roader with senior wildlife naturalists.' },
  { id: 'canter', title: 'Canter Safari', price: 1200, type: 'Seat', desc: 'High-seating open 20-seater coach tracking dry wetland slopes.' }
];

const BOOKING_PACKAGE_LABELS = {
  half: 'Half Day',
  full: 'Full Day',
  jeep: 'Private Jeep',
  canter: 'Canter Shared',
};

const PERMIT_INCLUSIONS = [
  { icon: '\u{1F699}', label: 'Gypsy 4x4 Offroader' },
  { icon: '\u{1F472}', label: 'Forest Dept Guide' },
  { icon: '\u{1F43E}', label: 'Sanctuary Entry Fees' },
  { icon: '\u{1F3AB}', label: 'Hassle-free Clearance' },
];

function ExperiencesScreen() {
  const [date, setDate] = useState('');
  const [pack, setPack] = useState('half');
  const [guests, setGuests] = useState(2);
  const [activeTab, setActiveTab] = useState('half');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Secure booking request filed! Package: ${pack}, Guests: ${guests}, Date: ${date}. Sasan permit code dispatched.`);
  };

  const activePkg = PACKAGES.find(pkg => pkg.id === activeTab) || PACKAGES[0];

  return (
    <div className="bg-[#050f08] text-gray-200">
      <div className="experiences-jungle-container">
        <section className="relative w-full h-[50vh] overflow-hidden flex flex-col justify-center items-center bg-transparent">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="z-20 text-center px-6 select-none max-w-3xl">
            <span class="text-xs uppercase tracking-[0.5em] text-[#c2aa72] font-semibold">Wild Expeditions</span>
            <h1 class="text-4xl sm:text-6xl font-black uppercase text-white tracking-widest cinzel gold-glow mt-3">Safari Packages</h1>
          </div>
        </section>

        <section className="experiences-packages-section py-12 sm:py-16 lg:py-24 bg-transparent relative">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="max-w-6xl mx-auto px-3 sm:px-6 relative z-10 w-full min-w-0">
            <div className="flex flex-col lg:flex-row gap-5 sm:gap-8 items-stretch">

              {/* Left Column: Interactive Tab Stack */}
              <div className="w-full lg:w-2/5 flex flex-col gap-3 sm:gap-4">
                <span className="text-[10px] text-[#c2aa72] uppercase tracking-[0.3em] font-bold text-left mb-1 sm:mb-2 block">
                  Select Expedition
                </span>
                {PACKAGES.map((pkg, index) => {
                  const isActive = pkg.id === activeTab;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => {
                        setActiveTab(pkg.id);
                        setPack(pkg.id);
                      }}
                      className={`w-full p-4 sm:p-6 rounded-xl flex items-center justify-between text-left transition-all duration-300 border focus:outline-none cursor-pointer gap-3 min-w-0 ${isActive
                        ? 'bg-[#c2aa72]/15 border-[#c2aa72] shadow-[0_0_20px_rgba(194,170,114,0.15)]'
                        : 'bg-[#0b1a10]/20 border-[#c2aa72]/10 hover:border-[#c2aa72]/30 hover:bg-[#0b1a10]/35'
                        }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <span className={`text-xs font-bold font-serif shrink-0 ${isActive ? 'text-[#c2aa72]' : 'text-gray-500'}`}>
                          0{index + 1}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm sm:text-md font-bold uppercase tracking-wider cinzel leading-snug ${isActive ? 'text-[#c2aa72] gold-glow' : 'text-white'}`}>
                            {pkg.title}
                          </span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">
                            {pkg.type} Booking
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-black font-serif whitespace-nowrap ${isActive ? 'text-[#c2aa72]' : 'text-gray-400'}`}>
                          ₹{pkg.price.toLocaleString('en-IN')}
                        </span>
                        <span className={`transition-transform duration-300 text-sm ${isActive ? 'text-[#c2aa72] translate-x-1' : 'text-gray-500'}`}>
                          &#10142;
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Breathtaking Interactive Permit Pass */}
              <div key={activeTab} className="permit-card w-full lg:w-3/5 glass-card animate-permit-slide-in">

                {/* Background Watermark/Aura */}
                <div className="permit-card__aura" aria-hidden="true" />

                <div className="permit-card__body">
                  {/* Tag and Crown */}
                  <div className="permit-card__meta">
                    <span className="permit-card__badge">
                      Official Permit Details
                    </span>
                    {activePkg.tag ? (
                      <span className="permit-card__tag">
                        {activePkg.tag}
                      </span>
                    ) : (
                      <span className="permit-card__slot">
                        Available Slot
                      </span>
                    )}
                  </div>

                  {/* Title & Desc */}
                  <div className="permit-card__intro">
                    <h2 className="permit-card__title">
                      {activePkg.title}
                    </h2>
                    <p className="permit-card__desc">
                      {activePkg.desc}
                    </p>
                  </div>

                  {/* Included Items grid */}
                  <div className="permit-card__inclusions-wrap">
                    <h4 className="permit-card__inclusions-title">
                      Permit Inclusions & Perks
                    </h4>
                    <div className="permit-inclusions">
                      {PERMIT_INCLUSIONS.map((item) => (
                        <div key={item.label} className="permit-inclusion">
                          <span className="permit-inclusion__icon" aria-hidden="true">{item.icon}</span>
                          <span className="permit-inclusion__label">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Price block and Call to Action */}
                <div className="permit-card__footer">
                  <div className="permit-card__price-block">
                    <span className="permit-card__price-label">
                      Permit Fare
                    </span>
                    <span className="permit-card__price">
                      ₹{activePkg.price.toLocaleString('en-IN')}
                    </span>
                    <span className="permit-card__price-note">
                      {activePkg.id === 'canter' ? 'Per Seat' : 'Flat rate up to 6 guests'}
                    </span>
                  </div>

                  <div className="permit-card__actions">
                    <a
                      href="#book-block"
                      className="permit-card__cta btn-gold"
                    >
                      Book Permit Now
                    </a>

                    {/* Tiny Barcode details */}
                    <div className="permit-card__barcode" aria-hidden="true">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <span key={i} className="permit-card__barcode-line" style={{ width: i % 4 === 0 ? '2.5px' : '1px', height: `${8 + (i % 3) * 3}px` }} />
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>

        <section id="book-block" className="booking-section py-12 sm:py-16 lg:py-24 bg-transparent relative">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 flex flex-col items-center w-full min-w-0">
            <div className="text-center mb-8 sm:mb-12 lg:mb-16">
              <span className="text-xs uppercase tracking-[0.40em] text-[#c2aa72] font-semibold">State Clearance</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold cinzel text-white mt-3">Book Secure Permits</h2>
            </div>
            <form onSubmit={handleSubmit} className="booking-form w-full min-w-0 glass-card rounded-xl flex flex-col gap-5 sm:gap-6 text-left">
              <div className="booking-form-grid booking-form-grid--two">
                <div className="booking-form-field">
                  <label className="booking-form-label" htmlFor="booking-date">Select Date</label>
                  <input
                    id="booking-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="booking-form-input"
                  />
                </div>
                <div className="booking-form-field">
                  <label className="booking-form-label" htmlFor="booking-package">Safari Package</label>
                  <select
                    id="booking-package"
                    value={pack}
                    onChange={(e) => setPack(e.target.value)}
                    className="booking-form-input booking-form-select"
                  >
                    {PACKAGES.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {BOOKING_PACKAGE_LABELS[pkg.id]} · ₹{pkg.price.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="booking-form-grid booking-form-grid--three">
                <div className="booking-form-field">
                  <label className="booking-form-label" htmlFor="booking-guests">Guests Count</label>
                  <input
                    id="booking-guests"
                    type="number"
                    min="1"
                    max="6"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="booking-form-input"
                  />
                </div>
                <div className="booking-form-field">
                  <label className="booking-form-label" htmlFor="booking-email">Contact Email</label>
                  <input
                    id="booking-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="booking-form-input"
                  />
                </div>
                <div className="booking-form-field">
                  <label className="booking-form-label" htmlFor="booking-phone">Helpline Phone</label>
                  <input
                    id="booking-phone"
                    type="tel"
                    required
                    placeholder="+91 99999 99999"
                    className="booking-form-input"
                  />
                </div>
              </div>
              <button type="submit" className="booking-form-submit btn-gold">Submit Secure Booking</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

// ==========================================================================
// BLOG SCREEN COMPONENT
// ==========================================================================
const STORIES = [
  { species: 'lion', title: 'The Golden Pride: Asiatic Lion Kinships', author: 'Dr. Patel', read: '5 min read', desc: 'An analytical review of tribal boundary patrol loops and cub rearing processes near reservoir borders.', svg: '<path d="M50 15C30.7 15 15 30.7 15 50c0 9.8 4 18.6 10.5 25C26 63.8 30.2 55 42 53c-4.5-3.3-7.5-8.8-7.5-15 0-10.5 8.5-19 19-19s19 8.5 19 19c0 6.2-3 11.7-7.5 15 11.8 2 16 10.8 16.5 22 6.5-6.4 10.5-15.2 10.5-25 0-19.3-15.7-35-35-35z"/>' },
  { species: 'leopard', title: 'Canopy Stalkers: Stealth Dynamics of Rosettes', author: 'Neha Sharma', read: '7 min read', desc: 'Tracking diaries recording micro moves of leopards scaling acacia boughs safe from ground packs.', svg: '<circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="40" cy="45" r="4" fill="currentColor"/><circle cx="60" cy="45" r="4" fill="currentColor"/>' },
  { species: 'bear', title: 'Maldharis: Ancient Symbiotic Co-habitation', author: 'Ranger Amit', read: '4 min read', desc: 'How forest herder breeds share single trails with felines in total historical peace.', svg: '<path d="M50 20 L75 55 H25 Z M 40 55 V80 H 60 V55"/>' }
];

function BlogScreen() {
  return (
    <div>
      <section className="relative w-full h-[50vh] overflow-hidden flex flex-col justify-center items-center bg-[#030905]">
        <div className="absolute inset-0 bg-cover bg-center z-0 scale-105"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(5,15,8,0.4), rgba(5,15,8,1)), url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="800" viewBox="0 0 1920 800"><rect width="100%" height="100%" fill="%23040e06"/><path d="M 0 500 Q 400 450 800 520 T 1600 480 T 1920 540 L 1920 800 L 0 800 Z" fill="%230b1c0e"/></svg>')`
          }}></div>
        <div className="z-20 text-center px-6 select-none max-w-3xl">
          <span class="text-xs uppercase tracking-[0.5em] text-[#c2aa72] font-semibold">Forest Chronicles</span>
          <h1 class="text-4xl sm:text-6xl font-black uppercase text-white tracking-widest cinzel gold-glow mt-3">Jungle Stories</h1>
        </div>
      </section>

      <section className="py-24 bg-[#050f08]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STORIES.map(story => (
              <div key={story.title} className="glass-card rounded-lg overflow-hidden flex flex-col justify-between h-full text-left">
                <div>
                  <div className="h-52 bg-[#0b1a10] relative flex items-center justify-center p-6">
                    <span className="absolute top-4 left-4 bg-emerald-900/40 text-emerald-400 text-[9px] tracking-widest uppercase font-bold py-1 px-3 rounded">Field Diary</span>
                    <div className="w-24 h-24" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" class="w-full h-full text-[#c2aa72]">${story.svg}</svg>` }}></div>
                  </div>
                  <div className="p-6 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      <span>{story.author}</span>
                      <span>&bull; {story.read}</span>
                    </div>
                    <h3 className="text-xl font-bold cinzel text-white leading-snug">{story.title}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">{story.desc}</p>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <span className="text-xs uppercase tracking-wider text-[#c2aa72] font-bold">Read Article &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================================================
// GALLERY SCREEN COMPONENT
// ==========================================================================
const GALLERY_ITEMS = [
  { cat: 'wildlife', cap: 'Asiatic Lion Patrol', svg: '<path d="M50 15C30.7 15 15 30.7 15 50c0 9.8 4 18.6 10.5 25C26 63.8 30.2 55 42 53c-4.5-3.3-7.5-8.8-7.5-15 0-10.5 8.5-19 19-19s19 8.5 19 19c0 6.2-3 11.7-7.5 15 11.8 2 16 10.8 16.5 22 6.5-6.4 10.5-15.2 10.5-25 0-19.3-15.7-35-35-35z"/>', image: '/lion_card.png' },
  { cat: 'safari', cap: 'Open Gypsy Dust Track', svg: '<rect x="100" y="180" width="400" height="110" rx="10" fill="currentColor"/><path d="M120 180 L160 80 L440 80 L480 180 Z" stroke="currentColor" stroke-width="12" fill="none"/>', image: '/gallery_safari.png' },
  { cat: 'landscape', cap: 'Golden Dry Teak Valleys', svg: '<path d="M0 80 Q25 60 50 80 T100 80 L100 100 L0 100 Z" fill="currentColor"/><circle cx="80" cy="30" r="10" fill="currentColor"/>', image: '/gallery_landscape.png' },
  { cat: 'visitors', cap: 'Guest Zoom Capture', svg: '<rect x="20" y="30" width="60" height="50" rx="5" fill="currentColor"/><circle cx="50" cy="55" r="15" fill="none" stroke="#050f08" stroke-width="4"/>', image: '/gallery_visitors.png' },
  { cat: 'wildlife', cap: 'Indian Leopard Stalk', svg: '', image: '/leopard_card.png' },
  { cat: 'wildlife', cap: 'Sloth Bear Forage', svg: '', image: '/bear_card.png' },
  { cat: 'wildlife', cap: 'Spotted Deer Grazing', svg: '', image: '/deer_card.png' },
  { cat: 'wildlife', cap: 'Mugger Crocodile Sunbathe', svg: '', image: '/crocodile_card.png' },
  { cat: 'wildlife', cap: 'Indian Python Undergrowth', svg: '', image: '/python_card.png' },
  { cat: 'wildlife', cap: 'Indian Peacock Dance', svg: '', image: '/peacock_card.png' },
  { cat: 'landscape', cap: 'Ancient Teak Forests', svg: '', image: '/about_gir_bg.png' },
  { cat: 'safari', cap: 'Golden Safari Trail', svg: '', image: '/safari_page_bg.png' }
];

const GALLERY_TRAIL_SLOTS = [
  { left: 54, top: 6, side: 'right' },
  { left: 46, top: 14.5, side: 'left' },
  { left: 56, top: 23, side: 'right' },
  { left: 44, top: 31.5, side: 'left' },
  { left: 54, top: 40, side: 'right' },
  { left: 42, top: 48.5, side: 'left' },
  { left: 52, top: 57, side: 'right' },
  { left: 44, top: 65.5, side: 'left' },
  { left: 54, top: 74, side: 'right' },
  { left: 42, top: 82.5, side: 'left' },
  { left: 52, top: 91, side: 'right' },
  { left: 46, top: 99, side: 'left' },
];

const GALLERY_TRAIL_SLOTS_MOBILE = [
  { left: 50, top: 6, side: 'right' },
  { left: 50, top: 14.5, side: 'left' },
  { left: 50, top: 23, side: 'right' },
  { left: 50, top: 31.5, side: 'left' },
  { left: 50, top: 40, side: 'right' },
  { left: 50, top: 48.5, side: 'left' },
  { left: 50, top: 57, side: 'right' },
  { left: 50, top: 65.5, side: 'left' },
  { left: 50, top: 74, side: 'right' },
  { left: 50, top: 82.5, side: 'left' },
  { left: 50, top: 91, side: 'right' },
  { left: 50, top: 99, side: 'left' },
];

function getGalleryTrailSlots() {
  if (typeof window === 'undefined') return GALLERY_TRAIL_SLOTS;
  return window.innerWidth <= 767 ? GALLERY_TRAIL_SLOTS_MOBILE : GALLERY_TRAIL_SLOTS;
}

function GalleryCollectionCard({ item, photoCount, onOpen, variant = 'default' }) {
  const cardProps = {
    onClick: onOpen,
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    },
  };

  if (variant === 'trail') {
    return (
      <div
        {...cardProps}
        className="gallery-collection-card gallery-collection-card--trail group cursor-pointer"
      >
        <div className="gallery-collection-card__thumb">
          {item.image ? (
            <img src={item.image} alt={item.cap} loading="lazy" decoding="async" />
          ) : (
            <div
              className="gallery-collection-card__placeholder"
              dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" class="w-8 h-8 text-[#c2aa72]/40">${item.svg}</svg>` }}
            />
          )}
        </div>
        <div className="gallery-collection-card__info">
          <h4 className="gallery-collection-card__title cinzel">{item.cap}</h4>
          <span className="gallery-collection-card__arrow" aria-hidden="true">&rarr;</span>
        </div>
      </div>
    );
  }

  return (
    <div {...cardProps} className="gallery-collection-card group cursor-pointer">
      <div className="gallery-collection-card__image">
        {item.image ? (
          <img src={item.image} alt={item.cap} loading="lazy" decoding="async" />
        ) : (
          <div
            className="gallery-collection-card__placeholder"
            dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" class="w-10 h-10 text-[#c2aa72]/40">${item.svg}</svg>` }}
          />
        )}
      </div>
      <div className="gallery-collection-card__body">
        <h4 className="gallery-collection-card__title cinzel">{item.cap}</h4>
        <div className="gallery-collection-card__meta">
          <span>{photoCount} Photos</span>
          <span className="gallery-collection-card__arrow" aria-hidden="true">&rarr;</span>
        </div>
      </div>
    </div>
  );
}

function GalleryScreen() {
  const [lightbox, setLightbox] = useState(null);
  const [trailSlots, setTrailSlots] = useState(GALLERY_TRAIL_SLOTS);

  useEffect(() => {
    const updateSlots = () => setTrailSlots(getGalleryTrailSlots());
    updateSlots();
    window.addEventListener('resize', updateSlots);
    return () => window.removeEventListener('resize', updateSlots);
  }, []);

  const getPhotoCount = (cap) => {
    const counts = {
      'Asiatic Lion Patrol': 18,
      'Open Gypsy Dust Track': 24,
      'Golden Dry Teak Valleys': 22,
      'Guest Zoom Capture': 24,
      'Indian Leopard Stalk': 19,
      'Sloth Bear Forage': 17,
      'Spotted Deer Grazing': 15,
      'Mugger Crocodile Sunbathe': 14,
      'Indian Python Undergrowth': 13,
      'Indian Peacock Dance': 16,
      'Ancient Teak Forests': 20,
      'Golden Safari Trail': 20
    };
    return counts[cap] || 15;
  };

  useEffect(() => {
    if (!lightbox) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLightbox(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightbox]);

  const closeLightbox = () => setLightbox(null);

  return (
    <>
    <div className="gallery-jungle-container">
      <div className="gallery-jungle-container__overlay" aria-hidden="true" />

      <section className="gallery-section">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 relative z-10">
          <div className="gallery-hero">
            <SectionHeading eyebrow="Visual Archives" title="Captured Wilderness" className="mb-2" />
            <p className="gallery-intro">
              A collection of raw, real and breathtaking moments from Gir.
            </p>
          </div>

          <div className="gallery-page-grid">
            <div className="gallery-trail-scaler">
              <div className="gallery-trail-map" aria-label="Gallery roadmap trail">
                {GALLERY_ITEMS.map((item) => {
                  const itemIndex = GALLERY_ITEMS.indexOf(item);
                  const slot = trailSlots[itemIndex];
                  if (!slot) return null;
                  const photoCount = getPhotoCount(item.cap);
                  const num = String(itemIndex + 1).padStart(2, '0');

                  return (
                    <div
                      key={item.cap}
                      className={`gallery-trail-item gallery-trail-item--${slot.side}`}
                      style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
                    >
                      <div className="gallery-trail-marker" aria-hidden="true">
                        <span className="cinzel">{num}</span>
                      </div>
                      <div className="gallery-trail-slot">
                        <GalleryCollectionCard
                          item={item}
                          photoCount={photoCount}
                          variant="trail"
                          onOpen={() => setLightbox(item)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>

      {lightbox && createPortal(
        <div
          className="gallery-lightbox lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.cap}
          onClick={closeLightbox}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="gallery-lightbox__close"
            onClick={(event) => {
              event.stopPropagation();
              closeLightbox();
            }}
          >
            &times;
          </button>
          <div
            className="gallery-lightbox__content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="gallery-lightbox__media">
              {lightbox.image ? (
                <img
                  src={lightbox.image}
                  alt={lightbox.cap}
                  className="gallery-lightbox__image"
                />
              ) : (
                <div
                  className="gallery-lightbox__svg"
                  dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" class="w-full max-w-3xl h-[60vh] text-[#c2aa72]">${lightbox.svg}</svg>` }}
                />
              )}
            </div>
            <h4 className="gallery-lightbox__caption cinzel">{lightbox.cap}</h4>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ==========================================================================
// CONTACT SCREEN COMPONENT
// ==========================================================================
const FAQS = [
  { q: 'What is the best time of year to visit Gir?', a: 'The ideal time to explore Gir is between mid-October and mid-June. Sasan Sasan Gir is closed during monsoons (June 16 to Oct 15).' },
  { q: 'Are park permits refundable?', a: 'Permits are strictly non-refundable and non-transferable under standard state forest department guidelines.' },
  { q: 'How many guests are allowed in one private Gypsy?', a: 'A maximum of six adult guests and one child under 12 are permitted in a single open Gypsy carriage.' }
];

function ContactScreen() {
  const [faqActive, setFaqActive] = useState(null);

  const toggleFaq = (idx) => {
    setFaqActive(faqActive === idx ? null : idx);
  };

  return (
    <div className="contact-jungle-container contact-page">
      <section className="contact-hero relative w-full flex flex-col justify-center items-center bg-transparent">
        <div className="section-safari-shadow" aria-hidden="true" />
        <div className="contact-hero__inner z-20 text-center">
          <span className="contact-hero__eyebrow">Get In Touch</span>
          <h1 className="contact-hero__title cinzel gold-glow">
            <span className="contact-hero__title-line">Contact</span>
            <span className="contact-hero__title-line">Sasan</span>
          </h1>
        </div>
      </section>

      <section className="contact-main-section relative border-b border-emerald-950/20 z-10">
        <div className="section-safari-shadow" aria-hidden="true" />
        <div className="contact-main-grid max-w-7xl mx-auto relative z-10">
          <div className="contact-form-column">
            <h2 className="contact-section-title cinzel text-white">Send a Message</h2>
            <form className="contact-form glass-card" onSubmit={(e) => { e.preventDefault(); alert('Dispatch sent!'); }}>
              <div className="contact-form-field">
                <label className="contact-form-label" htmlFor="contact-name">Your Name</label>
                <input id="contact-name" type="text" required placeholder="Your full name" className="contact-form-input" />
              </div>
              <div className="contact-form-field">
                <label className="contact-form-label" htmlFor="contact-email">Email Address</label>
                <input id="contact-email" type="email" required placeholder="you@example.com" className="contact-form-input" />
              </div>
              <div className="contact-form-field">
                <label className="contact-form-label" htmlFor="contact-message">Your Message</label>
                <textarea id="contact-message" required rows="5" placeholder="Write inquiry..." className="contact-form-input contact-form-textarea" />
              </div>
              <button type="submit" className="contact-form-submit btn-gold">Send Dispatch</button>
            </form>
          </div>

          <div className="contact-info-column">
            <h2 className="contact-section-title cinzel text-white">
              <span className="contact-section-title__line">Information</span>
              <span className="contact-section-title__line">Desk</span>
            </h2>
            <div className="contact-info-card glass-card">
              <div className="contact-info-block">
                <span className="contact-info-label">Office Address</span>
                <p className="contact-info-value">
                  Gir National Park Headquarters, Sasan Gir, Junagadh District, Gujarat, India - 362135
                </p>
              </div>
              <div className="contact-info-grid">
                <div className="contact-info-block">
                  <span className="contact-info-label">Phone Helpline</span>
                  <p className="contact-info-value">
                    <a href="tel:+912877285540" className="contact-info-link">+91 28772 85540</a>
                  </p>
                </div>
                <div className="contact-info-block">
                  <span className="contact-info-label">Official Email</span>
                  <p className="contact-info-value">
                    <a href="mailto:permits@girsafari.gov.in" className="contact-info-link">permits@girsafari.gov.in</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="contact-faq-section relative z-10">
        <div className="section-safari-shadow" aria-hidden="true" />
        <div className="max-w-4xl mx-auto px-3 sm:px-6 text-left relative z-10 w-full min-w-0">
          <header className="contact-faq-header text-center">
            <span className="contact-faq-eyebrow">Immediate Clarity</span>
            <h2 className="contact-faq-title cinzel text-white mt-3">
              <span className="contact-faq-title__line">Frequently Asked</span>
              <span className="contact-faq-title__line">Questions</span>
            </h2>
          </header>

          <div className="flex flex-col gap-3 sm:gap-4">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="contact-faq-item glass-card overflow-hidden border-[#8a7344]/15 bg-[#030905]/85">
                <button onClick={() => toggleFaq(idx)} className="contact-faq-trigger">
                  <span className="contact-faq-question">{faq.q}</span>
                  <svg className={`contact-faq-icon ${faqActive === idx ? 'is-open' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </button>
                {faqActive === idx && (
                  <div className="contact-faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LegalPageLayout({ eyebrow, title, children }) {
  return (
    <div className="legal-page bg-[#050f08] text-gray-200 min-h-screen">
      <div className="about-jungle-container">
        <section className="legal-hero relative w-full flex flex-col justify-center items-center bg-transparent">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="legal-hero__inner z-20 text-center">
            <span className="legal-hero__eyebrow">{eyebrow}</span>
            <h1 className="legal-hero__title cinzel gold-glow">{title}</h1>
          </div>
        </section>

        <section className="legal-content relative z-10">
          <div className="section-safari-shadow" aria-hidden="true" />
          <div className="legal-content__inner">
            <div className="legal-card glass-card">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DisclaimerScreen() {
  return (
    <LegalPageLayout eyebrow="Legal Notice" title="Disclaimer">
      <h2 className="legal-card__title">
        <span className="legal-card__title-line">Important</span>
        <span className="legal-card__title-line">Information</span>
      </h2>
      <p className="legal-card__text">
        Welcome to Gir Jungle Safari. The information provided on this website is for general informational and booking purposes only. All information on the site is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.
      </p>
      <p className="legal-card__text">
        Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or reliance on any information provided on the site. Your use of the site and your reliance on any information on the site is solely at your own risk.
      </p>
      <p className="legal-card__text">
        Please note that Gir National Park is a protected ecological sanctuary. Wildlife sightings are subject to natural factors, and sightings of Asiatic Lions or other wild species are never guaranteed. Safaris are conducted under the rules and strict regulations of the Forest Department of Gujarat.
      </p>
    </LegalPageLayout>
  );
}

function PrivacyPolicyScreen() {
  return (
    <LegalPageLayout eyebrow="Data Protection" title="Privacy Policy">
      <h2 className="legal-card__title">
        <span className="legal-card__title-line">Our</span>
        <span className="legal-card__title-line">Commitment</span>
      </h2>
      <p className="legal-card__text">
        At Gir Jungle Safari, we respect your privacy and are committed to protecting it. This Privacy Policy describes the types of information we may collect from you or that you may provide when you visit our website and our practices for collecting, using, maintaining, protecting, and disclosing that information.
      </p>
      <h3 className="legal-card__subtitle">1. Information We Collect</h3>
      <p className="legal-card__text">
        We collect personal identification information (such as name, email address, phone number, and identity proof details required for safari permits) when you submit booking requests, sign up for our newsletter, or contact our support team.
      </p>
      <h3 className="legal-card__subtitle">2. How We Use Your Information</h3>
      <p className="legal-card__text">
        We use the information we collect to process safari permits, manage bookings, send confirmation notifications, respond to support inquiries, and periodically email wildlife updates and promotional offers (if subscribed).
      </p>
      <h3 className="legal-card__subtitle">3. Data Security</h3>
      <p className="legal-card__text">
        We implement robust security measures to safeguard your personal data from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
      </p>
    </LegalPageLayout>
  );
}

function TermsConditionsScreen() {
  return (
    <LegalPageLayout eyebrow="Rules & Regulations" title="Terms & Conditions">
      <h2 className="legal-card__title">
        <span className="legal-card__title-line">Booking</span>
        <span className="legal-card__title-line">Terms</span>
      </h2>
      <p className="legal-card__text">
        Please read these terms and conditions carefully before booking any safari or tour packages with us. By using this website and completing booking processes, you agree to comply with and be bound by these terms.
      </p>
      <h3 className="legal-card__subtitle">1. Safari Permit Bookings</h3>
      <p className="legal-card__text">
        All safari permits are non-refundable and non-transferable once booked. You must provide authentic photo identity proof (Aadhaar Card, Passport, Voter ID, etc.) for all travelers at the time of booking. The same identity proof must be presented at the forest entry gate.
      </p>
      <h3 className="legal-card__subtitle">2. Forest Rules & Safety</h3>
      <p className="legal-card__text">
        All visitors must strictly adhere to the guidelines set by the Gujarat Forest Department. Littering, getting off the safari vehicle, playing loud music, or trying to feed/harass animals is strictly prohibited. Violators will face immediate expulsion and legal penalties.
      </p>
      <h3 className="legal-card__subtitle">3. Price Changes & Cancellations</h3>
      <p className="legal-card__text">
        Prices are subject to change without prior notice due to government fee updates or currency fluctuations. In case of safari cancellation due to severe weather, forest closures, or government guidelines, refund policies will apply based on forest department decisions.
      </p>
    </LegalPageLayout>
  );
}
