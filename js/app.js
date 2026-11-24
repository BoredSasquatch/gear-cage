/* Gear Cage screens and interactions. */
(function(){
"use strict";
const St=window.GCStore, S=St.S, G=window.GC, CSV=window.GCCsv, CFG=window.GC_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LSx={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

/* ---------- formatting ---------- */
function money(n){if(n===null||n===undefined||n===""||isNaN(n))return"—";n=Number(n);const whole=Math.round(n)===n;
  try{return new Intl.NumberFormat(undefined,{style:"currency",currency:S.settings.currency||"LKR",minimumFractionDigits:whole?0:2,maximumFractionDigits:whole?0:2}).format(n);}
  catch(e){return(S.settings.currency||"")+" "+n.toFixed(whole?0:2);}}
function fmtDate(s){if(!s)return"—";const d=G.parseD(s);if(!d||isNaN(d))return"—";return d.toLocaleDateString(undefined,{weekday:undefined,day:"numeric",month:"short",year:d.getFullYear()===new Date().getFullYear()?undefined:"numeric"});}
function fmtWhen(s){if(!s)return"";const d=new Date(s);const mins=Math.round((Date.now()-d)/6e4);
  if(mins<1)return"just now";if(mins<60)return mins+" min ago";if(mins<1440&&d.getDate()===new Date().getDate())return d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  return d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+" "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});}
function toast(msg,kind){const t=document.createElement("div");t.className="toast "+(kind||"");t.textContent=msg;$("#toasts").appendChild(t);while($("#toasts").children.length>3)$("#toasts").firstChild.remove();setTimeout(()=>t.remove(),kind==="bad"?4500:2800);}
const chip=(txt,k)=>`<span class="chip ${k||""}">${esc(txt)}</span>`;
const statusChip=s=>{const x=G.STATUS[s]||G.STATUS.available;return chip(x[0],x[1]);};
const jobChip=j=>{const x=G.JOB_STATUS[j.status]||["",""];return chip(isOverdue(j)?`${G.diffDays(j.due_on,G.today())}d overdue`:x[0],isOverdue(j)?"bad":x[1]);};
const tagHTML=i=>i?`<span class="tag ${i.is_case?"case":""}">${esc(i.tag)}</span>`:"";
const isOverdue=j=>(j.status==="out"||j.status==="wrapped")&&j.due_on&&G.diffDays(j.due_on,G.today())>0;
const canWrite=()=>S.me&&(S.me.role==="admin"||S.me.role==="crew");
const isAdmin=()=>S.me&&S.me.role==="admin";
const CHECK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
const IC={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  jobs:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 9l2-5 16 0-2 5M8 4l-2 5M13 4l-2 5M18 4l-2 5"/></svg>',
  scan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>'
};

/* ---------- UI state and routing ---------- */
const UI={v:"home",id:null,inputs:{},jobFilter:"active",gearQ:"",gearCat:"",gearStatus:"",mFilter:"open",jobMode:{},wrapCase:LSx.get("gc-wrapcase",{}),ack:{},labelSel:new Set(),labelLayout:LSx.get("gc-label-layout","medium"),labelSkip:0,labelFilter:"",showLeft:true};
const M={};
const VIEWS={home:vHome,jobs:vJobs,job:vJob,gear:vGear,item:vItem,kits:vKits,maint:vMaint,labels:vLabels,people:vPeople,more:vMore,settings:vSettings};
function route(){const h=(location.hash||"").slice(1);const m=h.match(/^(job|item)-(.+)$/);
  if(m){UI.v=m[1];UI.id=m[2];}else{UI.v=VIEWS[h]?h:"home";UI.id=null;}
  if(UI.v==="job"&&UI.id&&S.jobs.get(UI.id)&&S.jobs.get(UI.id).status==="closed"&&!G.linesOf(UI.id).length)St.loadJobLines(UI.id);
  render();}
window.addEventListener("hashchange",()=>{route();window.scrollTo(0,0);});
function go(h){if(location.hash==="#"+h)route();else location.hash=h;}
let rq=false;function schedule(){if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;render();});}
St.on(schedule);
const val=(id,d)=>UI.inputs[id]!==undefined?UI.inputs[id]:(d||"");

/* ---------- shell ---------- */
let chromeBuilt=false;
function render(){
  const app=$("#app");
  if(!S.loaded){return;}
  if(S.mode==="live"&&!S.me){chromeBuilt=false;app.innerHTML=signInHTML();return;}
  if(S.me&&(S.me.role==="pending"||S.me.role==="disabled")){chromeBuilt=false;app.innerHTML=pendingHTML();return;}
  if(!chromeBuilt){app.innerHTML=chromeHTML();chromeBuilt=true;}
  document.body.classList.toggle("ro",!canWrite());
  const ae=document.activeElement;let fid=null,sel=null;
  if(ae&&ae.id&&ae.closest&&ae.closest("#view")){fid=ae.id;try{sel=[ae.selectionStart,ae.selectionEnd];}catch(e){}}
  const nav=UI.v==="job"?"jobs":UI.v==="item"?"gear":["kits","maint","labels","people","settings"].includes(UI.v)?"more":UI.v;
  document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("on",a.dataset.nav===nav));
  $("#sync").outerHTML=syncHTML();
  $("#studio").textContent=S.settings.studio||"Equipment check-out";
  $("#banners").innerHTML=bannersHTML();
  let html="";try{html=VIEWS[UI.v]();}catch(e){console.error(e);html=`<div class="panel empty">Something went wrong showing this page. ${esc(e.message)}</div>`;}
  $("#view").innerHTML=html;
  if(fid){const el=document.getElementById(fid);if(el){el.focus({preventScroll:true});if(sel&&el.setSelectionRange&&sel[0]!=null){try{el.setSelectionRange(sel[0],sel[1]);}catch(e){}}}}
}
function chromeHTML(){
  const tab=(h,ic,t)=>`<a href="#${h}" data-nav="${h}">${IC[ic]}<span>${t}</span></a>`;
  return `<header class="top"><div class="wrap"><div class="top-row">
    <a class="brand" href="#home"><img class="logo-colour" src="assets/logo-colour.png" alt="Kehelmala, inspired storytelling"><img class="logo-white" src="assets/logo-white.png" alt="Kehelmala, inspired storytelling">
      <div class="app"><b>Gear Cage</b><span id="studio"></span></div></a>
    <nav class="desk">${["home:Overview","jobs:Jobs","gear:Gear","kits:Kits","maint:Maintenance","labels:Labels"].map(x=>{const[h,t]=x.split(":");return`<a href="#${h}" data-nav="${h}">${t}</a>`;}).join("")}
      <a href="#more" data-nav="more">More</a></nav>
    <span id="sync"></span>
    <button class="btn primary small" data-act="scan" style="min-height:38px">${IC.cam} Scan</button>
  </div></div></header>
  <div class="wrap" id="banners"></div>
  <main class="wrap" id="view"></main>
  <nav class="tabbar">${tab("home","home","Home")}${tab("jobs","jobs","Jobs")}
    <button class="scanbtn" data-act="scan" aria-label="Scan a QR label"><span class="c">${IC.scan}</span></button>
    ${tab("gear","gear","Gear")}${tab("more","more","More")}</nav>`;
}
function syncHTML(){
  const n=St.pending();let cls="",t="Synced";
  if(S.mode==="demo"){cls="wait";t="Demo mode";}
  else if(!S.online){cls="off";t=n?`Offline · ${n} waiting`:"Offline";}
  else if(S.syncing){cls="wait";t="Syncing…";}
  else if(n){cls="wait";t=`${n} waiting`;}
  else if(S.lastSync)t="Synced "+fmtWhen(S.lastSync);
  return `<span id="sync" class="sync ${cls}" data-act="sync" title="${esc(t)}"><i></i><span class="t">${esc(t)}</span></span>`;
}
function bannersHTML(){let h="";
  if(S.mode==="demo")h+=`<div class="banner"><div class="grow"><b>Demo mode.</b> Example gear, saved on this device only. Follow the setup guide to connect Supabase and share it with your crew.</div></div>`;
  if(S.error)h+=`<div class="banner bad"><div class="grow">${esc(S.error)}</div></div>`;
  if(S.failed.length)h+=`<div class="banner bad"><div class="grow">${S.failed.length} change${S.failed.length>1?"s":""} couldn't be saved to the server.</div><a class="btn small" href="#settings">See details</a></div>`;
  if(G.items().some(i=>i.example)&&S.mode!=="demo")h+=`<div class="banner"><div class="grow">Example data is loaded. Remove it once your own gear is in.</div><a class="btn small" href="#settings">Remove examples</a></div>`;
  return h;}
function signInHTML(){return `<div class="signin"><div class="card">
  <img class="logo-colour" src="assets/logo-colour.png" alt="Kehelmala, inspired storytelling" style="display:var(--logo-colour)"><img class="logo-white" src="assets/logo-white.png" alt="" style="display:var(--logo-white)">
  <h1>Gear Cage</h1><div class="muted">Sign in with your Kehelmala Microsoft 365 account.</div>
  <button class="btn primary big" data-act="signin-ms">Sign in with Microsoft</button>
  ${CFG.showEmailSignIn?`<details><summary class="muted small" style="cursor:pointer">No Microsoft account? Get a sign-in link by email</summary>
   <form data-form="email-signin" style="display:grid;gap:8px;margin-top:10px"><input class="input" type="email" name="email" required placeholder="you@example.com" autocomplete="email"><button class="btn">Email me a link</button></form></details>`:""}
  ${S.error?`<div class="small" style="color:var(--bad)">${esc(S.error)}</div>`:""}</div></div>`;}
