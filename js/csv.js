/* CSV template, export and import. One column layout for all three, so an export can be edited and imported back. */
(function(){
"use strict";
const G=window.GC, St=window.GCStore, S=St.S;
const COLS=[["Tag","tag"],["Name","name"],["Brand","brand"],["Model","model"],["Category","category"],["Quantity","qty"],["Serial","serial"],["Room","room"],["Shelf","shelf"],
  ["Is case","is_case"],["Home case","home_case"],["Status","status"],["Critical","critical"],["Purchase date","purchase_date"],["Purchase cost","purchase_cost"],["Replacement cost","replacement_cost"],
  ["Supplier","supplier"],["Service every (days)","service_days"],["Last serviced","last_serviced"],["Always goes out with","companions"],["Notes","notes"]];
const ALIASES={assettag:"tag",tag:"tag",barcode:"tag",qr:"tag",name:"name",item:"name",itemname:"name",description:"name",brand:"brand",make:"brand",manufacturer:"brand",model:"model",category:"category",type:"category",
  quantity:"qty",qty:"qty",units:"qty",count:"qty",serial:"serial",serialnumber:"serial",sn:"serial",room:"room",location:"room",shelf:"shelf",shelforcase:"shelf",bin:"shelf",
  iscase:"is_case",case:"is_case",container:"is_case",homecase:"home_case",livesin:"home_case",storedin:"home_case",packedin:"home_case",
  status:"status",critical:"critical",purchasedate:"purchase_date",purchased:"purchase_date",datepurchased:"purchase_date",purchasecost:"purchase_cost",purchaseprice:"purchase_cost",cost:"purchase_cost",price:"purchase_cost",paid:"purchase_cost",
  replacementcost:"replacement_cost",replacementvalue:"replacement_cost",replacement:"replacement_cost",supplier:"supplier",vendor:"supplier",serviceeverydays:"service_days",serviceevery:"service_days",serviceinterval:"service_days",servicedays:"service_days",
  lastserviced:"last_serviced",lastservice:"last_serviced",alwaysgoesoutwith:"companions",goeswith:"companions",companions:"companions",accessories:"companions",notes:"notes",note:"notes",comments:"notes"};
const STATUS_WORDS={instudio:"available",available:"available",instock:"available",ok:"available",inrepair:"maintenance",repair:"maintenance",maintenance:"maintenance",missing:"lost",lost:"lost",stolen:"lost",retired:"retired",sold:"retired",out:"out"};
const cell=v=>{v=v==null?"":String(v);return/[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
const toCSV=rows=>"﻿"+rows.map(r=>r.map(cell).join(",")).join("\r\n");
const normH=h=>String(h||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const yes=v=>/^(y|yes|true|1|x|critical|case)$/i.test(String(v||"").trim());

function exportRows(){const tagOf=id=>{const x=G.item(id);return x?x.tag:"";};
  return [COLS.map(c=>c[0]),...G.items().sort(G.byTag).map(i=>COLS.map(([,k])=>k==="qty"?"":k==="status"?(G.STATUS[i.status]||G.STATUS.available)[0]:k==="critical"?(i.critical?"Yes":"No"):
    k==="is_case"?(i.is_case?"Yes":"No"):k==="home_case"?tagOf(i.home_case_id):k==="companions"?(i.companions||[]).map(tagOf).filter(Boolean).join("; "):i[k]??""))];}
function templateRows(){return [COLS.map(c=>c[0]),
  ["CSE-0001","EXAMPLE: Pelican 1610 A-cam case","Pelican","1610","Case","1","","Cage A","Floor","Yes","","In studio","No","2024-03-12","389","419","","","","","Cases get their own QR label"],
  ["","EXAMPLE: Sony FX6 body","Sony","ILME-FX6","Camera","1","EX5012345","Cage A","Shelf 1","No","CSE-0001","In studio","No","2024-03-12","5999","6299","B&H","365","2025-10-02","","Home case CSE-0001: lives in that Pelican"],
  ["","EXAMPLE: SDI cable 3 ft","","","Cable","4","","Cage B","Cable drawer","No","","","Yes","2025-01-09","22","26","","","","","Quantity 4 makes four tagged cables. Delete the EXAMPLE rows before you import"]];}

function parseCSV(t){t=String(t).replace(/^﻿/,"");const first=t.split(/\r?\n/,1)[0]||"";const cnt=c=>first.split(c).length-1;
  const d=[",",";","\t"].sort((a,b)=>cnt(b)-cnt(a))[0];const rows=[];let row=[],f="",q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===d){row.push(f);f="";}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&t[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f="";}
    else f+=c;}
  if(f!==""||row.length){row.push(f);rows.push(row);}
  return rows.filter(r=>r.some(x=>String(x).trim()!==""));}
function parseMoney(s){s=String(s||"").trim();if(!s)return null;let x=s.replace(/[^\d.,\-]/g,"");if(!x)return NaN;
  const lc=x.lastIndexOf(","),ld=x.lastIndexOf(".");
  if(lc>-1&&ld>-1)x=lc>ld?x.replace(/\./g,"").replace(",","."):x.replace(/,/g,"");
  else if(lc>-1)x=/,\d{1,2}$/.test(x)?x.replace(/,(?=\d{1,2}$)/,".").replace(/,/g,""):x.replace(/,/g,"");
  const n=Number(x);return isFinite(n)?n:NaN;}
function parseDateCell(s,dayFirst){s=String(s||"").trim();if(!s)return"";let m;
  const ok=(y,mo,d)=>{const dt=new Date(y,mo-1,d);return dt.getFullYear()===y&&dt.getMonth()===mo-1&&dt.getDate()===d?G.iso(dt):null;};
  if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)))return ok(+m[1],+m[2],+m[3]);
  if((m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))){let a=+m[1],b=+m[2],y=+m[3];if(y<100)y+=2000;
    if(a>12)return ok(y,b,a);if(b>12)return ok(y,a,b);return dayFirst?ok(y,b,a):ok(y,a,b);}
  const t=Date.parse(s);return isNaN(t)?null:G.iso(new Date(t));}

