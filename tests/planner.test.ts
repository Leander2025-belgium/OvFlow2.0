import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeJourneys } from '../src/data/planner';
import { decodePolyline } from '../src/data/geometry';
import { handlePlanner } from '../worker/planner';
import raw from './fixtures/mixed-journey.json';
import type { Stop } from '../src/data/types';
const from: Stop = { id:'a', name:'Gent-Sint-Pieters', lat:51.0359,lon:3.7101,operator:'nmbs',aliases:[] };
const to: Stop = { ...from,id:'b',name:'Wilrijk',lat:51.157,lon:4.415,operator:'delijn' };
afterEach(() => vi.unstubAllGlobals());
describe('real multimodal journeys', () => {
 it('preserves a recorded train + bus journey with walking and two transfers', () => {
  const j = normalizeJourneys(raw,from,to)[0];
  expect(j.legs.map(l=>l.mode)).toEqual(['WALK','TRAIN','WALK','BUS','WALK','BUS','WALK']);
  expect(j.transfers).toBe(2);
  expect(j.legs[3].line).toBe('18');
  expect(j.legs[5].line).toBe('22');
  expect(j.legs[3].routePoints!.length).toBeGreaterThan(30);
  expect(j.legs[0].from.name).toBe(from.name);
  expect(j.legs.at(-1)!.to.name).toBe(to.name);
  expect(j.legs[3].from.delay).toBeNull();
  expect(j.legs.every(l=>!l.vehicle)).toBe(true); // HERE IDs must never masquerade as vehicle IDs.
 });
 it('decodes the official HERE example and rejects truncation', () => {
  expect(decodePolyline('BFoz5xJ67i1B1B7PzIhaxL7Y')).toEqual([{lat:50.10228,lon:8.69821},{lat:50.10201,lon:8.69567},{lat:50.10063,lon:8.6915},{lat:50.09878,lon:8.68752}]);
  expect(()=>decodePolyline('BFoz')).toThrow();
 });
 it('maps geometry to actual endpoint coordinates without swapping latitude', () => {
  for (const l of normalizeJourneys(raw,from,to)[0].legs) {
    expect(l.routePoints![0].lat).toBeCloseTo(l.from.lat,3);
    expect(l.routePoints![0].lon).toBeCloseTo(l.from.lon,3);
  }
 });
 it('forwards arrival searches to the fixed endpoint with train and bus modes', async () => {
  const f=vi.fn().mockResolvedValue(Response.json(raw)); vi.stubGlobal('fetch',f);
  const r=await handlePlanner(new Request('https://ovflow.test/api/journeys',{method:'POST',body:JSON.stringify({origin:{lt:51,ln:4},destination:{lt:51.1,ln:4.1},originName:'A',destinationName:'B',at:'2026-10-28T12:00:00+01:00',arrival:true})}));
  expect(r!.status).toBe(200);
  expect(f.mock.calls[0][0]).toBe('https://www.delijn.be/api/here/routes/');
  const p=JSON.parse(f.mock.calls[0][1].body);
  expect(p.arrivalTime).toBe('2026-10-28T12:00:00+01:00');expect(p.departureTime).toBeUndefined();
  expect(p.modes).toContain('bus');expect(p.modes).toContain('regionalTrain');
 });
 it('rejects invalid coordinates without fetching',async()=>{
  const f=vi.fn();vi.stubGlobal('fetch',f);
  const r=await handlePlanner(new Request('https://ovflow.test/api/journeys',{method:'POST',body:JSON.stringify({origin:{lt:100,ln:4}})}));
  expect(r!.status).toBe(400);expect(f).not.toHaveBeenCalled();
 });
});
