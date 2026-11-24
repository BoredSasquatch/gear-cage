/* Gear Cage data layer.
   Every change is applied locally at once, written to an outbox kept on the device, and sent to Supabase
   when there is a connection. Data is cached on the device so the app opens and works without signal. */
(function(){
"use strict";
const CFG = window.GC_CONFIG || {};
const TABLES = ["items","kits","jobs","job_lines","maintenance","profiles"];
const LS = {
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const nowISO = () => new Date().toISOString();

const S = {
  mode: (CFG.supabaseUrl && CFG.supabaseAnonKey) ? "live" : "demo",
  items:new Map(), kits:new Map(), jobs:new Map(), job_lines:new Map(), maintenance:new Map(), profiles:new Map(),
  events:[], settings:{studio:"Kehelmala Productions",currency:"LKR",allowed_domain:"",owner_email:""},
  me:null, session:null, online:navigator.onLine, syncing:false, lastSync:null, loaded:false,
  outbox:[], failed:[], error:""
};
let sb=null, flushing=false, listeners=[];
const emit = () => listeners.forEach(f=>{try{f();}catch(e){console.error(e);}});

/* ---------- cache ---------- */
const CACHE_KEY = () => S.mode==="demo" ? "gc-demo-data" : "gc-cache-"+(S.me&&S.me.id||"anon");
function saveCache(){
  const o={savedAt:nowISO(),settings:S.settings,me:S.me,events:S.events.slice(0,300)};
  TABLES.forEach(t=>o[t]=[...S[t].values()]);
  if(!LS.set(CACHE_KEY(),o)) console.warn("Could not save the offline copy (storage full?)");
}
function loadCache(){
  const o=LS.get(CACHE_KEY(),null);if(!o)return false;
  TABLES.forEach(t=>{S[t]=new Map((o[t]||[]).map(r=>[r.id,r]));});
  S.events=o.events||[];if(o.settings)S.settings=o.settings;if(o.me&&!S.me)S.me=o.me;S.lastSync=o.savedAt;return true;
}
function saveOutbox(){LS.set("gc-outbox-"+(S.me&&S.me.id||"anon"),S.outbox);}
function loadOutbox(){S.outbox=LS.get("gc-outbox-"+(S.me&&S.me.id||"anon"),[]);}

/* ---------- applying changes ---------- */
function applyOp(op){
  if(op.t==="ev"){if(!S.events.some(e=>e.id===op.row.id))S.events.unshift(op.row);return;}
  const m=S[op.table];if(!m)return;
  if(op.t==="up")m.set(op.row.id,Object.assign({},m.get(op.row.id)||{},op.row));
  else if(op.t==="pa"){const r=m.get(op.id);if(r)m.set(op.id,Object.assign({},r,op.patch));}
  else if(op.t==="del")m.delete(op.id);
}
function queue(op){
  op.qid=uuid();op.at=nowISO();applyOp(op);
  if(S.mode==="demo"){saveCache();emit();return;}
  S.outbox.push(op);saveOutbox();saveCache();emit();
  scheduleFlush();
}
let flushTimer=null;
function scheduleFlush(){clearTimeout(flushTimer);flushTimer=setTimeout(flush,250);}

const Store = {
  S, uuid, nowISO,
  on(f){listeners.push(f);},
  insert(table,row){row=Object.assign({},row);if(!row.id)row.id=uuid();queue({t:"up",table,row});return row;},
  patch(table,id,patch){queue({t:"pa",table,id,patch:Object.assign({},patch)});},
  remove(table,id){queue({t:"del",table,id});},
  log(action,f){const row=Object.assign({id:uuid(),at:nowISO(),by:S.me&&S.me.id,action,note:""},f||{});queue({t:"ev",row});return row;},
  pending(){return S.outbox.length;},
  get client(){return sb;}
};

/* ---------- sync ---------- */
function isRetryable(err,status){
  if(!navigator.onLine)return true;
  const m=String(err&&err.message||err||"");
  return status===0||status===401||status===408||status===429||status>=500||/fetch|network|load failed|timeout|jwt/i.test(m);
}
async function flush(){
  if(S.mode==="demo"||flushing||!sb||!S.session)return;
  if(!navigator.onLine){S.online=false;emit();return;}
  flushing=true;S.syncing=true;emit();
  try{
    while(S.outbox.length){
      const op=S.outbox[0];let res;
      try{
        if(op.t==="up")res=await sb.from(op.table).upsert(op.row);
        else if(op.t==="pa")res=await sb.from(op.table).update(op.patch).eq("id",op.id);
        else if(op.t==="del")res=await sb.from(op.table).delete().eq("id",op.id);
        else if(op.t==="ev")res=await sb.from("events").upsert(op.row,{onConflict:"id",ignoreDuplicates:true});
      }catch(e){res={error:{message:String(e)},status:0};}
      if(res&&res.error){
        if(isRetryable(res.error,res.status)){
          if(res.status===401){try{await sb.auth.refreshSession();}catch(e){}}
          break;
        }
        S.failed.push({op,message:res.error.message,at:nowISO()});LS.set("gc-failed",S.failed.slice(-50));
      }
      S.outbox.shift();saveOutbox();
    }
  }finally{flushing=false;S.syncing=false;S.online=navigator.onLine;emit();}
  if(S.outbox.length)setTimeout(flush,15000);
}
async function fetchAll(table,build){
  const out=[];const size=1000;
  for(let from=0;;from+=size){
    let q=sb.from(table).select("*");if(build)q=build(q);
    const {data,error}=await q.range(from,from+size-1);
    if(error)throw error;out.push(...data);if(data.length<size)break;
  }
  return out;
}
async function refresh(){
  if(S.mode==="demo"||!sb||!S.session||!navigator.onLine)return;
  await flush();
  try{
    const [items,kits,jobs,maint,profiles,settings]=await Promise.all([
      fetchAll("items"),fetchAll("kits"),fetchAll("jobs"),fetchAll("maintenance"),fetchAll("profiles"),
      sb.from("settings").select("*").eq("id",1).maybeSingle()]);
    const openIds=jobs.filter(j=>j.status!=="closed"&&j.status!=="cancelled").map(j=>j.id);
    const recentClosed=jobs.filter(j=>j.status==="closed").sort((a,b)=>String(b.closed_at).localeCompare(String(a.closed_at))).slice(0,30).map(j=>j.id);
    const ids=[...openIds,...recentClosed];let lines=[];
    for(let i=0;i<ids.length;i+=80){lines=lines.concat(await fetchAll("job_lines",q=>q.in("job_id",ids.slice(i,i+80))));}
    S.items=new Map(items.map(r=>[r.id,r]));S.kits=new Map(kits.map(r=>[r.id,r]));S.jobs=new Map(jobs.map(r=>[r.id,r]));
    S.maintenance=new Map(maint.map(r=>[r.id,r]));S.profiles=new Map(profiles.map(r=>[r.id,r]));S.job_lines=new Map(lines.map(r=>[r.id,r]));
    if(settings.data)S.settings=settings.data;
    const me=S.profiles.get(S.session.user.id);if(me)S.me=me;
    S.outbox.forEach(applyOp);   // keep changes that have not reached the server yet
    S.lastSync=nowISO();S.loaded=true;S.error="";saveCache();
  }catch(e){
    S.error=isRetryable(e,e&&e.status)?"":("Couldn't load from the server: "+(e.message||e));
  }
  emit();
}
Store.refresh=refresh;Store.flush=flush;

Store.loadJobLines=async function(jobId){
  if(S.mode==="demo"||!sb||!navigator.onLine)return;
  try{const rows=await fetchAll("job_lines",q=>q.eq("job_id",jobId));rows.forEach(r=>S.job_lines.set(r.id,r));S.outbox.forEach(applyOp);emit();}catch(e){}
};
Store.itemEvents=async function(itemId){
  const local=S.events.filter(e=>e.item_id===itemId);
  if(S.mode==="demo"||!sb||!navigator.onLine)return local;
  try{const {data,error}=await sb.from("events").select("*").eq("item_id",itemId).order("at",{ascending:false}).limit(60);
    if(error)throw error;const ids=new Set(data.map(e=>e.id));return local.filter(e=>!ids.has(e.id)).concat(data);}
  catch(e){return local;}
};
/* ---------- equipment photos (Supabase Storage bucket "item-photos"; demo mode keeps them on the device) ---------- */
const BUCKET="item-photos";
const blobToDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});
Store.photoUrl=function(i,thumb){if(!i||!i.photo_path)return"";
  if(S.mode==="demo")return thumb?(i.photo_thumb||""):(i.photo_full||i.photo_thumb||"");
  return `${String(CFG.supabaseUrl).replace(/\/$/,"")}/storage/v1/object/public/${BUCKET}/${i.photo_path}${thumb?"-t":""}.jpg?v=${i.photo_v||0}`;};
Store.uploadPhoto=async function(item,full,thumb){
  if(S.mode==="demo"){const t=await blobToDataURL(thumb);const f=full.size<350000?await blobToDataURL(full):t;
    Store.patch("items",item.id,{photo_path:"demo",photo_thumb:t,photo_full:f,photo_v:Date.now()});return{ok:true};}
  if(!sb||!S.session)return{ok:false,message:"you're not signed in"};
  const base=item.id+"/photo",opt={contentType:"image/jpeg",upsert:true,cacheControl:"31536000"};
  for(const [name,blob] of [[base+".jpg",full],[base+"-t.jpg",thumb]]){
    const {error}=await sb.storage.from(BUCKET).upload(name,blob,opt);
    if(error)return{ok:false,message:/bucket not found/i.test(error.message)?"photo storage isn't set up yet (run update 3 in Supabase)":error.message};}
  Store.patch("items",item.id,{photo_path:base,photo_v:Date.now()});Store.log("photo",{item_id:item.id});return{ok:true};
};
Store.removePhoto=async function(item){if(!item)return{ok:false,message:"item not found"};
  if(S.mode!=="demo"&&sb&&item.photo_path){const {error}=await sb.storage.from(BUCKET).remove([item.photo_path+".jpg",item.photo_path+"-t.jpg"]);if(error)return{ok:false,message:error.message};}
  Store.patch("items",item.id,S.mode==="demo"?{photo_path:null,photo_thumb:null,photo_full:null}:{photo_path:null});return{ok:true};
};
Store.saveSettings=async function(patch){
  S.settings=Object.assign({},S.settings,patch);saveCache();emit();
  if(S.mode==="demo"||!sb)return {ok:true};
  const {error}=await sb.from("settings").update(patch).eq("id",1);
  return error?{ok:false,message:error.message}:{ok:true};
};
Store.setRole=async function(id,role){
  const p=S.profiles.get(id);if(p)S.profiles.set(id,Object.assign({},p,{role}));emit();
  if(S.mode==="demo"||!sb)return {ok:true};
  const {error}=await sb.from("profiles").update({role}).eq("id",id);if(error){await refresh();return {ok:false,message:error.message};}
  return {ok:true};
};
Store.renameMe=async function(name){
  if(!S.me)return;S.me=Object.assign({},S.me,{name});S.profiles.set(S.me.id,S.me);saveCache();emit();
  if(S.mode!=="demo"&&sb)await sb.from("profiles").update({name}).eq("id",S.me.id);
};

/* ---------- sign-in ---------- */
Store.signInMicrosoft=function(){
  return sb.auth.signInWithOAuth({provider:"azure",options:{scopes:"email openid profile",redirectTo:location.origin+location.pathname}});
};
Store.signInEmail=async function(email){
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
  return error?{ok:false,message:error.message}:{ok:true};
};
Store.signOut=async function(){
  if(S.outbox.length&&!confirmSignOut())return;
  try{if(sb)await sb.auth.signOut();}catch(e){}
  S.session=null;S.me=null;emit();
};
let confirmSignOut=()=>true;Store.setSignOutGuard=f=>{confirmSignOut=f;};

Store.boot=async function(){
  if(S.mode==="demo"){
    S.me={id:"demo-me",name:"You",email:"",role:"admin"};
    if(!loadCache()){window.GC_DEMO_SEED&&window.GC_DEMO_SEED(Store);S.profiles.set(S.me.id,S.me);saveCache();}
    if(!S.profiles.has(S.me.id))S.profiles.set(S.me.id,S.me);
    S.loaded=true;emit();return;
  }
  if(!window.supabase){S.error="The app couldn't load its sign-in library. Check your connection and reload.";
    // offline with a cached profile still works
    const last=LS.get("gc-last-me",null);if(last){S.me=last;loadCache();loadOutbox();S.loaded=true;}emit();return;}
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
  const last=LS.get("gc-last-me",null);
  if(last){S.me=last;loadCache();loadOutbox();S.loaded=true;emit();}
  let session=null;
  try{({data:{session}}=await sb.auth.getSession());}catch(e){}
  if(session)await onSession(session);
  else if(!navigator.onLine&&last){/* offline: keep working from the cache until the connection returns */}
  else{S.me=null;S.loaded=true;emit();}
  sb.auth.onAuthStateChange((ev,sess)=>{
    if(ev==="SIGNED_OUT"){S.session=null;S.me=null;LS.set("gc-last-me",null);emit();return;}
    if(sess&&(!S.session||S.session.user.id!==sess.user.id))onSession(sess);else if(sess)S.session=sess;
  });
};
async function onSession(session){
  S.session=session;const uid=session.user.id;
  if(!S.me||S.me.id!==uid){S.me={id:uid,email:session.user.email,name:"",role:"pending"};loadCache();loadOutbox();}
  try{
    const {data}=await sb.from("profiles").select("*").eq("id",uid).maybeSingle();
    if(data){S.me=data;LS.set("gc-last-me",data);}
  }catch(e){}
  S.loaded=true;emit();
  if(S.me&&(S.me.role==="admin"||S.me.role==="crew"))refresh();
}
window.addEventListener("online",()=>{S.online=true;emit();refresh();});
window.addEventListener("offline",()=>{S.online=false;emit();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden)refresh();},60000);
S.failed=LS.get("gc-failed",[]);

window.GCStore=Store;
})();
