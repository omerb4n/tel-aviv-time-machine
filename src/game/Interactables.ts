import * as THREE from 'three';
import { mulberry32 } from '../core/math';
import { baseHeight } from '../data/geography';
import type { Poi } from './types';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A tile mosaic in Gutman's warm palette: sea, Jaffa hill, dunes, houses, sun. Stylised, not a copy. */
function mosaicTexture() {
  return canvasTexture(1024, 256, (g) => {
    const tile = 8;
    const pick = (x: number, y: number): string => {
      const u = x / 1024;
      const v = y / 256;
      const sun = Math.hypot(u - 0.86, (v - 0.22) * 0.25) < 0.03;
      if (sun) return '#f2b541';
      if (v < 0.42) return u < 0.25 ? '#4f8fc0' : '#87b9d8'; // sky
      if (u < 0.22) return v < 0.62 ? '#c9a46a' : '#2f6f9e'; // Jaffa hill / sea
      const house = (u < 0.38 || u > 0.7) && Math.floor(u * 22) % 3 === 0 && v > 0.45 && v < 0.72;
      if (house) return v < 0.52 ? '#b4442f' : '#efe3c8';
      // the Gymnasium in the middle of the wall: twin towers, a dark arch, long wings
      if (u > 0.47 && u < 0.6 && v > 0.22 && v < 0.74) {
        const tower = (u > 0.49 && u < 0.515) || (u > 0.555 && u < 0.58);
        if (v < 0.5 && !tower) return '#87b9d8';
        if (v < 0.27) return '#b4442f'; // tower caps
        if (u > 0.522 && u < 0.548 && v > 0.56) return '#3a2e26'; // arch
        return '#f4ead2';
      }
      if (u > 0.4 && u < 0.67 && v > 0.55 && v < 0.74) return Math.floor(u * 160) % 3 === 0 && v > 0.6 && v < 0.68 ? '#5a4a3a' : '#efe3c8';
      if (v > 0.8) return '#3d6b5a';
      return '#d8b77a'; // sand
    };
    for (let y = 0; y < 256; y += tile)
      for (let x = 0; x < 1024; x += tile) {
        g.fillStyle = pick(x + tile / 2, y + tile / 2);
        g.fillRect(x, y, tile, tile);
        g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
        g.fillRect(x, y, tile, tile);
        g.strokeStyle = 'rgba(60,50,40,0.55)';
        g.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
      }
  });
}

function posterTexture() {
  return canvasTexture(512, 512, (g) => {
    g.fillStyle = '#ece4d0';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#1f3d5a';
    g.fillRect(0, 0, 512, 120);
    g.fillStyle = '#ece4d0';
    g.font = 'bold 54px "Frank Ruhl Libre", serif';
    g.textAlign = 'center';
    g.fillText('מגדל שלום', 256, 82);
    // the tower drawing
    g.fillStyle = '#9aa3a8';
    g.fillRect(206, 150, 100, 250);
    g.fillStyle = '#5c6a73';
    for (let y = 160; y < 395; y += 12) g.fillRect(212, y, 88, 4);
    g.fillStyle = '#c9c2b0';
    g.fillRect(120, 360, 272, 40);
    g.fillStyle = '#2a2622';
    g.font = 'bold 40px Heebo, sans-serif';
    g.fillText('SHALOM TOWER · 1965', 256, 448);
    g.font = '26px Heebo, sans-serif';
    g.fillText('The tallest building in the Middle East', 256, 488);
  });
}

function sparkTexture() {
  return canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,240,200,1)');
    grd.addColorStop(0.18, 'rgba(255,214,140,0.9)');
    grd.addColorStop(0.45, 'rgba(233,184,114,0.25)');
    grd.addColorStop(1, 'rgba(233,184,114,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,236,190,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(64, 14);
    g.lineTo(64, 114);
    g.moveTo(14, 64);
    g.lineTo(114, 64);
    g.stroke();
  });
}

