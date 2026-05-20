"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useSparkThemeColors } from "@/hooks/use-spark-theme-colors";

function SparkleCloud({
  color,
  count,
  spread,
  size,
  opacity,
  spin,
}: {
  color: string;
  count: number;
  spread: [number, number, number];
  size: number;
  opacity: number;
  spin: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread[0];
      arr[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    }
    return arr;
  }, [count, spread]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * spin;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Scene({
  primary,
  secondary,
  tertiary,
}: {
  primary: string;
  secondary: string;
  tertiary: string;
}) {
  return (
    <group>
      <SparkleCloud color={primary} count={280} spread={[22, 14, 8]} size={2} opacity={0.4} spin={0.02} />
      <SparkleCloud color={secondary} count={100} spread={[16, 10, 6]} size={3.2} opacity={0.16} spin={-0.015} />
      <SparkleCloud color={tertiary} count={70} spread={[18, 12, 7]} size={2.4} opacity={0.12} spin={0.018} />
    </group>
  );
}

function canUseWebGL() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function VisionField() {
  const [ready, setReady] = useState(false);
  const { primary, secondary, tertiary } = useSparkThemeColors();

  useEffect(() => {
    setReady(canUseWebGL());
  }, []);

  if (!ready) return null;

  return (
    <Canvas
      className="!h-full !w-full"
      style={{ width: "100%", height: "100%", display: "block" }}
      camera={{ position: [0, 0, 9], fov: 42 }}
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.55} />
      <Suspense fallback={null}>
        <Scene primary={primary} secondary={secondary} tertiary={tertiary} />
      </Suspense>
    </Canvas>
  );
}
