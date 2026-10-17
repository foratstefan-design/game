/* NEON RIFT: ECHOES — playable chapters 2 & 3, and the chapter progression router.
   This file uses a separate overlay so it does not change the original chapter 1 / 4 / 5 renderers. */
(()=>{'use strict';
const $=id=>document.getElementById(id), KEY='neonrift-story23-v1'; // existing save key deliberately preserved
const CH1='neon-rift-echoes-v1', CH45='neon-rift-echoes-ch45-v1';
function stored(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
let progress=Object.assign({completed2:false,completed3:false,chapter:0,flags2:{},flags3:{},position2:null,position3:null},stored(KEY));
function save(){try{localStorage.setItem(KEY,JSON.stringify(progress))}catch{}}
const chapter1Complete=()=>!!stored(CH1).state?.complete;
const later=()=>stored(CH45);
function nextChapter(){const l=later();return l.completed5?6:l.unlocked5?5:progress.completed3?4:progress.completed2?3:chapter1Complete()?2:1}
const style=document.createElement('style');style.textContent=`
#story23{position:fixed;inset:0;z-index:55;display:none;background:#08121e;overflow:hidden;touch-action:none;color:#eaf6fa;font-family:system-ui,-apple-system,sans-serif}
#s23canvas{width:100%;height:100%;display:block}
#s23hud{position:absolute;top:max(12px,env(safe-area-inset-top));left:max(12px,env(safe-area-inset-left));max-width:min(73%,650px);pointer-events:none;text-shadow:0 2px 5px #010511}
#s23name{color:#8cebe1;font-size:15px;font-weight:800;letter-spacing:1.3px}#s23objective{margin-top:4px;font-size:13px;color:#e7f1fb}#s23health{margin-top:3px;font-size:12px;color:#fbd7e2}
#s23menu{position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));display:flex;gap:6px}
#s23menu button,#s23modal button,#storyContinue,#storyNav button{background:#113249ec;color:#edfaff;border:1px solid #60bcd688;border-radius:10px;padding:10px 12px;font:600 13px system-ui;cursor:pointer}
#s23menu button:active,#s23modal button:active{background:#246077}
#s23hint{position:absolute;left:50%;transform:translateX(-50%);bottom:24%;pointer-events:none;border-radius:16px;background:#071928e8;padding:7px 13px;color:#ddfefa;border:1px solid #64d5d59a;font-size:12px;white-space:nowrap;display:none}
#s23modal{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:#030b19a8;padding:12px;overflow:auto}
#s23box{width:min(610px,95vw);max-height:88vh;overflow:auto;border-radius:16px;background:#0c2132f8;border:1px solid #77e1dfaa;box-shadow:0 18px 80px #000e;padding:22px}
#s23box h2{margin:0 0 10px;font-size:clamp(18px,3.6vw,25px);color:#93efec}#s23box p{font-size:14px;line-height:1.55;color:#d4e6f1}#s23box button{display:block;width:100%;margin-top:8px;text-align:left}
#s23touch{position:absolute;inset:0;pointer-events:none;display:none}#s23stick{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));left:max(15px,env(safe-area-inset-left));width:106px;height:106px;border:2px solid #9be2eb99;border-radius:50%;background:#397c8c4a;pointer-events:auto;touch-action:none}#s23nub{position:absolute;top:33px;left:33px;width:36px;height:36px;border-radius:50%;background:#a3edf2b6}#s23act{position:absolute;bottom:max(30px,env(safe-area-inset-bottom));right:max(20px,env(safe-area-inset-right));width:74px;height:74px;border-radius:50%;pointer-events:auto;border:2px solid #a9f2d4;background:#195760cc;color:white;font:700 12px system-ui;touch-action:none}
#s23shoot{position:absolute;bottom:max(30px,env(safe-area-inset-bottom));right:max(112px,calc(env(safe-area-inset-right) + 112px));width:76px;height:76px;border-radius:50%;pointer-events:auto;border:2px solid #ffd78a;background:#754338cc;color:white;font:700 12px system-ui;touch-action:none}
    #storyNav{position:absolute;top:58px;right:10px;z-index:15;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:min(96vw,530px)}
#storyNav button{font-size:12px;padding:8px 11px}#storyContinue{display:none;margin-top:10px!important;background:#275274!important;border-color:#82f9e5!important}
@media(pointer:coarse){#s23touch{display:block}}@media(max-height:430px){#s23box{padding:11px;max-height:95vh}#s23box p{font-size:12px;margin:7px 0}#s23box button{padding:7px}#s23hint{bottom:16%}#s23stick{width:92px;height:92px}#s23nub{top:27px;left:27px;width:34px;height:34px}#s23shoot{width:59px;height:59px;right:max(94px,calc(env(safe-area-inset-right) + 94px))}#s23act{width:59px;height:59px}}
`;document.head.append(style);
const root=document.createElement('div');root.id='story23';root.innerHTML=`<canvas id="s23canvas"></canvas><div id="s23hud"><div id="s23name"></div><div id="s23objective"></div><div id="s23health"></div></div><div id="s23menu"><button id="s23journal">Journal</button><button id="s23exit">Zur Station ✕</button></div><div id="s23hint"></div><div id="s23touch"><div id="s23stick"><div id="s23nub"></div></div><button id="s23shoot">ENERGIE</button><button id="s23act">AKTION</button></div><div id="s23modal"><div id="s23box"></div></div>`;document.body.append(root);
const canvas=$('s23canvas'),ctx=canvas.getContext('2d'),modal=$('s23modal'),box=$('s23box'),hint=$('s23hint');
let active=false,chapter=2,paused=true,dialogOpen=false,raf=0,last=0,seconds=0,viewW=0,viewH=0,dpr=1;
const tile=54,keys=new Set(),joy={x:0,y:0,id:null},player={x:0,y:0,r:15,speed:185,hearts:3,invulnerable:0},walls=new Set();
let scene=null,flags={},guards=[],toast='',toastUntil=0,shake=0;
let pulses=[],foes=[],sparks=[],shotTimer=0,threatTimer=0,actionKills=0,fireHeld=false,aimX=1,aimY=0,alarmPhase=false,chaser=null,screenFlash=0;
const rnd=(a,b)=>a+Math.random()*(b-a);
const xy=(x,y)=>({x:x*tile+tile/2,y:y*tile+tile/2});
function at(x,y){const p=xy(x,y);player.x=p.x;player.y=p.y}
function setSavePosition(){if(!active)return;progress['flags'+chapter]={...flags};progress['position'+chapter]={x:player.x,y:player.y};progress.chapter=chapter;save()}
function resize(){viewW=innerWidth;viewH=innerHeight;dpr=Math.min(devicePixelRatio||1,1.7);canvas.width=Math.round(viewW*dpr);canvas.height=Math.round(viewH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function wall(x,y){walls.add(`${x},${y}`)}
function isWall(x,y){return !scene||x<0||y<0||x>=scene.w||y>=scene.h||walls.has(`${x},${y}`)}
function blocked(x,y){const r=player.r;return [ [-r,-r],[r,-r],[-r,r],[r,r] ].some(([a,b])=>isWall(Math.floor((x+a)/tile),Math.floor((y+b)/tile)))}
function roomWalls(w,h){walls.clear();for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)wall(x,y)}
function line(x1,y1,x2,y2){const length=Math.hypot(x2-x1,y2-y1),steps=Math.ceil(length/14);for(let k=1;k<steps;k++){const x=x1+(x2-x1)*k/steps,y=y1+(y2-y1)*k/steps;if(isWall(Math.floor(x/tile),Math.floor(y/tile)))return false}return true}
// Fiktiver Energiestrahl und autonome Drohnen: action modules shared by chapters 2 and 3.
function collideCircleWall(x,y,r){return [[-r,-r],[r,-r],[-r,r],[r,r]].some(([a,b])=>isWall(Math.floor((x+a)/tile),Math.floor((y+b)/tile)))}
function resetAction(){pulses=[];foes=[];sparks=[];shotTimer=0;threatTimer=3.8;actionKills=0;fireHeld=false;alarmPhase=false;chaser=null;screenFlash=0;aimX=1;aimY=0;player.hearts=5;player.invulnerable=1.5;}
function spawnDrone(type='drone',nearX=null,nearY=null){
 if(foes.length>=12)return;
 const px=nearX??player.x,py=nearY??player.y;
 for(let attempt=0;attempt<60;attempt++){
  const ang=rnd(-Math.PI,Math.PI),d=rnd(250,520),x=px+Math.cos(ang)*d,y=py+Math.sin(ang)*d;
  if(!collideCircleWall(x,y,18)&&x>tile*2&&y>tile*2&&x<(scene.w-2)*tile&&y<(scene.h-2)*tile){
   const fast=type==='runner';foes.push({x,y,r:fast?12:16,type,hp:fast?3:4,speed:fast?137:88,hit:0,stun:0,phase:rnd(0,7)});return;
  }
 }
}
function nearestThreat(){let best=null,bd=620;for(const e of foes){const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<bd){best=e;bd=d}}if(chaser){const d=Math.hypot(chaser.x-player.x,chaser.y-player.y);if(d<bd){best=chaser;bd=d}}for(const g of guards){if(g.stun>0)continue;const d=Math.hypot(g.x-player.x,g.y-player.y);if(d<bd){best=g;bd=d}}return best;}
function firePulse(targetX=null,targetY=null){
 if(!active||paused||shotTimer>0)return;
 const target=targetX!==null?{x:targetX,y:targetY}:nearestThreat();
 let vx=target?target.x-player.x:aimX,vy=target?target.y-player.y:aimY;
 const mag=Math.hypot(vx,vy)||1;vx/=mag;vy/=mag;aimX=vx;aimY=vy;shotTimer=.24;
 pulses.push({x:player.x+vx*19,y:player.y+vy*19,vx:vx*730,vy:vy*730,r:5,life:.88});
 for(let j=0;j<3;j++)sparks.push({x:player.x+vx*17,y:player.y+vy*17,vx:rnd(-50,50),vy:rnd(-50,50),t:.17,c:'#b8ffe4'});
}
function startChase(){if(alarmPhase)return;alarmPhase=true;
 const spawnX=Math.max(tile*2,player.x-240),spawnY=player.y;
 chaser={x:spawnX,y:spawnY,r:29,stun:0,phase:0};threatTimer=1.2;
 message('ALARM! Der SCHATTEN verfolgt dich. LAUF ZUM AUSGANG!');}
function actionDamage(){if(player.invulnerable>0)return;
 player.hearts--;player.invulnerable=1.5;screenFlash=.3;
 if(player.hearts<=0){
  const label=chapter===2?'TRANSITKNOTEN':'SEKTOR NULL';
  show(label+' · SIGNAL VERLOREN',['Die Notfallabschirmung bricht zusammen. Du wirst zum letzten sicheren Zugang zurückgebracht.','Gesammelte Hinweise, gelöste Rätsel und die Kapitelreihenfolge bleiben gespeichert.'],[['Erneut fliehen',()=>{foes=[];pulses=[];chaser=null;alarmPhase=false;player.hearts=5;player.invulnerable=2;at(chapter===2?4:3,chapter===2?6:4);threatTimer=3;hide()}],['Später fortsetzen',close]]);
 }else message('Treffer! Schutzenergie '+player.hearts+'/5');
}
function updateAction(dt){shotTimer=Math.max(0,shotTimer-dt);screenFlash=Math.max(0,screenFlash-dt);if(fireHeld)firePulse();
 const underAttack=(chapter===2?!!flags.elian:!!flags.terminal);
 threatTimer-=dt;
 if(underAttack&&threatTimer<=0){spawnDrone(Math.random()<.36?'runner':'drone');threatTimer=alarmPhase?rnd(2.1,3.3):rnd(5.2,7.6);}
 if(chapter===2&&flags.tape)startChase();
 if(chapter===3&&flags.archive)startChase();
 for(let j=pulses.length-1;j>=0;j--){let b=pulses[j];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  if(b.life<=0||isWall(Math.floor(b.x/tile),Math.floor(b.y/tile))){pulses.splice(j,1);continue}
  let hit=false;
  if(chaser&&Math.hypot(b.x-chaser.x,b.y-chaser.y)<chaser.r+b.r){chaser.stun=Math.min(1.35,chaser.stun+.45);hit=true;}
  for(const g of guards){if(g.stun<=0&&Math.hypot(b.x-g.x,b.y-g.y)<20){g.stun=7;hit=true;message('Wächter für 7 Sekunden deaktiviert');break}}
  for(let k=foes.length-1;k>=0&&!hit;k--){const e=foes[k];if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+b.r){e.hp--;e.hit=.15;hit=true;
    for(let z=0;z<7;z++)sparks.push({x:e.x,y:e.y,vx:rnd(-115,115),vy:rnd(-115,115),t:rnd(.14,.35),c:'#75edfc'});
    if(e.hp<=0){foes.splice(k,1);actionKills++}break;
  }}if(hit)pulses.splice(j,1);
 }
 for(let i=foes.length-1;i>=0;i--){const e=foes[i];e.hit=Math.max(0,e.hit-dt);e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;
  const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;
  if(d>19){const speed=e.speed*dt;const nx=e.x+dx/d*speed,ny=e.y+dy/d*speed;if(!collideCircleWall(nx,e.y,e.r))e.x=nx;if(!collideCircleWall(e.x,ny,e.r))e.y=ny;}
  if(d<player.r+e.r+4)actionDamage();
 }
 if(chaser){chaser.phase+=dt;chaser.stun=Math.max(0,chaser.stun-dt);
  if(chaser.stun<=0){const dx=player.x-chaser.x,dy=player.y-chaser.y,d=Math.hypot(dx,dy)||1;
   const spd=(chapter===2?158:174)*dt;const nx=chaser.x+dx/d*spd,ny=chaser.y+dy/d*spd;
   if(!collideCircleWall(nx,chaser.y,chaser.r))chaser.x=nx;
   if(!collideCircleWall(chaser.x,ny,chaser.r))chaser.y=ny;
  }
  if(Math.hypot(chaser.x-player.x,chaser.y-player.y)<chaser.r+player.r)actionDamage();
 }
 for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.t<=0)sparks.splice(i,1)}
}
function drawAction(){
 for(const b of pulses){ctx.beginPath();ctx.fillStyle='#b4fff2';ctx.shadowColor='#78eaf8';ctx.shadowBlur=8;ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;
 for(const e of foes){ctx.fillStyle=e.hit>0?'#fcffde':e.type==='runner'?'#ffb670':'#ea608d';ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,7);ctx.fill();ctx.fillStyle='#162338';ctx.fillRect(e.x-7,e.y-5,14,10);ctx.fillStyle='#9dfffa';ctx.fillRect(e.x-5,e.y-3,3,3);ctx.fillRect(e.x+2,e.y-3,3,3)}
 if(chaser){const c=chaser;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.phase);ctx.fillStyle=c.stun>0?'#8fe7e4':'#843bba';ctx.beginPath();for(let k=0;k<8;k++){let r=k%2?24:35;let a=Math.PI*2*k/8;let x=Math.cos(a)*r,y=Math.sin(a)*r;if(!k)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fill();ctx.fillStyle='#ffb5dc';ctx.fillRect(-11,-3,22,7);ctx.restore();ctx.fillStyle='#ffe7ff';ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillText('SCHATTEN · UNBESIEGBAR',c.x,c.y-46)}
 for(const p of sparks){ctx.globalAlpha=Math.min(1,p.t*5);ctx.fillStyle=p.c;ctx.fillRect(p.x-2,p.y-2,4,4)}ctx.globalAlpha=1;
}

