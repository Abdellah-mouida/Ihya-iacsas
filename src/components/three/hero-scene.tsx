"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Points } from "three";

// Build a small sprite texture from a canvas drawing.
function makeSprite(draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawCircle(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.38);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, s * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function drawHex(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2;
  const r = s * 0.34;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = c + r * Math.cos(a);
    const y = c + r * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
}

function drawSnow(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2;
  const r = s * 0.36;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const ex = c + r * Math.cos(a);
    const ey = c + r * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // little branches
    const bx = c + r * 0.6 * Math.cos(a);
    const by = c + r * 0.6 * Math.sin(a);
    const bl = s * 0.13;
    for (const sign of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(
        bx + bl * Math.cos(a + (sign * Math.PI) / 3),
        by + bl * Math.sin(a + (sign * Math.PI) / 3),
      );
      ctx.stroke();
    }
  }
}

function ParticleSystem({
  texture,
  count,
  color,
  size,
  speed,
  seed,
}: {
  texture: THREE.Texture;
  count: number;
  color: string;
  size: number;
  speed: number;
  seed: number;
}) {
  const ref = useRef<Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      // Keep all particles behind the focal plane and well away from the
      // camera (z=6) so sizeAttenuation never blows one up close.
      arr[i * 3 + 2] = -3 - Math.random() * 12;
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.02 * speed;
    ref.current.position.y =
      Math.sin(state.clock.elapsedTime * 0.12 + seed) * 0.35;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        alphaTest={0.02}
      />
    </points>
  );
}

export default function HeroScene() {
  const [circleTex, hexTex, snowTex] = useMemo(
    () => [makeSprite(drawCircle), makeSprite(drawHex), makeSprite(drawSnow)],
    [],
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ParticleSystem
        texture={circleTex}
        count={60}
        color="#f0d69a"
        size={0.16}
        speed={1}
        seed={0}
      />
      <ParticleSystem
        texture={hexTex}
        count={48}
        color="#d9b25a"
        size={0.19}
        speed={0.7}
        seed={2}
      />
      <ParticleSystem
        texture={snowTex}
        count={46}
        color="#fff4e0"
        size={0.22}
        speed={1.3}
        seed={4}
      />
    </Canvas>
  );
}
