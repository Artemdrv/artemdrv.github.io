/* Only MC Call caches are managed; unrelated applications on this origin are untouched. */
const CACHE='mc-call-r4-4.0.0';
const PREFIXES=['mc-call-v','mc-call-r4-'];
const SCOPE=new URL('./',self.location.href).href;
const FILES=['./','./index.html','./ui-r4.css','./app-r4.js','./core-r4.js','./symbols-r4.svg','./assets-r4.js','./manifest.webmanifest','./assets/icon-r4-180.png','./assets/icon-r4-192.png','./assets/icon-r4-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(p=>new Request(new URL(p,SCOPE),{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n!==CACHE&&PREFIXES.some(p=>n.startsWith(p))).map(n=>caches.delete(n)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(SCOPE)||url.pathname.includes('/api/')||req.headers.has('Authorization'))return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{try{const r=await fetch(req);if(!r.ok)throw Error('Navigation failed');return r;}catch{const hit=await (await caches.open(CACHE)).match(new URL('./index.html',SCOPE));return hit||Response.error();}})());return;
 }
 if(!FILES.some(p=>new URL(p,SCOPE).pathname===url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),hit=await cache.match(req,{ignoreSearch:true});if(hit)return hit;const r=await fetch(req);if(r.ok&&r.type==='basic')await cache.put(req,r.clone());return r;})());
});