const node=(id,x,y,label,color,cb)=>({id,...xy(x,y),label,color,cb});
function chapterTwo(){scene={w:34,h:23,title:'KAPITEL 2 · DER LETZTE FUNKSPRUCH',subtitle:'Transitknoten der Station AURORA'};roomWalls(scene.w,scene.h);
for(let x=9;x<=24;x++){if(x!==15&&x!==16&&x!==22)wall(x,10)}
for(let y=4;y<=19;y++){if(y!==8&&y!==15)wall(18,y)}
for(const [x,y] of [[7,12],[8,12],[25,10],[25,11],[4,16],[5,16],[28,5],[28,6]])wall(x,y);
scene.nodes=[node('elian',5,5,'ELIAN · Techniker','#8ae4dc',talkElian),node('note',11,5,'Dienstprotokoll','#f8d6a4',readNote),node('relayA',12,7,'Relais Alpha','#8fc3ff',()=>relay(0)),node('relayB',26,7,'Relais Beta','#87ffe2',()=>relay(1)),node('relayC',24,17,'Relais Gamma','#edb2ff',()=>relay(2)),node('archive',9,18,'Funkspeicher','#ffc77f',archive2),node('gate',31,11,'Sektorschleuse','#f6a2b0',exit2),node('memo',6,19,'Verlorene Nachricht','#b7c9ee',readMemo)];guards=[];
const pos=progress.position2;if(pos&&progress.chapter===2){player.x=pos.x;player.y=pos.y}else at(4,6);}
function talkElian(){show('ELIAN · TECHNIKER',[
'„Du kommst vom Kern? Gut. Dann ist da oben also doch noch jemand.“',
'„Vor zwölf Minuten empfingen wir eine Nachricht. Keine Stimme, nur drei Töne. Danach fielen die Streckensicherungen aus.“',
'„Ich habe versucht, die Relais wiederzuschalten. Aber jedes will die Tonfolge in einer anderen Reihenfolge hören.“',
'„Wenn du sie einschaltest, komme ich an den verschlüsselten Funkspeicher. Danach können wir Sektor Null öffnen.“'
],[['Ich sehe mir die Relais an.',()=>{flags.elian=true;persist();hide()}],['Wer hat die Nachricht gesendet?',()=>show('ELIAN',['„Der Absender wird als UNBEKANNT angezeigt. Nur ein Wort taucht immer wieder auf: ECHO.“','„Komisch ist das Datum. Es liegt dreißig Jahre in der Vergangenheit.“'],[['Zurück',()=>{flags.elian=true;persist();hide()}]])]]);}
function readNote(){flags.note=true;persist();show('DIENSTPROTOKOLL · 02:17',[
'„Die Relais prüfen einen dreiteiligen Musterschlüssel. Die Symbole sind Kreis, Stern und Dreieck.“',
'„Alpha: Stern → Kreis → Dreieck. Beta: Dreieck → Stern → Kreis. Gamma: Kreis → Dreieck → Stern.“',
'„Nach dem Stromausfall hat jemand den Funkkanal von Hand geöffnet.“'
],[['Notiz merken',hide]])}
function readMemo(){flags.memo=true;persist();show('ZERKNITTERTER ZETTEL',[
'„Falls ich nicht zurückkomme: Sag Elian, dass die Türen nicht wegen des Stromausfalls verriegelt wurden.“',
'„Etwas auf der anderen Seite hat versucht, sie von innen zu öffnen.“'
],[['Einstecken',hide]])}
const relayOrder=[[1,0,2],[2,1,0],[0,2,1]],symbols=['○ Kreis','★ Stern','△ Dreieck'];
function relay(i){const id=['A','B','C'][i];if(flags['relay'+id]){show('RELAIS '+id,['Versorgung aktiv. Die Anzeigen leuchten wieder.'],[['Weiter',hide]]);return}
if(!flags.elian){show('RELAIS '+id,['Die Schaltfolge ist verschlüsselt. Vielleicht weiß der Techniker am Bahnsteig mehr.'],[['Weiter',hide]]);return}
let sequence=[];const needed=relayOrder[i];const render=()=>{
const correct=sequence.every((n,j)=>needed[j]===n);
if(sequence.length===3){if(correct){flags['relay'+id]=true;persist();show('RELAIS '+id+' · AKTIV',['Die Anzeigen wechseln von Rot auf Grün. Ein Generator fährt wieder hoch.',`Relais versorgt: ${['A','B','C'].filter(k=>flags['relay'+k]).length}/3.`],[['Weiter',hide]])}else{show('RELAIS '+id+' · FEHLER',['Falsche Schaltfolge. Die drei Symbole blinken rot und die Eingabe wird zurückgesetzt.','Im Dienstprotokoll steht die richtige Reihenfolge.'],[['Erneut eingeben',()=>{sequence=[];render()}],['Abbrechen',hide]])}return}
show('RELAIS '+id+' · SCHALTPULT',[`Wähle die drei Symbole in der richtigen Reihenfolge. Eingabe: ${sequence.map(n=>symbols[n]).join(' → ')||'—'}`],[...symbols.map((s,n)=>[s,()=>{sequence.push(n);render()}]),['Zurück',hide]])};render()}
function archive2(){if(!['A','B','C'].every(k=>flags['relay'+k])){show('FUNKSPEICHER GESPERRT',[`Nur ${['A','B','C'].filter(k=>flags['relay'+k]).length} von 3 Relais versorgen das Archiv.`],[['Zurück',hide]]);return}
if(flags.tape){show('FUNKSPEICHER',['Die aufgezeichnete Stimme endet immer an derselben Stelle: „Hör nicht auf den zweiten ...“'],[['Zurück',hide]]);return}
show('AUFZEICHNUNG · KANAL 00',[ 'Ein knisterndes Tonband beginnt zu laufen.',
'UNBEKANNTE STIMME: „Wenn jemand das hier hört: Schalte die Verbindung ab. Der zweite Sender lügt.“',
'Eine andere Stimme flüstert: „AURORA ist nicht der Anfang.“',
'Der Zeitstempel ist beschädigt. Der gespeicherte Ausschnitt lautet: „... vor dreißig Jahren ...“'
],[['Aufzeichnung sichern',()=>{flags.tape=true;persist();hide();message('Funkspruch gesichert · Sektorschleuse geöffnet')}]]);}
function exit2(){if(!flags.tape){show('SEKTORSCHLEUSE',['Die Steuerung benötigt die entschlüsselte Aufnahme aus dem Funkspeicher.'],[['Weiter',hide]]);return}
show('KAPITEL 2 ABGESCHLOSSEN',[
'Du erreichst die Schleuse unter Alarm. Hinter dir schlägt der Schatten gegen die Sicherheitstür. Du hast den Verfolger abgeschüttelt.',
'ELIAN: „Wenn dir da unten jemand begegnet, frag nicht zuerst nach seinem Namen. Frag, wie lange er schon dort ist.“',
'Hinter der Schleuse beginnt Sektor Null. Aus der Dunkelheit dringt das rhythmische Geräusch schwerer Schritte.'
],[['Kapitel 3 beginnen',()=>{progress.completed2=true;progress.chapter=3;progress.position3=null;save();hide();start(3)}],['Später fortsetzen',()=>{progress.completed2=true;progress.chapter=3;save();close()}]])}
function chapterThree(){scene={w:38,h:25,title:'KAPITEL 3 · SEKTOR NULL',subtitle:'Das Sicherheitsarchiv'};roomWalls(scene.w,scene.h);
for(let x=5;x<33;x++){if(![9,10,21,22,29].includes(x))wall(x,10);if(![6,7,17,18,29,30].includes(x))wall(x,17)}
for(let y=3;y<22;y++){if(![6,7,14,15,20].includes(y))wall(19,y)}
for(const [x,y] of [[8,5],[9,5],[27,5],[27,6],[13,13],[14,13],[24,19],[25,19],[32,20],[33,20]])wall(x,y);
scene.nodes=[node('entrance',4,4,'Wartungskonsole','#9dcfea',console3),node('idcard',9,20,'Sicherheitsausweis','#ffe69f',card3),node('relay',30,5,'Überwachungskonsole','#9cfff4',surveillance3),node('data',29,13,'Archivterminal','#ceafff',data3),node('portal',35,21,'Portalraum','#ff9fcc',portal3),node('journal',5,21,'Wartungslog','#d2e4ff',log3)];
guards=[{axis:'x',from:11*tile,to:17*tile,y:7*tile+27,t:0,dir:1},{axis:'y',from:12*tile,to:16*tile,x:25*tile+27,t:1.1,dir:1},{axis:'x',from:22*tile,to:32*tile,y:21*tile+27,t:2.2,dir:-1}];
if(progress.position3&&progress.chapter===3){player.x=progress.position3.x;player.y=progress.position3.y}else at(3,4);player.hearts=3;player.invulnerable=1.5;}
function console3(){show('SICHERHEITSKONSOLE · AURORA',[
'„Zugang Sektor Null. Die Anlage wurde nicht evakuiert. Sie wurde abgeriegelt.“',
'„Drei Wächter kontrollieren die Korridore. Halte Abstand und nutze die Wände als Deckung.“',
'„Für das Archiv brauchst du einen Ausweis aus dem Materiallager. An der Überwachungskonsole kannst du die Patrouillen für kurze Zeit abschalten.“'
],[['Verstanden',()=>{flags.terminal=true;persist();hide()}]])}
function card3(){if(flags.card){show('MATERIALLAGER',['Die Kiste ist leer. Den Ausweis trägst du bereits bei dir.'],[['Zurück',hide]]);return}show('MATERIALLAGER',[ 'Zwischen alten Schaltplänen liegt ein Sicherheitsausweis.',
'Name: DR. E. VALE · Stufe: 04. Das Foto wurde entfernt.',
'Jemand hat auf die Rückseite geschrieben: „IRIS weiß es. Aber sie darf es nicht erinnern.“'
],[['Ausweis mitnehmen',()=>{flags.card=true;persist();hide();message('Sicherheitsausweis erhalten')}]]);}
function surveillance3(){show('ÜBERWACHUNGSKONSOLE',[ 'Die Kameras zeigen leere Flure. Dann erscheint für einen Augenblick ein Gesicht direkt vor dem Objektiv.',
'Unter dem Bild blinkt „PROTOKOLL: RUHE“ – damit lassen sich die Wächter kurzzeitig außer Betrieb setzen.'
],[['Patrouillen 18 Sekunden abschalten',()=>{flags.silence=seconds+18;persist();hide();message('Patrouillen kurzzeitig deaktiviert')}],['Zurück',hide]])}
function data3(){if(!flags.card){show('ARCHIVTERMINAL',['Zugang verweigert. Sicherheitsfreigabe Stufe 04 erforderlich. Suche im Materiallager nach einem Ausweis.'],[['Zurück',hide]]);return}if(flags.archive){show('ARCHIVTERMINAL',['Die Datei ECHO-00 wurde bereits übertragen.'],[['Zurück',hide]]);return}show('ECHO-00 · VERSCHLUSSSACHE',[
'Der Bildschirm zeigt hunderte Male dieselbe Zeile: „DATUM UNGÜLTIG“.',
'Ein letzter Eintrag lässt sich öffnen: „Das Experiment wurde vor seiner eigenen Erfindung aktiviert.“',
'IRIS: „Diese Datei dürfte nicht existieren. Jemand hat Erinnerungen in die Vergangenheit gesendet.“',
'DU: „Wer?“',
'IRIS: „Ich finde einen Namen. Aber jedes Mal, wenn ich ihn ausspreche, verschwindet er.“'
],[['Datei sichern',()=>{flags.archive=true;persist();hide();message('ECHO-00 gesichert · Portalraum geöffnet')}]]);}
function log3(){show('WARTUNGSLOG',[
'„Unser Beobachter behauptete heute, die Korridore seien gestern noch anders verlaufen.“',
'„Der Bauplan sagt, die Anlage sei seit dreißig Jahren unverändert. Die Türen erinnern sich offenbar an etwas anderes.“'
],[['Zurück',hide]])}
function portal3(){if(!flags.archive){show('PORTALRAUM VERSCHLOSSEN',['Das Portal benötigt die Freigabe aus dem Archivterminal.'],[['Zurück',hide]]);return}
show('KAPITEL 3 ABGESCHLOSSEN',[
'Der Bogen erwacht und wirft blaue Schatten über den Boden. IRIS versucht, eine Verbindung zur Station herzustellen.',
'IRIS: „Warte. Die Welt auf der anderen Seite gehorcht anderen Regeln.“',
'DU: „Was für Regeln?“',
'IRIS: „Dort gibt es nur noch zwei Dimensionen. Und etwas läuft hinter dir.“',
'Der Schatten erreicht die Schwelle, aber das Portal schließt sich hinter dir. Du hast die Verfolgung überlebt.'
],[['Kapitel 4 · Der Riss',()=>{progress.completed3=true;progress.chapter=4;save();close();go4()}],['Später fortsetzen',()=>{progress.completed3=true;progress.chapter=4;save();close()}]])}
function show(title,paragraphs,actions){paused=true;dialogOpen=true;modal.style.display='flex';box.replaceChildren();let h=document.createElement('h2');h.textContent=title;box.append(h);for(const t of paragraphs){let p=document.createElement('p');p.textContent=t;box.append(p)}for(const [label,cb] of actions){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',cb);box.append(b)}}
function hide(){modal.style.display='none';paused=false;dialogOpen=false;last=performance.now()}
function persist(){setSavePosition();refreshNav()}
function message(msg){toast=msg;toastUntil=seconds+3.3}
function objective(){if(chapter===2){const done=['A','B','C'].filter(k=>flags['relay'+k]).length;return !flags.elian?'Sprich mit Elian am Bahnsteig.':done<3?`Aktiviere die drei Relais (${done}/3).${flags.note?' Reihenfolge im Dienstprotokoll gefunden.':' Suche das Dienstprotokoll.'}`:!flags.tape?'Entschlüssele die Nachricht am Funkspeicher.':'FLIEH vor dem Schatten zur Schleuse im Osten! Nutze deinen Energiestoß, um ihn kurz aufzuhalten.'}
return !flags.card?'Finde den Sicherheitsausweis im Materiallager.':!flags.archive?'Erreiche das Archivterminal. Meide die Wächter.':'FLIEH zum Portal im Südosten! Schalte Drohnen mit Energiepulsen aus.'}
function nearest(){let best=null,d=Infinity;for(const n of scene.nodes){const r=Math.hypot(n.x-player.x,n.y-player.y);if(r<83&&r<d){best=n;d=r}}return best}
function interact(){if(!active)return;if(dialogOpen)return;const n=nearest();if(n)n.cb();else message('Kein Gegenstand in Reichweite. Suche die leuchtenden Markierungen.')}
function journal(){if(!active)return;show(`JOURNAL · KAPITEL ${chapter}`,[objective(), chapter===2?'Aktiviere Relais und funke den Notruf. Energieschüsse (F / linke Maustaste / ENERGIE) stoppen Drohnen. Nach der Aufnahme beginnt die Flucht.':'Wächter und Drohnen lassen sich mit Energieimpulsen kurzzeitig außer Gefecht setzen. Fliehe mit dem Archivbeweis zum Portal.',`Fortschritt: Kapitel 2 ${progress.completed2?'abgeschlossen':'offen'} · Kapitel 3 ${progress.completed3?'abgeschlossen':'offen'}.`],[['Weiter erkunden',hide],['Zur Station',close]])}
function start(which){if(which!==2&&which!==3)return false;close();chapter=which;flags={...(progress['flags'+which]||{})};if(chapter===2)chapterTwo();else chapterThree();resetAction();active=true;progress.chapter=chapter;save();paused=true;root.style.display='block';resize();refreshHUD();last=performance.now();
show(chapter===2?'KAPITEL 2 · DER LETZTE FUNKSPRUCH':'KAPITEL 3 · SEKTOR NULL',chapter===2?[
'Die Station AURORA zittert unter einem tiefen Dröhnen. Im verlassenen Transitknoten blinkt eine einzige Lampe.',
'Ein älterer Techniker winkt dir zu. Hinter ihm sind die Zugänge zu drei Relais ausgefallen.',
'Achtung: Die Sicherheitsdrohnen sind aktiv. Verteidige dich mit Energieschüssen und fliehe nach dem Funkspruch durch die Schleuse.']: [
'Hinter der Schleuse liegt ein Bereich, den niemand auf den Plänen eingezeichnet hat.',
'Du hörst langsame Schritte. Sicherheitswächter durchsuchen die Korridore. Nutze Wände als Deckung.',
'Sammle den Ausweis, sichere ECHO-00, halte die Wächter mit Energieimpulsen auf und entkomme dem Schatten durch das Portal.'
],[['Weiter',hide],['Zur Station',close]]);raf=requestAnimationFrame(loop);refreshNav();return true}
function close(){if(!active)return;setSavePosition();active=false;paused=true;root.style.display='none';modal.style.display='none';keys.clear();joy.x=joy.y=0;cancelAnimationFrame(raf);refreshNav()}
function go4(){if(window.NEON_CHAPTERS?.start4)window.NEON_CHAPTERS.start4();else message('Kapitel 4 wird nicht geladen. Bitte chapters.js prüfen.')}
function go5(){if(window.NEON_CHAPTERS?.start5)window.NEON_CHAPTERS.start5()}
function enterNext(){const n=nextChapter();if(n===1){if($('start').style.display!=='none')$('play').click();else{window.scrollTo?.(0,0)}}else if(n===2||n===3)start(n);else if(n===4)go4();else if(n===5)go5();else if(n===6&&window.NEON_CITY)window.NEON_CITY.start()}
function refreshNav(){const next=nextChapter(),labels={1:'Kapitel 1 · AURORA',2:'Kapitel 2 · Funkspruch',3:'Kapitel 3 · Sektor Null',4:'Kapitel 4 · Der Riss',5:'Kapitel 5 · Wahrheit',6:'VESPER 3D · 30 Jahre zuvor'};
if($('storyContinue')){$('storyContinue').style.display=next>1?'inline-block':'none';$('storyContinue').textContent='Fortsetzen → '+labels[next]}
if($('storyNext'))$('storyNext').textContent=next===1?'Kapitel 1 spielen':'Fortsetzen: Kapitel '+(next===6?'VESPER':next);
if($('storyReplay'))$('storyReplay').style.display=chapter1Complete()?'inline-block':'none';
}
const launcher=$('chapterLauncher');if(launcher)launcher.style.display='none';const nav=document.createElement('div');nav.id='storyNav';nav.innerHTML='<button id="storyNext">Kapitel 1 spielen</button><button id="storyReplay" style="display:none">Kapitel 1 erneut</button><button id="storyAction2">Kapitel 2 · Action</button><button id="storyAction3">Kapitel 3 · Action</button>'; document.body.append(nav);
$('storyAction2').onclick=()=>{progress.position2=null;progress.flags2={};start(2)};$('storyAction3').onclick=()=>{progress.position3=null;progress.flags3={};start(3)};$('storyNext').onclick=enterNext;$('storyReplay').onclick=()=>{if($('start').style.display!=='none')$('play').click();else message('Du befindest dich in der Station. Suche den Kern, um Kapitel 1 erneut anzusehen.')};
const button=document.createElement('button');button.id='storyContinue';button.textContent='Fortsetzen';$('start').append(button);button.onclick=enterNext;
function refreshHUD(){$('s23name').textContent=scene.title;$('s23objective').textContent=objective();$('s23health').textContent='Schutzenergie: '+('♥ '.repeat(Math.max(0,player.hearts)))+'  ·  Drohnen: '+actionKills+'  ·  F / MAUS / ENERGIE: Energieschuss'+(alarmPhase?'  ·  FLIEH!':'');}
function step(dt){seconds+=dt;player.invulnerable=Math.max(0,player.invulnerable-dt);let vx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;let vy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joy.y;const len=Math.hypot(vx,vy);if(len>.07){vx/=Math.max(1,len);vy/=Math.max(1,len);const speed=player.speed*(alarmPhase?1.2:1)*dt;if(!blocked(player.x+vx*speed,player.y))player.x+=vx*speed;if(!blocked(player.x,player.y+vy*speed))player.y+=vy*speed}
if(chapter===3){for(const guard of guards){guard.stun=Math.max(0,(guard.stun||0)-dt);if(guard.stun>0)continue;guard.t+=dt*1.1;const n=(Math.sin(guard.t)+1)/2;if(guard.axis==='x'){guard.x=guard.from+(guard.to-guard.from)*n;guard.y=guard.y??0}else{guard.y=guard.from+(guard.to-guard.from)*n;guard.x=guard.x??0}
if(seconds<(Number(flags.silence)||0)||player.invulnerable>0)continue;
const dist=Math.hypot(guard.x-player.x,guard.y-player.y);if(dist<126&&line(guard.x,guard.y,player.x,player.y)){actionDamage();break}}}updateAction(dt)}
function cam(){return {x:Math.max(0,Math.min(scene.w*tile-viewW,player.x-viewW/2)),y:Math.max(0,Math.min(scene.h*tile-viewH,player.y-viewH/2))}}
function render(){if(!active)return;const c=cam();ctx.fillStyle='#050e19';ctx.fillRect(0,0,viewW,viewH);ctx.save();ctx.translate(-Math.floor(c.x),-Math.floor(c.y));const fromX=Math.max(0,Math.floor(c.x/tile)-1),toX=Math.min(scene.w,Math.ceil((c.x+viewW)/tile)+1),fromY=Math.max(0,Math.floor(c.y/tile)-1),toY=Math.min(scene.h,Math.ceil((c.y+viewH)/tile)+1);
for(let y=fromY;y<toY;y++)for(let x=fromX;x<toX;x++){const px=x*tile,py=y*tile,w=isWall(x,y);ctx.fillStyle=w?'#263949':(chapter===2?(y<10?'#182c3d':'#1c2e39'):'#182a37');ctx.fillRect(px,py,tile,tile);if(w){ctx.fillStyle='#426079';ctx.fillRect(px,py,tile,6);ctx.fillStyle='#0b1626';ctx.fillRect(px+4,py+10,tile-8,tile-17)}else{ctx.strokeStyle='#ffffff0c';ctx.strokeRect(px+.5,py+.5,tile-1,tile-1);if((x*29+y*17)%11===0){ctx.fillStyle='#63e9db25';ctx.fillRect(px+7,py+7,4,4)}}}
for(let j=1;j<=5;j++){const gx=j*6*tile;ctx.fillStyle='#71d9dc19';ctx.fillRect(gx,3*tile,4,scene.h*tile-6*tile)}
for(const n of scene.nodes){let done=false;if(chapter===2){done=n.id.startsWith('relay')?!!flags[n.id]:n.id==='archive'?!!flags.tape:false}else done=n.id==='idcard'?!!flags.card:n.id==='data'?!!flags.archive:false;
ctx.globalAlpha=done?.45:1;ctx.fillStyle=n.color+'32';ctx.beginPath();ctx.arc(n.x,n.y,25+3*Math.sin(seconds*2+n.x),0,7);ctx.fill();ctx.fillStyle=n.color;ctx.fillRect(n.x-13,n.y-13,26,26);ctx.fillStyle='#102431';ctx.fillRect(n.x-7,n.y-8,14,15);ctx.globalAlpha=1;ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#d6eef6';ctx.fillText(n.label,n.x,n.y-28)}
if(chapter===3){for(const guard of guards){const silent=seconds<(Number(flags.silence)||0)||guard.stun>0;ctx.fillStyle=silent?'#6f928f55':'#e7588c2e';ctx.beginPath();ctx.arc(guard.x,guard.y,125,0,7);ctx.fill();ctx.fillStyle=silent?'#688f8b':'#ef6b9d';ctx.fillRect(guard.x-16,guard.y-16,32,32);ctx.fillStyle='#182639';ctx.fillRect(guard.x-9,guard.y-5,18,9)}}
drawAction();if(!player.invulnerable||Math.floor(seconds*9)%2){ctx.fillStyle='#051523';ctx.beginPath();ctx.arc(player.x,player.y+4,19,0,7);ctx.fill();ctx.fillStyle='#91f2d9';ctx.fillRect(player.x-10,player.y-10,20,20);ctx.fillStyle='#133c4a';ctx.fillRect(player.x-7,player.y-7,14,7);ctx.strokeStyle='#dff5c0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x+aimX*21,player.y+aimY*21);ctx.stroke()}ctx.restore();if(screenFlash>0){ctx.fillStyle='rgba(251,57,88,'+(screenFlash*.45)+')';ctx.fillRect(0,0,viewW,viewH)}const near=nearest();hint.style.display=near&&!dialogOpen?'block':'none';if(near)hint.textContent='E / AKTION · '+near.label;
if(seconds<toastUntil){ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#9cf5df';ctx.fillText(toast,viewW/2,83)}refreshHUD()}
function loop(now){if(!active)return;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;if(!paused)step(dt);render();raf=requestAnimationFrame(loop)}
window.addEventListener('keydown',e=>{if(!active)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','e',' ','f','w','a','s','d'].includes(k))e.preventDefault();keys.add(k);if(!e.repeat&&(k==='e'||k===' '))interact();if(k==='f')firePulse();if(!e.repeat&&k==='j')journal()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());window.addEventListener('resize',()=>{if(active)resize()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)setSavePosition()});
$('s23exit').onclick=close;$('s23journal').onclick=journal;$('s23act').addEventListener('pointerdown',e=>{e.preventDefault();interact()});const shootButton=$('s23shoot');shootButton.addEventListener('pointerdown',e=>{e.preventDefault();fireHeld=true;firePulse();shootButton.setPointerCapture(e.pointerId)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])shootButton.addEventListener(ev,()=>fireHeld=false);canvas.addEventListener('pointerdown',e=>{if(!active||dialogOpen||e.pointerType==='touch')return;const rect=canvas.getBoundingClientRect(),c=cam();firePulse(e.clientX-rect.left+c.x,e.clientY-rect.top+c.y)});
const stick=$('s23stick'),nub=$('s23nub');function move(e){const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,max=r.width*.32,k=Math.min(1,max/(Math.hypot(dx,dy)||1));joy.x=dx*k/max;joy.y=dy*k/max;nub.style.transform=`translate(${dx*k}px,${dy*k}px)`}
stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.id=e.pointerId;stick.setPointerCapture(e.pointerId);move(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)move(e)});for(const evt of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(evt,e=>{if(joy.id===e.pointerId){joy.id=null;joy.x=joy.y=0;nub.style.transform='translate(0,0)'}});
window.NEON_STORY={start,close,refresh:refreshNav,continue:enterNext,get active(){return active},get next(){return nextChapter()},get progress(){return {...progress}}};refreshNav();
})();