function museumSignTexture() {
  return canvasTexture(512, 300, (g) => {
    g.fillStyle = '#f3f0e8';
    g.fillRect(0, 0, 512, 300);
    g.fillStyle = '#1f3d5a';
    g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#c8452f';
    g.fillRect(28, 96, 18, 150);
    g.fillStyle = '#f3f0e8';
    g.font = 'bold 40px "Frank Ruhl Libre", serif';
    g.textAlign = 'center';
    g.fillText('מוזיאון תל-אביב', 256, 46);
    g.fillStyle = '#1d1a15';
    g.font = 'bold 44px Heebo, sans-serif';
    g.fillText('TEL-AVIV MUSEUM', 280, 140);
    g.font = '30px Heebo, sans-serif';
    g.fillText('Paintings · Sculpture', 280, 190);
    g.font = 'bold 26px Heebo, sans-serif';
    g.fillText('16 Rothschild Blvd', 280, 248);
  });
}

/** A stylised portrait of Theodor Herzl: dark ground, a bearded profile in light. Not a copy. */
function portraitTexture() {
  return canvasTexture(256, 320, (g) => {
    g.fillStyle = '#2a2622';
    g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#c9b18a';
    g.fillRect(0, 0, 256, 10);
    g.fillRect(0, 310, 256, 10);
    g.fillRect(0, 0, 10, 320);
    g.fillRect(246, 0, 10, 320);
    g.fillStyle = '#9c8466';
    g.beginPath();
    g.ellipse(128, 128, 48, 60, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#15120f';
    g.beginPath(); // hair
    g.ellipse(128, 86, 56, 30, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath(); // the long dark beard
    g.moveTo(80, 140);
    g.quadraticCurveTo(128, 300, 176, 140);
    g.quadraticCurveTo(128, 170, 80, 140);
    g.fill();
    g.fillStyle = '#1b1d24';
    g.fillRect(56, 230, 144, 80); // coat
  });
}

/** The flag of Israel: two blue stripes and a Star of David on white. */
/** A flag hung vertically, as in the hall: stripes down its length, the star high up. */
function flagTexture() {
  return canvasTexture(220, 900, (g) => {
    g.fillStyle = '#f7f7f4';
    g.fillRect(0, 0, 220, 900);
    g.fillStyle = '#1f4fa3';
    g.fillRect(28, 0, 26, 900);
    g.fillRect(166, 0, 26, 900);
    g.strokeStyle = '#1f4fa3';
    g.lineWidth = 9;
    const tri = (rot: number) => {
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = rot + (i * Math.PI * 2) / 3;
        const [px, py] = [110 + Math.sin(a) * 44, 350 - Math.cos(a) * 44];
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    };
    tri(0);
    tri(Math.PI);
  });
}

function paintingTexture(seed: number) {
  const r = mulberry32(seed);
  return canvasTexture(128, 96, (g) => {
    const pal = ['#c8452f', '#e1b04a', '#3d6b8a', '#6d8a4a', '#efe3c8', '#2b2a28'];
    g.fillStyle = pal[Math.floor(r() * pal.length)];
    g.fillRect(0, 0, 128, 96);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      g.fillRect(r() * 100, r() * 70, 20 + r() * 50, 12 + r() * 40);
    }
  });
}

/**
 * The museum hall on 14 May 1948: the leaders' table under Herzl's portrait between two flags,
 * paintings on the walls, rows of guests facing the table. Local +z is the door.
 */
function makeHall(room: { w: number; d: number }): THREE.Object3D {
  const g = new THREE.Group();
  const { w, d } = room;
  const H = 6;
  // The hall is lit by a soft self-illumination instead of lights: extra lights would make
  // every material in the scene more expensive on phones, not just the room's.
  const glow = (m: THREE.MeshStandardMaterial) => {
    m.emissive.copy(m.color).multiplyScalar(0.42);
    return m;
  };
  const mat = (color: string, rough = 0.9) => glow(new THREE.MeshStandardMaterial({ color, roughness: rough }));
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  const wall = mat('#ece6d8');
  box(w, 0.06, d, 0, 0.03, 0, mat('#8a6a48', 0.7)); // wooden floor
  box(w, 0.1, d, 0, H, 0, mat('#f4f1ea')); // ceiling
  box(w, H, 0.2, 0, H / 2, -d / 2, wall); // back wall
  box(w, H, 0.2, 0, H / 2, d / 2, wall); // door wall
  box(0.2, H, d, -w / 2, H / 2, 0, wall);
  box(0.2, H, d, w / 2, H / 2, 0, wall);
  box(1.6, 2.6, 0.06, 0, 1.3, d / 2 - 0.12, mat('#5a4330')); // the double door
  // Herzl high between two long flags, laid out after Rudi Weissenstein's photograph
  const lit = (map: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 0.8, ...extra });
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2), lit(portraitTexture()));
  portrait.position.set(0, 4.1, -d / 2 + 0.12);
  g.add(portrait);
  for (const fx of [-2.6, 2.6]) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 5.4), lit(flagTexture(), { side: THREE.DoubleSide }));
    flag.position.set(fx, 3.5, -d / 2 + 0.14);
    g.add(flag);
  }
  // paintings on the side walls
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const pz = -d / 2 + 2.5 + Math.floor(i / 2) * (d / 3.2);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), lit(paintingTexture(i + 3)));
    p.position.set(side * (w / 2 - 0.12), 2.5, pz);
    p.rotation.y = -side * (Math.PI / 2);
    g.add(p);
  }
  // the leaders' table: a long table with a cloth, microphones in the middle
  const tz = -d / 2 + 2.2;
  box(8.4, 0.8, 1.2, 0, 0.4, tz, mat('#e9e4d6', 1));
  for (const mx of [-0.25, 0.25]) box(0.04, 0.35, 0.04, mx, 0.98, tz + 0.35, mat('#202020', 0.4));
  const people = new Figures(mulberry32(14), 1948);
  for (let i = -6; i <= 6; i++) if (i !== 0) people.add('seated', i * 0.6, tz - 0.75, 0);
  people.add('man', 0, tz - 0.7, 0); // the speaker, standing at the microphones
  // rows of guests facing the table, with a centre aisle
  const chair = mat('#4a3626', 0.8);
  const rnd = mulberry32(48);
  for (let row = 0, z = tz + 3; z < d / 2 - 2.2; row++, z += 1.1)
    for (let x = -w / 2 + 1.4; x <= w / 2 - 1.4; x += 0.75) {
      if (Math.abs(x) < 1.0) continue;
      box(0.46, 0.45, 0.44, x, 0.225, z + 0.12, chair);
      if (rnd() < 0.72) people.add('seated', x, z, Math.PI);
    }
  g.add(...people.build(0.3));
  return g;
}

