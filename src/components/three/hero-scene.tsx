"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Points, ShaderMaterial } from "three";

const COUNT = 130;

// Warm brand palettes. Dark mode uses bright motes with additive glow; light
// mode uses deeper brass/gold/green with normal blending so they stay visible
// on the light hero.
const PALETTE_DARK = [
  new THREE.Color("#f0d69a"),
  new THREE.Color("#d9b25a"),
  new THREE.Color("#fff4e0"),
];
const PALETTE_LIGHT = [
  new THREE.Color("#9a6a1e"),
  new THREE.Color("#b6832c"),
  new THREE.Color("#2f7d54"),
];

const vertexShader = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    // Strictly circular: discard anything outside the unit disc, soft edge in.
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.12, d);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
`;

const MARGIN = 0.06; // normalized wrap margin beyond the visible edge
const FADE_FROM = 0.36; // fully visible within this; fully faded by the edge (0.5)

function edgeFade(n: number) {
  const a = Math.abs(n);
  const t = (a - FADE_FROM) / (0.5 - FADE_FROM);
  return 1 - Math.min(Math.max(t, 0), 1);
}

type Buffers = {
  // Normalized (resolution-independent) simulation state.
  nx: Float32Array;
  ny: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  phase: Float32Array;
  base: Float32Array;
  // GPU attribute buffers.
  positions: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
};

// Module-scope buffer construction — building these random arrays here (once,
// lazily via a ref) is cheaper than reconstructing them inside useMemo on every
// mount. Behaviour/mutation logic is unchanged from before.
function createBuffers(count: number): Buffers {
  const nx = new Float32Array(count);
  const ny = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const phase = new Float32Array(count);
  const base = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    nx[i] = (Math.random() - 0.5) * (1 + 2 * MARGIN);
    ny[i] = (Math.random() - 0.5) * (1 + 2 * MARGIN);
    vx[i] = (Math.random() - 0.5) * 0.02;
    vy[i] = (Math.random() - 0.5) * 0.02 - 0.012; // gentle upward drift
    phase[i] = Math.random() * Math.PI * 2;
    base[i] = 0.4 + Math.random() * 0.55;
    sizes[i] = 4 + Math.random() * 9;
  }
  return { nx, ny, vx, vy, phase, base, positions, alphas, sizes, colors };
}

function paintColors(colors: Float32Array, count: number, dark: boolean) {
  const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
  for (let i = 0; i < count; i++) {
    const c = palette[i % palette.length];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
}

const isDark = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");

function ParticleField() {
  const { viewport, gl } = useThree();
  const pointsRef = useRef<Points>(null);
  const matRef = useRef<ShaderMaterial>(null);

  // Lazily create + retain the buffers in a ref (not useMemo).
  const buffersRef = useRef<Buffers | null>(null);
  if (buffersRef.current === null) {
    buffersRef.current = createBuffers(COUNT);
    paintColors(buffersRef.current.colors, COUNT, isDark());
  }
  const buffers = buffersRef.current;

  const uniforms = useMemo(() => ({ uPixelRatio: { value: 1 } }), []);

  // Repaint mote colors + blend mode when the theme changes.
  useEffect(() => {
    const apply = () => {
      const dark = isDark();
      paintColors(buffers.colors, COUNT, dark);
      const colorAttr = pointsRef.current?.geometry.getAttribute("aColor") as
        | THREE.BufferAttribute
        | undefined;
      if (colorAttr) colorAttr.needsUpdate = true;
      if (matRef.current) {
        matRef.current.blending = dark
          ? THREE.AdditiveBlending
          : THREE.NormalBlending;
        matRef.current.needsUpdate = true;
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [buffers]);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const { nx, ny, vx, vy, phase, base, positions, alphas } = buffers;
    const dt = Math.min(delta, 0.05);
    const W = viewport.width;
    const H = viewport.height;
    const bound = 0.5 + MARGIN;
    const span = 1 + 2 * MARGIN;
    const t = state.clock.elapsedTime;

    const posAttr = pts.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const alphaAttr = pts.geometry.getAttribute(
      "aAlpha",
    ) as THREE.BufferAttribute;

    for (let i = 0; i < COUNT; i++) {
      // Drift + a tiny lateral wobble, then wrap within the padded bounds.
      let x = nx[i] + vx[i] * dt + Math.sin(t * 0.3 + phase[i]) * 0.0006;
      let y = ny[i] + vy[i] * dt;
      if (x > bound) x -= span;
      else if (x < -bound) x += span;
      if (y > bound) y -= span;
      else if (y < -bound) y += span;
      nx[i] = x;
      ny[i] = y;

      positions[i * 3] = x * W;
      positions[i * 3 + 1] = y * H;
      positions[i * 3 + 2] = 0;
      // Fade near the edges so wrapping is invisible → density stays constant.
      alphas[i] = edgeFade(x) * edgeFade(y) * base[i];
    }

    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    if (matRef.current) {
      matRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[buffers.positions, 3]}
        />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ParticleField />
    </Canvas>
  );
}