function pendingHTML(){return `<div class="signin"><div class="card"><img src="assets/logo-colour.png" alt="Kehelmala" style="display:var(--logo-colour)"><img src="assets/logo-white.png" alt="" style="display:var(--logo-white)">
  <h1>${S.me.role==="disabled"?"Access removed":"Waiting for approval"}</h1>
  <div class="muted">${S.me.role==="disabled"?"Your access to Gear Cage has been turned off. Ask the studio admin if this is a mistake.":`You're signed in as ${esc(S.me.email||S.me.name)}. An admin needs to approve you before you can use Gear Cage. Ask them to open More, then People.`}</div>
  <button class="btn" data-act="recheck">Check again</button><button class="btn" data-act="signout">Sign out</button></div></div>`;}

/* ---------- home ---------- */
function stageFor(j){return j.status==="booked"?{t:"Pull",m:"pull"}:j.status==="out"?{t:"Wrap",m:"wrap"}:j.status==="wrapped"?{t:"Check in",m:"studio"}:{t:"Open",m:""};}
function jobProgress(j){const ls=G.linesOf(j.id).filter(l=>l.state!=="left");const n=ls.length||0;
  if(j.status==="booked")return[ls.filter(l=>l.state==="pulled").length,n,"pulled"];
  if(j.status==="out")return[ls.filter(l=>["packed","loose","damaged","missing"].includes(l.state)).length,n,"packed"];
  if(j.status==="wrapped")return[ls.filter(l=>l.back_at).length,n,"back"];return[n,n,"done"];}
function jobCard(j){const[a,b,w]=jobProgress(j);const st=stageFor(j);const who=G.personName(j.responsible_id);
  return `<div class="row click" data-act="open-job" data-id="${j.id}"><div class="grow" style="display:grid;gap:5px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(j.name)}</b>${jobChip(j)}</div>
    <div class="small muted">${fmtDate(j.starts_on)}${j.due_on&&j.due_on!==j.starts_on?" to "+fmtDate(j.due_on):""}${who?" · "+esc(who):""} · ${a}/${b} ${w}</div>
    <div class="bar ${a===b&&b?"ok":""}"><i style="width:${b?a/b*100:0}%"></i></div></div>
    <span class="btn small primary">${st.t}</span></div>`;}
function vHome(){
  const all=G.items(),live=all.filter(i=>i.status!=="retired");
  const jobs=G.activeJobs().sort((a,b)=>String(a.starts_on||"").localeCompare(String(b.starts_on||"")));
  const mine=jobs.filter(j=>j.responsible_id===(S.me&&S.me.id)),others=jobs.filter(j=>!mine.includes(j));
  const out=live.filter(i=>i.status==="out"),lost=live.filter(i=>i.status==="lost"),repair=live.filter(i=>i.status==="maintenance"),due=G.serviceDue();
  const clashes=jobs.filter(j=>j.status==="booked").map(j=>({j,n:G.linesOf(j.id).filter(l=>l.state!=="left"&&G.issueFor(j,G.item(l.item_id))).length})).filter(x=>x.n);
  const overdue=jobs.filter(isOverdue);
  const first=(S.me&&S.me.name||"").split(" ")[0];
  if(!all.length)return `<div class="head"><div class="sp"><span class="eyebrow">Welcome${first?", "+esc(first):""}</span><h1>The cage is empty</h1></div></div>
    <div class="panel pad stack"><div>Add your gear first: each item and each case gets a QR label. The quickest way is a spreadsheet import.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-write data-act="import">Import from a spreadsheet</button><button class="btn" data-write data-act="add-item">Add one item</button></div></div>`;
  return `<div class="head"><div class="sp"><span class="eyebrow">${fmtDate(G.today())}${first?" · Hi "+esc(first):""}</span><h1>${esc(S.settings.studio||"Studio")}</h1></div>
    <button class="btn primary" data-write data-act="new-job">New job</button></div>
  <div class="stack">
  ${mine.length?`<div class="panel"><div class="ptitle"><h2>Your jobs</h2></div>${mine.map(jobCard).join("")}</div>`:""}
  <div class="panel"><div class="ptitle"><h2>${mine.length?"Other jobs":"Jobs on now and coming up"}</h2><a class="btn small" href="#jobs">All jobs</a></div>
    ${others.length?others.map(jobCard).join(""):`<div class="empty">${mine.length?"No other jobs.":"No jobs booked. Start one when a shoot is planned."}</div>`}</div>
  <div class="kpis">
    <div class="kpi"><span class="eyebrow">Out now</span><span class="v">${out.length}</span><span class="s">${money(G.sum(out,G.repl))} of gear</span></div>
    <div class="kpi ${lost.length?"alert":""}"><span class="eyebrow">Missing</span><span class="v">${lost.length}</span><span class="s">${money(G.sum(lost,G.repl))} to replace</span></div>
    <div class="kpi hero"><span class="eyebrow">Cost to replace</span><span class="v">${money(G.sum(live.filter(i=>i.status!=="lost"),G.repl))}</span><span class="s">Everything in the cage</span></div>
    <div class="kpi"><span class="eyebrow">Invested</span><span class="v">${money(G.sum(live,i=>G.num(i.purchase_cost)))}</span><span class="s">${live.length} items</span></div></div>
  <div class="panel"><div class="ptitle"><h2>Needs attention</h2></div>
    ${[...overdue.map(j=>`<div class="row click" data-act="open-job" data-id="${j.id}">${chip("Overdue","bad")}<div class="grow">${esc(j.name)} <span class="small muted">due ${fmtDate(j.due_on)}</span></div></div>`),
      ...clashes.map(x=>`<div class="row click" data-act="open-job" data-id="${x.j.id}">${chip("Clash","warn")}<div class="grow">${esc(x.j.name)} <span class="small muted">${x.n} item${x.n>1?"s":""} not available</span></div></div>`),
      ...lost.map(i=>`<div class="row click" data-act="item" data-id="${i.id}">${chip("Missing","bad")}${tagHTML(i)}<div class="grow">${esc(i.name)}</div></div>`),
      ...repair.map(i=>`<div class="row click" data-act="item" data-id="${i.id}">${chip("In repair","warn")}${tagHTML(i)}<div class="grow">${esc(i.name)}</div></div>`),
      ...due.map(d=>`<div class="row click" data-act="item" data-id="${d.item.id}">${chip(d.left<0?"Service overdue":d.left===0?"Service today":"Service in "+d.left+"d",d.left<=0?"warn":"")}${tagHTML(d.item)}<div class="grow">${esc(d.item.name)}</div></div>`)
    ].join("")||`<div class="empty">Nothing overdue, missing, clashing or due for service.</div>`}</div>
  </div>`;
}

/* ---------- jobs list ---------- */
function vJobs(){
  const f=UI.jobFilter;const all=[...S.jobs.values()];
  const sets={active:all.filter(j=>["booked","out","wrapped"].includes(j.status)),closed:all.filter(j=>j.status==="closed"||j.status==="cancelled")};
  const list=(sets[f]||[]).sort((a,b)=>f==="closed"?String(b.closed_at||b.due_on).localeCompare(String(a.closed_at||a.due_on)):String(a.starts_on||"").localeCompare(String(b.starts_on||"")));
  return `<div class="head"><div class="sp"><span class="eyebrow">Jobs</span><h1>Shoots</h1></div><button class="btn primary" data-write data-act="new-job">New job</button></div>
  <div class="toolbar"><div class="seg">${[["active","Booked and out"],["closed","Finished"]].map(o=>`<button class="${f===o[0]?"on":""}" data-act="jobfilter" data-v="${o[0]}">${o[1]}</button>`).join("")}</div></div>
  <div class="panel">${list.length?list.slice(0,80).map(jobCard).join(""):`<div class="empty">${f==="closed"?"No finished jobs yet.":"No jobs booked. Make one for your next shoot."}</div>`}</div>`;}

/* ---------- job page ---------- */
function modeFor(j){const m=UI.jobMode[j.id];if(j.status==="booked")return"pull";if(j.status==="closed"||j.status==="cancelled")return"done";
  if(j.status==="wrapped")return"studio";return m==="studio"?"studio":"wrap";}
function vJob(){
  const j=S.jobs.get(UI.id);if(!j)return `<div class="panel empty">This job isn't here. It may have been deleted. <a href="#jobs">Back to jobs</a></div>`;
  const mode=modeFor(j);const who=G.personName(j.responsible_id);
  const steps=[["pull","Pull"],["wrap","Wrap on set"],["studio","Studio check-in"],["done","Closed"]];const idx=steps.findIndex(s=>s[0]===mode);
  let body="";
  if(mode==="pull")body=pullView(j);else if(mode==="wrap")body=wrapView(j);else if(mode==="studio")body=studioView(j);else body=doneView(j);
  return `<div class="head"><div class="sp"><span class="eyebrow"><a href="#jobs" style="color:inherit">Jobs</a> · ${fmtDate(j.starts_on)}${j.due_on&&j.due_on!==j.starts_on?" to "+fmtDate(j.due_on):""}</span>
    <h1>${esc(j.name)}</h1><div class="small muted">Responsible: <b style="color:var(--ink)">${esc(who||"nobody set")}</b>${j.notes?" · "+esc(j.notes):""}</div></div>
    ${jobChip(j)}<button class="btn small" data-write data-act="edit-job" data-id="${j.id}">Edit</button></div>
  <div class="stepper">${steps.map((s,i)=>`<span class="${i<idx?"done":i===idx?"on":""}">${s[1]}</span>`).join("")}</div>${body}`;}
function scanBarHTML(id,ph){const q=val(id);let sg="";
  if(q&&!G.findCode(q)){const r=[...[...S.kits.values()].filter(k=>(k.name+" "+k.tag).toLowerCase().includes(q.toLowerCase())).slice(0,3).map(k=>`<button type="button" data-act="pick-code" data-code="${esc(k.tag)}" data-for="${id}">${chip("Kit","acc")}<b>${esc(k.name)}</b></button>`),
    ...G.searchItems(q,8).map(i=>`<button type="button" data-act="pick-code" data-code="${esc(i.tag)}" data-for="${id}">${tagHTML(i)}<span>${esc(i.name)}</span></button>`)];
    if(r.length)sg=`<div class="sugg">${r.join("")}</div>`;}
  return `<form class="scanbar" data-form="scan" data-for="${id}" autocomplete="off"><input class="input" id="${id}" data-keep placeholder="${esc(ph)}" value="${esc(q)}" aria-label="${esc(ph)}" enterkeyhint="go">
    <button class="btn primary" type="button" data-act="scan" aria-label="Scan with camera">${IC.cam}</button>${sg}</form>`;}
function lineGroups(lines,keyFn){const g=new Map();lines.forEach(l=>{const k=keyFn(l);if(!g.has(k))g.set(k,[]);g.get(k).push(l);});return g;}
function itemMeta(i,l){const kit=l&&l.kit_id&&S.kits.get(l.kit_id);const parent=l&&l.parent_id&&G.item(l.parent_id);
  return [[i.brand,i.model].filter(Boolean).join(" "),kit?kit.name:"",parent&&l.via==="companion"?"goes with "+parent.tag:"",l&&l.via==="scan"?"added by scan":""].filter(Boolean).map(esc).join(" · ");}

