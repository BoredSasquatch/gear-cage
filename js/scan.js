/* Camera QR scanning. Opens the back camera, reads QR codes continuously, and calls onCode for each new code.
   A USB or Bluetooth scanner works too: it types the code into the focused scan box and presses Enter. */
(function(){
"use strict";
let stream=null,raf=0,video=null,canvas=null,ctx=null,onCode=null,last={code:"",at:0},audio=null,detector=null;

function beep(ok){
  try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();
    o.frequency.value=ok?1320:330;g.gain.value=.08;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+(ok?.08:.25));}catch(e){}
  try{navigator.vibrate&&navigator.vibrate(ok?40:[60,60,60]);}catch(e){}
}
async function start(videoEl,cb){
  stop();video=videoEl;onCode=cb;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("This browser can't use the camera. Type the tag instead.");
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;video.setAttribute("playsinline","");video.muted=true;await video.play();
  if("BarcodeDetector" in window){try{const f=await BarcodeDetector.getSupportedFormats();if(f.includes("qr_code"))detector=new BarcodeDetector({formats:["qr_code","code_128","code_39"]});}catch(e){detector=null;}}
  canvas=canvas||document.createElement("canvas");ctx=canvas.getContext("2d",{willReadFrequently:true});
  tick();
}
async function tick(){
  if(!stream)return;
  if(video.readyState>=2){
    let code=null;
    try{
      if(detector){const r=await detector.detect(video);if(r&&r[0])code=r[0].rawValue;}
      else if(window.jsQR){const w=Math.min(720,video.videoWidth),h=Math.round(video.videoHeight*(w/video.videoWidth));
        canvas.width=w;canvas.height=h;ctx.drawImage(video,0,0,w,h);const img=ctx.getImageData(0,0,w,h);
        const r=window.jsQR(img.data,w,h,{inversionAttempts:"dontInvert"});if(r)code=r.data;}
    }catch(e){}
    const t=Date.now();
    if(code&&(code!==last.code||t-last.at>2500)){last={code,at:t};try{onCode&&onCode(code);}catch(e){console.error(e);}}
  }
  raf=requestAnimationFrame(()=>setTimeout(tick,detector?60:120));
}
function stop(){cancelAnimationFrame(raf);if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}if(video){video.srcObject=null;}}
window.GCScan={start,stop,beep};
})();
