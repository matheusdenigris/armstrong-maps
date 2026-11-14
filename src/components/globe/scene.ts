/**
 * The 3D scene of the globe: Mars, a thin atmosphere, and a mark on the ground at each landing
 * site. Plain
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

/** How far above the ground a marker lies, as a share of the radius: enough not to flicker. */
const MARKER_LIFT = 1.006;

/**
 * The mark of a landing site: a ring with a dot in its middle on a dark disc, lying flat on the
 * ground. It is part of the planet, so it turns with it and flattens towards the edge, where a
 * mark that always faced the viewer would float off the surface.
 */
function siteMarkers(sites: readonly Site[]): THREE.Group {
  const ring = new THREE.RingGeometry(0.021, 0.029, 48);
  const dot = new THREE.CircleGeometry(0.0105, 32);
  const disc = new THREE.CircleGeometry(0.04, 48);
  // Not lit: a site on the night side is still a site to pick.
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  const backing = new THREE.MeshBasicMaterial({
    color: 0x04060a,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const group = new THREE.Group();
  const outward = new THREE.Vector3();
  for (const site of sites) {
    const marker = new THREE.Group();
    toVector(site.landing, 1, outward);
    marker.position.copy(outward).multiplyScalar(MARKER_LIFT);
    // Its face looks straight up from the ground.
    marker.lookAt(outward.multiplyScalar(2));
    const shade = new THREE.Mesh(disc, backing);
    shade.position.z = -0.0006;
    marker.add(shade, new THREE.Mesh(ring, white), new THREE.Mesh(dot, white));
    group.add(marker);
  }
  return group;
}

/** A small repeatable random generator, so the star field is the same on every visit. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * The sky behind the planet. It is decoration, not a star catalogue: the stars are drawn from a
 * fixed random sequence, most of them faint and a few bright, in slightly different whites, and
 * denser along one band, as the Milky Way is.
 */
function starField(pixelRatio: number): THREE.Points {
  const random = seeded(1969);
  const count = 5200;
  const positions = new Float32Array(count * 3);
  const tints = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  // Cool, neutral and warm whites.
  const whites = [
    [0.74, 0.83, 1],
    [1, 1, 1],
    [1, 0.9, 0.78],
  ];
  const tilt = 58 * RAD;
  for (let index = 0; index < count; index += 1) {
    // Four stars in ten lie near the band; the rest are spread over the whole sky.
    const banded = random() < 0.4;
    const z = banded ? (random() + random() + random() - 1.5) * 0.24 : random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = 60 + random() * 30;
    const x = ring * Math.cos(angle);
    const y = z;
    const w = ring * Math.sin(angle);
    // The band is tipped over, so it crosses the view at a slant.
    positions[index * 3] = radius * x;
    positions[index * 3 + 1] = radius * (y * Math.cos(tilt) - w * Math.sin(tilt));
    positions[index * 3 + 2] = radius * (y * Math.sin(tilt) + w * Math.cos(tilt));

    // Few stars are bright: the fourth power keeps most of them near the faint end.
    const bright = random() ** 4;
    const glow = 0.42 + 0.58 * bright;
    const white = whites[Math.floor(random() * whites.length)];
    tints[index * 3] = white[0] * glow;
    tints[index * 3 + 1] = white[1] * glow;
    tints[index * 3 + 2] = white[2] * glow;
    sizes[index] = 1.7 + bright * 3.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { scale: { value: pixelRatio } },
    vertexShader: `
      attribute float size;
      attribute vec3 tint;
      uniform float scale;
      varying vec3 vTint;
      void main() {
        vTint = tint;
        gl_PointSize = size * scale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    // A soft round point: bright in the middle, fading to nothing at its edge.
    fragmentShader: `
      varying vec3 vTint;
      void main() {
        float fall = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vTint * fall, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

/**
 * Where the light comes from, seen from the camera: from the left, a little above and in front.
 * It leaves the right edge of the planet in shadow, with the line between day and night in view.
 */
const SUNLIGHT = new THREE.Vector3(-1.8, 0.7, 1.4);
/** Where the planet is, seen from the camera, near enough for the direction of a light. */
const PLANET = new THREE.Vector3(0, 0, -4);

/**
 * A soft rim of light around the planet, brighter on the day side. Mars has a thin, dusty
 * atmosphere; this is a hint of it.
 */
function atmosphere(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(0xd9916a) },
      sun: { value: SUNLIGHT.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 tint;
      uniform vec3 sun;
      varying vec3 vNormal;
      void main() {
        float rim = pow(max(0.0, 0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.4);
        float day = smoothstep(-0.45, 0.55, dot(vNormal, sun));
        gl_FragColor = vec4(tint, 1.0) * rim * mix(0.12, 1.0, day);
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
 * its left edge. `pixelRatio` is how many device pixels a point of the screen has, so that the
 * stars keep their size on a dense screen.
 */
export function createGlobeScene(
  sites: readonly Site[],
  surface: THREE.Texture,
  pixelRatio = 1,
): GlobeScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 400);
  scene.add(camera);

  // The light travels with the camera, so the planet turns under it from day into night. It is
  // not the real Sun: where it is day on Mars right now is not shown.
  scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  const light = new THREE.DirectionalLight(0xfff1e0, 3.4);
  // A light only has a direction: from where it is to its target, which is the planet.
  light.position.copy(PLANET).add(SUNLIGHT);
  camera.add(light);
  camera.add(light.target);
  light.target.position.copy(PLANET);
  // A faint, cool light from the other side keeps the night side from being a black disc.
  const night = new THREE.DirectionalLight(0x8fa6c9, 0.22);
  night.position.copy(PLANET).add(new THREE.Vector3(2.2, -0.4, 1.2));
  camera.add(night);
  camera.add(night.target);
  night.target.position.copy(PLANET);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 96),
    new THREE.MeshStandardMaterial({ map: surface, roughness: 1, metalness: 0 }),
  );
  scene.add(planet, atmosphere(), starField(pixelRatio), siteMarkers(sites));

  const dispose = () => {
    scene.traverse((object) => {
      const item = object as Partial<THREE.Mesh>;
      item.geometry?.dispose();
      const material = item.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
  };

  return { scene, camera, dispose };
}