// ---------------------------------------------------------------- people of 1909

type Figure = 'man' | 'woman' | 'child' | 'seated';

/**
 * Instanced low-poly figures in period dress. 1909: suits and bowler hats, long dresses and
 * wide hats. 1948: shirt sleeves and suits, few hats, shorter dresses in colour.
 */
class Figures {
  private parts = new Map<string, { geo: THREE.BufferGeometry; items: { m: THREE.Matrix4; c: THREE.Color }[] }>();
  private q = new THREE.Quaternion();

  constructor(
    private rnd: () => number,
    private era: 1909 | 1948 = 1909,
  ) {}

  private part(key: string, geo: () => THREE.BufferGeometry, x: number, y: number, z: number, s: number, color: string) {
    let p = this.parts.get(key);
    if (!p) this.parts.set(key, (p = { geo: geo(), items: [] }));
    p.items.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y * s, z), this.q, new THREE.Vector3(s, s, s)), c: new THREE.Color(color) });
  }

  add(kind: Figure, x: number, z: number, yaw = 0) {
    const r = this.rnd;
    const s = kind === 'child' ? 0.62 : 0.92 + r() * 0.14;
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const skin = ['#d8b08c', '#c99a74', '#e2bf9c'][Math.floor(r() * 3)];
    const dark = ['#2b2a28', '#3a3530', '#28303a', '#4a4036'][Math.floor(r() * 4)];
    if (this.era === 1948) return this.add48(kind, x, z, yaw, s, skin, dark);
    if (kind === 'woman') {
      const dress = r() < 0.6 ? ['#efe9dc', '#e4dccb', '#d9d2c4'][Math.floor(r() * 3)] : dark;
      this.part('dress', () => new THREE.CylinderGeometry(0.13, 0.36, 1.42, 8), x, 0.71, z, s, dress);
      this.part('head', () => new THREE.SphereGeometry(0.115, 8, 6), x, 1.56, z, s, skin);
      this.part('brim', () => new THREE.CylinderGeometry(0.27, 0.27, 0.025, 10), x, 1.66, z, s, r() < 0.5 ? '#f2eee4' : '#3a3530');
    } else {
      this.part('suit', () => new THREE.CylinderGeometry(0.2, 0.22, 1.45, 8), x, 0.72, z, s, kind === 'child' && r() < 0.5 ? '#efe9dc' : dark);
      this.part('head', () => new THREE.SphereGeometry(0.115, 8, 6), x, 1.58, z, s, skin);
      if (kind === 'man') {
        this.part('crown', () => new THREE.CylinderGeometry(0.11, 0.13, 0.12, 8), x, 1.72, z, s, r() < 0.2 ? '#e8e2d2' : '#1f1d1a');
        this.part('brim', () => new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10), x, 1.665, z, s, '#1f1d1a');
      }
    }
  }

  private add48(kind: Figure, x: number, z: number, yaw: number, s: number, skin: string, dark: string) {
    const r = this.rnd;
    const shirt = ['#f1eee6', '#e6dcc4', '#c9d3dc', '#d8cfae'][Math.floor(r() * 4)];
    if (kind === 'seated') {
      // on a chair: torso, thighs forward, head; most of the leaders wore dark suits
      const [fx, fz] = [Math.sin(yaw) * 0.22, Math.cos(yaw) * 0.22];
      this.part('torso', () => new THREE.CylinderGeometry(0.19, 0.21, 0.7, 8), x, 0.82, z, s, r() < 0.7 ? dark : shirt);
      this.part('lap', () => new THREE.BoxGeometry(0.36, 0.16, 0.42), x + fx, 0.5, z + fz, s, dark);
      this.part('head', () => new THREE.SphereGeometry(0.115, 8, 6), x, 1.3, z, s, skin);
      return;
    }
    if (kind === 'woman') {
      const dress = ['#3d4f6b', '#7a3b33', '#e8e2d2', '#5d6b4a', '#b98d4a'][Math.floor(r() * 5)];
      this.part('dress48', () => new THREE.CylinderGeometry(0.15, 0.3, 1.0, 8), x, 0.95, z, s, dress);
      this.part('legs', () => new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), x, 0.23, z, s, skin);
      this.part('head', () => new THREE.SphereGeometry(0.115, 8, 6), x, 1.56, z, s, skin);
      return;
    }
    this.part('shirt', () => new THREE.CylinderGeometry(0.2, 0.19, 0.7, 8), x, 1.1, z, s, r() < 0.45 ? dark : shirt);
    this.part('trousers', () => new THREE.CylinderGeometry(0.19, 0.16, 0.76, 8), x, 0.38, z, s, r() < 0.4 ? '#c8b98f' : dark);
    this.part('head', () => new THREE.SphereGeometry(0.115, 8, 6), x, 1.58, z, s, skin);
    if (r() < 0.15) this.part('cap', () => new THREE.CylinderGeometry(0.12, 0.13, 0.07, 8), x, 1.69, z, s, '#5b5446');
  }

  /** `glow` adds a little self-illumination (for figures indoors, out of the sun). */
  build(glow = 0): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const { geo, items } of this.parts.values()) {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.92, emissive: new THREE.Color(glow, glow * 0.92, glow * 0.8) }), items.length);
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      mesh.computeBoundingSphere();
      out.push(mesh);
    }
    return out;
  }
}

