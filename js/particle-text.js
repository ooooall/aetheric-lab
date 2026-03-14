/**
 * Effect #1 — Particle text "Aetheric Lab"
 * Chaos → assemble with spring physics, cursor repulsion
 */

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const PARTICLE_COUNT_DESKTOP = 15000;
const PARTICLE_COUNT_MOBILE = 6000;
const SPRING_STIFFNESS = 0.08;
const SPRING_DAMPING = 0.85;
const REPEL_RADIUS_PX = 120;
const REPEL_STRENGTH = 80;
const ASSEMBLY_DELAY_MS = 1200;
const ASSEMBLY_DURATION_MS = 1800;

function createParticleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function sampleTextPixels(text = 'Aetheric Lab') {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 120px "DM Serif Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const points = [];
  const stride = 2;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 20) {
        const nx = (x / width) * 2 - 1;
        const ny = -((y / height) * 2 - 1);
        points.push(nx, ny, 0);
      }
    }
  }
  return points;
}

function createChaosPositions(count, aspect) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    positions.push(
      (Math.random() - 0.5) * 2 * aspect,
      (Math.random() - 0.5) * 2,
      0
    );
  }
  return positions;
}

export function createParticleTextScene(container, options = {}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;

  let width = container.clientWidth;
  let height = container.clientHeight;
  let aspect = width / height;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.01, 10);
  camera.position.z = 1;
  camera.updateProjectionMatrix();

  const textPoints = sampleTextPixels();
  const availableTargets = Math.floor(textPoints.length / 3);
  const targetCount = Math.min(particleCount, availableTargets);
  const targetPositions = new Float32Array(targetCount * 3);
  const step = Math.max(1, availableTargets / targetCount);
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(Math.floor(i * step), availableTargets - 1) * 3;
    targetPositions[i * 3] = textPoints[idx] * 0.85;
    targetPositions[i * 3 + 1] = textPoints[idx + 1] * 0.85;
    targetPositions[i * 3 + 2] = 0;
  }

  const chaosPositions = createChaosPositions(targetCount, aspect);
  const positions = new Float32Array(chaosPositions);
  const velocities = new Float32Array(targetCount * 3);
  const sizes = new Float32Array(targetCount);
  const opacities = new Float32Array(targetCount);
  for (let i = 0; i < targetCount; i++) {
    sizes[i] = 1.5 + Math.random() * 1.5;
    opacities[i] = 0.6 + Math.random() * 0.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('target', new THREE.BufferAttribute(new Float32Array(targetPositions), 3));

  const texture = createParticleTexture();
  const material = new THREE.PointsMaterial({
    size: 0.015,
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: new THREE.Color(0x5fffd4),
    sizeAttenuation: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (350.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
      `
    );
    shader.vertexShader = 'attribute float size;\nattribute float opacity;\nvarying float vOpacity;\n' + shader.vertexShader.replace(
      'gl_Position = projectionMatrix * mvPosition;',
      'vOpacity = opacity;\n  gl_Position = projectionMatrix * mvPosition;'
    );
    shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      'float d = length(gl_PointCoord - 0.5) * 2.0;\n  float opacity = vOpacity * (1.0 - smoothstep(0.0, 1.0, d));\n  gl_FragColor = vec4(outgoingLight, opacity);'
    );
  };

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x060606, 0);
  container.appendChild(renderer.domElement);

  const callbacks = options.callbacks || {};
  const mouse3D = new THREE.Vector3(-1e6, -1e6, 0);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersect = new THREE.Vector3();
  let cursorInHero = false;
  let lastMouseX = 0, lastMouseY = 0, lastMouseTime = 0;
  let assemblyStartFired = false;

  function projectMouseToScene(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, intersect);
    mouse3D.copy(intersect);
  }

  let startTime = null;
  const posAttr = geometry.attributes.position;
  const targetAttr = geometry.attributes.target;
  const velocitiesArray = new Float32Array(targetCount * 3);
  const staggerDelays = new Float32Array(targetCount);
  for (let i = 0; i < targetCount; i++) staggerDelays[i] = Math.random() * 0.4;
  const hasStartedAssembly = new Uint8Array(targetCount);

  const noise2D = createNoise2D();
  const noiseOffsets = new Float32Array(targetCount * 2);
  for (let i = 0; i < targetCount; i++) {
    noiseOffsets[i * 2] = Math.random() * 1000;
    noiseOffsets[i * 2 + 1] = Math.random() * 1000;
  }

  function getRepelRadiusUnits() {
    return (REPEL_RADIUS_PX / height) * 2;
  }

  function animate(time) {
    if (!startTime) startTime = time;
    const elapsed = time - startTime;
    const repelRadiusUnits = getRepelRadiusUnits();

    if (elapsed > ASSEMBLY_DELAY_MS && !assemblyStartFired && callbacks.onAssemblyStart) {
      assemblyStartFired = true;
      callbacks.onAssemblyStart();
    }
    const mouseValid = mouse3D.x > -1e5 && mouse3D.y > -1e5;
    if (cursorInHero && mouseValid && callbacks.onCursorMove) {
      const dt = (time - lastMouseTime) / 1000 || 0.016;
      const vel = Math.sqrt(Math.pow(mouse3D.x - lastMouseX, 2) + Math.pow(mouse3D.y - lastMouseY, 2)) / dt;
      const velocityNorm = Math.min(1, vel / 4);
      const dist = Math.sqrt(mouse3D.x * mouse3D.x + mouse3D.y * mouse3D.y);
      const distNorm = Math.min(1, dist / 1.2);
      callbacks.onCursorMove(velocityNorm, distNorm);
      lastMouseX = mouse3D.x;
      lastMouseY = mouse3D.y;
      lastMouseTime = time;
    }

    for (let i = 0; i < targetCount; i++) {
      const ix = i * 3;
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const tx = targetAttr.getX(i);
      const ty = targetAttr.getY(i);
      const tz = targetAttr.getZ(i);
      let vx = velocitiesArray[ix];
      let vy = velocitiesArray[ix + 1];
      let vz = velocitiesArray[ix + 2];

      if (elapsed > ASSEMBLY_DELAY_MS + staggerDelays[i] * ASSEMBLY_DURATION_MS) {
        hasStartedAssembly[i] = 1;
      }
      const inChaos = !hasStartedAssembly[i];

      if (inChaos) {
        const t = elapsed * 0.001;
        const nx = noiseOffsets[i * 2];
        const ny = noiseOffsets[i * 2 + 1];
        const drift = 0.0002;
        x += noise2D(nx + t * 0.3, ny) * drift;
        y += noise2D(nx + 100, ny + t * 0.3) * drift;
        velocitiesArray[ix] = 0;
        velocitiesArray[ix + 1] = 0;
        velocitiesArray[ix + 2] = 0;
      } else {
        const dx = tx - x;
        const dy = ty - y;
        const dz = tz - z;
        vx += dx * SPRING_STIFFNESS;
        vy += dy * SPRING_STIFFNESS;
        vz += dz * SPRING_STIFFNESS;
        vx *= SPRING_DAMPING;
        vy *= SPRING_DAMPING;
        vz *= SPRING_DAMPING;

        const dxMouse = x - mouse3D.x;
        const dyMouse = y - mouse3D.y;
        const distToMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distToMouse < repelRadiusUnits && distToMouse > 1e-6) {
          const force = (REPEL_STRENGTH / (distToMouse * distToMouse + 0.01)) * 0.00025;
          const fx = (dxMouse / distToMouse) * force;
          const fy = (dyMouse / distToMouse) * force;
          vx += fx;
          vy += fy;
        }

        x += vx;
        y += vy;
        velocitiesArray[ix] = vx;
        velocitiesArray[ix + 1] = vy;
        velocitiesArray[ix + 2] = vz;
      }

      posAttr.setXYZ(i, x, y, z);
    }

    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function onResize() {
    width = container.clientWidth;
    height = container.clientHeight;
    aspect = width / height;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  let rafId;
  function loop(time) {
    animate(time);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  window.addEventListener('resize', onResize);

  function onMouseMove(e) {
    if (!cursorInHero && callbacks.onCursorEnter) callbacks.onCursorEnter();
    cursorInHero = true;
    lastMouseX = mouse3D.x;
    lastMouseY = mouse3D.y;
    lastMouseTime = performance.now();
    projectMouseToScene(e.clientX, e.clientY);
  }
  function onMouseLeave() {
    if (cursorInHero && callbacks.onCursorLeave) callbacks.onCursorLeave();
    cursorInHero = false;
    mouse3D.set(-1e6, -1e6, 0);
  }
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseleave', onMouseLeave);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    },
    setMouse(clientX, clientY) {
      projectMouseToScene(clientX, clientY);
    },
    scatterAndReassemble() {
      const aspectNow = container.clientWidth / container.clientHeight;
      for (let i = 0; i < targetCount; i++) {
        hasStartedAssembly[i] = 0;
        posAttr.setXYZ(
          i,
          (Math.random() - 0.5) * 2 * aspectNow,
          (Math.random() - 0.5) * 2,
          0
        );
        velocitiesArray[i * 3] = 0;
        velocitiesArray[i * 3 + 1] = 0;
        velocitiesArray[i * 3 + 2] = 0;
      }
      posAttr.needsUpdate = true;
      startTime = performance.now();
    },
  };
}
