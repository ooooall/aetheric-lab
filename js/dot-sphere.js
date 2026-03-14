/**
 * Живая сфера — Fibonacci 1200+ точек, дыхание, пятно света от курсора, волна при hover
 */

import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';

const N = 1200;
const SPHERE_RADIUS = 1.0;
const GLOW_RADIUS = 0.45;
const BASE_OPACITY = 0.055;
const PULSE_AMPLITUDE = 0.025;
const PULSE_FREQ = 0.8;
const NOISE_AMOUNT = 0.015;
const HIT_LERP = 0.15;
const RIPPLE_SPEED = 1.2;
const RIPPLE_WIDTH = 0.12;
const RIPPLE_DURATION = 2.0;
const FADEOUT_MS = 800;
const SPIN_BOOST_DURATION_MS = 500;
const BASE_ROT_Y = 0.003;
const BASE_ROT_X = 0.0008;
const BOOST_ROT_MULT = 2.5;

const TEAL = new THREE.Color(0x4de8c2);
const WHITE = new THREE.Color(0xffffff);

function fibonacciSphere(samples, radius) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const positions = [];
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r * radius;
    const z = Math.sin(theta) * r * radius;
    positions.push(x, y * radius, z);
  }
  return positions;
}

export function createDotSphereScene(container, options = {}) {
  const callbacks = options.callbacks || {};
  let width = Math.max(500, window.innerWidth);
  let height = Math.max(500, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 10);
  camera.position.z = 3.0;
  camera.lookAt(0, 0, 0);

  const sphereGroup = new THREE.Group();
  scene.add(sphereGroup);

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.FrontSide })
  );
  sphereGroup.add(hitMesh);

  const basePositions = fibonacciSphere(N, SPHERE_RADIUS);
  const positions = new Float32Array(basePositions);
  const sizes = new Float32Array(N);
  const opacities = new Float32Array(N);
  const colors = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    sizes[i] = 2.35;
    opacities[i] = BASE_OPACITY;
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute vec3 aColor;
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vOpacity = aOpacity;
        vColor = aColor;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;
        float alpha = (1.0 - smoothstep(0.36, 0.5, dist)) * vOpacity;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  sphereGroup.add(points);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x060606, 0);
  container.appendChild(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-10, -10);
  const currentHit = new THREE.Vector3(0, 0, 0);
  const targetHit = new THREE.Vector3(0, 0, 0);
  const tempLocal = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  const noise3D = createNoise3D();

  let isHovering = true;
  let time = 0;
  let glowStrength = 1;
  let spinBoostUntil = 0;
  let rippleTime = -1;
  let rippleOrigin = new THREE.Vector3(0, 0, 0);
  let prevHadHit = false;

  function projectMouse(clientX, clientY) {
    mouse.x = (clientX / width) * 2 - 1;
    mouse.y = -(clientY / height) * 2 + 1;
  }

  function updateHitPoint() {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(hitMesh);
    const hadHit = intersects.length > 0;
    if (hadHit) {
      tempLocal.copy(intersects[0].point);
      sphereGroup.worldToLocal(tempLocal);
      targetHit.copy(tempLocal);
      if (!prevHadHit) {
        rippleTime = 0;
        rippleOrigin.copy(currentHit);
        if (callbacks.onHoverEnter) callbacks.onHoverEnter();
      }
    } else {
      rayDir.copy(raycaster.ray.direction).normalize().multiplyScalar(SPHERE_RADIUS);
      tempLocal.copy(rayDir);
      sphereGroup.worldToLocal(tempLocal);
      targetHit.copy(tempLocal);
      if (prevHadHit) {
        spinBoostUntil = performance.now() + SPIN_BOOST_DURATION_MS;
        if (callbacks.onHoverLeave) callbacks.onHoverLeave();
      }
    }
    prevHadHit = hadHit;
    currentHit.lerp(targetHit, HIT_LERP);
  }

  function lerpColor(out, a, b, t) {
    out.r = a.r + (b.r - a.r) * t;
    out.g = a.g + (b.g - a.g) * t;
    out.b = a.b + (b.b - a.b) * t;
  }

  const tempColor = new THREE.Color();

  function animate(deltaMs) {
    const dt = deltaMs / 1000;
    time += dt;

    const rotBoost = spinBoostUntil > performance.now() ? BOOST_ROT_MULT : 1;
    sphereGroup.rotation.y += BASE_ROT_Y * rotBoost;
    sphereGroup.rotation.x += BASE_ROT_X * rotBoost;

    sphereGroup.updateMatrixWorld(true);

    updateHitPoint();
    if (isHovering) {
      glowStrength = Math.min(1, glowStrength + dt * 2);
    } else {
      glowStrength = Math.max(0, glowStrength - dt * (1000 / FADEOUT_MS));
    }

    const posAttr = geometry.attributes.position;
    const sizeAttr = geometry.attributes.aSize;
    const opacityAttr = geometry.attributes.aOpacity;
    const colorAttr = geometry.attributes.aColor;

    for (let i = 0; i < N; i++) {
      const ix = i * 3;
      const baseX = basePositions[ix];
      const baseY = basePositions[ix + 1];
      const baseZ = basePositions[ix + 2];

      const noise = noise3D(baseX * 0.5 + time * 0.1, baseY * 0.5, baseZ * 0.5);
      const nx = baseX + noise * NOISE_AMOUNT;
      const ny = baseY + noise3D(baseX * 0.5, baseY * 0.5 + time * 0.08, baseZ * 0.5) * NOISE_AMOUNT;
      const nz = baseZ + noise3D(baseX * 0.5 + time * 0.05, baseY * 0.5, baseZ * 0.5) * NOISE_AMOUNT;
      posAttr.setXYZ(i, nx, ny, nz);

      const pulse = Math.sin(time * PULSE_FREQ + i * 0.05) * PULSE_AMPLITUDE;
      let opacity = BASE_OPACITY + pulse;
      let size = 2.35;
      WHITE.getRGB(tempColor);

      const dist = Math.sqrt(
        (nx - currentHit.x) ** 2 + (ny - currentHit.y) ** 2 + (nz - currentHit.z) ** 2
      );

      if (dist < GLOW_RADIUS && glowStrength > 0.001) {
        const t = 1.0 - dist / GLOW_RADIUS;
        const brightness = t * t * t * glowStrength;

        opacity = BASE_OPACITY + brightness * 0.88;
        if (brightness > 0.8) {
          const u = (brightness - 0.8) / 0.2;
          lerpColor(tempColor, TEAL, WHITE, u);
          size = 4.8;
        } else if (brightness > 0.3) {
          tempColor.copy(TEAL);
          size = 3.2 + brightness * 1.4;
        } else {
          lerpColor(tempColor, WHITE, TEAL, brightness / 0.3);
          size = 2.35;
        }
      } else {
        size = 2.35;
      }

      if (rippleTime >= 0 && rippleTime < RIPPLE_DURATION) {
        const d = Math.sqrt(
          (nx - rippleOrigin.x) ** 2 + (ny - rippleOrigin.y) ** 2 + (nz - rippleOrigin.z) ** 2
        );
        const rippleFront = rippleTime * RIPPLE_SPEED;
        const diff = Math.abs(d - rippleFront);
        if (diff < RIPPLE_WIDTH) {
          const t = 1 - diff / RIPPLE_WIDTH;
          const extra = t * 0.6 * (1 - rippleTime / RIPPLE_DURATION);
          opacity = Math.min(1, opacity + extra);
          tempColor.lerp(TEAL, 0.4);
        }
      }

      sizeAttr.setX(i, size);
      opacityAttr.setX(i, opacity);
      colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }

    if (rippleTime >= 0 && rippleTime < RIPPLE_DURATION) {
      rippleTime += dt;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  let lastTime = performance.now();
  let rafId;
  function loop() {
    const now = performance.now();
    animate(now - lastTime);
    lastTime = now;
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  function onMouseMove(e) {
    isHovering = true;
    projectMouse(e.clientX, e.clientY);
  }

  function onMouseLeave(e) {
    if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
      isHovering = false;
      spinBoostUntil = performance.now() + SPIN_BOOST_DURATION_MS;
      if (callbacks.onHoverLeave) callbacks.onHoverLeave();
    }
  }

  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseout', onMouseLeave);

  function onResize() {
    width = Math.max(500, window.innerWidth);
    height = Math.max(500, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseout', onMouseLeave);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    },
    setMouse(clientX, clientY) {
      isHovering = true;
      projectMouse(clientX, clientY);
    },
    getMouseXNorm() {
      return (mouse.x + 1) * 0.5;
    },
  };
}