/* pull */
function pullView(j){
  const sm=G.pullSummary(j);const ls=sm.ls.map(l=>Object.assign({},l,{it:G.item(l.item_id)})).filter(l=>l.it);
  const onJob=new Set(ls.map(l=>l.item_id));
  const key=l=>{const h=l.it.home_case_id;if(h&&onJob.has(h)){const c=G.item(h);return"1|In "+c.tag+" "+c.name;}return"2|"+([l.it.room,l.it.shelf].filter(Boolean).join(" · ")||"No shelf set");};
  const groups=lineGroups(ls,key);const kits=[...S.kits.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const ack=UI.ack[j.id];const canGo=canWrite()&&sm.going.length&&!sm.pending&&!sm.blocked&&(!sm.critLeft||ack);
  const why=!sm.going.length?"Add a kit or scan gear to build the pull sheet.":sm.pending?`${sm.pending} item${sm.pending>1?"s":""} still to scan or leave behind.`:sm.blocked?`${sm.blocked} item${sm.blocked>1?"s are":" is"} not available. Swap or leave them.`:sm.critLeft&&!ack?"Confirm you're leaving critical items behind.":"Everything is pulled. Ready to go.";
  return `<div class="panel pad stack">
    ${kits.length?`<div style="display:grid;gap:8px"><span class="eyebrow">Add a kit</span><div class="kitpick">${kits.map(k=>{const on=(j.kit_ids||[]).includes(k.id);
      return`<button data-write data-act="job-kit" data-id="${k.id}" class="${on?"on":""}" aria-pressed="${on}"><b>${esc(k.name)}</b><span class="small muted">${(k.item_ids||[]).length} items${on?" · added":""}</span></button>`;}).join("")}</div></div>`:""}
    <div style="display:grid;gap:6px"><span class="eyebrow">Scan every item as you pull it</span>${scanBarHTML("scan-pull","Scan a QR label or type a tag")}
      <span class="small muted">Scanning an item already on the sheet ticks it. Anything else is added. Scanning a case adds the items that live in it, and each of those still needs its own scan.</span></div></div>
  ${ls.length?`<div class="panel" style="margin-top:14px">${[...groups.keys()].sort().map(k=>{const g=groups.get(k);
    return `<div class="loc"><span>${esc(k.slice(2))}</span><span class="muted" style="margin-left:auto">${g.filter(l=>l.state!=="planned").length}/${g.length}</span></div>${g.sort((a,b)=>G.byTag(a.it,b.it)).map(l=>pullLine(j,l)).join("")}`;}).join("")}</div>
   <div class="footer"><div class="grow"><div class="small"><b>${sm.pulled}</b> of ${sm.going.length} pulled${sm.ls.length-sm.going.length?` · ${sm.ls.length-sm.going.length} left behind`:""} · ${money(sm.value)} going out</div>
     <div class="bar ${sm.pulled===sm.going.length&&sm.going.length?"ok":""}"><i style="width:${sm.going.length?sm.pulled/sm.going.length*100:0}%"></i></div>
     <div class="small ${canGo?"":"muted"}">${esc(why)}</div>
     ${sm.critLeft?`<label class="chk small"><input type="checkbox" data-act="ack" data-id="${j.id}" ${ack?"checked":""}> I'm leaving ${sm.critLeft} critical item${sm.critLeft>1?"s":""} behind on purpose</label>`:""}</div>
     <button class="btn primary big" data-act="confirm-out" data-id="${j.id}" ${canGo?"":"disabled"}>Check out ${sm.going.length}</button></div>`
  :`<div class="panel empty" style="margin-top:14px">The pull sheet is empty. Add a kit or scan gear.</div>`}`;}
function pullLine(j,l){const i=l.it;const left=l.state==="left";const issue=!left&&G.issueFor(j,i);const clashes=left?[]:G.clashesFor(j,i.id).filter(o=>!issue||!issue.includes(o.name));
  const swaps=issue?G.items().filter(x=>x.id!==i.id&&x.category===i.category&&x.status==="available"&&!G.jobHolding(x.id)&&!G.lineFor(j.id,x.id)).sort((a,b)=>((b.model===i.model)-(a.model===i.model))||G.byTag(a,b)).slice(0,8):[];
  const pulled=l.state==="pulled";
  return `<div class="line ${left?"left":pulled?"done":""} ${issue?"prob":""}">
    <button class="tick" data-write data-act="pull-tick" data-id="${l.id}" aria-pressed="${pulled}" aria-label="Pulled ${esc(i.name)}" ${left?"disabled":""}>${CHECK}</button>
    <div class="grow"><div class="t">${tagHTML(i)}<b>${esc(i.name)}</b>${i.critical?`<span class="crit">Critical</span>`:""}</div>
      <div class="small muted">${itemMeta(i,l)}</div>
      ${issue?`<div class="warnline"><b>${esc(issue)}.</b>${swaps.length?`<select class="input" style="width:auto;min-height:36px" data-swap="${l.id}" aria-label="Swap for"><option value="">Swap for…</option>${swaps.map(s=>`<option value="${s.id}">${esc(s.tag)} · ${esc(s.name)}</option>`).join("")}</select>`:"No spare available."}</div>`:""}
      ${clashes.length?`<div class="small" style="color:var(--warn)">Also booked on ${clashes.map(o=>`${esc(o.name)} (${fmtDate(o.starts_on)})`).join(", ")}</div>`:""}
      ${left?`<div class="small">Left behind: <select class="input" style="width:auto;min-height:34px" data-reason="${l.id}">${G.LEAVE_REASONS.map(r=>`<option ${r===l.reason?"selected":""}>${r}</option>`).join("")}</select></div>`:""}</div>
    <div class="acts" data-write>${left?`<button class="btn small" data-act="unleave" data-id="${l.id}">Undo</button>`:`<button class="btn small" data-act="leave" data-id="${l.id}">Leave</button>`}
      ${!l.kit_id&&l.via!=="case"?`<button class="btn small" data-act="rm-line" data-id="${l.id}">Remove</button>`:""}</div></div>`;}

/* wrap on set */
function wrapView(j){
  const sm=G.wrapSummary(j);const cur=UI.wrapCase[j.id]&&G.item(UI.wrapCase[j.id]);
  const ls=sm.ls.filter(l=>l.state!=="left").map(l=>Object.assign({},l,{it:G.item(l.item_id)})).filter(l=>l.it);
  const todo=ls.filter(l=>l.state==="out");const packed=lineGroups(ls.filter(l=>l.state==="packed"),l=>l.packed_case_id);
  const sec=(title,arr,extra)=>arr.length?`<div class="loc"><span>${title}</span><span class="muted" style="margin-left:auto">${arr.length}</span>${extra||""}</div>${arr.sort((a,b)=>G.byTag(a.it,b.it)).map(l=>wrapLine(j,l)).join("")}`:"";
  return `<div class="panel pad stack">
    <div class="casebar ${cur?"":"none"}">${cur?`<div class="grow"><span class="small" style="opacity:.8">Packing into</span><br><b>${esc(cur.tag)} · ${esc(cur.name)}</b></div><button class="btn small" data-act="wrap-case-clear" data-id="${j.id}">Done with this case</button>`
      :`<div class="grow"><b>Scan a case to start packing it.</b><div class="small">Then scan every item as it goes in. Items that don't go in a case can be marked Loose.</div></div>`}</div>
    ${scanBarHTML("scan-wrap",cur?"Scan the next item, or another case":"Scan a case QR label")}
    <div class="small muted">Works without signal. Scans are kept on this phone and sync when you're back online.</div></div>
  <div class="panel" style="margin-top:14px">
    ${sec("Still to pack",todo)}
    ${[...packed.keys()].map(cid=>{const c=G.item(cid);return sec("In "+esc(c?c.tag+" "+c.name:"a case"),packed.get(cid));}).join("")}
    ${sec("Travelling loose",ls.filter(l=>l.state==="loose"))}${sec("Damaged",ls.filter(l=>l.state==="damaged"))}${sec("Missing",ls.filter(l=>l.state==="missing"))}
  </div>
  <div class="footer"><div class="grow"><div class="small"><b>${ls.length-todo.length}</b> of ${ls.length} accounted for${sm.damaged?` · ${sm.damaged} damaged`:""}${sm.missing?` · ${sm.missing} missing`:""}</div>
    <div class="bar ${todo.length?"":"ok"}"><i style="width:${ls.length?(ls.length-todo.length)/ls.length*100:0}%"></i></div>
    <div class="small muted">${todo.length?`${todo.length} still to pack. Every item must be packed, marked loose, damaged or missing before you finish.`:"Everything is accounted for."}</div></div>
    <div style="display:grid;gap:6px"><button class="btn primary big" data-write data-act="finish-wrap" data-id="${j.id}" ${todo.length?"disabled":""}>Finish wrap</button>
    <button class="btn small" data-act="skip-wrap" data-id="${j.id}">Skip to studio check-in</button></div></div>`;}
function wrapLine(j,l){const i=l.it;const wrongHome=l.state==="packed"&&i.home_case_id&&i.home_case_id!==l.packed_case_id?G.item(i.home_case_id):null;
  return `<div class="line ${l.state==="out"?"":l.state==="damaged"||l.state==="missing"?"prob":"done"}">
    <div class="grow"><div class="t">${tagHTML(i)}<b>${esc(i.name)}</b>${i.critical?`<span class="crit">Critical</span>`:""}</div>
      <div class="small muted">${i.home_case_id&&l.state==="out"?"Lives in "+esc((G.item(i.home_case_id)||{}).tag||""):itemMeta(i,l)}${l.wrap_by?" · "+esc(G.personName(l.wrap_by))+" "+fmtWhen(l.wrap_at):""}${l.note?" · "+esc(l.note):""}</div>
      ${wrongHome?`<div class="warnline">Normally lives in ${esc(wrongHome.tag)} ${esc(wrongHome.name)}</div>`:""}</div>
    <div class="acts" data-write>${l.state==="out"?(i.is_case?`<button class="btn small" data-act="wrap-case" data-jid="${j.id}" data-id="${i.id}">Pack into this</button>`:"")+
      `<button class="btn small" data-act="wrap-mark" data-id="${l.id}" data-s="loose">Loose</button><button class="btn small" data-act="wrap-mark" data-id="${l.id}" data-s="damaged">Damaged</button><button class="btn small danger" data-act="wrap-mark" data-id="${l.id}" data-s="missing">Missing</button>`
      :`<button class="btn small" data-act="wrap-mark" data-id="${l.id}" data-s="out">Undo</button>`}</div></div>`;}

/* studio check-in */
function studioView(j){
  const sm=G.studioSummary(j);const ls=sm.ls.map(l=>Object.assign({},l,{it:G.item(l.item_id)})).filter(l=>l.it);
  const g=lineGroups(ls,l=>l.packed_case_id?"c"+l.packed_case_id:l.state==="loose"?"loose":"none");
  const order=[...g.keys()].sort((a,b)=>(a==="none")-(b==="none")||(a==="loose")-(b==="loose"));
  const title=k=>k==="none"?"Not packed at wrap":k==="loose"?"Travelled loose":(()=>{const c=G.item(k.slice(1));return"In "+(c?c.tag+" "+c.name:"a case");})();
  return `<div class="panel pad stack">${scanBarHTML("scan-studio","Scan each item back onto the shelf")}
    <div class="small muted">Scan a case first to see what's packed in it, then scan each item as you unpack. Whoever checks gear in is logged; the job stays with ${esc(G.personName(j.responsible_id)||"the responsible person")}.</div></div>
  <div class="panel" style="margin-top:14px">${order.map(k=>{const arr=g.get(k);return `<div class="loc"><span>${esc(title(k))}</span><span class="muted" style="margin-left:auto">${arr.filter(l=>l.back_at).length}/${arr.length}</span></div>${arr.sort((a,b)=>G.byTag(a.it,b.it)).map(l=>studioLine(j,l)).join("")}`;}).join("")}</div>
  <div class="footer"><div class="grow"><div class="small"><b>${sm.done.length}</b> of ${sm.ls.length} checked in${sm.damaged.length?` · ${sm.damaged.length} damaged`:""}${sm.missing.length?` · ${sm.missing.length} missing (${money(G.sum(sm.missing,l=>G.repl(G.item(l.item_id))))})`:""}</div>
    <div class="bar ${sm.left.length?"":"ok"}"><i style="width:${sm.ls.length?sm.done.length/sm.ls.length*100:0}%"></i></div>
    <div class="small muted">${sm.left.length?`${sm.left.length} still to check in. Items go back into stock as you scan them.`:"Every item is accounted for."}</div></div>
    <button class="btn primary big" data-write data-act="close-job" data-id="${j.id}" ${sm.left.length?"disabled":""}>Close job</button></div>`;}
function studioLine(j,l){const i=l.it;const back=!!l.back_at;const st=l.state;const conf=st==="missing"&&l.back_by;
  return `<div class="line ${back&&st==="returned"?"done":(st==="damaged"||st==="missing")?"prob":""}">
    <button class="tick" data-write data-act="studio-back" data-id="${l.id}" aria-pressed="${back}" aria-label="Back in ${esc(i.name)}">${CHECK}</button>
    <div class="grow"><div class="t">${tagHTML(i)}<b>${esc(i.name)}</b>${i.critical?`<span class="crit">Critical</span>`:""}${st==="damaged"?chip("Damaged","warn"):""}${st==="missing"?chip(conf?"Missing":"Missing at wrap","bad"):""}</div>
      <div class="small muted">${back?"Back "+fmtWhen(l.back_at)+(l.back_by?" · "+esc(G.personName(l.back_by)):""):esc([i.room,i.shelf].filter(Boolean).join(" · ")||"")}${l.note?" · "+esc(l.note):""}${st==="missing"?" · replace for "+money(G.repl(i)):""}</div></div>
    <div class="acts" data-write>${back||conf?`<button class="btn small" data-act="studio-undo" data-id="${l.id}">Undo</button>`:
      `<button class="btn small" data-act="studio-dmg" data-id="${l.id}">Damaged</button><button class="btn small danger" data-act="studio-miss" data-id="${l.id}">Missing</button>`}</div></div>`;}
function doneView(j){const ls=G.linesOf(j.id).filter(l=>l.state!=="left");const miss=ls.filter(l=>l.state==="missing"),dmg=ls.filter(l=>l.state==="damaged");
  return `<div class="panel"><div class="ptitle"><h2>${j.status==="cancelled"?"Cancelled":"Closed "+fmtDate(j.closed_at)}</h2><span class="small muted">${ls.length} items${miss.length?` · ${money(G.sum(miss,l=>G.repl(G.item(l.item_id))))} lost`:""}</span></div>
    ${ls.map(l=>{const i=G.item(l.item_id);if(!i)return"";return `<div class="row click" data-act="item" data-id="${i.id}">${tagHTML(i)}<div class="grow">${esc(i.name)}<div class="small muted">${l.out_by?"Out: "+esc(G.personName(l.out_by))+" · ":""}${l.wrap_by?"Wrap: "+esc(G.personName(l.wrap_by))+" · ":""}${l.back_by?"Back: "+esc(G.personName(l.back_by)):""}</div></div>${chip(l.state==="returned"?"Returned":l.state==="damaged"?"Damaged":l.state==="missing"?"Missing":l.state,l.state==="returned"?"ok":l.state==="damaged"?"warn":"bad")}</div>`;}).join("")||`<div class="empty">${S.online?"Loading…":"Connect to load this job's items."}</div>`}</div>`;}

/* ---------- gear ---------- */
function vGear(){
  const q=val("gear-q");const toks=q.toLowerCase().split(/\s+/).filter(Boolean);
  let rows=G.items().filter(i=>(!UI.gearCat||(UI.gearCat==="__cases"?i.is_case:i.category===UI.gearCat))&&(!UI.gearStatus||i.status===UI.gearStatus)&&
    (!toks.length||toks.every(t=>[i.tag,i.name,i.brand,i.model,i.serial,i.room,i.shelf].join(" ").toLowerCase().includes(t)))).sort(G.byTag);
  const live=G.items().filter(i=>i.status!=="retired");
  return `<div class="head"><div class="sp"><span class="eyebrow">Gear · ${live.length} items</span><h1>Everything in the cage</h1></div>
    <button class="btn" data-act="export">Export</button><button class="btn" data-write data-act="import">Import</button><button class="btn primary" data-write data-act="add-item">Add gear</button></div>
  <div class="kpis"><div class="kpi"><span class="eyebrow">Invested</span><span class="v">${money(G.sum(live,i=>G.num(i.purchase_cost)))}</span><span class="s">What you paid</span></div>
    <div class="kpi hero"><span class="eyebrow">Replacement value</span><span class="v">${money(G.sum(live.filter(i=>i.status!=="lost"),G.repl))}</span><span class="s">To rebuy today</span></div>
    <div class="kpi"><span class="eyebrow">Showing</span><span class="v">${rows.length}</span><span class="s">${money(G.sum(rows,G.repl))}</span></div></div>
  <div class="toolbar"><input class="input" id="gear-q" data-keep placeholder="Search tag, name, serial, shelf" value="${esc(q)}" aria-label="Search gear">
    <select class="input" data-ui="gearCat" aria-label="Category" style="flex:0 1 170px"><option value="">All categories</option><option value="__cases" ${UI.gearCat==="__cases"?"selected":""}>Cases only</option>${G.CATS.map(c=>`<option ${UI.gearCat===c[0]?"selected":""}>${c[0]}</option>`).join("")}</select>
    <select class="input" data-ui="gearStatus" aria-label="Status" style="flex:0 1 150px"><option value="">Any status</option>${Object.entries(G.STATUS).map(([k,v])=>`<option value="${k}" ${UI.gearStatus===k?"selected":""}>${v[0]}</option>`).join("")}</select></div>
  <div class="panel">${rows.length?rows.slice(0,400).map(i=>{const w=G.whereIs(i);return `<div class="row click" data-act="item" data-id="${i.id}">${tagHTML(i)}<div class="grow"><b>${esc(i.name)}</b>${i.critical?` <span class="crit">Critical</span>`:""}
      <div class="small muted">${esc(w.text)}</div></div><div style="display:grid;justify-items:end;gap:3px">${statusChip(i.status)}<span class="small num muted">${money(G.repl(i))}</span></div></div>`;}).join("")
    :`<div class="empty">${G.items().length?"Nothing matches.":"No gear yet."}</div>`}</div>`;}
let histCache={};
function vItem(){
  const i=G.item(UI.id);if(!i)return `<div class="panel empty">This item isn't here. <a href="#gear">Back to gear</a></div>`;
  const w=G.whereIs(i);const kits=[...S.kits.values()].filter(k=>(k.item_ids||[]).includes(i.id));
  const recs=[...S.maintenance.values()].filter(r=>r.item_id===i.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const comps=(i.companions||[]).map(G.item).filter(Boolean);const home=i.home_case_id&&G.item(i.home_case_id);
  if(!histCache[i.id]){histCache[i.id]={loading:true,rows:[]};St.itemEvents(i.id).then(r=>{histCache[i.id]={rows:r};schedule();});}
  const hist=histCache[i.id];
  const list=arr=>arr.map(x=>`<div class="row click" data-act="item" data-id="${x.id}">${tagHTML(x)}<div class="grow">${esc(x.name)}${x.critical?` <span class="crit">Critical</span>`:""}</div>${statusChip(x.status)}</div>`).join("");
  return `<div class="head"><div class="sp"><span class="eyebrow"><a href="#gear" style="color:inherit">Gear</a> · ${esc(i.category)}${i.is_case?" · Case":""}</span><h1>${esc(i.name)}</h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${tagHTML(i)}${statusChip(i.status)}${i.critical?`<span class="crit">Critical</span>`:""}${i.example?chip("Example"):""}</div></div>
    <button class="btn" data-act="print-one" data-id="${i.id}">Print label</button><button class="btn primary" data-write data-act="edit-item" data-id="${i.id}">Edit</button></div>
  <div class="stack">
  <div class="where">${chip("Where",w.kind)}<b>${esc(w.text)}</b></div>
  ${i.is_case?`<div class="grid2"><div class="panel"><div class="ptitle"><h2>Lives in this case</h2><span class="small muted">Fixed contents</span></div>${list(G.caseContents(i.id))||`<div class="empty">No fixed contents. Set an item's home case to this case to add it.</div>`}</div>
    <div class="panel"><div class="ptitle"><h2>Packed in it now</h2></div>${list(G.packedIn(i.id))||`<div class="empty">Empty.</div>`}</div></div>`:""}
  <div class="panel pad"><dl class="facts">${[["Brand and model",[i.brand,i.model].filter(Boolean).join(" ")],["Serial",i.serial],["Shelf",[i.room,i.shelf].filter(Boolean).join(" · ")],["Home case",home?home.tag+" "+home.name:""],
    ["Purchased",fmtDate(i.purchase_date)],["Supplier",i.supplier],["Purchase cost",money(i.purchase_cost)],["Replacement cost",money(G.repl(i))],["Service every",G.num(i.service_days)?i.service_days+" days":""],["Last serviced",fmtDate(i.last_serviced)]]
    .map(f=>`<div><dt>${f[0]}</dt><dd>${esc(f[1]||"—")}</dd></div>`).join("")}</dl>${i.notes?`<p style="margin:12px 0 0">${esc(i.notes)}</p>`:""}</div>
  ${comps.length?`<div class="panel"><div class="ptitle"><h2>Always goes out with</h2></div>${list(comps)}</div>`:""}
  ${kits.length?`<div class="panel pad"><span class="eyebrow">In kits</span><div>${kits.map(k=>esc(k.name)).join(", ")}</div></div>`:""}
  <div class="panel"><div class="ptitle"><h2>Maintenance</h2><button class="btn small" data-write data-act="add-maint" data-item="${i.id}">Log</button></div>
    ${recs.map(r=>`<div class="row click" data-act="edit-maint" data-id="${r.id}"><div class="grow">${fmtDate(r.date)} · ${esc(r.type)}<div class="small muted">${esc(r.description)}</div></div>${r.status==="open"?chip("Open","warn"):""}<span class="num small">${money(r.cost)}</span></div>`).join("")||`<div class="empty">Nothing logged.</div>`}</div>
  <div class="panel"><div class="ptitle"><h2>History</h2></div>${hist.loading?`<div class="empty">Loading…</div>`:hist.rows.slice(0,40).map(e=>{const j=e.job_id&&S.jobs.get(e.job_id);const c=e.case_id&&G.item(e.case_id);
    return `<div class="row"><div class="grow"><b style="text-transform:capitalize">${esc(e.action)}</b>${j?" · "+esc(j.name):""}${c?" · in "+esc(c.tag):""}${e.note?" · "+esc(e.note):""}<div class="small muted">${fmtWhen(e.at)}${e.by?" · "+esc(G.personName(e.by)):""}</div></div></div>`;}).join("")||`<div class="empty">No scans yet.</div>`}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap" data-write><button class="btn" data-act="dup-item" data-id="${i.id}">Duplicate</button>${isAdmin()?`<button class="btn danger" data-act="del-item" data-id="${i.id}" data-confirm="Delete for good?">Delete</button>`:""}</div>
  </div>`;}

/* ---------- kits ---------- */
function vKits(){const kits=[...S.kits.values()].sort((a,b)=>a.name.localeCompare(b.name));
  return `<div class="head"><div class="sp"><span class="eyebrow">Kits · ${kits.length}</span><h1>Camera configurations</h1></div><button class="btn primary" data-write data-act="add-kit">New kit</button></div>
  ${kits.length?`<div class="grid2">${kits.map(k=>{const its=(k.item_ids||[]).map(G.item).filter(Boolean);const bad=its.filter(i=>i.status!=="available");
    const inCases=G.sum(its.filter(i=>i.is_case),c=>G.caseContents(c.id).length);
    return `<div class="panel pad stack" style="gap:8px"><div style="display:flex;gap:8px;justify-content:space-between;align-items:center"><h2>${esc(k.name)}</h2><span class="tag">${esc(k.tag||"")}</span></div>
      ${k.description?`<div class="small muted">${esc(k.description)}</div>`:""}
      <div style="display:flex;gap:6px;flex-wrap:wrap">${bad.length?chip(bad.length+" unavailable","warn"):chip("Ready","ok")}${chip(its.length+" items"+(inCases?` + ${inCases} in cases`:""))}</div>
      <div class="small">Replacement value <b class="num">${money(G.sum(its,G.repl)+G.sum(its.filter(i=>i.is_case),c=>G.sum(G.caseContents(c.id),G.repl)))}</b></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-write data-act="edit-kit" data-id="${k.id}">Edit</button></div></div>`;}).join("")}</div>`
  :`<div class="panel empty">Kits are gear that travels together, like an A-camera build. Add cases to a kit and everything that lives in them comes along.</div>`}`;}

/* ---------- maintenance ---------- */
function vMaint(){const recs=[...S.maintenance.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date)));const shown=recs.filter(r=>UI.mFilter==="all"||r.status===UI.mFilter);const due=G.serviceDue();
  const yr=String(new Date().getFullYear());
  return `<div class="head"><div class="sp"><span class="eyebrow">Maintenance</span><h1>Service and repairs</h1></div><button class="btn primary" data-write data-act="add-maint">Log</button></div>
  <div class="kpis"><div class="kpi"><span class="eyebrow">Open</span><span class="v">${recs.filter(r=>r.status==="open").length}</span><span class="s">Repairs and services</span></div>
    <div class="kpi"><span class="eyebrow">Service due</span><span class="v">${due.filter(d=>d.left<=0).length}</span><span class="s">${due.filter(d=>d.left>0).length} more within 14 days</span></div>
    <div class="kpi"><span class="eyebrow">Spent in ${yr}</span><span class="v">${money(G.sum(recs.filter(r=>String(r.date).startsWith(yr)),r=>G.num(r.cost)))}</span><span class="s">${money(G.sum(recs,r=>G.num(r.cost)))} all time</span></div></div>
  ${due.length?`<div class="panel" style="margin-bottom:14px"><div class="ptitle"><h2>Service schedule</h2></div>${due.map(d=>`<div class="row">${tagHTML(d.item)}<div class="grow"><b>${esc(d.item.name)}</b><div class="small muted">Every ${d.item.service_days} days · last ${fmtDate(d.item.last_serviced||d.item.purchase_date)}</div></div>
    ${chip(d.left<0?-d.left+"d overdue":d.left===0?"Due today":"Due "+fmtDate(d.due),d.left<0?"bad":d.left===0?"warn":"")}<button class="btn small" data-write data-act="add-maint" data-item="${d.item.id}" data-type="Service">Log</button></div>`).join("")}</div>`:""}
  <div class="panel"><div class="ptitle"><h2>Log</h2><div class="seg">${[["open","Open"],["done","Done"],["all","All"]].map(o=>`<button class="${UI.mFilter===o[0]?"on":""}" data-act="mfilter" data-v="${o[0]}">${o[1]}</button>`).join("")}</div></div>
    ${shown.map(r=>{const i=G.item(r.item_id);return `<div class="row click" data-act="edit-maint" data-id="${r.id}">${tagHTML(i)}<div class="grow"><b>${esc(i?i.name:"Deleted item")}</b><div class="small muted">${fmtDate(r.date)} · ${esc(r.type)} · ${esc(r.description)}</div></div>
      <span class="num small">${money(r.cost)}</span>${r.status==="open"?`<button class="btn small" data-write data-act="done-maint" data-id="${r.id}">Done</button>`:chip("Done","ok")}</div>`;}).join("")||`<div class="empty">${UI.mFilter==="open"?"No open maintenance.":"Nothing logged yet."}</div>`}</div>`;}

