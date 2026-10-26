import * as THREE from 'three';
import { SEA_LEVEL } from '../data/geography';

/** The Mediterranean: a large plane with procedural wave normals and PBR reflections. */
export class Sea {
  readonly mesh: THREE.Mesh;
  private uniforms = { uTime: { value: 0 } };

  constructor() {
    const g = new THREE.PlaneGeometry(40000, 40000, 1, 1);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: '#1f5e78', roughness: 0.08, metalness: 0.1 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;\nuniform float uTime;')
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            vec2 p = vWaterXZ;
            float t = uTime;
            float nx = 0.06*sin(p.x*0.045 + p.y*0.02 + t*0.9) + 0.035*sin(p.x*0.13 + p.y*0.07 - t*1.3) + 0.02*sin(p.x*0.41 - p.y*0.37 + t*2.1) + 0.012*sin(p.x*1.1 + p.y*0.9 - t*3.0);
            float nz = 0.05*sin(p.y*0.05 - p.x*0.015 + t*0.7) + 0.03*sin(p.y*0.17 - p.x*0.05 + t*1.1) + 0.02*sin(p.y*0.47 + p.x*0.29 - t*1.9) + 0.012*sin(p.y*1.3 - p.x*0.7 + t*2.7);
            vec3 nw = normalize(vec3(nx, 1.0, nz));
            normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
          }`,
        );
    };
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.position.y = SEA_LEVEL;
    this.mesh.name = 'sea';
  }

  update(t: number) {
    this.uniforms.uTime.value = t;
  }
}
