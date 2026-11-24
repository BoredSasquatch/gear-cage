/* Gear Cage rules: locations, bookings, and the job steps (plan, pull, wrap on set, studio check-in).
   Screens call these; these call the store. Nothing here touches the page. */
(function(){
"use strict";
const St=window.GCStore, S=St.S;

const CATS=[["Camera","CAM"],["Lens","LNS"],["Monitor","MON"],["Wireless video","WVD"],["Power","PWR"],["Media","MED"],["Cable","CBL"],["Follow focus","FIZ"],["Support","SUP"],["Grip","GRP"],["Filter","FLT"],["Audio","AUD"],["Lighting","LGT"],["Case","CSE"],["Accessory","ACC"]];
const PREFIX=Object.fromEntries(CATS);
const STATUS={available:["In studio","ok"],out:["Out","acc"],maintenance:["In repair","warn"],lost:["Missing","bad"],retired:["Retired",""]};
const JOB_STATUS={booked:["Booked",""],out:["Out on shoot","acc"],wrapped:["Wrapped, coming back","warn"],closed:["Closed","ok"],cancelled:["Cancelled",""]};
const LEAVE_REASONS=["Not needed on this job","Unavailable","Packed separately","Client supplying"];

/* ---------- small helpers ---------- */
const num=v=>(v===null||v===undefined||v===""||isNaN(Number(v)))?0:Number(v);
/* Money: each item stores prices in the currency paid (LKR or USD). Totals are shown in the display currency
   (settings.currency), converted with settings.usd_rate (rupees per US dollar). */
const dispCur=()=>S.settings.currency==="USD"?"USD":"LKR";
const rate=()=>num(S.settings.usd_rate);
function needsRate(){const d=dispCur();return !rate()&&(items().some(i=>(i.cost_currency||"LKR")!==d&&(num(i.purchase_cost)||num(i.replacement_cost)))||[...S.maintenance.values()].some(r=>(r.cost_currency||"LKR")!==d&&num(r.cost)));}
function toDisp(v,cur){v=num(v);if(!v)return 0;const d=dispCur();cur=cur==="USD"?"USD":"LKR";if(cur===d)return v;const r=rate();if(!r)return 0;
  return cur==="USD"?v*r:v/r;}
const repl=i=>i?toDisp(i.replacement_cost!=null&&i.replacement_cost!==""?i.replacement_cost:i.purchase_cost,i.cost_currency):0;
const buy=i=>i?toDisp(i.purchase_cost,i.cost_currency):0;
const mcost=r=>r?toDisp(r.cost,r.cost_currency):0;
const sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>iso(new Date());
const parseD=s=>{if(!s)return null;const p=String(s).slice(0,10).split("-").map(Number);return new Date(p[0],p[1]-1,p[2]);};
const diffDays=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);
const addDays=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return iso(d);};
const byTag=(a,b)=>String(a.tag||"").localeCompare(String(b.tag||""),undefined,{numeric:true});
const items=()=>[...S.items.values()];
const item=id=>S.items.get(id);
const person=id=>S.profiles.get(id);
const personName=id=>{const p=person(id);return p?(p.name||p.email||"Crew member"):"";};
const me=()=>S.me&&S.me.id;
const linesOf=jobId=>[...S.job_lines.values()].filter(l=>l.job_id===jobId);
const caseContents=caseId=>items().filter(i=>i.home_case_id===caseId&&i.status!=="retired").sort(byTag);
const packedIn=caseId=>items().filter(i=>i.in_case_id===caseId).sort(byTag);
const activeJobs=()=>[...S.jobs.values()].filter(j=>j.status==="booked"||j.status==="out"||j.status==="wrapped");
function lineFor(jobId,itemId){for(const l of S.job_lines.values())if(l.job_id===jobId&&l.item_id===itemId)return l;return null;}
function jobHolding(itemId){ // the job that physically has this item right now
  for(const l of S.job_lines.values()){
    if(l.item_id!==itemId)continue;const j=S.jobs.get(l.job_id);if(!j)continue;
    if((j.status==="out"||j.status==="wrapped")&&["out","packed","loose","damaged"].includes(l.state)&&!l.back_at)return j;
  }return null;}

