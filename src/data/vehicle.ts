import { useEffect, useState } from 'react';
import { z } from 'zod';
export interface VehiclePosition { lat:number; lon:number; timestamp:number; live:boolean }
const event=z.object({tripId:z.string(),vehicleId:z.string(),lt:z.number().min(-90).max(90),ln:z.number().min(-180).max(180),timestamp:z.number().finite().positive()});
export function parseVehicle(raw:unknown,tripId:string,vehicleId:string,now=Date.now()):Omit<VehiclePosition,'live'>|null{
 const p=event.safeParse(raw);if(!p.success)return null;const d=p.data;
 if(d.tripId!==tripId.replace(/^delijn:/,'')||d.vehicleId!==vehicleId||d.timestamp>now+60000||now-d.timestamp>300000)return null;
 return {lat:d.lt,lon:d.ln,timestamp:d.timestamp};
}
export function useVehiclePosition(tripId?:string,vehicleId?:string){
 const [point,setPoint]=useState<Omit<VehiclePosition,'live'>|null>(null),[connected,setConnected]=useState(false),[now,setNow]=useState(Date.now());
 useEffect(()=>{
  setPoint(null);setConnected(false);
  if(!tripId?.startsWith('delijn:')||!vehicleId||!/^\d{1,12}$/.test(vehicleId))return;
  let stream:EventSource|null=null;
  const open=()=>{
   stream?.close();stream=null;setConnected(false);setNow(Date.now());
   if(document.hidden||!navigator.onLine)return;
   stream=new EventSource(`/api/delijn/vehicle/${vehicleId}`);
   stream.onmessage=e=>{try{const value=parseVehicle(JSON.parse(e.data),tripId,vehicleId);setPoint(value);setConnected(!!value);setNow(Date.now());}catch{setPoint(null);setConnected(false);}};
   stream.onerror=()=>setConnected(false);
  };
  open();document.addEventListener('visibilitychange',open);window.addEventListener('online',open);window.addEventListener('offline',open);window.addEventListener('pageshow',open);
  const timer=setInterval(()=>setNow(Date.now()),15000);
  return()=>{stream?.close();clearInterval(timer);document.removeEventListener('visibilitychange',open);window.removeEventListener('online',open);window.removeEventListener('offline',open);window.removeEventListener('pageshow',open);};
 },[tripId,vehicleId]);
 return point && now-point.timestamp<=300000 ? {...point,live:connected&&now-point.timestamp<=90000}:null;
}
