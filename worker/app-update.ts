// Outside the offline navigation fallback; never touch profile or ride storage.
export function appUpdate(request: Request): Response | null {
 if (new URL(request.url).pathname !== '/api/app-update') return null;
 return new Response(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OVFlow bijwerken</title><body style="font:18px system-ui;max-width:480px;margin:80px auto;padding:24px;color:#163d33"><h1>OVFlow bijwerken</h1><p>Laad de nieuwste versie. Je profiel, ritten en kilometers blijven bewaard.</p><button style="padding:16px" id="update">Nieuwste versie openen</button><p id="status" role="status"></p><script>
 document.getElementById('update').onclick=async()=>{
 const status=document.getElementById('status');status.textContent='App bijwerken…';
 try {
 if('serviceWorker' in navigator){for(const registration of await navigator.serviceWorker.getRegistrations()){if(registration.scope===location.origin+'/') await registration.unregister();}}
 if('caches' in window){for(const key of await caches.keys()){if(key.startsWith('workbox-precache-'))await caches.delete(key);}}
 location.replace('/?updated='+Date.now());
 }catch{status.textContent='Bijwerken mislukt. Controleer je internet en probeer opnieuw.';}
 };</script></body></html>`, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
