/**
 * The 3D scene of the globe: Mars, a thin atmosphere, and a marker on each landing site. Plain
 * three.js, with nothing that depends on a browser, so the same scene can run on a phone's
 * OpenGL context.
 */
import * as THREE from 'three';

import type { Site } from '@/data/sites';
import type { LatLon } from '@/mission/geo';

/** Vertical field of view of the camera, in degrees. */
export const FIELD_OF_VIEW = 35;

const RAD = Math.PI / 180;

/**
 * A point on the unit sphere. Longitude 0 faces +X and east is towards -Z, which matches the way
 * three.js wraps an equirectangular texture around a sphere.
 */
export function toVector({ lat, lon }: LatLon, radius = 1, target = new THREE.Vector3()) {
  const phi = lat * RAD;
  const lambda = lon * RAD;
  return target.set(
    radius * Math.cos(phi) * Math.cos(lambda),
    radius * Math.sin(phi),
    -radius * Math.cos(phi) * Math.sin(lambda),
  );
}

/** The distance from which a unit sphere fits in view with some room, for a viewport's aspect. */
export function fitDistance(aspect: number, room = 1.18): number {
  const vertical = (FIELD_OF_VIEW * RAD) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return room / Math.sin(Math.min(vertical, horizontal));
}

/** A ring with a dot in the middle, drawn into a small texture. */
function markerTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const dot = 1 - THREE.MathUtils.smoothstep(distance, 0.3, 0.38);
      const ring =
        THREE.MathUtils.smoothstep(distance, 0.62, 0.7) *
        (1 - THREE.MathUtils.smoothstep(distance, 0.86, 0.94));
      const alpha = Math.max(dot, ring);
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 255;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A small repeatable random generator, so the star field is the same on every visit. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Background points. They are decoration, not a star catalogue. */
function starField(): THREE.Points {
  const random = seeded(1969);
  const count = 1400;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    const radius = 60 + random() * 30;
    positions[index * 3] = radius * ring * Math.cos(angle);
    positions[index * 3 + 1] = radius * z;
    positions[index * 3 + 2] = radius * ring * Math.sin(angle);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xdfe6f2,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

/** A soft rim of light around the planet. Mars has a thin, dusty atmosphere; this is a hint of it. */
function atmosphere(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(0xd9916a) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 tint;
      varying vec3 vNormal;
      void main() {
        float rim = pow(max(0.0, 0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.4);
        gl_FragColor = vec4(tint, 1.0) * rim;
      }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.13, 64, 48), material);
  return mesh;
}

export type GlobeScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose: () => void;
};

/**
 * Builds the scene. `surface` is an equirectangular image of the planet, with longitude -180 on
 * its left edge.
 */
export function createGlobeScene(sites: readonly Site[], surface: THREE.Texture): GlobeScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 400);
  scene.add(camera);

  // The light travels with the camera: it gives the planet volume. It is not the real Sun.
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const light = new THREE.DirectionalLight(0xfff1e0, 2.4);
  light.position.set(-1.6, 1.2, 1.4);
  camera.add(light);
  camera.add(light.target);
  light.target.position.set(0, 0, -4);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 96),
    new THREE.MeshStandardMaterial({ map: surface, roughness: 1, metalness: 0 }),
  );
  scene.add(planet, atmosphere(), starField());

  const pin = new THREE.SpriteMaterial({
    map: markerTexture(),
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  for (const site of sites) {
    const marker = new THREE.Sprite(pin);
    marker.position.copy(toVector(site.landing, 1.012));
    marker.scale.setScalar(0.052);
    scene.add(marker);
  }

  const dispose = () => {
    scene.traverse((object) => {
      const item = object as Partial<THREE.Mesh>;
      item.geometry?.dispose();
      const material = item.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
    pin.map?.dispose();
  };

  return { scene, camera, dispose };
}
