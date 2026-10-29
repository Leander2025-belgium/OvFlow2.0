/** Stream only the public De Lijn vehicle endpoint; never accept caller-supplied URLs. */
export async function vehicleStream(id:string, request:Request):Promise<Response>{
 try {
  const info=await fetch(`https://www.delijn.be/api/vehicle/${id}/`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!info.ok)throw new Error('Unavailable');
  const data=await info.json() as {streamUrl?:string};
  const url=new URL(data.streamUrl||'');
  if(url.protocol!=='https:'||url.hostname!=='ardelijn-p-apps-001-rirp-lost.azurewebsites.net'||url.pathname!==`/vehicle/${id}`||url.username||url.password||url.port)throw new Error('Unexpected stream');
  const stream=await fetch(url,{headers:{Accept:'text/event-stream'},signal:request.signal});
  if(!stream.ok||!stream.headers.get('content-type')?.includes('text/event-stream'))throw new Error('Unavailable');
  return new Response(stream.body,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Geen voertuiglocatie beschikbaar.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
