import { describe,it,expect } from 'vitest';
import { makeRide,rideDistance,savedPlan } from '../src/data/rides';
import { parseVehicle } from '../src/data/vehicle';
import { normalizeDeLijnTrip } from '../src/data/delijn';
import raw from './fixtures/delijn-trip.json';
const trip=normalizeDeLijnTrip(raw);
describe('ride registration',()=>{
 it('refuses reversed or incomplete journeys',()=>{expect(rideDistance(trip,4,2)).toBeNull();expect(rideDistance(trip,0,-1)).toBeNull();});
 it('measures the route curve rather than a direct start-to-end line',()=>{
  const t={...trip,stops:[{...trip.stops[0],lat:51,lon:4},{...trip.stops[1],lat:51,lon:4.01}],routePoints:[{lat:51,lon:4},{lat:51.01,lon:4},{lat:51.01,lon:4.01},{lat:51,lon:4.01}]};
  const result=rideDistance(t,0,1)!;expect(result.basis).toBe('route');expect(result.meters).toBeGreaterThan(2800);expect(result.meters).toBeLessThan(3000);
 });
 it('labels missing geometry as an estimate and creates a stable deduplication key',()=>{expect(rideDistance(trip,0,3)?.basis).toBe('estimate');expect(makeRide(trip,0,3)?.id).toBe(makeRide(trip,0,3)?.id);});
 it('does not persist GPS or delays as live observations',()=>{const t=savedPlan({...trip,vehicleId:'42',position:{kind:'gps',lat:51,lon:4,timestamp:Date.now()}});expect(t.position.kind).toBe('unavailable');expect(t.vehicleId).toBeUndefined();expect(t.offline).toBe(true);expect(t.stops.every(s=>s.delay===null&&!s.left)).toBe(true);});
});
describe('vehicle GPS identity and freshness',()=>{
 const now=1793213708000,data={tripId:'2026-10-28_1022_125',vehicleId:'5891',lt:51.1783,ln:4.376,timestamp:now};
 it('accepts a matching measured position',()=>expect(parseVehicle(data,'delijn:'+data.tripId,'5891',now)?.lat).toBe(51.1783));
 it('rejects another trip, vehicle, stale or invalid coordinates',()=>{
  expect(parseVehicle(data,'other','5891',now)).toBeNull();expect(parseVehicle(data,data.tripId,'123',now)).toBeNull();expect(parseVehicle(data,data.tripId,'5891',now+300001)).toBeNull();expect(parseVehicle({...data,lt:NaN},data.tripId,'5891',now)).toBeNull();
 });
});
