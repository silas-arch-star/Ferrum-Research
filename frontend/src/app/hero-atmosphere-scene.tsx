"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const asset = "/ferrum-liquid-atmosphere.png";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uImage;
  uniform vec2 uViewport;
  uniform float uImageAspect;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float viewportAspect = uViewport.x / uViewport.y;
    vec2 uv = vUv;
    if (viewportAspect > uImageAspect) {
      float shownHeight = uImageAspect / viewportAspect;
      float verticalPosition = uViewport.x < 640.0 ? 0.73 : 0.72;
      uv.y = (1.0 - shownHeight) * (1.0 - verticalPosition) + uv.y * shownHeight;
    } else {
      float shownWidth = viewportAspect / uImageAspect;
      uv.x = (1.0 - shownWidth) * 0.5 + uv.x * shownWidth;
    }

    float ribbonZone = smoothstep(0.08, 0.22, uv.y) * (1.0 - smoothstep(0.56, 0.70, uv.y));
    float rockZone = 1.0 - smoothstep(0.20, 0.43, uv.y);
    float edgeFade = smoothstep(0.0, 0.07, vUv.x) * (1.0 - smoothstep(0.93, 1.0, vUv.x));
    vec2 displaced = uv;
    displaced.y += ribbonZone * edgeFade * (
      0.019 * sin(uv.x * 13.0 - uTime * 0.92 + sin(uv.x * 5.0 + uTime * 0.23))
      + 0.005 * sin(uv.x * 29.0 - uTime * 1.24)
    );
    displaced.x += ribbonZone * edgeFade * 0.008 * sin(uv.x * 7.0 - uTime * 0.42 + uv.y * 4.0);
    displaced.xy += rockZone * edgeFade * vec2(
      0.0024 * sin(uTime * 0.16 + uv.y * 9.0),
      0.0017 * sin(uv.x * 7.0 - uTime * 0.19)
    );

    vec3 color = texture2D(uImage, clamp(displaced, 0.0, 1.0)).rgb;
    float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float metal = ribbonZone * smoothstep(0.18, 0.64, brightness);
    float travelingHighlight = pow(max(0.0, sin(uv.x * 21.0 - uTime * 1.1 + uv.y * 6.0)), 10.0);
    float fineRipple = 0.5 + 0.5 * sin(uv.x * 36.0 - uTime * 1.5 + uv.y * 11.0);
    color += vec3(0.11) * metal * travelingHighlight;
    color += vec3(0.025) * metal * fineRipple;

    float mineral = rockZone * smoothstep(0.05, 0.32, brightness);
    float rockLight = 0.5 + 0.5 * sin(uv.x * 6.0 - uTime * 0.22 + uv.y * 4.0);
    color *= 1.0 + mineral * (0.065 * rockLight - 0.025);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function AtmospherePlane() {
  const loaded = useLoader(THREE.TextureLoader, asset);
  const texture = useMemo(() => {
    const copy = loaded.clone();
    copy.colorSpace = THREE.SRGBColorSpace;
    copy.minFilter = THREE.LinearFilter;
    copy.magFilter = THREE.LinearFilter;
    copy.needsUpdate = true;
    return copy;
  }, [loaded]);
  const material = useRef<THREE.ShaderMaterial>(null);
  const elapsed = useRef(0);
  const { size } = useThree();
  useEffect(() => {
    return () => { texture.dispose(); useLoader.clear(THREE.TextureLoader, asset); };
  }, [texture]);
  const uniforms = useMemo(() => ({
    uImage: { value: texture },
    uViewport: { value: new THREE.Vector2(size.width, size.height) },
    uImageAspect: { value: texture.image.width / texture.image.height },
    uTime: { value: 0 },
  }), [texture, size.width, size.height]);
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.05);
    if (material.current) material.current.uniforms.uTime.value = elapsed.current;
  });
  return <mesh frustumCulled={false}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} depthWrite={false} depthTest={false} />
  </mesh>;
}

export default function AtmosphereScene({ visible }: { visible: boolean }) {
  return <Canvas className="hero-atmosphere-canvas" dpr={[1, 1.35]} frameloop={visible ? "always" : "demand"} gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}>
    <AtmospherePlane />
  </Canvas>;
}
