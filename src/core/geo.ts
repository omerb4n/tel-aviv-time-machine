/**
 * Local scene frame: metres, origin at the Herzl St / Rothschild Blvd corner
 * (the heart of the 1909 Ahuzat Bayit plots). +x = east, +z = south, +y = up.
 *
 * Hand-placed content uses street-relative helpers (see data/streets.ts). Content
 * imported from GIS (OSM, municipal layers, georeferenced historical maps) should
 * convert WGS84 coordinates with `toLocal` so both live in the same frame.
 */
export const ORIGIN = { lat: 32.0628, lon: 34.7706 } as const;

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function toLocal(lat: number, lon: number): { x: number; z: number } {
  return {
    x: (lon - ORIGIN.lon) * M_PER_DEG_LON,
    z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT,
  };
}

export function toLatLon(x: number, z: number): { lat: number; lon: number } {
  return { lat: ORIGIN.lat - z / M_PER_DEG_LAT, lon: ORIGIN.lon + x / M_PER_DEG_LON };
}

/** Unit direction (x, z) for a compass bearing in degrees (0 = north, 90 = east). */
export function bearingDir(deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
}
