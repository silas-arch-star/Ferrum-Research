"use client";

import { AdaptiveDpr, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { EntranceMotion } from "./cinematic-entrance";

function Specimen({ motion, onReady }: { motion: RefObject<EntranceMotion>; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const ready = useRef(false);
  const { scene } = useLoader(GLTFLoader, "/ferrum-specimen.glb");
  const geometry = useMemo(() => ["Graphite", "Polished", "Bronze"].map(name =>
    (scene.getObjectByName(name) as THREE.Mesh).geometry), [scene]);
  const texture = useLoader(THREE.TextureLoader, "/ferrum-specimen-surface.png");
  // The baked image preserves the row order and linear sampling of the source DataTexture.
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const { camera, size } = useThree();
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, .05);
    const t = elapsed.current;
    const pose = motion.current;
    if (group.current) {
      group.current.rotation.set(-.12 + Math.sin(t * .24) * .035 + pose.tilt, -.38 + t * .075 + pose.rotation, -.12 + Math.sin(t * .29) * .025);
      group.current.position.y = Math.sin(t * .68) * .065;
      group.current.scale.setScalar(pose.scale);
    }
    const baseDistance = size.width / size.height < .8 ? 10.6 : 8.1;
    camera.position.set(0, .1, baseDistance - pose.push);
    camera.lookAt(0, 0, 0);
    if (!ready.current) { ready.current = true; onReady(); }
  });
  return <group ref={group}>
    <mesh geometry={geometry[0]}><meshStandardMaterial vertexColors map={texture} metalness={.64} roughness={.85} bumpMap={texture} bumpScale={.075} /></mesh>
    <mesh geometry={geometry[1]}><meshPhysicalMaterial vertexColors map={texture} metalness={1} roughness={.29} roughnessMap={texture} bumpMap={texture} bumpScale={.018} clearcoat={.18} clearcoatRoughness={.23} /></mesh>
    <mesh geometry={geometry[2]}><meshStandardMaterial vertexColors metalness={.92} roughness={.37} /></mesh>
  </group>;
}

export default function EntranceMineralScene({ motion, visible, onReady }: { motion: RefObject<EntranceMotion>; visible: boolean; onReady: () => void }) {
  return <Canvas camera={{ position: [0, .1, 8.1], fov: 38, near: .05, far: 50 }} dpr={[1, 1.5]} frameloop={visible ? "always" : "demand"} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}>
    <AdaptiveDpr pixelated={false} />
    <ambientLight intensity={.4} />
    <directionalLight position={[-3, 4, 5]} intensity={2.3} color="#e8edf0" />
    <Environment resolution={256} frames={1} environmentIntensity={1.5}>
      <color attach="background" args={["#a3aaa9"]} />
      <Lightformer form="rect" intensity={1} color="#10171a" position={[0, 0, 5]} scale={[10, 3, 1]} />
      <Lightformer form="rect" intensity={7} position={[-3, 3, 4]} scale={[2, 6, 1]} />
      <Lightformer form="rect" intensity={5} position={[4, 1, 2]} scale={[.8, 5, 1]} />
      <Lightformer form="rect" intensity={3} position={[0, 4, -2]} scale={[4, 2, 1]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={1.8} color="#cbb591" position={[2, -1, 3]} scale={[2, 3, 1]} rotation={[0, -.3, 0]} />
    </Environment>
    <Specimen motion={motion} onReady={onReady} />
  </Canvas>;
}
