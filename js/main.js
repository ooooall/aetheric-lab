/**
 * Aetheric Lab — Entry: Lenis, GSAP, cursor, scroll progress, scenes, sound
 */

import Lenis from 'lenis';
import { createParticleTextScene } from './particle-text.js';
import { createDotSphereScene } from './dot-sphere.js';
import * as sound from './sound.js';

const { gsap } = window;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

// ─── Touch detection ─────────────────────────────────────────────────────
if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  document.body.classList.add('using-touch');
}

// ─── Tap to enter (sound unlock) ──────────────────────────────────────────
const tapOverlay = document.getElementById('tap-to-enter');
const ASSEMBLY_DELAY_MS = 1200;
function onFirstInteraction() {
  if (tapOverlay && tapOverlay.classList.contains('hidden')) return;
  sound.initSound();
  tapOverlay?.classList.add('hidden');
  sound.startDrone();
  document.removeEventListener('click', onFirstInteraction);
  document.removeEventListener('touchstart', onFirstInteraction);
}
if (tapOverlay) {
  tapOverlay.addEventListener('click', onFirstInteraction);
  document.addEventListener('touchstart', onFirstInteraction, { once: true, passive: true });
}

// ─── Lenis smooth scroll ───────────────────────────────────────────────
const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
const progressEl = document.getElementById('scroll-progress');
function updateProgress() {
  const p = lenis.progress;
  progressEl.style.height = `${p * 100}%`;
}
lenis.on('scroll', updateProgress);

// ─── RAF: Lenis + update progress ───────────────────────────────────────
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ─── Custom cursor (desktop only) ───────────────────────────────────────
const cursor = document.getElementById('cursor');
const cursorDot = cursor?.querySelector('.cursor-dot');
const cursorRing = cursor?.querySelector('.cursor-ring');
let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;
const LERP = 0.12;

if (!document.body.classList.contains('using-touch') && cursor) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';
  });

  function updateCursor() {
    ringX += (mouseX - ringX) * LERP;
    ringY += (mouseY - ringY) * LERP;
    cursorRing.style.left = ringX + 'px';
    cursorRing.style.top = ringY + 'px';
    requestAnimationFrame(updateCursor);
  }
  updateCursor();

  document.querySelectorAll('[data-cursor-hover]').forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}

// ─── Scenes ─────────────────────────────────────────────────────────────
const heroWrap = document.getElementById('hero-canvas-wrap');
const sphereWrap = document.getElementById('sphere-canvas-wrap');

let particleScene, dotSphereScene;
if (heroWrap) {
  particleScene = createParticleTextScene(heroWrap, {
    callbacks: {
      onAssemblyStart() {
        if (sound.isReady()) sound.playAssemblySound();
      },
      onCursorEnter: () => sound.isReady() && sound.particleRepelStart(),
      onCursorLeave: () => sound.isReady() && sound.particleRepelStop(),
      onCursorMove: (velocityNorm, distNorm) => sound.isReady() && sound.particleRepelUpdate(velocityNorm, distNorm),
    },
  });
}
if (sphereWrap) {
  dotSphereScene = createDotSphereScene(sphereWrap, {
    callbacks: {
      onHoverEnter: () => sound.isReady() && sound.sphereHoverEnter(),
      onHoverLeave: () => sound.isReady() && sound.sphereSingingBowlStop(),
      onClick: () => sound.isReady() && sound.sphereClick(),
      onDotBrighten: (yNorm) => sound.isReady() && sound.sphereDotPing(yNorm),
    },
  });
}

// Forward global mouse to scenes (for cursor repulsion / light wave when canvas doesn't get events)
if (!document.body.classList.contains('using-touch')) {
  document.addEventListener('mousemove', (e) => {
    if (heroWrap && particleScene) {
      const r = heroWrap.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        particleScene.setMouse(e.clientX, e.clientY);
      }
    }
    if (sphereWrap && dotSphereScene) {
      const r = sphereWrap.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        dotSphereScene.setMouse(e.clientX, e.clientY);
        if (sound.isReady()) {
          const xNorm = (e.clientX - r.left) / r.width;
          sound.sphereSingingBowl(xNorm);
        }
      }
    }
  });
}

// ─── Touch: tap hero to scatter & reassemble ────────────────────────────
if (document.body.classList.contains('using-touch') && heroWrap && particleScene) {
  heroWrap.addEventListener('click', () => particleScene.scatterAndReassemble());
}

// ─── Tagline: fade in after particle assembly ────────────────────────────
const tagline = document.querySelector('.hero-tagline');
const ASSEMBLY_DURATION = 1800;
setTimeout(() => {
  if (tagline) tagline.classList.add('visible');
}, ASSEMBLY_DELAY_MS + ASSEMBLY_DURATION + 200);

// ─── Manifesto: word-by-word on scroll ───────────────────────────────────
const manifesto = document.getElementById('manifesto');
const words = manifesto?.querySelectorAll('.word');
if (gsap && ScrollTrigger && words?.length) {
  gsap.set(words, { opacity: 0, y: '0.4em' });
  gsap.to(words, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    stagger: 0.06,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#sphere-section',
      start: 'top 70%',
      end: 'top 30%',
      scrub: false,
      once: true,
    },
  });
}

// ─── Scroll section sound ────────────────────────────────────────────────
let lastSectionIndex = -1;
function getCurrentSectionIndex() {
  const sections = document.querySelectorAll('section.full-viewport');
  const scroll = lenis.scroll;
  let idx = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].offsetTop <= scroll + 100) idx = i;
  }
  return idx;
}
lenis.on('scroll', () => {
  const idx = getCurrentSectionIndex();
  if (idx !== lastSectionIndex && lastSectionIndex >= 0 && sound.isReady()) {
    sound.scrollSection();
  }
  lastSectionIndex = idx;
});

// ─── CTA (contact email) sounds ───────────────────────────────────────────
const contactEmail = document.querySelector('.contact-email');
if (contactEmail) {
  contactEmail.addEventListener('mouseenter', () => sound.isReady() && sound.ctaHover());
  contactEmail.addEventListener('click', () => sound.isReady() && sound.ctaClick());
}

// ─── Mute button + M key ───────────────────────────────────────────────────
const muteBtn = document.getElementById('mute-btn');
function updateMuteUI() {
  if (muteBtn) muteBtn.classList.toggle('muted', sound.isMuted());
}
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    if (sound.isReady()) {
      sound.toggleMute();
      updateMuteUI();
    }
  });
}
document.addEventListener('keydown', (e) => {
  if ((e.key === 'm' || e.key === 'M') && sound.isReady()) {
    sound.toggleMute();
    updateMuteUI();
  }
});

// ─── Optional: kill on page hide (cleanup) ────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (particleScene) particleScene.destroy();
  if (dotSphereScene) dotSphereScene.destroy();
  lenis.destroy();
});