/* ---------- labels ---------- */
function labelPool(){const f=UI.labelFilter;const q=val("label-q").toLowerCase();
  return G.items().filter(i=>i.status!=="retired"&&(!f||(f==="__cases"?i.is_case:i.category===f))&&(!q||[i.tag,i.name,i.room,i.shelf].join(" ").toLowerCase().includes(q))).sort(G.byTag);}
function vLabels(){const pool=labelPool();const sel=G.items().filter(i=>UI.labelSel.has(i.id)).sort(G.byTag);const L=window.GCLabels.LAYOUTS;
  return `<div class="head"><div class="sp"><span class="eyebrow">QR labels</span><h1>Print labels</h1></div><button class="btn primary" data-act="print-labels" ${sel.length?"":"disabled"}>Print ${sel.length} label${sel.length===1?"":"s"}</button></div>
  <div class="panel pad stack">
    <div class="fg"><label class="f">Label sheet<select class="input" data-ui="labelLayout">${Object.entries(L).map(([k,v])=>`<option value="${k}" ${UI.labelLayout===k?"selected":""}>${esc(v.name)}</option>`).join("")}</select></label>
      <label class="f">Skip used spaces at the start<input class="input" type="number" min="0" max="64" id="label-skip" value="${UI.labelSkip}"><span class="hint">For a part-used sticker sheet</span></label></div>
    <div class="small muted">Labels show a QR code, the tag and the name. Use small labels for cables and cards, medium for bodies and lenses, and large ones on cases. In the print dialog set scale to 100% and margins to none.</div></div>
  <div class="toolbar" style="margin-top:14px"><input class="input" id="label-q" data-keep placeholder="Filter by tag, name or shelf" value="${esc(val("label-q"))}">
    <select class="input" data-ui="labelFilter" style="flex:0 1 170px"><option value="">All gear</option><option value="__cases" ${UI.labelFilter==="__cases"?"selected":""}>Cases only</option>${G.CATS.map(c=>`<option ${UI.labelFilter===c[0]?"selected":""}>${c[0]}</option>`).join("")}</select>
    <button class="btn small" data-act="label-all">Select all ${pool.length}</button><button class="btn small" data-act="label-none">Clear</button></div>
  <div class="panel">${pool.slice(0,500).map(i=>`<label class="row click" style="cursor:pointer"><input type="checkbox" data-label="${i.id}" ${UI.labelSel.has(i.id)?"checked":""} style="width:20px;height:20px">${tagHTML(i)}<div class="grow">${esc(i.name)}<div class="small muted">${esc([i.room,i.shelf].filter(Boolean).join(" · "))}</div></div></label>`).join("")||`<div class="empty">No gear matches.</div>`}</div>
  ${sel.length?`<h2 style="margin:18px 0 8px">Preview, first sheet</h2><div class="lbl-preview" id="lbl-prev"></div>`:""}`;}
