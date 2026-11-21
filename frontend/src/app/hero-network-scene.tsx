"use client";

import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Company } from "@/lib/api";

const phase = (index: number, salt: number) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const sharedVertex = `
  uniform float uTime;
  uniform vec2 uPointer;
  attribute vec3 aHero;
  attribute vec3 aNetwork;
  attribute float aPhase;
  varying float vBrightness;
  varying float vHalo;

  vec3 fieldPosition() {
    float morph = 0.28 + 0.18 * sin(uTime * 0.28);
    vec3 p = mix(aHero, aNetwork, smoothstep(0.0, 1.0, morph));
    p.x += 0.09 * sin(p.y * 1.7 + uTime * 0.52 + aPhase * 4.0);
    p.y += 0.19 * sin(p.x * 1.8 + uTime * 0.9 + aPhase * 6.28318);
    p.z += 0.16 * cos(p.x * 1.5 - uTime * 0.65 + aPhase * 5.0);
    p.xy += uPointer * vec2(0.16, -0.12) * (0.35 + aPhase * 0.65);
    vBrightness = (0.56 + 0.44 * aPhase) * (0.84 + 0.16 * sin(uTime * 0.85 + aPhase * 10.0));
    vHalo = step(0.88, aPhase);
    return p;
  }
`;

const pointsVertex = sharedVertex + `
  attribute float aSize;
  void main() {
    vec3 p = fieldPosition();
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = min(12.0, aSize * (15.0 + 5.0 * step(0.88, aPhase)) / max(1.0, -view.z));
  }
`;
const pointsFragment = `
  varying float vBrightness;
  varying float vHalo;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float core = 1.0 - smoothstep(0.06, 0.24, radius);
    float halo = 1.0 - smoothstep(0.13, 0.5, radius);
    gl_FragColor = vec4(vec3(0.93, 0.95, 0.97), (core * 0.84 + halo * (0.12 + 0.21 * vHalo)) * vBrightness);
  }
`;
const linesVertex = sharedVertex + `
  void main() {
    vec3 p = fieldPosition();
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const linesFragment = `
  uniform float uTime;
  varying float vBrightness;
  void main() {
    float shimmer = 0.81 + 0.19 * sin(uTime * 0.72 + vBrightness * 8.0);
    gl_FragColor = vec4(vec3(0.75, 0.79, 0.84), 0.26 * vBrightness * shimmer);
  }
`;
const companyVertex = `
  uniform float uTime;
  varying float vOpacity;
  void main() {
    vec3 p = position;
    p.y += 0.055 * sin(uTime * 0.45 + position.x * 2.0);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = min(9.0, 27.0 / max(1.0, -view.z));
    vOpacity = 0.28 + 0.07 * sin(uTime * 0.7 + position.x * 3.0);
  }
`;
const companyFragment = `
  varying float vOpacity;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float glow = 1.0 - smoothstep(0.2, 0.5, radius);
    gl_FragColor = vec4(vec3(0.97, 0.97, 0.94), glow * vOpacity);
  }
