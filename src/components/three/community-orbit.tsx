"use client";

import { Float, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { Group, Mesh } from "three";

const PALETTE = ["#c9a227", "#e9c46a", "#2f9e75", "#b9822f"];
const NODES = [0, 1, 2, 3, 4, 5, 6];

function OrbitingNode({
  radius,
  speed,
  size,
  color,
  offset,
  inclination,
}: {
  radius: number;
  speed: number;
  size: number;
  color: string;
  offset: number;
  inclination: number;
}) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    const mesh = ref.current;
    if (!mesh) return;
    mesh.position.set(
      Math.cos(t) * radius,
      Math.sin(t) * radius * Math.sin(inclination),
      Math.sin(t) * radius * Math.cos(inclination),
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.3}
        metalness={0.6}
      />
    </mesh>
  );
}

function OrbitRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2.4, 0, 0]}>
      <torusGeometry args={[radius, 0.012, 12, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} />
    </mesh>
  );
}

function Cluster() {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.15;
    if (core.current) {
      core.current.rotation.x += delta * 0.2;
      core.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.8}>
      <group ref={group}>
        <mesh ref={core}>
          <icosahedronGeometry args={[1.15, 0]} />
          <meshStandardMaterial
            color="#e9c46a"
            emissive="#c9a227"
            emissiveIntensity={0.35}
            roughness={0.25}
            metalness={0.7}
            wireframe
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.72, 0]} />
          <meshStandardMaterial
            color="#2f9e75"
            emissive="#2f9e75"
            emissiveIntensity={0.4}
            roughness={0.2}
            metalness={0.5}
          />
        </mesh>

        <OrbitRing radius={2.1} color="#c9a227" />
        <OrbitRing radius={2.8} color="#2f9e75" />
        <OrbitRing radius={3.4} color="#e9c46a" />

        {NODES.map((i) => (
          <OrbitingNode
            key={i}
            radius={2.1 + (i % 3) * 0.65}
            speed={0.5 + (i % 4) * 0.18}
            size={0.12 + (i % 3) * 0.05}
            color={PALETTE[i % PALETTE.length]}
            offset={(i / NODES.length) * Math.PI * 2}
            inclination={0.5 + (i % 3) * 0.5}
          />
        ))}
      </group>
    </Float>
  );
}

export default function CommunityOrbit() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 6, 5]} intensity={1.3} />
      <pointLight position={[-5, -3, -4]} intensity={0.6} color="#2f9e75" />
      <Suspense fallback={null}>
        <Cluster />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
