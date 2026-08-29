"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Points, ShaderMaterial } from "three";

const COUNT = 130;

// Warm brand palette for the motes (gold / brass / cream), all rendered as
// soft circles by the fragment shader below.
const PALETTE = [
  new THREE.Color("#f0d69a"),
  new THREE.Color("#d9b25a"),
  new THREE.Color("#fff4e0"),
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

function ParticleField() {
  const { viewport, gl } = useThree();
  const pointsRef = useRef<Points>(null);
  const matRef = useRef<ShaderMaterial>(null);

  // Normalized (resolution-independent) particle state, mapped onto the hero's
  // visible viewport every frame so motes always fill the section exactly.
  const sim = useMemo(() => {
    const nx = new Float32Array(COUNT);
    const ny = new Float32Array(COUNT);
    const vx = new Float32Array(COUNT);
    const vy = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const base = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      nx[i] = (Math.random() - 0.5) * (1 + 2 * MARGIN);
      ny[i] = (Math.random() - 0.5) * (1 + 2 * MARGIN);
      vx[i] = (Math.random() - 0.5) * 0.02;
      vy[i] = (Math.random() - 0.5) * 0.02 - 0.012; // gentle upward drift
      phase[i] = Math.random() * Math.PI * 2;
      base[i] = 0.4 + Math.random() * 0.55;
    }
    return { nx, ny, vx, vy, phase, base };
  }, []);

  const { positions, alphas, sizes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const alphas = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      sizes[i] = 4 + Math.random() * 9;
      const col = PALETTE[i % PALETTE.length];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, alphas, sizes, colors };
  }, []);

  const uniforms = useMemo(
    () => ({ uPixelRatio: { value: 1 } }),
    [],
  );

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
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
      let x = sim.nx[i] + sim.vx[i] * dt + Math.sin(t * 0.3 + sim.phase[i]) * 0.0006;
      let y = sim.ny[i] + sim.vy[i] * dt;
      if (x > bound) x -= span;
      else if (x < -bound) x += span;
      if (y > bound) y -= span;
      else if (y < -bound) y += span;
      sim.nx[i] = x;
      sim.ny[i] = y;

      positions[i * 3] = x * W;
      positions[i * 3 + 1] = y * H;
      positions[i * 3 + 2] = 0;
      // Fade near the edges so wrapping is invisible → density stays constant.
      alphas[i] = edgeFade(x) * edgeFade(y) * sim.base[i];
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
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aAlpha" args={[alphas, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
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
