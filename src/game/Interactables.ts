import * as THREE from 'three';
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
      const sun = Math.hypot(u - 0.82, (v - 0.25) * 0.25) < 0.035;
      if (sun) return '#f2b541';
      if (v < 0.42) return u < 0.25 ? '#4f8fc0' : '#87b9d8'; // sky
      if (u < 0.22) return v < 0.62 ? '#c9a46a' : '#2f6f9e'; // Jaffa hill / sea
      const house = Math.floor(u * 22) % 3 === 0 && v > 0.45 && v < 0.72;
      if (house) return v < 0.52 ? '#b4442f' : '#efe3c8';
      // the Gymnasium in the middle of the wall
      if (u > 0.47 && u < 0.6 && v > 0.32 && v < 0.72) return v < 0.4 && (u < 0.5 || u > 0.57) ? '#efe3c8' : v < 0.4 ? '#87b9d8' : '#e8d7b0';
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
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
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
    if (poi.prop!.kind === 'mosaic') {
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
      e.marker.scale.setScalar(1.1 + pulse * 0.5);
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