function printLabels(list){const html=window.GCLabels.sheetHTML(list,UI.labelLayout,UI.labelSkip);$("#print-area").innerHTML=html;setTimeout(()=>window.print(),80);}
function fillPreview(){const el=$("#lbl-prev");if(!el)return;const sel=G.items().filter(i=>UI.labelSel.has(i.id)).sort(G.byTag);const L=window.GCLabels.LAYOUTS[UI.labelLayout];
  el.innerHTML=window.GCLabels.sheetHTML(sel.slice(0,Math.max(1,L.cols*L.rows-UI.labelSkip)),UI.labelLayout,UI.labelSkip);
  const pg=el.querySelector(".lbl-page");if(pg){const w=el.clientWidth-20;const s=Math.min(1,w/pg.offsetWidth);pg.style.transform=`scale(${s})`;el.style.height=(pg.offsetHeight*s+24)+"px";}}

/* ---------- people, more, settings ---------- */
function vPeople(){if(!isAdmin())return `<div class="panel empty">Only admins can manage people.</div>`;
  const ps=[...S.profiles.values()].sort((a,b)=>(a.role==="pending"?0:1)-(b.role==="pending"?0:1)||String(a.name).localeCompare(String(b.name)));
  return `<div class="head"><div class="sp"><span class="eyebrow">People</span><h1>Crew access</h1></div></div>
  <div class="panel">${ps.map(p=>`<div class="row"><div class="grow"><b>${esc(p.name||p.email)}</b>${p.id===S.me.id?" (you)":""}<div class="small muted">${esc(p.email||"")}</div></div>
    <select class="input" style="width:auto" data-role="${p.id}" ${p.id===S.me.id?"disabled":""}>${[["pending","Waiting"],["crew","Crew"],["admin","Admin"],["disabled","No access"]].map(r=>`<option value="${r[0]}" ${p.role===r[0]?"selected":""}>${r[1]}</option>`).join("")}</select></div>`).join("")}</div>
  <form class="panel pad stack" data-form="access" style="margin-top:14px"><h2>Automatic approval</h2>
    <label class="f">Company email domain<input class="input" name="allowed_domain" value="${esc(S.settings.allowed_domain||"")}" placeholder="kehelmala.com"><span class="hint">People who sign in with an email at this domain become crew straight away. Everyone else waits for you to approve them here.</span></label>
    <div><button class="btn primary">Save</button></div></form>`;}
function vMore(){const link=(h,t,s)=>`<a class="row click" href="#${h}" style="text-decoration:none;color:inherit"><div class="grow"><b>${t}</b><div class="small muted">${s}</div></div><span class="muted">›</span></a>`;
  return `<div class="head"><div class="sp"><span class="eyebrow">More</span><h1>${esc(S.me&&S.me.name||"Menu")}</h1></div></div>
  <div class="panel">${link("kits","Kits","Camera configurations that go out together")}${link("maint","Maintenance","Service schedule and repairs")}${link("labels","Print QR labels","Sticker sheets and label printer rolls")}
    ${isAdmin()?link("people","People","Approve crew and set who's an admin"):""}${link("settings","Settings","Studio name, currency, sync and sign out")}</div>`;}
function vSettings(){const n=St.pending();
  return `<div class="head"><div class="sp"><span class="eyebrow">Settings</span><h1>Settings</h1></div></div>
  <div class="stack">
  <form class="panel pad stack" data-form="me"><h2>You</h2><label class="f">Your name, as the crew sees it<input class="input" name="name" value="${esc(S.me&&S.me.name||"")}"></label><div><button class="btn primary">Save</button></div></form>
  ${isAdmin()?`<form class="panel pad stack" data-form="studio"><h2>Studio</h2><div class="fg"><label class="f">Studio name<input class="input" name="studio" value="${esc(S.settings.studio||"")}"></label>
    <label class="f">Currency<select class="input" name="currency">${["LKR","USD","EUR","GBP","AUD","INR","SGD","AED"].map(c=>`<option ${c===S.settings.currency?"selected":""}>${c}</option>`).join("")}</select></label></div><div><button class="btn primary">Save</button></div></form>`:""}
  <div class="panel pad stack"><h2>Sync</h2><div>${S.mode==="demo"?"Demo mode: everything stays on this device.":`${S.online?"Online":"Offline"} · ${n?`${n} change${n>1?"s":""} waiting to sync`:"all changes synced"}${S.lastSync?" · last synced "+fmtWhen(S.lastSync):""}`}</div>
    ${S.failed.length?`<div class="banner bad"><div class="grow">${S.failed.length} change${S.failed.length>1?"s were":" was"} refused by the server: ${esc(S.failed.slice(-3).map(f=>f.message).join("; "))}</div><button class="btn small" data-act="clear-failed">Dismiss</button></div>`:""}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${S.mode!=="demo"?`<button class="btn" data-act="sync">Sync now</button>`:""}<button class="btn" data-act="export">Export gear as CSV</button></div></div>
  ${G.items().some(i=>i.example)&&isAdmin()?`<div class="panel pad stack"><h2>Example data</h2><div>Removes every item, kit, job and record marked as an example. Your own gear stays.</div><div><button class="btn danger" data-act="rm-examples" data-confirm="Remove all examples?">Remove example data</button></div></div>`:""}
  ${S.mode==="demo"?`<div class="panel pad stack"><h2>Demo</h2><div><button class="btn danger" data-act="reset-demo" data-confirm="Reset the demo?">Reset demo data</button></div></div>`:
    `<div><button class="btn" data-act="signout">Sign out</button></div>`}</div>`;}

/* ---------- modals ---------- */
function openModal(html){const m=$("#modal");m.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;m.hidden=false;const f=m.querySelector("[autofocus]");if(f)f.focus();}
function closeModal(){$("#modal").hidden=true;$("#modal").innerHTML="";for(const k in M)delete M[k];}
const mh=t=>`<div class="mh"><h2>${t}</h2><button class="btn small" data-act="close-modal">Close</button></div>`;
const crewOptions=sel=>[...S.profiles.values()].filter(p=>p.role==="admin"||p.role==="crew").sort((a,b)=>String(a.name).localeCompare(String(b.name)))
  .map(p=>`<option value="${p.id}" ${p.id===sel?"selected":""}>${esc(p.name||p.email)}</option>`).join("");