function plan(rows,opts){
  const res={fatal:"",entries:[],unknownHeaders:[]};if(rows.length<2){res.fatal="That file has no rows under the header.";return res;}
  const keys=rows[0].map(h=>{const k=ALIASES[normH(h)];if(!k&&String(h).trim())res.unknownHeaders.push(String(h).trim());return k||null;});
  if(!keys.includes("name")){res.fatal="Couldn't find a Name column. Start from the template so the headers match.";return res;}
  const byTag=new Map(G.items().map(i=>[String(i.tag||"").toUpperCase(),i]));const seen=new Set();
  rows.slice(1).forEach((r,ri)=>{
    const raw={};keys.forEach((k,ci)=>{if(k&&raw[k]===undefined)raw[k]=String(r[ci]??"").trim();});
    const e={line:ri+2,raw,errors:[],warns:[],action:"new",data:{},qty:1,tag:(raw.tag||"").toUpperCase()};
    if(!Object.values(raw).some(Boolean))return;
    if(/^example\b/i.test(raw.name||"")){e.action="skip";e.warns.push("Template example row");res.entries.push(e);return;}
    if(!raw.name)e.errors.push("Name is missing");
    const d=e.data;["name","brand","model","serial","room","shelf","supplier","notes"].forEach(k=>{if(raw[k])d[k]=raw[k];});
    if(raw.category){const c=G.CATS.find(c=>[c[0].toLowerCase(),c[1].toLowerCase(),c[0].toLowerCase()+"s"].includes(raw.category.toLowerCase()));
      if(c)d.category=c[0];else{d.category="Accessory";e.warns.push(`Category "${raw.category}" isn't a known one, filed under Accessory`);}}
    if(raw.is_case)d.is_case=yes(raw.is_case);if(d.category==="Case"&&raw.is_case===undefined)d.is_case=true;
    ["purchase_cost","replacement_cost"].forEach(k=>{if(!raw[k])return;const n=parseMoney(raw[k]);if(isNaN(n))e.errors.push(`"${raw[k]}" isn't a number`);else d[k]=n;});
    if(raw.service_days){const n=parseInt(raw.service_days,10);if(isNaN(n)||n<0)e.errors.push(`Service interval "${raw.service_days}" isn't a number of days`);else d.service_days=n;}
    ["purchase_date","last_serviced"].forEach(k=>{if(!raw[k])return;const v=parseDateCell(raw[k],opts.dayFirst);if(v)d[k]=v;else e.warns.push(`Date "${raw[k]}" not understood, left blank`);});
    if(raw.critical)d.critical=yes(raw.critical);
    if(raw.status){const st=STATUS_WORDS[normH(raw.status)];if(!st)e.warns.push(`Status "${raw.status}" not understood, ignored`);else if(st==="out")e.warns.push("Status Out ignored. Check gear out on a job so it's tracked");else d.status=st;}
    if(raw.qty){const n=parseInt(raw.qty,10);if(isNaN(n)||n<1)e.errors.push(`Quantity "${raw.qty}" isn't a whole number`);else if(n>100)e.errors.push("Quantity over 100. Split it into several rows");else e.qty=n;}
    e.companionTags=raw.companions?raw.companions.split(/[;|\n]+/).map(s=>s.trim().toUpperCase()).filter(Boolean):null;
    e.homeTag=raw.home_case?raw.home_case.trim().toUpperCase():null;
    if(e.tag&&byTag.has(e.tag)){
      if(opts.update){e.action="update";e.id=byTag.get(e.tag).id;if(e.qty>1){e.warns.push("Quantity ignored when updating an existing item");e.qty=1;}}
      else{e.action="skip";e.warns.push(`Tag ${e.tag} already exists`);}}
    if(e.tag&&e.action!=="skip"){if(seen.has(e.tag))e.errors.push(`Tag ${e.tag} appears more than once in this file`);seen.add(e.tag);}
    if(e.errors.length)e.action="error";
    res.entries.push(e);});
  const used=new Set([...byTag.keys(),...seen]);
  const alloc=prefix=>{let n=0;used.forEach(t=>{const m=t.match(new RegExp("^"+prefix+"-(\\d+)$"));if(m)n=Math.max(n,+m[1]);});const t=prefix+"-"+String(n+1).padStart(4,"0");used.add(t);return t;};
  res.entries.filter(e=>e.action==="new").forEach(e=>{e.tags=[];const prefix=G.PREFIX[e.data.category||"Accessory"]||"ACC";
    if(e.tag){e.tags.push(e.tag);const m=e.tag.match(/^(.*?)(\d+)$/);
      for(let c=1;c<e.qty;c++){const t=m?m[1]+String(+m[2]+c).padStart(m[2].length,"0"):e.tag+"-"+(c+1);if(used.has(t)){e.errors.push(`Numbering on from ${e.tag} would reuse tag ${t}`);e.action="error";break;}used.add(t);e.tags.push(t);}}
    else for(let c=0;c<e.qty;c++)e.tags.push(alloc(prefix));});
  const caseTags=new Set([...G.items().filter(i=>i.is_case).map(i=>String(i.tag).toUpperCase()),...res.entries.filter(e=>e.action!=="error"&&e.action!=="skip"&&e.data.is_case).flatMap(e=>e.tags||[e.tag])]);
  res.entries.forEach(e=>{if(e.action==="error"||e.action==="skip")return;
    if(e.companionTags){const miss=e.companionTags.filter(t=>!used.has(t));if(miss.length)e.warns.push("No item tagged "+miss.join(", ")+"; left out of \"always goes out with\"");}
    if(e.homeTag&&!caseTags.has(e.homeTag))e.warns.push(`Home case ${e.homeTag} isn't a case in inventory or this file; left blank`);});
  return res;}
