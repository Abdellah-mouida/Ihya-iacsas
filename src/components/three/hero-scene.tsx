"use client";

import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import type { Mesh, Points } from "three";

function Motif() {
  const ref = useRef<Mesh>(null);
  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.1;
    ref.current.rotation.y += delta * 0.14;
  });
  return (
    <Float speed={1.1} rotationIntensity={0.5} floatIntensity={1.1}>
      <mesh ref={ref}>
        <dodecahedronGeometry args={[1.55, 0]} />
        <meshStandardMaterial
          color="#e9c46a"
          emissive="#c9a227"
          emissiveIntensity={0.4}
          metalness={0.85}
          roughness={0.25}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function Particles() {
  const ref = useRef<Points>(null);
  const positions = useMemo(() => {
    const count = 200;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 15;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, []);

  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#e9c46a"
        transparent
        opacity={0.75}
        sizeAttenuation
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
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 5, 6]} intensity={1.1} />
      <Suspense fallback={null}>
        <Particles />
        <group position={[2.4, 0.2, 0]}>
          <Motif />
        </group>
      </Suspense>
    </Canvas>
  );
}