`;

function buildField(count: number) {
  const formations = [new Float32Array(count * 3), new Float32Array(count * 3)];
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const band = i % 9;
    const drift = phase(i, 1) - 0.5;
    const x = -2.5 + 5 * t;
    const angle = i * 2.399963;
    const radius = Math.sqrt(t) * 1.82;
    const values = [
      [x, Math.sin(x * 1.25 + band * 0.32) * 0.58 + (band - 4) * 0.19 + drift * 0.14, Math.sin(x * 0.95 + band * 0.7) * 0.68],
      [Math.cos(angle) * radius * 1.28, Math.sin(angle) * radius * 0.73, Math.sin(angle * 1.6) * 0.58],
    ];
    values.forEach((value, stage) => formations[stage].set(value, i * 3));
    phases[i] = phase(i, 2);
    sizes[i] = 1.05 + phase(i, 3) * 1.6;
  }
  const points = new THREE.BufferGeometry();
  points.setAttribute("position", new THREE.BufferAttribute(formations[0], 3));
  ["aHero", "aNetwork"].forEach((name, stage) => points.setAttribute(name, new THREE.BufferAttribute(formations[stage], 3)));
  points.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  points.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const edges: number[] = [];
  for (let i = 0; i < count; i += 2) {
    let nearest = -1;
    let distance = 0.44;
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const a = i * 3; const b = j * 3;
      const dx = formations[0][a] - formations[0][b];
      const dy = formations[0][a + 1] - formations[0][b + 1];
      const dz = formations[0][a + 2] - formations[0][b + 2];
      const candidate = dx * dx + dy * dy + dz * dz;
      if (candidate < distance && candidate > 0.025) { distance = candidate; nearest = j; }
    }
    if (nearest >= 0) edges.push(i, nearest);
  }
  const lines = new THREE.BufferGeometry();
  const linePositions = new Float32Array(edges.length * 3);
  const linePhases = new Float32Array(edges.length);
  lines.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  ["aHero", "aNetwork"].forEach((name, stage) => {
    const values = new Float32Array(edges.length * 3);
    edges.forEach((index, vertex) => {
      values.set(formations[stage].subarray(index * 3, index * 3 + 3), vertex * 3);
      linePhases[vertex] = phases[index];
    });
    lines.setAttribute(name, new THREE.BufferAttribute(values, 3));
  });
  lines.setAttribute("aPhase", new THREE.BufferAttribute(linePhases, 1));
  return { points, lines };
}

function DataField({ companies }: { companies: Company[] }) {
  const group = useRef<THREE.Group>(null);
  const pointsMaterial = useRef<THREE.ShaderMaterial>(null);
  const linesMaterial = useRef<THREE.ShaderMaterial>(null);
  const companyMaterial = useRef<THREE.ShaderMaterial>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const smoothPointer = useRef(new THREE.Vector2());
  const time = useRef(0);
  const field = useMemo(() => buildField(typeof window !== "undefined" && window.innerWidth < 640 ? 420 : 720), []);
  const companyGeometry = useMemo(() => {
    const nodes = companies.flatMap((company) => {
      const fundamental = company.fundamental_research?.["Final Score"];
      const technical = company.technical_research?.["Total Score (100)"];
      if (typeof fundamental !== "number" || typeof technical !== "number" || !Number.isFinite(fundamental) || !Number.isFinite(technical)) return [];
      return [{ id: company.ID, x: (fundamental - 50) * 0.048, y: (technical - 50) * 0.026 }];
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(nodes.flatMap((node) => [node.x, node.y, 0.15]), 3));
    geometry.userData.companyIds = nodes.map((node) => node.id);
    return geometry;
  }, [companies]);
  useEffect(() => () => { field.points.dispose(); field.lines.dispose(); companyGeometry.dispose(); }, [field, companyGeometry]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  useFrame((_, delta) => {
    time.current += Math.min(delta, 0.05);
    smoothPointer.current.x = THREE.MathUtils.damp(smoothPointer.current.x, pointer.current.x, 2.2, delta);
    smoothPointer.current.y = THREE.MathUtils.damp(smoothPointer.current.y, pointer.current.y, 2.2, delta);
    for (const material of [pointsMaterial.current, linesMaterial.current]) {
      if (!material) continue;
      material.uniforms.uTime.value = time.current;
      material.uniforms.uPointer.value.copy(smoothPointer.current);
    }
    if (companyMaterial.current) companyMaterial.current.uniforms.uTime.value = time.current;
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, smoothPointer.current.x * 0.075 + Math.sin(time.current * 0.21) * 0.04, 1.4, delta);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -smoothPointer.current.y * 0.055, 1.4, delta);
    }
  });
  return <group ref={group}>
    <lineSegments geometry={field.lines} frustumCulled={false}>
      <shaderMaterial ref={linesMaterial} vertexShader={linesVertex} fragmentShader={linesFragment} uniforms={{ uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
    <points geometry={field.points} frustumCulled={false}>
      <shaderMaterial ref={pointsMaterial} vertexShader={pointsVertex} fragmentShader={pointsFragment} uniforms={{ uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
    {companyGeometry.attributes.position.count > 0 && <points geometry={companyGeometry} frustumCulled={false}>
      <shaderMaterial ref={companyMaterial} vertexShader={companyVertex} fragmentShader={companyFragment} uniforms={{ uTime: { value: 0 } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>}
  </group>;
}

export default function HeroNetworkScene({ visible, companies, onReady }: { visible: boolean; companies: Company[]; onReady: () => void }) {
  return <Canvas className="hero-network-canvas" camera={{ position: [0, 0, 4.9], fov: 40 }} dpr={[1, 1.5]} frameloop={visible ? "always" : "demand"} gl={{ alpha: true, antialias: false, powerPreference: "low-power" }} onCreated={onReady}>
    <AdaptiveDpr pixelated={false} />
    <DataField companies={companies} />
  </Canvas>;
}