function jobForm(id){const j=id?S.jobs.get(id):{name:"",starts_on:G.today(),due_on:G.addDays(G.today(),1),responsible_id:S.me&&S.me.id,notes:""};M.id=id||null;
  openModal(`${mh(id?"Edit job":"New job")}<form data-form="job"><div class="mb">
    <label class="f">Job or production *<input class="input" name="name" required value="${esc(j.name)}" placeholder="e.g. Harbour Coffee commercial" autofocus></label>
    <div class="fg"><label class="f">Gear goes out<input class="input" type="date" name="starts_on" value="${esc(j.starts_on||"")}"></label><label class="f">Due back<input class="input" type="date" name="due_on" value="${esc(j.due_on||"")}"></label></div>
    <label class="f">Responsible crew member<select class="input" name="responsible_id">${crewOptions(j.responsible_id)}</select><span class="hint">They answer for this gear until the job closes, even if someone else brings it back.</span></label>
    <label class="f">Notes<input class="input" name="notes" value="${esc(j.notes||"")}" placeholder="Location, call time, anything to remember"></label><div class="err small" id="f-err" style="color:var(--bad)"></div></div>
    <div class="mf">${id&&j.status==="booked"?`<button type="button" class="btn danger" data-act="cancel-job" data-id="${id}" data-confirm="Cancel this job?">Cancel job</button><span style="flex:1"></span>`:""}
      <button type="button" class="btn" data-act="close-modal">Close</button><button class="btn primary">${id?"Save":"Create job"}</button></div></form>`);}
function itemForm(id,base){const i=id?G.item(id):Object.assign({category:"Camera",status:"available"},base||{});const isNew=!id;M.kind="item";M.id=id||null;M.picker={ids:(i.companions||[]).slice(),q:"",exclude:id};
  const rooms=[...new Set(G.items().map(x=>x.room).filter(Boolean))],shelves=[...new Set(G.items().map(x=>x.shelf).filter(Boolean))];
  const cases=G.items().filter(x=>x.is_case&&x.id!==id).sort(G.byTag);
  openModal(`${mh(isNew?"Add gear":"Edit "+esc(i.tag))}<form data-form="item" autocomplete="off"><div class="mb">
    <div class="fg"><label class="f">Name *<input class="input" name="name" required value="${esc(i.name)}" placeholder="e.g. SDI cable 3 ft" autofocus></label>
      <label class="f">Category<select class="input" name="category" id="f-cat">${G.CATS.map(c=>`<option ${c[0]===i.category?"selected":""}>${c[0]}</option>`).join("")}</select></label>
      <label class="f">Asset tag<input class="input" name="tag" id="f-tag" value="${esc(i.tag||G.nextTag(i.category))}" style="font-family:var(--f-tag);font-weight:700"><span class="hint">Printed on its QR label</span></label></div>
    <label class="chk"><input type="checkbox" name="is_case" ${i.is_case||(!id&&i.category==="Case")?"checked":""}><span><b>This is a case, bag or crate</b><br><span class="hint">Cases hold other gear. Scan a case at wrap, then scan what goes in it.</span></span></label>
    <div class="fg"><label class="f">Home case<select class="input" name="home_case_id"><option value="">None, lives on a shelf</option>${cases.map(c=>`<option value="${c.id}" ${c.id===i.home_case_id?"selected":""}>${esc(c.tag)} · ${esc(c.name)}</option>`).join("")}</select><span class="hint">For gear with a fixed place in a case. Packing it elsewhere at wrap is flagged.</span></label>
      <label class="f">Room<input class="input" name="room" list="dl-rooms" value="${esc(i.room)}" placeholder="e.g. Cage A"></label><label class="f">Shelf<input class="input" name="shelf" list="dl-shelves" value="${esc(i.shelf)}" placeholder="e.g. Shelf 2"></label></div>
    <datalist id="dl-rooms">${rooms.map(r=>`<option value="${esc(r)}">`).join("")}</datalist><datalist id="dl-shelves">${shelves.map(r=>`<option value="${esc(r)}">`).join("")}</datalist>
    <div class="fg"><label class="f">Brand<input class="input" name="brand" value="${esc(i.brand)}"></label><label class="f">Model<input class="input" name="model" value="${esc(i.model)}"></label><label class="f">Serial number<input class="input" name="serial" value="${esc(i.serial)}"></label></div>
    <label class="chk"><input type="checkbox" name="critical" ${i.critical?"checked":""}><span><b>Critical or easy to forget</b><br><span class="hint">Small parts and cables a shoot can't run without. Flagged on every pull sheet and check-in.</span></span></label>
    <div class="fg"><label class="f">Purchase cost<input class="input" name="purchase_cost" type="number" step="0.01" min="0" value="${esc(i.purchase_cost)}"></label><label class="f">Purchase date<input class="input" name="purchase_date" type="date" value="${esc(i.purchase_date)}"></label>
      <label class="f">Replacement cost<input class="input" name="replacement_cost" type="number" step="0.01" min="0" value="${esc(i.replacement_cost)}"></label><label class="f">Supplier<input class="input" name="supplier" value="${esc(i.supplier)}"></label></div>
    <div class="fg"><label class="f">Service every (days)<input class="input" name="service_days" type="number" min="0" value="${esc(i.service_days)}"></label><label class="f">Last serviced<input class="input" name="last_serviced" type="date" value="${esc(i.last_serviced)}"></label>
      ${isNew?`<label class="f">How many identical units?<input class="input" name="copies" type="number" min="1" max="50" value="1"><span class="hint">Each gets its own tag</span></label>`:`<label class="f">Status<select class="input" name="status">${Object.entries(G.STATUS).map(([k,v])=>`<option value="${k}" ${k===i.status?"selected":""}>${v[0]}</option>`).join("")}</select></label>`}</div>
    <div style="display:grid;gap:6px"><span class="eyebrow">Always goes out with</span><span class="hint">Cables, plates and chargers this item needs. They're added to the pull sheet automatically.</span><div id="picker">${pickerHTML()}</div></div>
    <label class="f">Notes<textarea class="input" name="notes" rows="2">${esc(i.notes)}</textarea></label><div class="small" id="f-err" style="color:var(--bad)"></div></div>
    <div class="mf"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">${isNew?"Add to inventory":"Save"}</button></div></form>`);}
function pickerHTML(){const p=M.picker;const picked=p.ids.map(G.item).filter(Boolean);const res=p.q?G.searchItems(p.q,8).filter(i=>i.id!==p.exclude&&!p.ids.includes(i.id)):[];
  return `${picked.length?`<div class="panel">${picked.map(i=>`<div class="row">${tagHTML(i)}<div class="grow">${esc(i.name)}</div><button type="button" class="btn small" data-act="pick-rm" data-id="${i.id}">Remove</button></div>`).join("")}</div>`:""}
    <div class="scanbar"><input class="input" id="pick-q" placeholder="Search gear to add" value="${esc(p.q)}" aria-label="Search gear to add" style="font-size:15px;border-width:1px">
    ${res.length?`<div class="sugg">${res.map(i=>`<button type="button" data-act="pick-add" data-id="${i.id}">${tagHTML(i)}<span>${esc(i.name)}</span></button>`).join("")}</div>`:""}</div>`;}
function rerenderPicker(){const el=$("#picker");if(!el)return;const had=document.activeElement&&document.activeElement.id==="pick-q";el.innerHTML=pickerHTML();if(had){const i=$("#pick-q");i.focus();i.setSelectionRange(i.value.length,i.value.length);}}
function submitItem(f){const fd=new FormData(f);const g=k=>String(fd.get(k)??"").trim();const n=k=>g(k)===""?null:Number(g(k));
  const d={name:g("name"),category:g("category"),tag:g("tag").toUpperCase(),brand:g("brand"),model:g("model"),serial:g("serial"),room:g("room"),shelf:g("shelf"),is_case:fd.get("is_case")==="on",home_case_id:g("home_case_id")||null,
    critical:fd.get("critical")==="on",purchase_cost:n("purchase_cost"),purchase_date:g("purchase_date")||null,replacement_cost:n("replacement_cost"),supplier:g("supplier"),service_days:n("service_days"),last_serviced:g("last_serviced")||null,notes:g("notes"),companions:M.picker.ids.slice()};
  const err=$("#f-err");if(!d.name){err.textContent="Give the item a name.";return;}if(!d.tag){err.textContent="Give the item a tag.";return;}
  if(M.id){if(G.items().some(i=>i.id!==M.id&&String(i.tag).toUpperCase()===d.tag)){err.textContent=`Tag ${d.tag} is already used.`;return;}
    const old=G.item(M.id);d.status=g("status")||old.status;if(d.home_case_id!==old.home_case_id&&old.status==="available")d.in_case_id=d.home_case_id;
    St.patch("items",M.id,d);St.log("edited",{item_id:M.id});toast(`Saved ${d.tag}`,"ok");closeModal();return;}
  const copies=Math.max(1,Math.min(50,Number(g("copies"))||1));const m=d.tag.match(/^(.*?)(\d+)$/);const tags=[];
  for(let c=0;c<copies;c++)tags.push(c&&m?m[1]+String(Number(m[2])+c).padStart(m[2].length,"0"):c?d.tag+"-"+(c+1):d.tag);
  const clash=tags.find(t=>G.items().some(i=>String(i.tag).toUpperCase()===t));if(clash){err.textContent=`Tag ${clash} is already used.`;return;}
  tags.forEach((tag,ix)=>{const r=St.insert("items",Object.assign({},d,{tag,serial:ix?"":d.serial,status:"available",in_case_id:d.home_case_id}));St.log("created",{item_id:r.id});});
  toast(copies>1?`Added ${copies} × ${d.name}`:`Added ${d.tag}`,"ok");closeModal();}
function kitForm(id){const k=id?S.kits.get(id):{name:"",tag:G.nextKitTag(),description:"",item_ids:[]};M.kind="kit";M.id=id||null;M.picker={ids:(k.item_ids||[]).slice(),q:""};
  openModal(`${mh(id?"Edit kit":"New kit")}<form data-form="kit" autocomplete="off"><div class="mb">
    <div class="fg"><label class="f">Kit name *<input class="input" name="name" required value="${esc(k.name)}" placeholder="e.g. A-cam FX6 documentary" autofocus></label><label class="f">Kit tag<input class="input" name="tag" value="${esc(k.tag||"")}"></label></div>
    <label class="f">What it's for<input class="input" name="description" value="${esc(k.description)}"></label>
    <div style="display:grid;gap:6px"><span class="eyebrow">Contents</span><span class="hint">Add cases to bring everything that lives in them. Each item's "always goes out with" gear comes too.</span><div id="picker">${pickerHTML()}</div></div><div class="small" id="f-err" style="color:var(--bad)"></div></div>
    <div class="mf">${id&&isAdmin()?`<button type="button" class="btn danger" data-act="del-kit" data-id="${id}" data-confirm="Delete this kit?">Delete</button><span style="flex:1"></span>`:""}<button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Save kit</button></div></form>`);}
function maintForm(id,itemId,type){const r=id?S.maintenance.get(id):{item_id:itemId||"",date:G.today(),type:type||"Service",description:"",cost:null,vendor:"",status:type==="Service"?"done":"open"};M.id=id||null;
  openModal(`${mh(id?"Maintenance record":"Log maintenance")}<form data-form="maint"><div class="mb">
    <label class="f">Item<select class="input" name="item_id" required><option value="">Choose gear…</option>${G.items().sort(G.byTag).map(i=>`<option value="${i.id}" ${i.id===r.item_id?"selected":""}>${esc(i.tag)} · ${esc(i.name)}</option>`).join("")}</select></label>
    <div class="fg"><label class="f">Date<input class="input" type="date" name="date" value="${esc(r.date)}"></label><label class="f">Type<select class="input" name="type">${["Service","Repair","Cleaning","Sensor clean","Firmware","Calibration","Inspection"].map(t=>`<option ${t===r.type?"selected":""}>${t}</option>`).join("")}</select></label>
      <label class="f">Status<select class="input" name="status"><option value="open" ${r.status==="open"?"selected":""}>Open</option><option value="done" ${r.status==="done"?"selected":""}>Done</option></select></label></div>
    <label class="f">Work done or problem<textarea class="input" name="description" rows="3">${esc(r.description)}</textarea></label>
    <div class="fg"><label class="f">Cost<input class="input" type="number" step="0.01" min="0" name="cost" value="${esc(r.cost)}"></label><label class="f">Done by<input class="input" name="vendor" value="${esc(r.vendor)}"></label></div>
    ${!id?`<label class="chk"><input type="checkbox" name="oos"><span>Take this item out of service until the record is done</span></label>`:""}</div>
    <div class="mf">${id&&isAdmin()?`<button type="button" class="btn danger" data-act="del-maint" data-id="${id}" data-confirm="Delete this record?">Delete</button><span style="flex:1"></span>`:""}<button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Save</button></div></form>`);}