/* ---------- codes and lookup ---------- */
function cleanCode(c){return String(c||"").trim().replace(/^GC:/i,"").trim().toUpperCase();}
function findCode(code){const c=cleanCode(code);if(!c)return null;
  for(const i of S.items.values())if(String(i.tag||"").toUpperCase()===c||(i.serial&&String(i.serial).toUpperCase()===c))return{type:"item",obj:i};
  for(const k of S.kits.values())if(String(k.tag||"").toUpperCase()===c)return{type:"kit",obj:k};
  return null;}
function searchItems(q,limit){const toks=String(q||"").toLowerCase().split(/\s+/).filter(Boolean);if(!toks.length)return[];
  return items().filter(i=>{const hay=[i.tag,i.name,i.brand,i.model,i.serial,i.category].join(" ").toLowerCase();return toks.every(t=>hay.includes(t));}).sort(byTag).slice(0,limit||8);}
function nextTag(cat,extra){const p=PREFIX[cat]||"ACC";let max=0;items().forEach(i=>{const m=String(i.tag||"").match(new RegExp("^"+p+"-(\\d+)$"));if(m)max=Math.max(max,+m[1]);});return p+"-"+String(max+1+(extra||0)).padStart(4,"0");}
function nextKitTag(){let max=0;[...S.kits.values()].forEach(k=>{const m=String(k.tag||"").match(/^KIT-(\d+)$/);if(m)max=Math.max(max,+m[1]);});return"KIT-"+String(max+1).padStart(3,"0");}

/* ---------- where is it ---------- */
function whereIs(i){
  if(!i)return{text:"Unknown",kind:""};
  const j=jobHolding(i.id);const c=i.in_case_id&&item(i.in_case_id);
  if(j){const l=lineFor(j.id,i.id);const who=personName(j.responsible_id);
    const inCase=l&&l.packed_case_id&&item(l.packed_case_id);
    return{text:(inCase?`Packed in ${inCase.tag} ${inCase.name}, `:"")+`on ${j.name}`+(who?` (${who})`:""),kind:"acc",job:j};}
  if(i.status==="lost")return{text:"Missing",kind:"bad"};
  if(i.status==="maintenance")return{text:"In repair",kind:"warn"};
  if(i.status==="retired")return{text:"Retired",kind:""};
  if(c)return{text:`In ${c.tag} ${c.name}`+(c.room?` · ${[c.room,c.shelf].filter(Boolean).join(" · ")}`:""),kind:"ok"};
  return{text:[i.room,i.shelf].filter(Boolean).join(" · ")||"In studio, no shelf set",kind:"ok"};
}

/* ---------- bookings and clashes ---------- */
function range(j){const s=j.starts_on||today();const e=j.due_on||s;return[s,e<s?s:e];}
function overlaps(a,b){const[as,ae]=range(a),[bs,be]=range(b);return as<=be&&bs<=ae;}
function clashesFor(job,itemId){
  return activeJobs().filter(o=>o.id!==job.id&&overlaps(job,o)&&linesOf(o.id).some(l=>l.item_id===itemId&&l.state!=="left"&&!l.back_at));}
function issueFor(job,i){ // why this item can't go out on this job right now
  if(!i)return"Deleted from inventory";
  const holder=jobHolding(i.id);if(holder&&holder.id!==job.id)return`Out on ${holder.name}`;
  if(i.status==="maintenance")return"In repair";if(i.status==="lost")return"Missing";if(i.status==="retired")return"Retired";
  return null;}

