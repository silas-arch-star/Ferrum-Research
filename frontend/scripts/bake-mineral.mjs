// Rebuild the original Ferrum specimen with node scripts/bake-mineral.mjs from frontend.
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const noise = (index, salt = 1) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

function finishGeometry(geometry, seed, shade) {
  if (!geometry.hasAttribute("normal")) geometry.computeVertexNormals();
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uv = new Float32Array(positions.count * 2);
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const nx = Math.abs(normals.getX(i)); const ny = Math.abs(normals.getY(i)); const nz = Math.abs(normals.getZ(i));
    const x = positions.getX(i); const y = positions.getY(i); const z = positions.getZ(i);
    uv[i * 2] = (ny > nx && ny > nz ? x : nx > nz ? z : x) * 1.7;
    uv[i * 2 + 1] = (ny > nx && ny > nz ? z : y) * 1.7;
    const tone = .88 + noise(seed, 9) * .18;
    colors.set([shade.r * tone, shade.g * tone, shade.b * tone], i * 3);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function crystal(seed, squat = false) {
  const points = [];
  const sides = seed % 3 === 0 ? 5 : 6;
  for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2 + .2;
    const radius = .42 + noise(i + seed, 2) * .12;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, -.48 - noise(i + seed, 4) * .1, Math.sin(angle) * radius));
    points.push(new THREE.Vector3(Math.cos(angle) * radius * .93, .28 + noise(i + seed, 3) * .13, Math.sin(angle) * radius * .88));
  }
  if (squat) {
    points.push(new THREE.Vector3(-.14, .47, -.16), new THREE.Vector3(.27, .42, .12));
  } else {
    points.push(new THREE.Vector3(.1 + noise(seed, 6) * .12, .61 + noise(seed, 7) * .12, -.07));
  }
  return new ConvexGeometry(points);
}

