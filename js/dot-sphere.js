/**
 * Effect #2 — Сфера из тысяч пикселей
 * Fibonacci sphere, волна света от курсора, наклон к курсору, пульс при наведении
 */

import * as THREE from 'three';

const SPHERE_DOTS_DESKTOP = 4200;
const SPHERE_DOTS_MOBILE = 1800;
const SPHERE_RADIUS = 0.42;
const CAMERA_DISTANCE = 2.05;
const BASE_ROTATION_Y = 0.0045;
const HOVER_ROTATION_Y = 0.012;
const TILT_LERP = 0.028;
const MAX_TILT = 0.22;
const LIGHT_RADIUS = 0.15;
const DOT_BRIGHT_THRESHOLD = 0.1;
const PIXEL_SIZE = 1.55;

function fibonacciSphere(samples, radius) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / Math.max(1, samples - 1)) * 2;
    const rY = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * rY * radius;
    const z = Math.sin(theta) * rY * radius;
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
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.01, 10);
  camera.position.z = CAMERA_DISTANCE;
  camera.lookAt(0, 0, 0);

  const positions = fibonacciSphere(dotCount, SPHERE_RADIUS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

  const sizes = new Float32Array(dotCount);
  for (let i = 0; i < dotCount; i++) {
    sizes[i] = 0.92 + Math.random() * 0.16;
  }
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const sphereCenter = new THREE.Vector3(0, 0, 0);
  const sphereRadius = SPHERE_RADIUS;
  const mouse = new THREE.Vector2(-10, -10);
  const raycaster = new THREE.Raycaster();
  const hoverPoint = new THREE.Vector3(0, 0, 0);
  let isHovering = false;
  let hoverTime = 0;
  let tiltX = 0, tiltY = 0;
  let targetTiltX = 0, targetTiltY = 0;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uBaseColor: { value: new THREE.Color(1, 1, 1) },
      uAccentColor: { value: new THREE.Color(0x5fffd4) },
      uLightRadius: { value: LIGHT_RADIUS },
    },
    vertexShader: `
      attribute float size;
      uniform vec3 uMouse;
      uniform float uTime;
      uniform float uHover;
      uniform float uLightRadius;
      varying float vBrightness;
      void main() {
        vec3 pos = position;
        float pulse = 1.0 + 0.1 * sin(uTime * 1.8) * uHover;
        pos *= pulse;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        float dist = length(worldPos.xyz - uMouse);
        vBrightness = 1.0 / (1.0 + (dist / uLightRadius) * (dist / uLightRadius));
        vec4 mvPos = viewMatrix * worldPos;
        float depth = -mvPos.z;
        gl_PointSize = size * ${PIXEL_SIZE.toFixed(2)} * (280.0 / depth);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      varying float vBrightness;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float edge = smoothstep(0.9, 0.35, d);
        float alpha = edge * mix(0.2, 0.95, vBrightness);
        vec3 col = mix(uBaseColor * 0.25, uAccentColor, vBrightness);
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
        targetTiltX = -mouse.y * MAX_TILT;
        targetTiltY = mouse.x * MAX_TILT;
      }
    } else {
      targetTiltX *= 0.92;
      targetTiltY *= 0.92;
    }
  }

  let rafId;
  function animate(time) {
    const dt = 0.016;
    hoverTime += dt;
    material.uniforms.uTime.value = hoverTime;
    material.uniforms.uHover.value = isHovering
      ? Math.min(1, material.uniforms.uHover.value + dt * 2.2)
      : Math.max(0, material.uniforms.uHover.value - dt * 1.5);

    tiltX += (targetTiltX - tiltX) * TILT_LERP;
    tiltY += (targetTiltY - tiltY) * TILT_LERP;
    points.rotation.x = tiltX;
    points.rotation.y += isHovering ? HOVER_ROTATION_Y : BASE_ROTATION_Y;
    points.rotation.z = tiltY;

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
    targetTiltX = 0;
    targetTiltY = 0;
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
      return (mouse.x + 1) * 0.5;
    },
  };
}