/* ---------- planning ---------- */
function addLine(job,itemId,opts,seen){opts=opts||{};seen=seen||new Set();if(seen.has(itemId))return 0;seen.add(itemId);
  const it=item(itemId);if(!it)return 0;let n=0;
  if(!lineFor(job.id,itemId)){St.insert("job_lines",{job_id:job.id,item_id:itemId,kit_id:opts.kitId||null,via:opts.via||"added",parent_id:opts.parentId||null,state:opts.state||"planned"});n++;}
  (it.companions||[]).forEach(cid=>{n+=addLine(job,cid,{kitId:opts.kitId,via:"companion",parentId:itemId,state:opts.childState},seen);});
  if(it.is_case)caseContents(it.id).forEach(c=>{n+=addLine(job,c.id,{kitId:opts.kitId,via:"case",parentId:it.id,state:opts.childState},seen);});
  return n;}
function addKit(job,k){const ids=new Set(job.kit_ids||[]);ids.add(k.id);St.patch("jobs",job.id,{kit_ids:[...ids]});
  let n=0;const seen=new Set();(k.item_ids||[]).forEach(id=>{n+=addLine(job,id,{kitId:k.id,via:"kit"},seen);});return n;}
function removeKit(job,k){St.patch("jobs",job.id,{kit_ids:(job.kit_ids||[]).filter(x=>x!==k.id)});
  linesOf(job.id).filter(l=>l.kit_id===k.id&&["planned","pulled","left"].includes(l.state)).forEach(l=>St.remove("job_lines",l.id));}
function removeLine(l){const kids=linesOf(l.job_id).filter(x=>x.parent_id===l.item_id&&!x.kit_id&&["planned","pulled","left"].includes(x.state));
  kids.forEach(x=>St.remove("job_lines",x.id));St.remove("job_lines",l.id);}

/* ---------- pull (check-out) ---------- */
function pullScan(job,code){ // returns {ok,msg,kind}
  const f=findCode(code);if(!f)return{ok:false,msg:`No gear matches "${cleanCode(code)}"`};
  if(f.type==="kit"){const n=addKit(job,f.obj);return{ok:true,msg:`${f.obj.name}: ${n} items added. Now scan each one as you pull it.`};}
  const i=f.obj;let l=lineFor(job.id,i.id);let added=0;
  if(!l){added=addLine(job,i.id,{via:"scan",state:"pulled"});l=lineFor(job.id,i.id);}
  else if(l.state!=="pulled"){St.patch("job_lines",l.id,{state:"pulled",reason:""});}
  else return{ok:true,msg:`${i.tag} already pulled`,kind:"info"};
  St.log("pulled",{item_id:i.id,job_id:job.id});
  const issue=issueFor(job,i);
  let msg=`Pulled ${i.tag} ${i.name}`+(added>1?`. ${added-1} item${added>2?"s":""} that go with it added`:"");
  if(i.is_case){const n=caseContents(i.id).length;if(n)msg+=`. Scan the ${n} item${n>1?"s":""} that live in this case too`;}
  return{ok:true,msg,kind:issue?"bad":"ok",warn:issue?`${i.tag}: ${issue}`:null};
}
function pullSummary(job){
  const ls=linesOf(job.id);const going=ls.filter(l=>l.state!=="left");
  const pulled=going.filter(l=>l.state==="pulled"||l.state==="out").length;
  const pending=going.filter(l=>l.state==="planned").length;
  const blocked=going.filter(l=>issueFor(job,item(l.item_id))).length;
  const critLeft=ls.filter(l=>l.state==="left"&&item(l.item_id)&&item(l.item_id).critical).length;
  return{ls,going,pulled,pending,blocked,critLeft,value:sum(going,l=>repl(item(l.item_id)))};
}
function confirmOut(job){
  const sm=pullSummary(job);if(!sm.going.length||sm.pending||sm.blocked)return false;
  const at=St.nowISO();
  sm.going.forEach(l=>{const i=item(l.item_id);if(!i)return;
    St.patch("job_lines",l.id,{state:"out",out_by:me(),out_at:at});
    const onJobCase=i.home_case_id&&sm.going.some(x=>x.item_id===i.home_case_id);
    St.patch("items",i.id,{status:"out",in_case_id:onJobCase?i.home_case_id:null});
    St.log("out",{item_id:i.id,job_id:job.id,case_id:onJobCase?i.home_case_id:null});});
  St.patch("jobs",job.id,{status:"out",out_at:at});
  return true;
}

