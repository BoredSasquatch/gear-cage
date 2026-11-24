/* QR label sheets. Each label carries a QR code of the asset tag, the tag in large type, and the item name.
   Layouts match common sticker sheets and a 62 mm label printer roll. Printing uses the browser's print dialog. */
(function(){
"use strict";
const LAYOUTS={
  small:{name:"Small: 65 per A4 sheet (38.1 × 21.2 mm, e.g. Avery L7651)",page:"A4",cols:5,rows:13,w:38.1,h:21.2,top:10.7,left:4.7,gapX:2.5,gapY:0,qr:17,fs:[9,6]},
  medium:{name:"Medium: 24 per A4 sheet (63.5 × 33.9 mm, e.g. Avery L7159)",page:"A4",cols:3,rows:8,w:63.5,h:33.9,top:12.9,left:6.4,gapX:2.5,gapY:0,qr:28,fs:[14,8]},
  roll:{name:"Label printer roll, 62 × 29 mm (e.g. Brother DK-11209)",page:"62mm 29mm",cols:1,rows:1,w:62,h:29,top:0,left:0,gapX:0,gapY:0,qr:25,fs:[15,8]},
  case:{name:"Case labels: 2 per A4 sheet, large",page:"A4",cols:1,rows:2,w:190,h:130,top:10,left:10,gapX:0,gapY:17,qr:95,fs:[44,18]}
};
function qrSVG(text){
  const q=window.qrcode(0,"M");q.addData(text);q.make();
  return q.createSvgTag({cellSize:4,margin:0,scalable:true});
}
function labelHTML(i,L){
  const code="GC:"+i.tag;
  return `<div class="lbl" style="width:${L.w}mm;height:${L.h}mm">
    <div class="lbl-qr" style="width:${L.qr}mm;height:${L.qr}mm">${qrSVG(code)}</div>
    <div class="lbl-t"><b style="font-size:${L.fs[0]}pt">${esc(i.tag)}</b><span style="font-size:${L.fs[1]}pt">${esc(i.name)}</span></div></div>`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function sheetHTML(list,layoutKey,skip){
  const L=LAYOUTS[layoutKey]||LAYOUTS.medium;const per=L.cols*L.rows;const cells=[];
  for(let s=0;s<(skip||0);s++)cells.push(null);list.forEach(i=>cells.push(i));
  const pages=[];for(let p=0;p<cells.length;p+=per)pages.push(cells.slice(p,p+per));
  return `<style>@page{size:${L.page};margin:0}</style>`+pages.map(pg=>`<div class="lbl-page" style="width:${L.page==="A4"?"210mm":L.w+"mm"};padding:${L.top}mm 0 0 ${L.left}mm;grid-template-columns:repeat(${L.cols},${L.w}mm);column-gap:${L.gapX}mm;row-gap:${L.gapY}mm;grid-auto-rows:${L.h}mm">
    ${pg.map(i=>i?labelHTML(i,L):`<div class="lbl blank" style="width:${L.w}mm;height:${L.h}mm"></div>`).join("")}</div>`).join("");
}
window.GCLabels={LAYOUTS,sheetHTML,qrSVG};
})();