function summary(p){const by=a=>p.entries.filter(e=>e.action===a);const nw=by("new");return{newRows:nw.length,units:G.sum(nw,e=>e.tags.length),updates:by("update").length,skips:by("skip").length,errors:by("error").length};}
function run(p){ // returns the list of writes as functions so the caller can show progress
  const finalTags=new Map(G.items().map(i=>[String(i.tag).toUpperCase(),i.id]));const jobs=[];
  p.entries.forEach(e=>{if(e.action==="new")e.ids=e.tags.map(t=>{const id=St.uuid();finalTags.set(t,id);return id;});});
  const comp=e=>e.companionTags?e.companionTags.map(t=>finalTags.get(t)).filter(Boolean):null;
  const home=e=>{if(!e.homeTag)return undefined;const id=finalTags.get(e.homeTag);const it=id&&G.item(id);const isCase=(it&&it.is_case)||p.entries.some(x=>x.data.is_case&&(x.tags||[]).includes(e.homeTag));return isCase?id:undefined;};
  // cases first so home-case links point at rows that already exist
  const order=[...p.entries].sort((a,b)=>(b.data.is_case?1:0)-(a.data.is_case?1:0));
  order.forEach(e=>{
    if(e.action==="new")e.tags.forEach((tag,ix)=>{const d=Object.assign({category:"Accessory",status:"available",critical:false,is_case:false,companions:[]},e.data,{id:e.ids[ix],tag});
      const c=comp(e);if(c)d.companions=c.filter(x=>x!==d.id);const h=home(e);if(h)d.home_case_id=h,d.in_case_id=h;if(ix>0&&d.serial)d.serial="";
      jobs.push(()=>St.insert("items",d));});
    if(e.action==="update"){const patch=Object.assign({},e.data);const c=comp(e);if(c)patch.companions=c.filter(x=>x!==e.id);const h=home(e);if(h)patch.home_case_id=h;
      jobs.push(()=>St.patch("items",e.id,patch));}});
  return jobs;}
window.GCCsv={COLS,toCSV,exportRows,templateRows,parseCSV,plan,summary,run,parseMoney,parseDateCell};
})();
