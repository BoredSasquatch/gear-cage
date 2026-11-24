/* Example data for demo mode (used only when config.js has no Supabase details). Everything is marked as an example. */
window.GC_DEMO_SEED=function(St){
  const S=St.S,G=window.GC,id=()=>St.uuid();
  S.settings.usd_rate=300;S.settings.rate_source="Example rate";S.settings.currency="LKR";
  const crewA={id:id(),name:"Kasun (example crew)",email:"",role:"crew"},crewB={id:id(),name:"Dilini (example crew)",email:"",role:"crew"};
  S.profiles.set(crewA.id,crewA);S.profiles.set(crewB.id,crewB);
  const T={};const add=(tag,name,o)=>{const r=Object.assign({id:id(),tag,name,brand:"",model:"",category:"Accessory",serial:"",room:"",shelf:"",is_case:false,home_case_id:null,in_case_id:null,critical:false,status:"available",
    cost_currency:"USD",purchase_cost:null,purchase_date:"2024-03-12",replacement_cost:null,supplier:"",service_days:null,last_serviced:null,companions:[],notes:"",example:true},o);T[tag]=r;S.items.set(r.id,r);return r;};
  add("CSE-0001","Pelican 1610, A-cam body case",{brand:"Pelican",category:"Case",is_case:true,room:"Cage A",shelf:"Floor",purchase_cost:389,replacement_cost:419});
  add("CSE-0002","Pelican 1510, lens case",{brand:"Pelican",category:"Case",is_case:true,room:"Cage B",shelf:"Floor",purchase_cost:259,replacement_cost:279});
  add("CSE-0003","Cable and power bag",{category:"Case",is_case:true,room:"Cage B",shelf:"Cable drawer",purchase_cost:45,replacement_cost:49,notes:"Packed differently each shoot"});
  const A=T["CSE-0001"].id,L=T["CSE-0002"].id;
  add("CAM-0001","Sony FX6 body",{brand:"Sony",model:"ILME-FX6",category:"Camera",serial:"EX5012345",room:"Cage A",shelf:"Shelf 1",home_case_id:A,in_case_id:A,purchase_cost:5999,replacement_cost:6299,service_days:365,last_serviced:"2025-10-02"});
  add("ACC-0001","FX6 top handle with XLR unit",{brand:"Sony",critical:true,home_case_id:A,in_case_id:A,purchase_cost:420,replacement_cost:450});
  add("MON-0001","FX6 LCD monitor with hood",{brand:"Sony",category:"Monitor",critical:true,home_case_id:A,in_case_id:A,purchase_cost:380,replacement_cost:399});
  add("PWR-0001","BP-U100 battery",{brand:"Sony",category:"Power",home_case_id:A,in_case_id:A,purchase_cost:299,replacement_cost:329});
  add("PWR-0002","BP-U100 battery",{brand:"Sony",category:"Power",home_case_id:A,in_case_id:A,purchase_cost:299,replacement_cost:329});
  add("PWR-0003","BP-U dual charger",{brand:"Sony",category:"Power",critical:true,room:"Cage A",shelf:"Shelf 3",purchase_cost:249,replacement_cost:269});
  add("MED-0001","CFexpress Type A 160GB",{brand:"Sony",category:"Media",critical:true,home_case_id:A,in_case_id:A,purchase_cost:199,replacement_cost:219});
  add("MED-0002","CFexpress Type A 160GB",{brand:"Sony",category:"Media",critical:true,home_case_id:A,in_case_id:A,purchase_cost:199,replacement_cost:219});
  add("MED-0003","CFexpress card reader",{brand:"Sony",category:"Media",critical:true,room:"Cage A",shelf:"Media drawer",purchase_cost:79,replacement_cost:89});
  add("LNS-0001","FE 24-70mm f/2.8 GM II",{brand:"Sony",category:"Lens",home_case_id:L,in_case_id:L,purchase_cost:2298,replacement_cost:2398});
  add("LNS-0002","18-35mm T2 Cine",{brand:"Sigma",category:"Lens",home_case_id:L,in_case_id:L,purchase_cost:3999,replacement_cost:4199});
  add("LNS-0003","50mm T1.5 FF Cine",{brand:"Sigma",category:"Lens",home_case_id:L,in_case_id:L,purchase_cost:3999,replacement_cost:4299});
  add("CBL-0001","SDI cable 1 ft",{category:"Cable",critical:true,room:"Cage B",shelf:"Cable drawer",purchase_cost:18,replacement_cost:22});
  add("CBL-0002","SDI cable 3 ft",{category:"Cable",critical:true,room:"Cage B",shelf:"Cable drawer",purchase_cost:22,replacement_cost:26});
  add("PWR-0004","D-tap to 2-pin power cable",{category:"Power",critical:true,room:"Cage B",shelf:"Cable drawer",purchase_cost:25,replacement_cost:29});
  add("WVD-0001","Mars 4K wireless video TX/RX",{brand:"Hollyland",category:"Wireless video",room:"Cage B",shelf:"Shelf 3",purchase_cost:699,replacement_cost:749,companions:[T["CBL-0001"].id,T["PWR-0004"].id]});
  add("SUP-0001","Flowtech 75 tripod with FSB 8 head",{brand:"Sachtler",category:"Support",room:"Cage B",shelf:"Floor",purchase_cost:2950,replacement_cost:3150,service_days:365,last_serviced:"2025-06-01"});
  add("AUD-0001","MKE 600 shotgun mic",{brand:"Sennheiser",category:"Audio",room:"Cage B",shelf:"Shelf 4",purchase_cost:329,replacement_cost:349});
  add("CBL-0003","XLR cable 10 ft",{category:"Cable",critical:true,room:"Cage B",shelf:"Cable drawer",purchase_cost:19,replacement_cost:24});
  T["AUD-0001"].companions=[T["CBL-0003"].id];
  add("CAM-0002","Pocket Cinema Camera 6K Pro",{brand:"Blackmagic",category:"Camera",room:"Cage A",shelf:"Shelf 2",purchase_cost:2535,replacement_cost:2595,status:"out"});
  add("MED-0004","T7 SSD 1TB",{brand:"Samsung",category:"Media",critical:true,room:"Cage A",shelf:"Media drawer",purchase_cost:109,replacement_cost:119,status:"out"});
  const kit={id:id(),name:"A-cam FX6 documentary",tag:"KIT-001",description:"Body case, lens case, wireless video, sound and tripod",example:true,
    item_ids:[A,L,T["PWR-0003"].id,T["MED-0003"].id,T["WVD-0001"].id,T["AUD-0001"].id,T["SUP-0001"].id,T["CSE-0003"].id]};
  S.kits.set(kit.id,kit);
  const d=n=>G.addDays(G.today(),n);
  const booked={id:id(),name:"Example: Harbour Coffee commercial",starts_on:d(2),due_on:d(3),responsible_id:crewA.id,status:"booked",notes:"Two-day shoot in Galle",kit_ids:[kit.id],example:true};
  const out={id:id(),name:"Example: Riverside interview",starts_on:d(-1),due_on:d(0),responsible_id:crewB.id,status:"out",out_at:new Date(Date.now()-864e5).toISOString(),notes:"",kit_ids:[],example:true};
  S.jobs.set(booked.id,booked);S.jobs.set(out.id,out);
  const addL=(job,it,o)=>{const r=Object.assign({id:id(),job_id:job.id,item_id:it.id,kit_id:null,via:"added",parent_id:null,state:"planned",reason:"",packed_case_id:null,note:""},o);S.job_lines.set(r.id,r);};
  // booked job: kit lines planned (cases bring their contents)
  const seen=new Set();const plan=(iid,via,parent)=>{if(seen.has(iid))return;seen.add(iid);const it=S.items.get(iid);addL(booked,it,{kit_id:kit.id,via,parent_id:parent||null});
    (it.companions||[]).forEach(c=>plan(c,"companion",iid));if(it.is_case)[...S.items.values()].filter(x=>x.home_case_id===iid).forEach(x=>plan(x.id,"case",iid));};
  kit.item_ids.forEach(i=>plan(i,"kit"));
  [T["CAM-0002"],T["MED-0004"]].forEach(it=>addL(out,it,{state:"out",out_by:crewB.id,out_at:out.out_at}));
  S.maintenance.set("m1",{id:"m1",item_id:T["CAM-0001"].id,date:"2025-10-02",type:"Service",description:"Sensor clean and firmware update",cost:180,vendor:"Camera service workshop",status:"done",completed_at:"2025-10-02",example:true});
};
