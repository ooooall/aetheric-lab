/**
 * Minimal mode: only entry overlay and sphere.
 */

import { createDotSphereScene } from './dot-sphere.js';

const tapOverlay = document.getElementById('tap-to-enter');
const sphereWrap = document.getElementById('sphere-canvas-wrap');
let sphereScene = null;

function startExperience() {
  if (document.body.classList.contains('entered')) return;
  document.body.classList.add('entered');
  tapOverlay?.classList.add('hidden');

  if (sphereWrap) {
    sphereScene = createDotSphereScene(sphereWrap);
  }

  document.removeEventListener('click', startExperience);
  document.removeEventListener('touchstart', startExperience);
}
window.addEventListener('beforeunload', () => {
  if (sphereScene) sphereScene.destroy();
});

if (tapOverlay) {
  tapOverlay.addEventListener('click', startExperience, { once: true });
  document.addEventListener('touchstart', startExperience, { once: true, passive: true });
}