function buildSpecimen() {
  const rough = [];
  const polished = [];
  const bronze = [];
  const graphite = new THREE.Color("#4a5052");
  const coreColor = new THREE.Color("#313639");
  const warm = new THREE.Color("#66533b");
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const add = (geometry, bucket, seed, color, position, scale, rotation) => {
    finishGeometry(geometry, seed, color);
    quaternion.setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    geometry.applyMatrix4(matrix);
    bucket.push(geometry);
  };

  const core = new THREE.IcosahedronGeometry(1, 4);
  const p = core.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const ridge = .85 + .14 * Math.sin(x * 5 + y * 3) * Math.cos(z * 7) + .075 * Math.sin(x * 19 + y * 12) * Math.cos(z * 17 - y * 8) + .045 * Math.sin(z * 29 + x * 15);
    p.setXYZ(i, x * ridge * .86 + .09 * y, y * ridge * 1.02, z * ridge * .71);
  }
  core.deleteAttribute("normal");
  core.deleteAttribute("uv");
  const welded = mergeVertices(core, .0001);
  welded.computeVertexNormals();
  const rockyCore = welded.toNonIndexed();
  core.dispose(); welded.dispose();
  add(rockyCore, rough, 4, coreColor, [0, -.08, 0], [1, 1, 1], [0, 0, 0]);

  const heroCrystals = [
    { p: [.46, .73, .12], s: [.82, 1.18, .75], r: [.1, .45, -.15] },
    { p: [.27, -.58, .52], s: [1.06, 1.04, .83], r: [.19, -.22, .34] },
    { p: [-.65, -.02, .32], s: [.78, .87, .69], r: [.15, .32, .38] },
    { p: [-.29, .55, .45], s: [.57, .8, .65], r: [.28, -.36, -.56] },
    { p: [.86, .1, .14], s: [.55, .69, .57], r: [-.24, .27, -.66] },
    { p: [-.33, -.71, -.47], s: [.78, .82, .6], r: [-.33, .62, -.27] },
  ];
  heroCrystals.forEach((item, i) => add(crystal(i + 10, i % 3 === 1), polished, i * 4, graphite, item.p, item.s, item.r));

  for (let i = 0; i < 92; i++) {
    const angle = i * 2.399963;
    const y = 1 - 2 * (i + .5) / 92;
    const radius = Math.sqrt(1 - y * y);
    const direction = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const small = i > 31;
    const size = small ? .13 + noise(i, 3) * .19 : .25 + noise(i, 4) * .28;
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
    add(crystal(i + 28, i % 4 !== 0), small ? rough : polished, i + 19, small ? coreColor : graphite,
      [direction.x * .76, direction.y * .89 - .07, direction.z * .65],
      [size * (1 + noise(i, 6) * .4), size * (.8 + noise(i, 7)), size],
      [rotation.x + .28, rotation.y + noise(i, 5), rotation.z]);
  }
  for (let i = 0; i < 48; i++) {
    const angle = i * 2.399963;
    const y = -.85 + noise(i, 15) * 1.4;
    const ring = Math.sqrt(Math.max(.1, 1 - y * y));
    const size = .012 + noise(i, 13) * .035;
    add(crystal(i + 130, true), bronze, i, warm, [Math.cos(angle) * ring * .84, y, Math.sin(angle) * ring * .73], [size, size * 1.7, size], [angle, y, angle * .3]);
  }
  for (let i = 0; i < 70; i++) {
    const size = .035 + noise(i, 18) * .09;
    add(crystal(i + 210, true), rough, i, coreColor,
      [.55 + (noise(i, 19) - .5) * .28, -.15 - noise(i, 20) * .8, .52 + noise(i, 21) * .2],
      [size, size * 1.3, size], [i * .6, i * 1.4, i * .3]);
  }

  const merged = [rough, polished, bronze].map(bucket => {
    const geometry = mergeGeometries(bucket, false);
    bucket.forEach(item => item.dispose());
    geometry.computeBoundingBox();
    return geometry;
  });
  const bounds = new THREE.Box3();
  merged.forEach(geometry => bounds.union(geometry.boundingBox));
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2.8 / bounds.getSize(new THREE.Vector3()).y;
  merged.forEach(geometry => { geometry.translate(-center.x, -center.y, -center.z); geometry.scale(scale, scale, scale); });
  return merged;
}

function surfaceTexture() {
  const side = 256;
  const pixels = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const grain = noise(x + y * side, 8);
    const cellX = Math.floor(x / 42); const cellY = Math.floor(y / 42);
    let first = 100; let second = 100;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const seed = (cellX + ox) * 123 + (cellY + oy) * 157;
      const dx = cellX + ox + noise(seed, 31) - x / 42;
      const dy = cellY + oy + noise(seed, 32) - y / 42;
      const distance = dx * dx + dy * dy;
      if (distance < first) { second = first; first = distance; }
      else if (distance < second) second = distance;
    }
    const fracture = Math.sqrt(second) - Math.sqrt(first);
    const striation = Math.sin(x * .6 + Math.sin(y * .04) * 4) * .5 + .5;
    const value = Math.round(130 + grain * 70 + striation * 35 - (fracture < .025 ? 105 : 0));
    const at = (y * side + x) * 4;
    pixels.set([value, value, value, 255], at);
  }
  return sharp(pixels, { raw: { width: side, height: side, channels: 4 } }).png().toBuffer();
}

// The Three.js exporter uses the browser FileReader API for binary buffers.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend();
  }
};
const specimen = new THREE.Group();
const names = ["Graphite", "Polished", "Bronze"];
buildSpecimen().forEach((geometry, index) => {
  const mesh = new THREE.Mesh(mergeVertices(geometry));
  mesh.name = names[index];
  specimen.add(mesh);
});
const binary = await new GLTFExporter().parseAsync(specimen, { binary: true });
await writeFile(new URL("../public/ferrum-specimen.glb", import.meta.url), new Uint8Array(binary));
await writeFile(new URL("../public/ferrum-specimen-surface.png", import.meta.url), await surfaceTexture());
