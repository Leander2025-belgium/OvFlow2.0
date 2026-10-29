import type { Trip, TripStop } from './types';
import { distance } from './utils';
export const stopKey = (p: TripStop) => `${p.id}@${p.time}`;
export interface RideRecord { id: string; tripId: string; line: string; from: string; to: string; meters: number; basis: 'route' | 'estimate'; completedAt: number }
export function rideDistance(trip: Trip, start: number, end: number): { meters: number; basis: 'route' | 'estimate' } | null {
 if (!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>=trip.stops.length) return null;
 if(trip.stops[start].canceled||trip.stops[end].canceled)return null;
 const shape=trip.routePoints;
 if(shape && shape.length>1){
  const lengths=[0];for(let i=1;i<shape.length;i++)lengths.push(lengths[i-1]+distance(shape[i-1],shape[i]));
  let cursor=0;const offsets:number[]=[];let valid=true;
  for(const [stopIndex,stop] of trip.stops.slice(0,end+1).entries()){
   if(stop.canceled){offsets.push(cursor);continue;}
   let best=Infinity,bestOffset=cursor;
   for(let j=0;j<shape.length-1;j++){
    if(lengths[j+1]<cursor)continue;
    const a=shape[j],b=shape[j+1],cos=Math.cos(stop.lat*Math.PI/180);
    const dx=(b.lon-a.lon)*cos,dy=b.lat-a.lat,den=dx*dx+dy*dy;
    const minT=lengths[j+1]>lengths[j]?Math.max(0,(cursor-lengths[j])/(lengths[j+1]-lengths[j])):0;
    const t=Math.max(minT,Math.min(1,den?((stop.lon-a.lon)*cos*dx+(stop.lat-a.lat)*dy)/den:0));
    const projected={lat:a.lat+t*(b.lat-a.lat),lon:a.lon+t*(b.lon-a.lon)};
    const d=distance(stop,projected);
    if(d<best){best=d;bestOffset=lengths[j]+t*(lengths[j+1]-lengths[j]);}
   }
   if(best>250 && stopIndex>=start)valid=false;
   cursor=bestOffset;offsets.push(cursor);
  }
  if(valid && offsets[end]>offsets[start])return {meters:Math.round(offsets[end]-offsets[start]),basis:'route'};
 }
 let meters=0;for(let i=start+1;i<=end;i++)meters+=distance(trip.stops[i-1],trip.stops[i]);
 return {meters:Math.round(meters),basis:'estimate'};
}
// Only the chosen travel plan is retained. Never restore old GPS or delays as live data.
export function savedPlan(trip: Trip): Trip { return {...trip, offline:true, position:{kind:'unavailable'}, vehicleId:undefined, stops:trip.stops.map(p=>({...p,delay:null,left:false}))}; }
export function makeRide(trip:Trip,start:number,end:number,line?:string):RideRecord|null{
 const d=rideDistance(trip,start,end);if(!d||d.meters<=0)return null;
 return {id:`${trip.id}:${stopKey(trip.stops[start])}:${stopKey(trip.stops[end])}`,tripId:trip.id,line:line||trip.line,from:trip.stops[start].name,to:trip.stops[end].name,...d,completedAt:Date.now()};
}
