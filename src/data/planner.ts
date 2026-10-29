import { z } from 'zod';
import type { Journey, Leg, Mode, Point, Stop } from './types';
import { decodePolyline } from './geometry';
const event = z.object({
  time: z.number().finite().positive(), delay: z.number().finite().optional(), status: z.string().optional(), dlStopId: z.string().optional(),
  place: z.object({ name: z.string().optional(), id: z.string().optional(), platform: z.string().optional(), location: z.object({ lt: z.number().min(-90).max(90), ln: z.number().min(-180).max(180) }) }),
});
const schema = z.object({ routes: z.array(z.object({ id: z.string(), sections: z.array(z.object({
  id: z.string(), travelType: z.string(), departure: event, arrival: event,
  transport: z.object({ mode: z.string(), name: z.string().optional() }),
  agency: z.object({ name: z.string() }).optional(), polyline: z.string().optional(),
  intermediateStops: z.array(z.object({ departure: event.optional(), arrival: event.optional(), dlStopId: z.string().optional() })).default([]),
  incidents: z.array(z.object({ summary: z.string().optional(), description: z.string().optional() }).passthrough()).default([]),
})).min(1) })) });
export function normalizeJourneys(raw: unknown, from: Stop, to: Stop): Journey[] {
  const data = schema.parse(raw);
  const point = (e: z.infer<typeof event>, fallback: string): Point => ({
    id: e.dlStopId ? `delijn:${e.dlStopId}` : e.place.id || '', name: e.place.name || fallback,
    lat: e.place.location.lt, lon: e.place.location.ln,
    time: e.time - (e.delay ?? 0), delay: e.delay ?? null,
    platform: e.place.platform || '', canceled: /cancel|deleted|notserved/i.test(e.status || ''),
  });
  return data.routes.map(r => {
    const legs: Leg[] = r.sections.map((s, i) => {
      const m = s.transport.mode.toLowerCase();
      const mode: Mode = m === 'pedestrian' ? 'WALK' : m.includes('train') ? 'TRAIN' : m === 'lightrail' || m === 'tram' ? 'TRAM' : m === 'subway' ? 'SUBWAY' : 'BUS';
      let routePoints;
      try { routePoints = s.polyline ? decodePolyline(s.polyline) : undefined; } catch { /* Omit malformed geometry, preserve the journey. */ }
      return { from: point(s.departure, i === 0 ? from.name : 'Vertrek'), to: point(s.arrival, i === r.sections.length - 1 ? to.name : 'Aankomst'),
        mode, line: mode === 'WALK' ? 'Te voet' : s.transport.name || s.transport.mode,
        agency: s.agency?.name, vehicle: '', geometry: s.polyline, routePoints,
        intermediate: s.intermediateStops.flatMap(p => { const e = p.departure || p.arrival; return e ? [point({ ...e, dlStopId: p.dlStopId || e.dlStopId }, 'Halte')] : []; }),
      };
    });
    return { id: r.id, legs, duration: r.sections.at(-1)!.arrival.time - r.sections[0].departure.time,
      transfers: Math.max(0, legs.filter(l => l.mode !== 'WALK').length - 1), updatedAt: Date.now(),
      alerts: r.sections.flatMap(s => s.incidents.map(x => x.summary || x.description || 'Er is een melding voor deze rit.')),
    };
  });
}
export async function planJourney(from: Stop, to: Stop, params: Record<string, string>, signal?: AbortSignal): Promise<Journey[]> {
  const r = await fetch('/api/journeys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    body: JSON.stringify({ origin: { lt: from.lat, ln: from.lon }, destination: { lt: to.lat, ln: to.lon }, originName: from.name, destinationName: to.name, at: params.at, arrival: params.timesel === 'arrival' }),
  });
  if (!r.ok) throw new Error('De routeplanner is tijdelijk niet beschikbaar. Probeer opnieuw.');
  return normalizeJourneys(await r.json(), from, to);
}
