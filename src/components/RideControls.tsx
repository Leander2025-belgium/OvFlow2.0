import { useState } from 'react';
import type { Trip } from '../data/types';
import { distance } from '../data/utils';
import { makeRide, rideDistance, stopKey } from '../data/rides';
import { useStore } from '../store';
export default function RideControls({trip}:{trip:Trip}){
 const s=useStore(), a=s.activeTrip!;
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const found=a.boardingKey?trip.stops.findIndex(p=>stopKey(p)===a.boardingKey):trip.stops.findIndex(p=>p.id===a.boardingStopId);
 const start=found>=0?found:(a.boardingKey?-1:0),end=trip.stops.findIndex(p=>stopKey(p)===a.alightingKey);
 const result=rideDistance(trip,start,end);
 function chooseStart(i:number){const current=useStore.getState().activeTrip;if(current?.id!==trip.id)return;s.set({activeTrip:{...current,boardingKey:stopKey(trip.stops[i]),alightingKey:end>i?current.alightingKey:undefined}});}
 function locate(){
  if(!navigator.geolocation){setMessage('Locatie is niet beschikbaar. Kies je halte hieronder.');return;}
  setBusy(true);setMessage('');navigator.geolocation.getCurrentPosition(p=>{
   setBusy(false);if(useStore.getState().activeTrip?.id!==trip.id)return;
   const nearest=trip.stops.slice(0,-1).map((stop,i)=>({i,canceled:stop.canceled,d:distance(stop,{lat:p.coords.latitude,lon:p.coords.longitude})})).filter(p=>!p.canceled).sort((a,b)=>a.d-b.d)[0];
   if(!nearest||nearest.d>1500||p.coords.accuracy>500){setMessage('Je locatie is te ver weg of te onnauwkeurig. Kies je instaphalte zelf.');return;}
   chooseStart(nearest.i);setMessage(`Dichtstbijzijnde instaphalte geselecteerd (${Math.round(nearest.d)} m). Controleer de rijrichting.`);
  },()=>{setBusy(false);setMessage('Je locatie kon niet worden bepaald. Kies je halte zelf.');},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
 }
 return <section className="planner-card ride-controls">
  <h2>Jouw deel van deze rit</h2>
  <button className="secondary" onClick={locate} disabled={busy}>{busy?'Locatie zoeken…':'Kies instaphalte via mijn locatie'}</button>
  {message&&<p role="status">{message}</p>}
  <div className="ride-selects">
   <label>Instaphalte<select aria-label="Instaphalte van deze rit" value={start} onChange={e=>chooseStart(Number(e.target.value))}><option value={-1} disabled>Kies je instaphalte</option>{trip.stops.slice(0,-1).map((p,i)=><option key={stopKey(p)+i} value={i} disabled={p.canceled}>{p.name}{p.canceled ? " · vervallen" : ""}</option>)}</select></label>
   <label>Uitstaphalte<select aria-label="Uitstaphalte van deze rit" value={end>start?end:-1} onChange={e=>s.set({activeTrip:{...a,boardingKey:stopKey(trip.stops[start]),alightingKey:stopKey(trip.stops[Number(e.target.value)])}})} disabled={start<0}><option value={-1} disabled>Kies je uitstaphalte</option>{trip.stops.map((p,i)=>i>start&&<option key={stopKey(p)+i} value={i} disabled={p.canceled}>{p.name}{p.canceled ? " · vervallen" : ""}</option>)}</select></label>
  </div>
  {result&&<p><strong>{(result.meters/1000).toFixed(2)} km</strong> · {result.basis==='route'?'berekend langs het routetraject':'schatting via de haltes (geen volledige routegeometrie)'}</p>}
  <button className="primary" disabled={!result||result.meters<=0} onClick={()=>{const ride=makeRide(trip,start,end,a.line);if(ride)s.finishRide(ride);}}>Ik ben uitgestapt · kilometers opslaan</button>
  <p className="fineprint">Je haltekeuze blijft bewaard. Rond af wanneer je dit traject hebt gereisd; pas dan tellen de kilometers mee. Ook na een lege batterij kun je hier verder.</p>
 </section>;
}
