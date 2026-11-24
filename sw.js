/* Keeps the app itself on the phone so it opens with no signal. Data lives in the app's own offline copy, not here.
   Bump VERSION whenever you upload changed files, so phones pick up the new version. */
const VERSION="gc-v4";
const SHELL=["./","index.html","config.js","css/app.css","js/store.js","js/logic.js","js/demo.js","js/csv.js","js/scan.js","js/labels.js","js/app.js",
  "assets/logo-colour.png","assets/logo-white.png","assets/icon-192.png","assets/icon-512.png","manifest.webmanifest",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js","https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js","https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{})))).then(()=>self.skipWaiting()));});
const PHOTOS="gc-photos";   // equipment photos stay cached across app updates, so they show offline once seen
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!==PHOTOS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  if(u.pathname.includes("/storage/v1/object/public/")){   // photos: the address changes when a photo is replaced, so the cached copy is always right
    e.respondWith(caches.open(PHOTOS).then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r;}))));return;}
  if(u.hostname.endsWith("supabase.co")||u.pathname.includes("/auth/"))return;   // live data and sign-in always go to the network
  // app files: network first so updates arrive (own files skip the browser's 10-minute cache), cached copy when offline
  const fresh=u.origin===location.origin&&e.request.mode!=="navigate";
  e.respondWith((fresh?fetch(e.request.url,{cache:"no-cache",credentials:"same-origin"}):fetch(e.request)).then(r=>{if(r.ok&&(u.origin===location.origin||u.hostname.includes("jsdelivr")||u.hostname.includes("fonts.g"))){const c=r.clone();caches.open(VERSION).then(x=>x.put(e.request,c));}return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));
});
