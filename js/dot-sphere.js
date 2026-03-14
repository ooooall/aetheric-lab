/**
 * Effect #2 — Interactive dot sphere
 * Fibonacci sphere, cursor light wave, hover pulse
 */

import * as THREE from 'three';

const SPHERE_DOTS_DESKTOP = 800;
const SPHERE_DOTS_MOBILE = 400;
const SPHERE_RADIUS = 0.5;
const BASE_ROTATION_Y = 0.003;
const HOVER_ROTATION_Y = 0.008;
const LIGHT_FALLOFF = 0.1;
const DOT_BRIGHT_THRESHOLD = 0.12;

function fibonacciSphere(samples, radius) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * radiusAtY * radius;
    const z = Math.sin(theta) * radiusAtY * radius;
    points.push(x, y * radius, z);
  }
  return points;
}

export function createDotSphereScene(container, options = {}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const dotCount = isMobile ? SPHERE_DOTS_MOBILE : SPHERE_DOTS_DESKTOP;
  const callbacks = options.callbacks || {};

  let width = container.clientWidth;
  let height = container.clientHeight;
  const prevBright = new Uint8Array(dotCount);
  const tempWorld = new THREE.Vector3();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 10);
  camera.position.z = 1.8;
  camera.lookAt(0, 0, 0);

  const positions = fibonacciSphere(dotCount, SPHERE_RADIUS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

  const sphereCenter = new THREE.Vector3(0, 0, 0);
  const sphereRadius = SPHERE_RADIUS;
  const mouse3D = new THREE.Vector3(0, 0, 0);
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-10, -10);
  const hoverPoint = new THREE.Vector3(0, 0, 0);
  let isHovering = false;
  let hoverTime = 0;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uBaseColor: { value: new THREE.Color(1, 1, 1) },
      uAccentColor: { value: new THREE.Color(0x5fffd4) },
    },
    vertexShader: `
      uniform vec3 uMouse;
      uniform float uTime;
      uniform float uHover;
      varying float vBrightness;
      varying vec3 vWorldPosition;
      void main() {
        vec3 pos = position;
        float pulse = 1.0 + 0.15 * sin(uTime * 2.0) * uHover;
        pos *= pulse;
        vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        float dist = length(vWorldPosition - uMouse);
        vBrightness = 1.0 / (1.0 + dist * 8.0);
        gl_PointSize = 4.0 * (300.0 / -mvPos.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      varying float vBrightness;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.0, 1.0, d)) * mix(0.15, 1.0, vBrightness);
        vec3 col = mix(uBaseColor * 0.15, uAccentColor, vBrightness);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x060606, 0);
  container.appendChild(renderer.domElement);

  function projectMouseToSphere(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const w = rect.width || width;
    const h = rect.height || height;
    mouse.x = ((clientX - rect.left) / w) * 2 - 1;
    mouse.y = -((clientY - rect.top) / h) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const dir = raycaster.ray.direction;
    const o = raycaster.ray.origin;
    const oc = o.clone().sub(sphereCenter);
    const a = dir.dot(dir);
    const b = 2 * oc.dot(dir);
    const c = oc.dot(oc) - sphereRadius * sphereRadius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0) {
        hoverPoint.copy(raycaster.ray.origin).addScaledVector(dir, t);
        material.uniforms.uMouse.value.copy(hoverPoint);
      }
    }
  }

  let rafId;
  function animate(time) {
    const dt = 0.016;
    hoverTime += dt;
    material.uniforms.uTime.value = hoverTime;
    material.uniforms.uHover.value = isHovering ? Math.min(1, material.uniforms.uHover.value + dt * 2) : Math.max(0, material.uniforms.uHover.value - dt * 2);
    const rotY = isHovering ? HOVER_ROTATION_Y : BASE_ROTATION_Y;
    points.rotation.y += rotY;
    points.updateMatrixWorld(true);
    const hoverPt = material.uniforms.uMouse.value;
    const posAttr = geometry.attributes.position;
    if (callbacks.onDotBrighten && hoverPt.x < 1e5) {
      for (let i = 0; i < dotCount; i++) {
        tempWorld.fromArray(posAttr.array, i * 3);
        tempWorld.applyMatrix4(points.matrixWorld);
        const d = tempWorld.distanceTo(hoverPt);
        const bright = d < DOT_BRIGHT_THRESHOLD;
        if (bright && !prevBright[i]) {
          const y = posAttr.getY(i);
          const yNorm = (y / SPHERE_RADIUS + 1) * 0.5;
          callbacks.onDotBrighten(yNorm);
        }
        prevBright[i] = bright ? 1 : 0;
      }
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }
  rafId = requestAnimationFrame(animate);

  function onResize() {
    width = container.clientWidth;
    height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function onMouseMove(e) {
    projectMouseToSphere(e.clientX, e.clientY);
  }

  function onMouseEnter() {
    isHovering = true;
    if (callbacks.onHoverEnter) callbacks.onHoverEnter();
  }
  function onMouseLeave() {
    isHovering = false;
    material.uniforms.uMouse.value.set(1e6, 1e6, 1e6);
    if (callbacks.onHoverLeave) callbacks.onHoverLeave();
  }
  function onClick(e) {
    if (callbacks.onClick) callbacks.onClick(e);
  }

  window.addEventListener('resize', onResize);
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseenter', onMouseEnter);
  container.addEventListener('mouseleave', onMouseLeave);
  container.addEventListener('click', onClick);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('click', onClick);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    },
    setMouse(clientX, clientY) {
      projectMouseToSphere(clientX, clientY);
    },
    getMouseXNorm() {
      const rect = container.getBoundingClientRect();
      return (mouse.x + 1) * 0.5;
    },
  };
}