function noteForm(title,hint,formKey,data){openModal(`${mh(esc(title))}<form data-form="${formKey}" ${Object.entries(data).map(([k,v])=>`data-${k}="${esc(v)}"`).join(" ")}><div class="mb"><div>${esc(hint)}</div>
  <label class="f">What happened<textarea class="input" name="note" rows="3" autofocus></textarea></label></div><div class="mf"><button type="button" class="btn" data-act="close-modal">Cancel</button><button class="btn primary">Save</button></div></form>`);}

/* import */
function importModal(){const I=M.imp;
  if(I.step==="done"){openModal(`${mh("Import finished")}<div class="mb">${esc(I.msg)}</div><div class="mf"><button class="btn" data-act="import">Import another file</button><a class="btn primary" href="#gear" data-act="close-modal">See gear</a></div>`);return;}
  const P=I.plan;const s=P&&!P.fatal?CSV.summary(P):null;
  const res=e=>e.action==="new"?chip("New"+(e.tags.length>1?" × "+e.tags.length:""),"ok"):e.action==="update"?chip("Update","acc"):e.action==="skip"?chip("Skip"):chip("Error","bad");
  openModal(`${mh("Import gear from a spreadsheet")}<div class="mb">
    <div class="stack" style="gap:6px"><div><b>1.</b> Download the template and fill it in, one row per item. <button class="btn small" data-act="dl-template">Download template</button></div>
      <div class="small muted">Mark cases with <b>Is case: Yes</b>. Put a case's tag in <b>Home case</b> for gear that lives in it. <b>Quantity</b> makes identical units with their own tags. Leave <b>Tag</b> blank to number automatically.</div>
      <div><b>2.</b> Save as CSV and choose the file.</div></div>
    <label class="panel pad" style="display:grid;gap:4px;justify-items:center;border-style:dashed;cursor:pointer;text-align:center"><b>${I.fileName?esc(I.fileName):"Choose a CSV file"}</b><span class="small muted">Tap to pick a file</span>
      <input type="file" id="imp-file" accept=".csv,text/csv,.txt" style="position:absolute;opacity:0;width:1px;height:1px"></label>
    <div class="fg"><label class="chk"><input type="checkbox" id="imp-update" ${I.opts.update?"checked":""}><span>Update items whose tag already exists</span></label>
      <label class="f">A date like 03/04/2025 means<select class="input" id="imp-dates"><option value="d" ${I.opts.dayFirst?"selected":""}>3 April</option><option value="m" ${!I.opts.dayFirst?"selected":""}>March 4</option></select></label></div>
    ${I.error?`<div style="color:var(--bad)">${esc(I.error)}</div>`:""}${P&&P.fatal?`<div style="color:var(--bad)">${esc(P.fatal)}</div>`:""}
    ${s?`<div style="display:flex;gap:6px;flex-wrap:wrap">${chip(s.units+" new","ok")}${chip(s.updates+" updates","acc")}${s.skips?chip(s.skips+" skipped"):""}${s.errors?chip(s.errors+" with errors","bad"):""}</div>
      <div class="panel tablewrap" style="max-height:300px;overflow:auto"><table><thead><tr><th>Row</th><th>Tag</th><th>Name</th><th>Result</th><th>Notes</th></tr></thead><tbody>
      ${P.entries.slice().sort((a,b)=>(b.action==="error")-(a.action==="error")||a.line-b.line).slice(0,300).map(e=>`<tr><td>${e.line}</td><td>${e.tags&&e.tags.length?`<span class="tag">${esc(e.tags[0])}</span>${e.tags.length>1?` <span class="small muted">to ${esc(e.tags[e.tags.length-1])}</span>`:""}`:esc(e.tag||"")}</td><td>${esc(e.raw.name||"")}</td><td>${res(e)}</td>
        <td class="small">${[...e.errors.map(x=>`<span style="color:var(--bad)">${esc(x)}</span>`),...e.warns.map(esc)].join("<br>")}</td></tr>`).join("")}</tbody></table></div>`:""}</div>
    <div class="mf"><button type="button" class="btn" data-act="close-modal">Cancel</button>${s?`<button class="btn primary" data-act="imp-run" ${s.units+s.updates?"":"disabled"}>Import ${s.units+s.updates}</button>`:""}</div>`);}

/* ---------- scanner overlay ---------- */
let scanCtx=null;
function contextScan(){
  if(UI.v==="job"){const j=S.jobs.get(UI.id);if(j&&canWrite()){const m=modeFor(j);
    if(m==="pull")return{title:"Pull: "+j.name,fn:c=>{const r=G.pullScan(j,c);return r;}};
    if(m==="wrap")return{title:"Wrap: "+j.name,fn:c=>{const r=G.wrapScan(j,c,UI.wrapCase[j.id]);if(r.setCase){UI.wrapCase[j.id]=r.setCase;LSx.set("gc-wrapcase",UI.wrapCase);}return r;}};
    if(m==="studio")return{title:"Check in: "+j.name,fn:c=>G.studioScan(j,c)};}}
  return{title:"Find gear",fn:c=>{const f=G.findCode(c);if(!f)return{ok:false,msg:`No gear matches "${G.cleanCode(c)}"`};
    if(f.type==="kit")return{ok:true,msg:"Kit: "+f.obj.name,kind:"ok",close:()=>go("kits")};
    const w=G.whereIs(f.obj);return{ok:true,kind:"ok",msg:`${f.obj.tag} ${f.obj.name}: ${w.text}`,close:()=>go("item-"+f.obj.id)};}};}
function handleCode(code,fromCamera){
  const ctx=scanCtx||contextScan();const r=ctx.fn(code)||{};
  window.GCScan.beep(r.ok&&r.kind!=="bad");
  if(fromCamera){const m=$("#scan-msg");if(m){m.className="msg "+(r.ok?(r.kind==="bad"?"bad":"ok"):"bad");m.textContent=r.msg+(r.warn?". "+r.warn:"");}
    if(r.close){stopScanner();r.close();}}
  else{toast(r.msg,r.ok?(r.kind==="bad"?"bad":r.kind==="info"?"":"ok"):"bad");if(r.warn)toast(r.warn,"bad");if(r.close)r.close();}
  if(r.needCase&&!fromCamera)toast("Tip: scan a case first","");
}
async function openScanner(){scanCtx=contextScan();const el=$("#scanner");
  el.innerHTML=`<div class="sh"><div class="grow">${esc(scanCtx.title)}</div><button class="btn small" data-act="scan-close">Done</button></div>
    <div class="vf"><video id="scan-video" playsinline muted></video><div class="reticle"></div></div>
    <div class="sf"><div class="msg" id="scan-msg">Point the camera at a QR label.</div>
      <form class="scanbar" data-form="scan-manual" autocomplete="off"><input class="input" id="scan-manual" placeholder="Or type a tag" enterkeyhint="go"><button class="btn primary">Go</button></form></div>`;
  el.hidden=false;
  try{await window.GCScan.start($("#scan-video"),code=>handleCode(code,true));}
  catch(e){$("#scan-msg").className="msg bad";$("#scan-msg").textContent=(e&&e.name==="NotAllowedError")?"Camera access is blocked. Allow the camera for this site in your browser settings, or type the tag below.":(e.message||"The camera isn't available. Type the tag below.");}}
function stopScanner(){window.GCScan.stop();$("#scanner").hidden=true;$("#scanner").innerHTML="";scanCtx=null;render();}

/* ---------- actions ---------- */
async function removeExamples(){["job_lines","jobs","maintenance","kits"].forEach(t=>[...S[t].values()].filter(x=>x.example||(t==="job_lines"&&S.jobs.get(x.job_id)&&S.jobs.get(x.job_id).example)).forEach(x=>St.remove(t,x.id)));
  G.items().filter(i=>i.example).sort((a,b)=>(a.is_case?1:0)-(b.is_case?1:0)).forEach(i=>St.remove("items",i.id));toast("Example data removed","ok");}
