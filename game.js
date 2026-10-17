(()=>{'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),mapCanvas=document.getElementById('mapCanvas'),mc=mapCanvas.getContext('2d');
const $=id=>document.getElementById(id),T=48,W=52,H=36,worldW=W*T,worldH=H*T;
let width=innerWidth,height=innerHeight,dpr=1,last=0,elapsed=0,started=false,dialogue=null,dialogIndex=0,dialogCallback=null,mapOpen=false,toastUntil=0,saveTimer=0;
const keys=new Set(),joystick={x:0,y:0,pointer:null};
let tiles=[],decor=[],particles=[];
const player={x:5*T+24,y:7*T+24,r:13,dir:0};
let state={flags:{},fragments:[],complete:false};
const nodes=[
{id:'terminal',name:'Notfallterminal',x:7,y:7,type:'terminal',color:'#72dafa'},
{id:'iris',name:'IRIS',x:15,y:8,type:'npc',color:'#a8f6d0'},
{id:'archive',name:'Archivkonsole',x:35,y:7,type:'fragment',color:'#ffe29c'},
{id:'garden',name:'Gewächshaus-Sensor',x:38,y:27,type:'fragment',color:'#ffe29c'},
{id:'reactor',name:'Reaktorspeicher',x:11,y:27,type:'fragment',color:'#ffe29c'},
{id:'door',name:'Sicherheitsschleuse',x:25,y:17,type:'door',color:'#f28ab3'},
{id:'core',name:'Zentraler Kern',x:27,y:19,type:'core',color:'#c5a4ff'},
{id:'log1',name:'Tagebuch',x:18,y:28,type:'log',color:'#83caff'},
{id:'log2',name:'Datenspur',x:39,y:11,type:'log',color:'#83caff'}];
const SAVE='neon-rift-echoes-v1';
function resetWorld(){tiles=Array.from({length:H},()=>Array(W).fill(0));decor=[];const wall=(x,y)=>{if(x>=0&&y>=0&&x<W&&y<H)tiles[y][x]=1};for(let x=0;x<W;x++){wall(x,0);wall(x,H-1)}for(let y=0;y<H;y++){wall(0,y);wall(W-1,y)}
// Four distinct exploration wings, connected by broad hallways.
for(let x=2;x<50;x++){if(x<22||x>30){wall(x,15);wall(x,21)}}for(let y=2;y<34;y++){if(y<14||y>22){wall(23,y);wall(30,y)}}
for(let x of [5,12,19,34,41,47]){tiles[15][x]=0;tiles[21][x]=0}for(let y of [6,11,26,31]){tiles[y][23]=0;tiles[y][30]=0}
// Keep a traversable wide central hub, and a few furnishing obstacles.
for(let y=16;y<=20;y++)for(let x=22;x<=31;x++)tiles[y][x]=0;
for(let y=3;y<14;y++)for(let x=3;x<22;x++){if((x*19+y*31)%61===0)decor.push({x,y,type:'crate'})}
for(let y=3;y<14;y++)for(let x=32;x<49;x++){if((x*11+y*7)%43===0)decor.push({x,y,type:'shelf'})}
for(let y=23;y<33;y++)for(let x=32;x<49;x++){if((x+y*3)%13===0)decor.push({x,y,type:'plant'})}
for(let y=23;y<33;y++)for(let x=3;x<22;x++){if((x*3+y)%17===0)decor.push({x,y,type:'pipe'})}
}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE));if(s&&s.state&&s.player){state={flags:s.state.flags||{},fragments:s.state.fragments||[],complete:!!s.state.complete};player.x=Number(s.player.x)||player.x;player.y=Number(s.player.y)||player.y}}catch(e){}}
function save(){try{localStorage.setItem(SAVE,JSON.stringify({state,player:{x:player.x,y:player.y}}))}catch(e){}}
function reset(){if(confirm('Spielstand wirklich löschen und von vorne beginnen?')){localStorage.removeItem(SAVE);state={flags:{},fragments:[],complete:false};player.x=5*T+24;player.y=7*T+24;location.reload()}}
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
const cam=()=>({x:Math.max(0,Math.min(worldW-width,player.x-width/2)),y:Math.max(0,Math.min(worldH-height,player.y-height/2))});
function solid(x,y){const a=Math.floor(x/T),b=Math.floor(y/T);return !tiles[b]||tiles[b][a]!==0}
function canMove(x,y){const r=player.r;return !solid(x-r,y-r)&&!solid(x+r,y-r)&&!solid(x-r,y+r)&&!solid(x+r,y+r)}
function say(lines,callback){dialogue=lines;dialogIndex=0;dialogCallback=callback||null;showLine()}
function showLine(){if(!dialogue)return;const [who,msg]=dialogue[dialogIndex];$('speaker').textContent=who;$('speech').textContent=msg;$('dialog').style.display='block'}
function next(){if(!dialogue)return;dialogIndex++;if(dialogIndex>=dialogue.length){dialogue=null;$('dialog').style.display='none';const cb=dialogCallback;dialogCallback=null;if(cb)cb();save()}else showLine()}
function notify(msg){$('toast').textContent=msg;$('toast').style.display='block';toastUntil=performance.now()+2700}
function nearest(){let best=null,dist=Infinity;for(const n of nodes){const d=Math.hypot(n.x*T+24-player.x,n.y*T+24-player.y);if(d<dist&&d<90){best=n;dist=d}}return best}
function interact(){if(dialogue){next();return}if(mapOpen){toggleMap();return}const n=nearest();if(!n){notify('Hier gibt es nichts zu untersuchen.');return}
if(n.id==='terminal'){say([['NOTFALLTERMINAL','AURORA / Jahr 2189. Die Station wurde nach einem rätselhaften Signal evakuiert.'],['NOTFALLTERMINAL','Drei Signalfragmente sind über die Anlage verteilt: Archiv, Gewächshaus und Reaktor.'],['NOTFALLTERMINAL','Nur der zentrale Kern kann die Nachricht wieder zusammensetzen.']],()=>{state.flags.intro=true;updateHUD()});return}
if(n.id==='iris'){say([['IRIS · Stations-KI','Du bist zurück. Ich hatte nicht erwartet, dass noch jemand meine Nachricht empfängt.'],['DU','Wer hat die Station verlassen?'],['IRIS','Alle. Sie hielten das Signal für eine Bedrohung. Ich glaube, es ist eine Einladung.'],['IRIS','Suche die drei Fragmente. Danach kann ich dir die Wahrheit zeigen.']],()=>{state.flags.iris=true;updateHUD()});return}
if(n.type==='fragment'){if(state.fragments.includes(n.id)){notify('Signalfragment bereits gesichert.');return}const lines={archive:[['ARCHIV','Fragment 01: Aufzeichnungen über ein Licht, das sich zwischen den Sternen bewegte.'],['ARCHIV','Die Wissenschaftler nannten es ECHO. Es antwortete auf jede Frage mit einer Erinnerung.']],garden:[['GEWÄCHSHAUS','Fragment 02: Das Signal ließ die Pflanzen auf Musik reagieren.'],['GEWÄCHSHAUS','Eine Botanikerin notierte: „Es scheint nicht zu sprechen. Es hört zu.“']],reactor:[['REAKTOR','Fragment 03: Die Energieversorgung wurde absichtlich heruntergefahren.'],['REAKTOR','Jemand wollte verhindern, dass ECHO vollständig empfangen wird.']]};say(lines[n.id],()=>{state.fragments.push(n.id);updateHUD();notify('Signalfragment '+state.fragments.length+'/3 gesichert')});return}
if(n.id==='door'){if(state.fragments.length<3){say([['SICHERHEITSSCHLEUSE','Zugang zum Kern gesperrt. Benötigt: 3 Signalfragmente.'],['SYSTEM',`Gefunden: ${state.fragments.length} von 3.`]])}else{state.flags.door=true;say([['SICHERHEITSSCHLEUSE','Signatur bestätigt. Die Kerndaten können jetzt entschlüsselt werden.']])}return}
if(n.id==='core'){if(state.fragments.length<3){say([['ZENTRALER KERN','Die Nachricht ist unvollständig. Finde zuerst alle drei Signalfragmente.']]);return}if(state.complete){say([['IRIS','Die Geschichte ist nicht zu Ende. Der Transitknoten wartet. Wir müssen den letzten Funkspruch finden.']],()=>{if(window.NEON_STORY)window.NEON_STORY.start(2)});return}say([['IRIS','Die Fragmente ergeben ein vollständiges Muster. Ich spiele die Nachricht ab.'],['ECHO','„Wir sind nicht die Ersten. Und wir sind nicht allein.“'],['DU','Wer bist du?'],['ECHO','„Eine Erinnerung an das, was diese Welt einmal sein wird.“'],['IRIS','Das Signal stammt nicht aus dem All. Es stammt aus der Zukunft.'],['SYSTEM','KAPITEL 1 ABGESCHLOSSEN · Die Quelle des Echos bleibt unbekannt.']],()=>{state.complete=true;updateHUD();save();notify('Kapitel 1 abgeschlossen!');if(window.NEON_STORY){window.NEON_STORY.refresh();window.NEON_STORY.start(2)}});return}
if(n.id==='log1')say([['PERSÖNLICHES LOG','„Manchmal fürchte ich nicht das Unbekannte, sondern das, was wir bereits wissen.“']]);
if(n.id==='log2')say([['FORSCHUNGSNOTIZ','„Die Nachricht scheint nur dann zu erscheinen, wenn niemand versucht, sie zu kontrollieren.“']]);}
function updateHUD(){$('quest').textContent=state.complete?'Kapitel 1 abgeschlossen · Das Echo bleibt':`Mission: Signalfragmente finden (${state.fragments.length}/3)`;$('status').textContent='Station AURORA · '+(state.fragments.length===3?'Kern untersuchen':'Erkunden & mit Objekten interagieren')}
function rounded(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function render(){ctx.clearRect(0,0,width,height);ctx.fillStyle='#050b13';ctx.fillRect(0,0,width,height);const c=cam(),sx=Math.floor(c.x/T),ex=Math.min(W,Math.ceil((c.x+width)/T)),sy=Math.floor(c.y/T),ey=Math.min(H,Math.ceil((c.y+height)/T));ctx.save();ctx.translate(-c.x,-c.y);
for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++){const px=x*T,py=y*T;let col=x<24?(y<17?'#142637':'#1a2634'):(y<17?'#17283b':'#172e30');ctx.fillStyle=(x+y)%2===0?col:'#122332';ctx.fillRect(px,py,T,T);ctx.strokeStyle='#8eb6c40b';ctx.strokeRect(px+.5,py+.5,T-1,T-1);if(tiles[y][x]){ctx.fillStyle='#32485b';ctx.fillRect(px,py,T,T);ctx.fillStyle='#577184';ctx.fillRect(px+3,py+3,T-6,5);ctx.fillStyle='#07121e';ctx.fillRect(px+8,py+15,T-16,T-23)}}
// corridor lamps and region details
for(let x=4;x<W-3;x+=8){const px=x*T+24;ctx.fillStyle='#5fe4ff35';ctx.beginPath();ctx.arc(px,17*T,11+Math.sin(elapsed*2+x)*2,0,Math.PI*2);ctx.fill()}
for(const d of decor){const x=d.x*T+7,y=d.y*T+7;if(x<c.x-50||x>c.x+width+50||y<c.y-50||y>c.y+height+50)continue;const colors={crate:'#657c8c',shelf:'#4b6d8d',plant:'#387b63',pipe:'#8a716e'};rounded(x,y,34,34,5,colors[d.type]);ctx.fillStyle='#0c1a27';ctx.fillRect(x+7,y+7,20,4);if(d.type==='plant'){ctx.fillStyle='#7dcaa2';ctx.beginPath();ctx.arc(x+17,y+12,11,0,7);ctx.fill()}}
for(const n of nodes){const x=n.x*T+24,y=n.y*T+24;if(x<c.x-80||x>c.x+width+80||y<c.y-80||y>c.y+height+80)continue;const collected=state.fragments.includes(n.id);ctx.globalAlpha=collected?.45:1;ctx.fillStyle=n.color+'22';ctx.beginPath();ctx.arc(x,y,28+Math.sin(elapsed*2+n.x)*3,0,7);ctx.fill();ctx.fillStyle=n.color;ctx.fillRect(x-12,y-12,24,24);ctx.fillStyle='#10212c';ctx.fillRect(x-7,y-7,14,14);ctx.fillStyle='#eaffff';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(n.name,x,y-25);ctx.globalAlpha=1}
// Player with flashlight cone
ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.dir);ctx.fillStyle='#8defff18';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,145,-.37,.37);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#04131e';ctx.beginPath();ctx.arc(player.x,player.y+4,17,0,7);ctx.fill();ctx.fillStyle='#8df4df';ctx.beginPath();ctx.arc(player.x,player.y,12,0,7);ctx.fill();ctx.fillStyle='#102e3d';ctx.beginPath();ctx.arc(player.x,player.y,7,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(player.x+Math.cos(player.dir)*8,player.y+Math.sin(player.dir)*8,3,0,7);ctx.fill();ctx.restore();
// atmospheric vignette
const v=ctx.createRadialGradient(width/2,height/2,Math.min(width,height)*.22,width/2,height/2,Math.max(width,height)*.8);v.addColorStop(0,'#0000');v.addColorStop(1,'#010611a0');ctx.fillStyle=v;ctx.fillRect(0,0,width,height);
// small minimap
const mw=Math.min(145,width*.2),mh=mw*H/W,mx=width-mw-12,my=52;if(width>520){ctx.fillStyle='#06131ddd';ctx.fillRect(mx-5,my-5,mw+10,mh+10);for(let y=0;y<H;y++)for(let x=0;x<W;x++){ctx.fillStyle=tiles[y][x]?'#5a7080':'#193648';ctx.fillRect(mx+x*mw/W,my+y*mh/H,mw/W+0.3,mh/H+0.3)}ctx.fillStyle='#8df4df';ctx.beginPath();ctx.arc(mx+player.x/worldW*mw,my+player.y/worldH*mh,3,0,7);ctx.fill()}
const near=nearest();$('hint').style.display=near&&!dialogue&&!mapOpen&&started?'block':'none';if(near)$('hint').textContent='E / AKTION · '+near.name;
}
function mapRender(){const w=mapCanvas.width,h=mapCanvas.height;mc.fillStyle='#071521';mc.fillRect(0,0,w,h);const scale=Math.min((w-30)/W,(h-30)/H),ox=(w-W*scale)/2,oy=(h-H*scale)/2;for(let y=0;y<H;y++)for(let x=0;x<W;x++){mc.fillStyle=tiles[y][x]?'#547084':'#1b3848';mc.fillRect(ox+x*scale,oy+y*scale,scale+.2,scale+.2)}for(const n of nodes){mc.fillStyle=n.color;mc.beginPath();mc.arc(ox+(n.x+.5)*scale,oy+(n.y+.5)*scale,4,0,7);mc.fill()}mc.fillStyle='#91ffe1';mc.beginPath();mc.arc(ox+player.x/T*scale,oy+player.y/T*scale,6,0,7);mc.fill();mc.font='16px system-ui';mc.fillText('● Du   ● Stationen / Hinweise',18,25)}
function toggleMap(){mapOpen=!mapOpen;$('mapOverlay').style.display=mapOpen?'flex':'none';if(mapOpen)mapRender()}
function update(dt){if(!started||dialogue||mapOpen)return;let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystick.x;let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joystick.y;const mag=Math.hypot(dx,dy);if(mag>.08){dx/=Math.max(1,mag);dy/=Math.max(1,mag);player.dir=Math.atan2(dy,dx);const sp=190*dt;if(canMove(player.x+dx*sp,player.y))player.x+=dx*sp;if(canMove(player.x,player.y+dy*sp))player.y+=dy*sp;saveTimer+=dt;if(saveTimer>2){save();saveTimer=0}}}
function loop(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;elapsed+=dt;if(!window.NEON_STORY?.active && !window.NEON_CHAPTERS?.active){update(dt);if(!document.hidden)render()}if(toastUntil&&now>toastUntil){$('toast').style.display='none';toastUntil=0}requestAnimationFrame(loop)}
function keydown(e){if(window.NEON_STORY?.active)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','m','e'].includes(k))e.preventDefault();keys.add(k);if(e.repeat)return;if(k==='e'||k===' ')interact();if(k==='m')toggleMap();if(k==='escape'&&mapOpen)toggleMap()}
window.addEventListener('keydown',keydown);window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();joystick.x=joystick.y=0});
const stick=$('stick'),nub=$('nub');function moveStick(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,len=Math.hypot(dx,dy)||1,fac=Math.min(max,len)/len;joystick.x=dx*fac/max;joystick.y=dy*fac/max;nub.style.transform=`translate(${dx*fac}px,${dy*fac}px)`}
stick.addEventListener('pointerdown',e=>{e.preventDefault();joystick.pointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)});stick.addEventListener('pointermove',e=>{if(joystick.pointer===e.pointerId)moveStick(e)});function release(e){if(joystick.pointer!==e.pointerId)return;joystick.pointer=null;joystick.x=joystick.y=0;nub.style.transform='translate(0,0)'}stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);
$('act').addEventListener('pointerdown',e=>{e.preventDefault();interact()});$('next').onclick=next;$('mapBtn').onclick=toggleMap;$('closeMap').onclick=toggleMap;$('resetBtn').onclick=reset;$('play').onclick=()=>{started=true;$('start').style.display='none';if(!state.flags.intro)say([['NOTFALLTERMINAL','Willkommen auf Station AURORA. Finde die drei Signalfragmente und kehre zum zentralen Kern zurück.'],['SYSTEM','Erkunde die Station frei. Folge den Beschriftungen, nutze die Karte und interagiere mit leuchtenden Objekten.']],()=>{state.flags.intro=true;save()})};
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});window.addEventListener('pagehide',save);resetWorld();load();resize();updateHUD();requestAnimationFrame(loop);
})();
