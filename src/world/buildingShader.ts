import * as THREE from 'three';
import type { PhotoSet } from './AssetPack';

/**
 * Extensions to the building materials' shader (MeshStandardMaterial via onBeforeCompile):
 *
 * - **Ageing.** Each building carries its phase's `weathering` (0 fresh … 1 neglected) in an
 *   `aging` vertex attribute (BuildingBatches). Grime is drawn from it: blotches, vertical rain
 *   streaks and a dark splash band near the ground, rougher where dirty. A building restored
 *   for 2025 is clean, the same building in 1985 grey and streaked: same geometry, other year.
 * - **Photo detail** (with the asset pack). A photo-sourced set tiles at its real size over the
 *   painted colour: its colour divided by its mean modulates the vertex colour (so the painted
 *   colour of a phase stays), its normal and roughness add relief. Windows and glass in the
 *   facade atlas are left alone (`wallness`, from the atlas brightness).
 *
 * The UVs of building parts are in metres (PartBuilder), which is what both rely on. Kit
 * modules (KitDressing) are instances of shared geometry, so with `kit` the metre UVs come from
 * the world position instead (box-projected on the normal: the plaster runs on across module
 * seams), and the weathering from the alpha of the batch's per-instance colour.
 */
export interface BuildingShader {
  uniforms: {
    uDetailMap: THREE.IUniform<THREE.Texture | null>;
    uDetailNormal: THREE.IUniform<THREE.Texture | null>;
    uDetailOrm: THREE.IUniform<THREE.Texture | null>;
    uDetailScale: THREE.IUniform<number>;
    uDetailMean: THREE.IUniform<THREE.Vector3>;
    uDetailRough: THREE.IUniform<number>;
    uDetailStrength: THREE.IUniform<number>;
  };
}

const VERTEX_PARS = /* glsl */ `
attribute float aging;
varying float vAging;
varying vec2 vMetreUv;
varying float vLocalY;
`;

const VERTEX = /* glsl */ `
vAging = aging;
vMetreUv = uv;
vLocalY = position.y;
`;

// after <batching_pars_vertex>: a kit instance's weathering rides in its colour's alpha
const KIT_PARS = /* glsl */ `
#if defined( KIT_DRESSING ) && defined( USE_BATCHING_COLOR )
float kitAging() {
  int size = textureSize( batchingColorTexture, 0 ).x;
  int j = int( getIndirectIndex( gl_DrawID ) );
  return texelFetch( batchingColorTexture, ivec2( j % size, j / size ), 0 ).a;
}
#endif
`;

// after <worldpos_vertex>
const KIT = /* glsl */ `
#if defined( KIT_DRESSING ) && defined( USE_BATCHING )
{
  vec4 kitWorld = modelMatrix * batchingMatrix * vec4( transformed, 1.0 );
  vec3 kitN = abs( normalize( mat3( modelMatrix ) * mat3( batchingMatrix ) * objectNormal ) );
  vMetreUv = kitN.y > 0.6 ? kitWorld.xz : ( kitN.x > kitN.z ? kitWorld.zy : kitWorld.xy );
  vLocalY = 99.0; // windows and ledges stand clear of the splash band
  #ifdef USE_BATCHING_COLOR
  vAging = kitAging();
  #endif
}
#endif
`;

const FRAGMENT_PARS = /* glsl */ `
varying float vAging;
varying vec2 vMetreUv;
varying float vLocalY;
#ifdef PHOTO_DETAIL
uniform sampler2D uDetailMap;
uniform sampler2D uDetailNormal;
uniform sampler2D uDetailOrm;
uniform float uDetailScale;
uniform vec3 uDetailMean;
uniform float uDetailRough;
uniform float uDetailStrength;
#endif
float ageHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float ageNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ageHash(i), ageHash(i + vec2(1.0, 0.0)), f.x), mix(ageHash(i + vec2(0.0, 1.0)), ageHash(i + 1.0), f.x), f.y);
}
`;

