import type { Mode } from './types';
export type Coordinate = { lat: number; lon: number };
export type RouteSegment = { points: Coordinate[]; mode: Mode; label?: string };
/** HERE Flexible Polyline v1 (https://github.com/heremaps/flexible-polyline). */
export function decodePolyline(encoded: string): Coordinate[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let index = 0;
  function unsigned() {
    let value = 0, factor = 1;
    for (let n = 0; n < 11; n++) {
      if (index >= encoded.length) throw new Error('Onvolledige routelijn');
      const chunk = alphabet.indexOf(encoded[index++]);
      if (chunk < 0) throw new Error('Ongeldige routelijn');
      value += (chunk & 31) * factor;
      if (!Number.isSafeInteger(value)) throw new Error('Ongeldige routelijn');
      if (chunk < 32) return value;
      factor *= 32;
    }
    throw new Error('Ongeldige routelijn');
  }
  const signed = () => { const n = unsigned(); return n % 2 ? -(n + 1) / 2 : n / 2; };
  if (unsigned() !== 1) throw new Error('Onbekende routelijnversie');
  const header = unsigned(), scale = 10 ** (header & 15), third = (header >> 4) & 7;
  let lat = 0, lon = 0;
  const points: Coordinate[] = [];
  while (index < encoded.length) {
    lat += signed(); lon += signed(); if (third) signed();
    const p = { lat: lat / scale, lon: lon / scale };
    if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) throw new Error('Ongeldige routecoördinaten');
    points.push(p);
  }
  return points;
}