function download(name,text){const blob=new Blob([text],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function lineById(id){return S.job_lines.get(id);}
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act,id=t.dataset.id;
  if(t.dataset.confirm&&!t.classList.contains("armed")){e.preventDefault();const txt=t.textContent;t.classList.add("armed");t.textContent=t.dataset.confirm+" Tap again";setTimeout(()=>{if(t.isConnected){t.classList.remove("armed");t.textContent=txt;}},4000);return;}
  const job=UI.v==="job"?S.jobs.get(UI.id):null;
  switch(a){
    case"signin-ms":St.signInMicrosoft();return;
    case"signout":St.signOut();return;
    case"recheck":location.reload();return;
    case"sync":St.refresh();toast("Syncing…");return;
    case"scan":openScanner();return;
    case"scan-close":stopScanner();return;
    case"close-modal":closeModal();return;
    case"open-job":go("job-"+id);return;
    case"item":closeModal();go("item-"+id);return;
    case"jobfilter":UI.jobFilter=t.dataset.v;break;
    case"new-job":jobForm();return;
    case"edit-job":jobForm(id);return;
    case"cancel-job":{St.patch("jobs",id,{status:"cancelled"});G.linesOf(id).forEach(l=>{if(["planned","pulled","left"].includes(l.state))St.remove("job_lines",l.id);});closeModal();toast("Job cancelled");break;}
    case"job-kit":{const k=S.kits.get(id);if(!k||!job)break;if((job.kit_ids||[]).includes(id)){G.removeKit(job,k);toast(k.name+" removed");}else{const n=G.addKit(job,k);toast(`${k.name}: ${n} items added`,"ok");}break;}
    case"pick-code":{const inp=t.dataset.for;UI.inputs[inp]="";handleCode(t.dataset.code,false);break;}
    case"pull-tick":{const l=lineById(id);if(!l)break;St.patch("job_lines",id,{state:l.state==="pulled"?"planned":"pulled"});if(l.state!=="pulled")St.log("pulled",{item_id:l.item_id,job_id:l.job_id});break;}
    case"leave":{const l=lineById(id);if(l)St.patch("job_lines",id,{state:"left",reason:job&&G.issueFor(job,G.item(l.item_id))?"Unavailable":G.LEAVE_REASONS[0]});break;}
    case"unleave":St.patch("job_lines",id,{state:"planned",reason:""});break;
    case"rm-line":{const l=lineById(id);if(l)G.removeLine(l);break;}
    case"confirm-out":{if(job&&G.confirmOut(job)){toast(`${job.name} checked out`,"ok");}break;}
    case"wrap-case":{UI.wrapCase[t.dataset.jid]=id;LSx.set("gc-wrapcase",UI.wrapCase);const j=S.jobs.get(t.dataset.jid);if(j)G.wrapScan(j,G.item(id).tag,null);toast("Packing into "+G.item(id).tag,"ok");break;}
    case"wrap-case-clear":delete UI.wrapCase[id];LSx.set("gc-wrapcase",UI.wrapCase);break;
    case"wrap-mark":{const l=lineById(id);if(!l||!job)break;const s=t.dataset.s;if(s==="damaged"){noteForm("What's damaged?","It stays on the job and comes back to the studio. A repair record opens at check-in.","wrap-dmg",{id});return;}G.wrapMark(job,l,s);break;}
    case"finish-wrap":if(job){G.finishWrap(job);toast("Wrap finished. Check it in at the studio.","ok");}break;
    case"skip-wrap":UI.jobMode[id]="studio";break;
    case"studio-back":{const l=lineById(id);if(!l||!job)break;if(l.back_at)G.undoCheckIn(job,l);else G.checkInLine(job,l,l.state==="damaged"?"damaged":"returned",l.note);break;}
    case"studio-undo":{const l=lineById(id);if(l&&job)G.undoCheckIn(job,l);break;}
    case"studio-dmg":noteForm("What's damaged?","It goes out of service and a repair record opens in Maintenance.","studio-dmg",{id});return;
    case"studio-miss":{const l=lineById(id);if(l&&job)G.checkInLine(job,l,"missing");break;}
    case"close-job":if(job&&G.closeJob(job)){const miss=G.linesOf(job.id).filter(l=>l.state==="missing");toast(miss.length?`Closed. ${miss.length} missing, ${money(G.sum(miss,l=>G.repl(G.item(l.item_id))))} to replace.`:"Closed. Everything came back.",miss.length?"bad":"ok");}break;
    case"add-item":itemForm();return;
    case"edit-item":itemForm(id);return;
    case"dup-item":{const s=G.item(id);const b=Object.assign({},s);["id","tag","serial","example","created_at","updated_at","in_case_id","status"].forEach(k=>delete b[k]);b.tag=G.nextTag(s.category);itemForm(null,b);return;}
    case"del-item":{St.remove("items",id);[...S.kits.values()].filter(k=>(k.item_ids||[]).includes(id)).forEach(k=>St.patch("kits",k.id,{item_ids:k.item_ids.filter(x=>x!==id)}));go("gear");toast("Deleted");return;}
    case"print-one":{const i=G.item(id);if(i){UI.labelSel=new Set([id]);if(i.is_case)UI.labelLayout="case";go("labels");}return;}
    case"add-kit":kitForm();return;
    case"edit-kit":kitForm(id);return;
    case"del-kit":St.remove("kits",id);closeModal();toast("Kit deleted");break;
    case"pick-add":M.picker.ids.push(id);M.picker.q="";rerenderPicker();return;
    case"pick-rm":M.picker.ids=M.picker.ids.filter(x=>x!==id);rerenderPicker();return;
    case"add-maint":closeModal();maintForm(null,t.dataset.item,t.dataset.type);return;
    case"edit-maint":if(e.target.closest("[data-act='done-maint']"))return;maintForm(id);return;
    case"done-maint":{e.stopPropagation();const r=S.maintenance.get(id);if(r){const back=G.finishMaint(r);toast(back?"Done. Back in stock.":"Marked done","ok");}break;}
    case"del-maint":St.remove("maintenance",id);closeModal();break;
    case"mfilter":UI.mFilter=t.dataset.v;break;
    case"export":download(`gear-${G.today()}.csv`,CSV.toCSV(CSV.exportRows()));return;
    case"dl-template":download("gear-import-template.csv",CSV.toCSV(CSV.templateRows()));return;
    case"import":M.imp={opts:{update:true,dayFirst:true}};importModal();return;
    case"imp-run":{const jobs=CSV.run(M.imp.plan);jobs.forEach(f=>f());const s=CSV.summary(M.imp.plan);M.imp.step="done";M.imp.msg=`Added ${s.units}, updated ${s.updates}${s.errors?`, ${s.errors} rows with errors left out`:""}. ${S.mode==="live"?"They sync to the server in the background.":""}`;importModal();break;}
    case"label-all":labelPool().forEach(i=>UI.labelSel.add(i.id));break;
    case"label-none":UI.labelSel.clear();break;
    case"print-labels":printLabels(G.items().filter(i=>UI.labelSel.has(i.id)).sort(G.byTag));return;
    case"clear-failed":S.failed=[];LSx.set("gc-failed",[]);break;
    case"rm-examples":removeExamples();break;
    case"reset-demo":try{localStorage.removeItem("gc-demo-data");}catch(e){}location.reload();return;
    case"ack":return;
  }
  render();
});
document.addEventListener("click",e=>{if(e.target.id==="modal")closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!$("#scanner").hidden)stopScanner();else if(!$("#modal").hidden)closeModal();}});
document.addEventListener("input",e=>{const t=e.target;
  if(t.id==="pick-q"){M.picker.q=t.value;rerenderPicker();return;}
  if(t.id==="label-skip"){UI.labelSkip=Math.max(0,parseInt(t.value,10)||0);fillPreviewSoon();return;}
  if(t.hasAttribute("data-keep")){UI.inputs[t.id]=t.value;render();}});
let pv=0;function fillPreviewSoon(){clearTimeout(pv);pv=setTimeout(fillPreview,150);}
document.addEventListener("change",e=>{const t=e.target;
  if(t.dataset.ui){UI[t.dataset.ui]=t.value;if(t.dataset.ui==="labelLayout")LSx.set("gc-label-layout",t.value);render();return;}
  if(t.dataset.act==="ack"){UI.ack[t.dataset.id]=t.checked;render();return;}
  if(t.dataset.label){if(t.checked)UI.labelSel.add(t.dataset.label);else UI.labelSel.delete(t.dataset.label);render();return;}
  if(t.dataset.swap&&t.value){const l=lineById(t.dataset.swap);const n=G.item(t.value);if(l&&n){const old=G.item(l.item_id);St.patch("job_lines",l.id,{item_id:n.id,state:"planned"});toast(`Swapped ${old.tag} for ${n.tag}`,"ok");}return;}
  if(t.dataset.reason){St.patch("job_lines",t.dataset.reason,{reason:t.value});return;}
  if(t.dataset.role){St.setRole(t.dataset.role,t.value).then(r=>toast(r.ok?"Access updated":"Couldn't change access: "+r.message,r.ok?"ok":"bad"));return;}
  if(t.id==="f-cat"&&M.kind==="item"&&!M.id){const tg=$("#f-tag");if(tg)tg.value=G.nextTag(t.value);const cs=document.querySelector("[name=is_case]");if(cs&&t.value==="Case")cs.checked=true;return;}
  if(t.id==="imp-file"&&t.files&&t.files[0]){const file=t.files[0];const I=M.imp;
    if(/\.(xlsx|xls|numbers)$/i.test(file.name)){I.error="That's a spreadsheet file. Save it as CSV first.";I.fileName=file.name;importModal();return;}
    const r=new FileReader();r.onload=()=>{I.fileName=file.name;I.error="";I.rows=CSV.parseCSV(r.result);I.plan=CSV.plan(I.rows,I.opts);importModal();};r.readAsText(file);return;}
  if(t.id==="imp-update"&&M.imp){M.imp.opts.update=t.checked;if(M.imp.rows)M.imp.plan=CSV.plan(M.imp.rows,M.imp.opts);importModal();return;}
  if(t.id==="imp-dates"&&M.imp){M.imp.opts.dayFirst=t.value==="d";if(M.imp.rows)M.imp.plan=CSV.plan(M.imp.rows,M.imp.opts);importModal();return;}
});
document.addEventListener("submit",e=>{const f=e.target;const k=f.dataset.form;if(!k)return;e.preventDefault();const fd=new FormData(f);const g=n=>String(fd.get(n)??"").trim();
  if(k==="scan"){const id=f.dataset.for;const v=($("#"+id).value||"").trim();UI.inputs[id]="";if(v)handleCode(v,false);render();const el=$("#"+id);if(el)el.focus();return;}
  if(k==="scan-manual"){const v=($("#scan-manual").value||"").trim();$("#scan-manual").value="";if(v)handleCode(v,true);return;}
  if(k==="email-signin"){St.signInEmail(g("email")).then(r=>toast(r.ok?"Check your email for the sign-in link":"Couldn't send the link: "+r.message,r.ok?"ok":"bad"));return;}
  if(k==="job"){if(!g("name")){$("#f-err").textContent="Name the job.";return;}
    const d={name:g("name"),starts_on:g("starts_on")||null,due_on:g("due_on")||g("starts_on")||null,responsible_id:g("responsible_id")||null,notes:g("notes")};
    if(M.id){St.patch("jobs",M.id,d);closeModal();toast("Saved","ok");}
    else{const j=St.insert("jobs",Object.assign({status:"booked",kit_ids:[],created_by:S.me&&S.me.id},d));closeModal();go("job-"+j.id);return;}
  }
  if(k==="item")submitItem(f);
  if(k==="kit"){if(!g("name")){$("#f-err").textContent="Name the kit.";return;}const d={name:g("name"),tag:g("tag").toUpperCase()||null,description:g("description"),item_ids:M.picker.ids.slice()};
    if(d.tag&&[...S.kits.values()].some(x=>x.id!==M.id&&x.tag===d.tag)){$("#f-err").textContent=`Tag ${d.tag} is already used.`;return;}
    if(M.id)St.patch("kits",M.id,d);else St.insert("kits",d);closeModal();toast("Kit saved","ok");}
  if(k==="maint"){if(!g("item_id"))return;const d={item_id:g("item_id"),date:g("date")||G.today(),type:g("type"),status:g("status"),description:g("description"),cost:g("cost")===""?null:Number(g("cost")),vendor:g("vendor")};
    if(M.id){const old=S.maintenance.get(M.id);St.patch("maintenance",M.id,d);if(old.status==="open"&&d.status==="done")G.finishMaint(Object.assign({},old,d));}
    else{const r=St.insert("maintenance",Object.assign({},d,{status:"open"}));if(d.status==="done")G.finishMaint(r);else if(fd.get("oos")==="on"){const it=G.item(d.item_id);if(it&&it.status==="available")St.patch("items",it.id,{status:"maintenance"});}}
    closeModal();toast("Saved","ok");}
  if(k==="wrap-dmg"){const l=lineById(f.dataset.id);const j=l&&S.jobs.get(l.job_id);if(l&&j)G.wrapMark(j,l,"damaged",g("note"));closeModal();toast("Marked damaged","bad");}
  if(k==="studio-dmg"){const l=lineById(f.dataset.id);const j=l&&S.jobs.get(l.job_id);if(l&&j)G.checkInLine(j,l,"damaged",g("note"));closeModal();toast("Repair record opened","bad");}
  if(k==="me"){St.renameMe(g("name"));toast("Saved","ok");}
  if(k==="studio"){St.saveSettings({studio:g("studio"),currency:g("currency")}).then(r=>toast(r.ok?"Saved":"Couldn't save: "+r.message,r.ok?"ok":"bad"));}
  if(k==="access"){St.saveSettings({allowed_domain:g("allowed_domain").replace(/^@/,"").toLowerCase()}).then(r=>toast(r.ok?"Saved":"Couldn't save: "+r.message,r.ok?"ok":"bad"));}
  render();
});
St.setSignOutGuard(()=>{toast("Some changes haven't synced yet. Connect to the internet and wait for them to sync before signing out.","bad");return false;});
window.addEventListener("afterprint",()=>{$("#print-area").innerHTML="";});
/* label preview needs layout after the page is drawn */
St.on(()=>{if(UI.v==="labels")fillPreviewSoon();});
window.addEventListener("hashchange",()=>{if(UI.v==="labels")fillPreviewSoon();});
document.addEventListener("change",e=>{if(UI.v==="labels")fillPreviewSoon();});
document.addEventListener("click",e=>{if(UI.v==="labels")fillPreviewSoon();});

route();
St.boot();
})();