/* ---------- wrap on set ---------- */
const OUTSTANDING_AT_WRAP=["out"];
function wrapScan(job,code,currentCaseId){ // returns {ok,msg,kind,setCase}
  const f=findCode(code);if(!f)return{ok:false,msg:`No gear matches "${cleanCode(code)}"`};
  if(f.type==="kit")return{ok:false,msg:"That's a kit label. Scan the case, then each item you put in it."};
  const i=f.obj;const l=lineFor(job.id,i.id);
  if(i.is_case){
    if(l&&l.state==="out"){St.patch("job_lines",l.id,{state:"loose",wrap_by:me(),wrap_at:St.nowISO(),packed_case_id:null});St.log("loose",{item_id:i.id,job_id:job.id});}
    const n=packedIn(i.id).filter(x=>{const xl=lineFor(job.id,x.id);return xl&&xl.state==="packed";}).length;
    return{ok:true,setCase:i.id,msg:`Packing into ${i.tag} ${i.name}${n?` (${n} already in it)`:""}. Scan each item as it goes in.`,kind:"ok"};}
  if(!l){const other=jobHolding(i.id);return{ok:false,msg:other?`${i.tag} belongs to ${other.name}`:`${i.tag} isn't on this job`};}
  if(!currentCaseId)return{ok:false,msg:"Scan the case you're packing into first, or mark this item as travelling loose.",needCase:true};
  const c=item(currentCaseId);
  St.patch("job_lines",l.id,{state:"packed",packed_case_id:currentCaseId,wrap_by:me(),wrap_at:St.nowISO()});
  St.patch("items",i.id,{in_case_id:currentCaseId});
  St.log("packed",{item_id:i.id,job_id:job.id,case_id:currentCaseId});
  const wrong=i.home_case_id&&i.home_case_id!==currentCaseId?item(i.home_case_id):null;
  return{ok:true,kind:wrong?"bad":"ok",msg:`${i.tag} ${i.name} packed in ${c?c.tag:"case"}`,warn:wrong?`${i.tag} normally lives in ${wrong.tag} ${wrong.name}`:null};
}
function wrapMark(job,l,state,note){ // loose, damaged, missing, or back to out (undo)
  const i=item(l.item_id);const patch={state,wrap_by:state==="out"?null:me(),wrap_at:state==="out"?null:St.nowISO(),note:note||""};
  if(state!=="packed")patch.packed_case_id=null;
  St.patch("job_lines",l.id,patch);if(i&&state!=="packed")St.patch("items",i.id,{in_case_id:null});
  if(state!=="out")St.log(state,{item_id:l.item_id,job_id:job.id,note:note||""});
}
function wrapSummary(job){const ls=linesOf(job.id);const left=ls.filter(l=>OUTSTANDING_AT_WRAP.includes(l.state));
  return{ls,left,packed:ls.filter(l=>l.state==="packed").length,loose:ls.filter(l=>l.state==="loose").length,damaged:ls.filter(l=>l.state==="damaged").length,missing:ls.filter(l=>l.state==="missing").length};}
function finishWrap(job){St.patch("jobs",job.id,{status:"wrapped",wrapped_at:St.nowISO()});}