interface Entry {
  poi: Poi;
  marker: THREE.Sprite;
  prop?: THREE.Object3D;
}

/**
 * Points of interest: small props that exist in certain years, each with a sparkle
 * that appears as the player approaches (so discovering them feels earned).
 */
export class Interactables {
  readonly root = new THREE.Group();
  private entries: Entry[] = [];
  private year = 0;
  /** POIs that should show a sparkle (open leads). */
  wanted = new Set<string>();

  constructor(pois: Poi[]) {
    this.root.name = 'interactables';
    const spark = sparkTexture();
    for (const poi of pois) {
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark, depthWrite: false, depthTest: false, transparent: true }));
      const y0 = baseHeight(poi.x, poi.z);
      marker.position.set(poi.x, y0 + poi.y, poi.z);
      marker.scale.setScalar(1.4);
      marker.userData.poiId = poi.id;
      marker.renderOrder = 8;
      this.root.add(marker);
      const prop = poi.prop ? this.makeProp(poi) : undefined;
      if (prop) {
        prop.position.set(poi.x, y0, poi.z);
        prop.rotation.y = poi.prop!.rot;
        prop.traverse((o) => (o.userData.poiId = poi.id));
        this.root.add(prop);
      }
      this.entries.push({ poi, marker, prop });
    }
  }

  private makeProp(poi: Poi): THREE.Object3D {
    const g = new THREE.Group();
    const kind = poi.prop!.kind;
    const wood = (c = '#7d6b52') => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    if (kind === 'crowd') {
      // As in Avraham Soskin's photograph: a dense band of people some 13 m wide, facing the
      // photographer (local +z) more or less, and one man alone up the dune behind them
      const f = new Figures(mulberry32(1909));
      const rnd = mulberry32(411);
      for (let i = 0; i < 80; i++) {
        const x = (rnd() - 0.5) * 13;
        const kindOf: Figure = rnd() < 0.1 ? 'child' : rnd() < 0.62 ? 'man' : 'woman';
        f.add(kindOf, x, -rnd() * 3.5 - (x / 6.5) ** 2 * 0.6, (rnd() - 0.5) * 1.6);
      }
      f.add('man', 0.5, -11);
      g.add(...f.build());
    } else if (kind === 'shells') {
      // a table with two baskets of shells; the organiser behind it and a child beside it
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.7), wood('#8a7556'));
      top.position.y = 0.78;
      g.add(top);
      for (const [lx, lz] of [[-0.58, -0.3], [0.58, -0.3], [-0.58, 0.3], [0.58, 0.3]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.05), wood('#6c5a42'));
        leg.position.set(lx, 0.39, lz);
        g.add(leg);
      }
      const rnd = mulberry32(43);
      for (const [bx, shell] of [[-0.32, '#f4efe4'], [0.32, '#8d8a84']] as const) {
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.2, 12), wood('#b08d57'));
        basket.position.set(bx, 0.91, 0);
        g.add(basket);
        for (let i = 0; i < 9; i++) {
          const sh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshStandardMaterial({ color: shell, roughness: 0.5 }));
          sh.scale.y = 0.5;
          sh.position.set(bx + (rnd() - 0.5) * 0.24, 1.02, (rnd() - 0.5) * 0.24);
          g.add(sh);
        }
      }
      const f = new Figures(mulberry32(7));
      f.add('man', 0, -0.8);
      f.add('child', 0.9, 0.1, -0.6);
      g.add(...f.build());
    } else if (kind === 'camera') {
      // a plate camera on a wooden tripod; lens towards local +z; the photographer under his cloth
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.5, 5), wood('#6c5a42'));
        leg.position.set(Math.sin(a) * 0.22, 0.72, Math.cos(a) * 0.22);
        leg.rotation.set(Math.cos(a) * -0.16, 0, Math.sin(a) * 0.16);
        g.add(leg);
      }
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.36), wood('#5b4128'));
      box.position.y = 1.52;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 12), new THREE.MeshStandardMaterial({ color: '#1b1a18', metalness: 0.4, roughness: 0.4 }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 1.52, 0.24);
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#141312', roughness: 1 }));
      cloth.position.set(0, 1.45, -0.42);
      g.add(box, lens, cloth);
      const f = new Figures(mulberry32(5));
      f.add('man', 0, -0.6);
      g.add(...f.build());
    } else if (kind === 'crowd48') {
      // people waiting on the boulevard on 14 May 1948, facing the museum (local +z)
      const f = new Figures(mulberry32(1948), 1948);
      const rnd = mulberry32(514);
      for (let i = 0; i < 48; i++) f.add(rnd() < 0.62 ? 'man' : 'woman', (rnd() - 0.5) * 16, (rnd() - 0.5) * 6, (rnd() - 0.5) * 0.7);
      g.add(...f.build());
    } else if (kind === 'sign') {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 0.05), wood('#f3f0e8'));
      board.position.y = 1.6;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05), new THREE.MeshStandardMaterial({ map: museumSignTexture(), roughness: 0.8 }));
      face.position.set(0, 1.6, 0.03);
      g.add(board, face);
      for (const lx of [-0.8, 0.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), wood('#2b2a28'));
        post.position.set(lx, 0.55, 0);
        g.add(post);
      }
    } else if (kind === 'hall') {
      g.add(makeHall(poi.room ?? { w: 18, d: 12 }));
    } else if (kind === 'mosaic') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(14.4, 3.6, 0.5), new THREE.MeshStandardMaterial({ color: '#cfc6b4', roughness: 0.9 }));
      frame.position.y = 1.8;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 3.2),
        new THREE.MeshStandardMaterial({ map: mosaicTexture(), roughness: 0.55, metalness: 0.05 }),
      );
      face.position.set(0, 1.8, 0.26);
      g.add(frame, face);
    } else {
      const wood = new THREE.MeshStandardMaterial({ color: '#7d6b52', roughness: 0.95 });
      for (let i = -6; i <= 6; i++) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.6 + (i % 2) * 0.15, 0.08), wood);
        board.position.set(i * 4, 1.3, 0);
        board.rotation.z = Math.sin(i * 12.9) * 0.02;
        g.add(board);
      }
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.8 }));
      poster.position.set(0, 1.45, 0.06);
      g.add(poster);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return g;
  }

  /** Hides the sparkles until the next update (used when rendering photo plates). */
  hideMarkers() {
    for (const e of this.entries) e.marker.visible = false;
  }

  setYear(year: number) {
    this.year = Math.floor(year);
    for (const e of this.entries) if (e.prop) e.prop.visible = this.active(e.poi);
  }

  private active(p: Poi) {
    return this.year >= p.from && (p.to === undefined || this.year <= p.to);
  }

  update(t: number, eye: THREE.Vector3) {
    for (const e of this.entries) {
      const d = eye.distanceTo(e.marker.position);
      const show = this.wanted.has(e.poi.id) && this.active(e.poi) && d < 55;
      e.marker.visible = show;
      if (!show) continue;
      const near = 1 - Math.min(1, Math.max(0, (d - 12) / 43));
      const pulse = 0.85 + Math.sin(t * 3.2) * 0.15;
      (e.marker.material as THREE.SpriteMaterial).opacity = near * pulse;
      e.marker.scale.setScalar(1.6 + pulse * 0.6);
      e.marker.position.y = baseHeight(e.poi.x, e.poi.z) + e.poi.y + Math.sin(t * 1.7) * 0.12;
    }
  }

  /** The POI hit by a ray, if it exists this year. */
  pick(raycaster: THREE.Raycaster): { poi: Poi; distance: number } | undefined {
    const objs: THREE.Object3D[] = [];
    for (const e of this.entries) {
      if (!this.active(e.poi)) continue;
      if (e.marker.visible) objs.push(e.marker);
      if (e.prop) objs.push(e.prop);
    }
    const hit = raycaster.intersectObjects(objs, true)[0];
    if (!hit) return undefined;
    const e = this.entries.find((x) => x.poi.id === hit.object.userData.poiId);
    return e && { poi: e.poi, distance: hit.distance };
  }

  /** Whether a POI is present in the current year. */
  present(id: string) {
    const e = this.entries.find((x) => x.poi.id === id);
    return !!e && this.active(e.poi);
  }
}