// after <color_fragment>: diffuseColor holds atlas × vertex colour
const COLOR = /* glsl */ `
#ifdef USE_MAP
  float wallness = smoothstep(0.3, 0.6, dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
#else
  float wallness = 1.0;
#endif
#ifdef PHOTO_DETAIL
  vec2 detailUv = vMetreUv * uDetailScale;
  float detailK = uDetailStrength * wallness;
  vec3 detail = texture2D(uDetailMap, detailUv).rgb / uDetailMean;
  diffuseColor.rgb *= mix(vec3(1.0), clamp(detail, 0.0, 2.5), detailK);
#endif
  float blotch = ageNoise(vMetreUv * 0.45) * 0.6 + ageNoise(vMetreUv * 1.9) * 0.4;
  float streak = ageNoise(vec2(vMetreUv.x * 3.1, vMetreUv.y * 0.22 + blotch));
  float splash = 1.0 - smoothstep(0.0, 1.4, vLocalY);
  float grime = vAging * clamp(0.9 * smoothstep(0.45, 0.95, 0.55 * blotch + 0.6 * streak) + 0.7 * splash, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.5, 0.46), grime * (0.35 + 0.65 * wallness));
`;

const ROUGHNESS = /* glsl */ `
#ifdef PHOTO_DETAIL
  vec2 detailOrm = texture2D(uDetailOrm, detailUv).rg;
  roughnessFactor *= mix(1.0, detailOrm.g / uDetailRough, detailK);
  diffuseColor.rgb *= mix(1.0, detailOrm.r, detailK * 0.6);
#endif
  roughnessFactor = clamp(mix(roughnessFactor, 1.0, grime * 0.6), 0.04, 1.0);
`;

// after <normal_fragment_maps>: perturb with the detail normal in a cotangent frame of the metre UVs
const NORMAL = /* glsl */ `
#ifdef PHOTO_DETAIL
{
  vec3 dn = texture2D(uDetailNormal, detailUv).xyz * 2.0 - 1.0;
  dn.xy *= detailK;
  vec3 q0 = dFdx(-vViewPosition);
  vec3 q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(detailUv);
  vec2 st1 = dFdy(detailUv);
  vec3 q1perp = cross(q1, normal);
  vec3 q0perp = cross(normal, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float s = det == 0.0 ? 0.0 : inversesqrt(det);
  normal = normalize(T * (s * dn.x) + B * (s * dn.y) + normal * dn.z);
}
#endif
`;

/**
 * Adds ageing to a building material; `photo` later adds detail from the pack. `kit` is for
 * the materials of kit modules (BatchedMesh instances, see above).
 */
export function buildingShader(m: THREE.MeshStandardMaterial, kit = false): BuildingShader {
  const shader: BuildingShader = {
    uniforms: {
      uDetailMap: { value: null },
      uDetailNormal: { value: null },
      uDetailOrm: { value: null },
      uDetailScale: { value: 1 },
      uDetailMean: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uDetailRough: { value: 0.5 },
      uDetailStrength: { value: 0 },
    },
  };
  if (kit) m.defines = { ...m.defines, KIT_DRESSING: '' };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shader.uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <batching_pars_vertex>', `#include <batching_pars_vertex>\n${KIT_PARS}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${VERTEX}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${KIT}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGHNESS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${NORMAL}`);
  };
  return shader;
}

/**
 * Lays a photo set over a building material. `strength` 0…1 is how much of the photo shows;
 * with `replaceMap` the procedural texture is dropped and the photo carries all the detail.
 */
export function photoDetail(m: THREE.MeshStandardMaterial, shader: BuildingShader, set: PhotoSet, strength: number, replaceMap = false) {
  const u = shader.uniforms;
  u.uDetailMap.value = set.map;
  u.uDetailNormal.value = set.normalMap;
  u.uDetailOrm.value = set.orm;
  u.uDetailScale.value = 1 / set.tile;
  u.uDetailMean.value.copy(set.mean);
  u.uDetailRough.value = set.roughness;
  u.uDetailStrength.value = strength;
  m.defines = { ...m.defines, PHOTO_DETAIL: '' };
  if (replaceMap) {
    m.map = null;
    // the photo's own roughness takes over from the flat value (the shader scales by map / mean)
    m.roughness = set.roughness;
  }
  m.needsUpdate = true;
}