/* ---------- studio check-in ---------- */
function studioScan(job,code){
  const f=findCode(code);if(!f)return{ok:false,msg:`No gear matches "${cleanCode(code)}"`};
  if(f.type==="kit")return{ok:false,msg:"That's a kit label. Scan the items one by one."};
  const i=f.obj;const l=lineFor(job.id,i.id);
  if(!l){const other=jobHolding(i.id);return{ok:false,msg:other?`${i.tag} belongs to ${other.name}`:`${i.tag} isn't on this job`};}
  if(l.back_at)return{ok:true,kind:"info",msg:`${i.tag} is already checked in`};
  checkInLine(job,l,l.state==="damaged"?"damaged":"returned",l.note);
  let msg=`Back in: ${i.tag} ${i.name}`;
  if(i.is_case){const inside=packedIn(i.id).filter(x=>{const xl=lineFor(job.id,x.id);return xl&&!xl.back_at;});if(inside.length)msg+=`. Now scan the ${inside.length} item${inside.length>1?"s":""} packed in it`;}
  return{ok:true,kind:l.state==="damaged"?"bad":"ok",msg:msg+(l.state==="damaged"?" (reported damaged at wrap)":"")};
}
function checkInLine(job,l,state,note){
  const i=item(l.item_id);const at=St.nowISO();
  const patch={state,back_by:me(),back_at:state==="missing"?null:at,note:note||l.note||""};
  if(state==="damaged"&&i&&!l.maint_id){const m=St.insert("maintenance",{item_id:i.id,date:today(),type:"Repair",description:note||l.note||("Came back damaged from "+job.name),status:"open",job_id:job.id});patch.maint_id=m.id;}
  St.patch("job_lines",l.id,patch);
  if(i){const status={returned:"available",damaged:"maintenance",missing:"lost"}[state];
    St.patch("items",i.id,{status,in_case_id:state==="missing"?null:(i.home_case_id||null)});
    St.log(state==="returned"?"returned":state,{item_id:i.id,job_id:job.id,note:note||""});}
}
function undoCheckIn(job,l){const i=item(l.item_id);
  if(l.maint_id)St.remove("maintenance",l.maint_id);
  St.patch("job_lines",l.id,{state:l.wrap_at?(l.packed_case_id?"packed":"loose"):"out",back_by:null,back_at:null,maint_id:null});
  if(i)St.patch("items",i.id,{status:"out",in_case_id:l.packed_case_id||null});}
function studioSummary(job){const ls=linesOf(job.id).filter(l=>l.state!=="left");
  const done=ls.filter(l=>l.back_at||(l.state==="missing"&&l.back_by));
  return{ls,done,left:ls.filter(l=>!done.includes(l)),missing:ls.filter(l=>l.state==="missing"),damaged:ls.filter(l=>l.state==="damaged")};}
function closeJob(job){const sm=studioSummary(job);if(sm.left.length)return false;St.patch("jobs",job.id,{status:"closed",closed_at:St.nowISO()});return true;}

/* ---------- maintenance ---------- */
const SERVICE_TYPES=["Service","Cleaning","Sensor clean","Calibration","Inspection","Firmware"];
function finishMaint(r){St.patch("maintenance",r.id,{status:"done",completed_at:today()});
  const it=item(r.item_id);if(!it)return null;const upd={};
  if(SERVICE_TYPES.includes(r.type))upd.last_serviced=r.date||today();
  const others=[...S.maintenance.values()].some(x=>x.id!==r.id&&x.item_id===it.id&&x.status==="open");
  if(it.status==="maintenance"&&!others)upd.status="available";
  if(Object.keys(upd).length)St.patch("items",it.id,upd);return upd.status==="available";}
function serviceDue(){const r=[];items().forEach(i=>{if(!num(i.service_days)||i.status==="lost"||i.status==="retired")return;
  const last=i.last_serviced||i.purchase_date;const due=last?addDays(last,num(i.service_days)):today();const left=diffDays(today(),due);
  if(left<=14)r.push({item:i,due,left});});return r.sort((a,b)=>a.left-b.left);}

window.GC={CATS,PREFIX,STATUS,JOB_STATUS,LEAVE_REASONS,SERVICE_TYPES,num,repl,buy,mcost,toDisp,dispCur,rate,needsRate,sum,iso,today,parseD,diffDays,addDays,byTag,items,item,person,personName,
  linesOf,lineFor,caseContents,packedIn,activeJobs,jobHolding,cleanCode,findCode,searchItems,nextTag,nextKitTag,whereIs,clashesFor,issueFor,overlaps,
  addLine,addKit,removeKit,removeLine,pullScan,pullSummary,confirmOut,wrapScan,wrapMark,wrapSummary,finishWrap,studioScan,checkInLine,undoCheckIn,studioSummary,closeJob,
  finishMaint,serviceDue};
})();
