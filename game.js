/* NEON RIFT: ECHOES — Episodes 1–3. Pure Canvas, no external libraries. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d'),mapCanvas=$('mapCanvas'),mc=mapCanvas.getContext('2d');
const T=48, SAVE='neon-rift-echoes-episodes-v2', LEGACY='neon-rift-echoes-v1';
const keys=new Set(),joy={x:0,y:0,pointer:null};
const pointer={x:0,y:0,active:false};
const touchMode=matchMedia('(pointer:coarse)').matches;
let vw=innerWidth,vh=innerHeight,dpr=1,now=0,prev=0,frame=0;
let started=false,paused=false,dead=false,mapOpen=false,dialogue=null,dialogIndex=0,dialogDone=null;
let tiles=[],details=[],nodes=[],enemies=[],shots=[],enemyShots=[],sparks=[],pickups=[],worldW=0,worldH=0,W=0,H=0;
let waves=null,chaseTime=60,chaseSpawn=0,bossActive=false,alarm=0,toastUntil=0,bannerUntil=0,saveClock=0;
let pathFlow=[],pathCell="",pathCooldown=0;
let progress={chapter:1,c1:{fragments:[],flags:{},complete:false},c2:{stage:0,complete:false},c3:{stage:0,locks:[],complete:false},position:null};
const player={x:0,y:0,r:13,dir:0,hp:100,maxHp:100,invuln:0,dashCd:0,dashTime:0,dashDx:0,dashDy:0,fireCd:0,aimX:1,aimY:0};
const chapters={
  1:{name:'KAPITEL 1 · STATION AURORA',region:'Forschungsstation AURORA',w:52,h:36,start:[5,7]},
  2:{name:'KAPITEL 2 · DIE VERGESSENE STADT',region:'Sektor NOCTIS',w:60,h:40,start:[7,8]},
  3:{name:'KAPITEL 3 · NULLPUNKT',region:'Tiefenanlage OMEGA',w:58,h:38,start:[11,9]}
};
const C1NODES=[
  ['terminal','Notfallterminal',7,7,'terminal','#72dafa'],['iris','IRIS',15,8,'npc','#a8f6d0'],
  ['archive','Archivkonsole',35,7,'fragment','#ffe29c'],['garden','Gewächshaus-Sensor',38,27,'fragment','#ffe29c'],
  ['reactor','Reaktorspeicher',11,27,'fragment','#ffe29c'],['door','Sicherheitsschleuse',25,17,'door','#f28ab3'],
  ['core','Zentraler Kern',27,19,'core','#c5a4ff'],['log1','Tagebuch',18,28,'log','#83caff'],
  ['log2','Datenspur',39,11,'log','#83caff']
];
const C2NODES=[
  ['mara','MARA · Funkerin',18,9,'npc','#92f3e5'],
  ['arena','Sicherheitsterminal',30,19,'arena','#ffbd80'],
  ['battery','Energiezelle',46,9,'battery','#ffe98e'],
  ['exit','Evakuierungstunnel',7,32,'exit','#a4f2ff'],
  ['log2a','Stadtarchiv',17,31,'log','#85d7ff'],
  ['heal2','Erste-Hilfe-Automat',51,31,'heal','#9af9bf']
];
const C3NODES=[
  ['iris3','IRIS · Uplink',11,9,'npc','#a5f9de'],
  ['lockA','Sicherungsanker A',12,29,'lock','#ffca81'],
  ['lockB','Sicherungsanker B',45,29,'lock','#ffca81'],
  ['relay','Signal-Relais',29,19,'relay','#9dd9ff'],
  ['bossConsole','Kernwächter',45,9,'boss','#ff7da5'],
  ['portal','ECHO-Portal',47,30,'portal','#c9abff'],
  ['log3a','Alter Datenträger',18,9,'log','#9bd1ff'],
  ['heal3','Erste-Hilfe-Automat',37,19,'heal','#9af9bf']
];
function cloneNodes(raw){return raw.map(([id,name,x,y,type,color])=>({id,name,x,y,type,color}));}
function tile(x,y){return tiles[y]?.[x] ?? 1;}
function wall(x,y){if(x>=0&&x<W&&y>=0&&y<H)tiles[y][x]=1;}
function floor(x,y){if(x>0&&x<W-1&&y>0&&y<H-1)tiles[y][x]=0;}
function hollow(x1,y1,x2,y2,doorX,doorY){
  for(let x=x1;x<=x2;x++){wall(x,y1);wall(x,y2);}
  for(let y=y1;y<=y2;y++){wall(x1,y);wall(x2,y);}
  if(doorX!==undefined){for(let x=doorX-1;x<=doorX+1;x++)floor(x,doorY);}
  if(doorY===undefined){for(let y=y1+1;y<y2;y++)floor(doorX,y);}
}
function initTiles(w,h){W=w;H=h;worldW=W*T;worldH=H*T;tiles=Array.from({length:H},()=>Array(W).fill(0));details=[];for(let x=0;x<W;x++){wall(x,0);wall(x,H-1);}for(let y=0;y<H;y++){wall(0,y);wall(W-1,y);}}
function buildMap(ch){
  const data=chapters[ch];initTiles(data.w,data.h);
  if(ch===1){
    for(let x=2;x<50;x++){if(x<22||x>30){wall(x,15);wall(x,21);}}
    for(let y=2;y<34;y++){if(y<14||y>22){wall(23,y);wall(30,y);}}
    for(const x of [5,12,19,34,41,47]){floor(x,15);floor(x,21);}
    for(const y of [6,11,26,31]){floor(23,y);floor(30,y);}
    for(let y=16;y<=20;y++)for(let x=22;x<=31;x++)floor(x,y);
    for(let y=3;y<14;y++)for(let x=3;x<22;x++)if((x*19+y*31)%61===0)details.push({x,y,type:'crate'});
    for(let y=3;y<14;y++)for(let x=32;x<49;x++)if((x*11+y*7)%43===0)details.push({x,y,type:'server'});
    for(let y=23;y<33;y++)for(let x=32;x<49;x++)if((x+y*3)%13===0)details.push({x,y,type:'plant'});
    for(let y=23;y<33;y++)for(let x=3;x<22;x++)if((x*3+y)%17===0)details.push({x,y,type:'pipe'});
    nodes=cloneNodes(C1NODES);
  }else if(ch===2){
    hollow(13,3,23,15,18,15);
    hollow(38,3,55,15,46,15);
    hollow(13,25,23,37,18,25);
    hollow(38,25,55,37,46,25);
    for(let y=17;y<=23;y++)for(let x=25;x<=36;x++)floor(x,y);
    for(let x=4;x<W-4;x+=5){
      if(x>24&&x<36)continue;
      details.push({x,y:20,type:'roadlamp'});
    }
    for(let i=0;i<60;i++){
      const x=2+(i*17+9)%56,y=2+(i*23+5)%36;
      if(!tile(x,y)&&Math.hypot(x-30,y-19)>6&&Math.hypot(x-7,y-32)>5)details.push({x,y,type:i%3===0?'wreck':'rubble'});
    }
    nodes=cloneNodes(C2NODES);
  }else{
    hollow(4,3,20,15,11,15);
    hollow(35,3,54,15,45,15);
    hollow(4,23,20,35,12,23);
    hollow(35,23,54,35,45,23);
    for(let x=23;x<=33;x++)for(let y=17;y<=21;y++)floor(x,y);
    for(let y=4;y<34;y+=5)for(const x of [24,33])details.push({x,y,type:'lamp'});
    for(let x=5;x<55;x+=7)for(const y of [17,21])if(tile(x,y)===0)details.push({x,y,type:'pipe'});
    nodes=cloneNodes(C3NODES);
  }
}
function cleanCombat(){enemies=[];shots=[];enemyShots=[];sparks=[];pickups=[];waves=null;bossActive=false;chaseSpawn=0;alarm=0;pathFlow=[];pathCell="";pathCooldown=0;}
function loadProgress(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE));
    if(s&&s.c1&&s.c2&&s.c3){
      progress={...progress,...s,c1:{...progress.c1,...s.c1},c2:{...progress.c2,...s.c2},c3:{...progress.c3,...s.c3}};
      progress.chapter=Math.max(1,Math.min(3,Number(progress.chapter)||1));
      progress.c1.fragments=Array.isArray(progress.c1.fragments)?progress.c1.fragments:[];
      progress.c3.locks=Array.isArray(progress.c3.locks)?progress.c3.locks:[];
      return;
    }
  }catch(e){/* saves can be unavailable in private browsing */}
  try{
    const old=JSON.parse(localStorage.getItem(LEGACY));
    if(old&&old.state){
      progress.c1={fragments:old.state.fragments||[],flags:old.state.flags||{},complete:!!old.state.complete};
      progress.chapter=progress.c1.complete?2:1;
      if(!old.state.complete&&old.player)progress.position={chapter:1,x:old.player.x,y:old.player.y};
    }
  }catch(e){}
}
function persist(){
  try{progress.position={chapter:progress.chapter,x:player.x,y:player.y};localStorage.setItem(SAVE,JSON.stringify(progress));}catch(e){}
}
function restoreSpot(ch){
  const d=chapters[ch];let p=progress.position;
  const defaultSpot=ch===2?(progress.c2.stage>=3?[46,12]:progress.c2.stage>=2?[30,19]:[7,8]):ch===3?(progress.c3.stage>=3?[45,18]:progress.c3.stage>=2?[45,17]:progress.c3.stage>=1?[29,19]:[11,9]):d.start;
  player.x=(defaultSpot[0]+.5)*T;player.y=(defaultSpot[1]+.5)*T;
  if(p&&p.chapter===ch&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&!solidAt(p.x,p.y)){
    player.x=p.x;player.y=p.y;
  }
}
function setChapter(ch,forceStart=false){
  progress.chapter=ch;buildMap(ch);cleanCombat();dead=false;paused=false;mapOpen=false;$('mapOverlay').style.display='none';
  player.hp=player.maxHp;player.invuln=0;player.dashCd=0;player.fireCd=0;player.dir=0;
  restoreSpot(ch);
  if(forceStart){const at=chapters[ch].start;player.x=(at[0]+.5)*T;player.y=(at[1]+.5)*T;}
  if(ch===2&&progress.c2.stage===3){chaseTime=65;chaseSpawn=3;}
  if(ch===3&&progress.c3.stage===1)progress.c3.relayStarted=false;
  updateHUD();persist();
  displayBanner(chapters[ch].name,ch===1?'Das Signal erwacht':ch===2?'Die Oberfläche wartet':'Unter dem letzten Licht',2600);
}
function solidAt(x,y){return tile(Math.floor(x/T),Math.floor(y/T))!==0;}
function canMove(x,y,r=player.r){return !solidAt(x-r,y-r)&&!solidAt(x+r,y-r)&&!solidAt(x-r,y+r)&&!solidAt(x+r,y+r);}
function relocate(dx,dy){
  const nx=player.x+dx,ny=player.y+dy;
  if(canMove(nx,player.y))player.x=nx;
  if(canMove(player.x,ny))player.y=ny;
}
function resize(){
  vw=innerWidth;vh=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
function camera(){return {x:Math.max(0,Math.min(Math.max(0,worldW-vw),player.x-vw*.5)),y:Math.max(0,Math.min(Math.max(0,worldH-vh),player.y-vh*.5))};}
function textAt(x,y,s,color='#fff',font='12px system-ui',align='center'){
  ctx.fillStyle=color;ctx.font=font;ctx.textAlign=align;ctx.fillText(s,x,y);
}
function notify(text,duration=2600){$('toast').textContent=text;$('toast').style.display='block';toastUntil=performance.now()+duration;}
function displayBanner(title,sub,duration=2200){$('bannerTitle').textContent=title;$('bannerSub').textContent=sub;$('banner').style.display='block';bannerUntil=performance.now()+duration;}
function talk(lines,done){dialogue=lines;dialogIndex=0;dialogDone=done||null;showDialogue();}
function showDialogue(){
  if(!dialogue)return;
  const [speaker,text]=dialogue[dialogIndex];$('speaker').textContent=speaker;$('speech').textContent=text;$('dialog').style.display='block';
}
function advanceDialogue(){
  if(!dialogue)return;
  dialogIndex++;
  if(dialogIndex<dialogue.length){showDialogue();return;}
  dialogue=null;$('dialog').style.display='none';const cb=dialogDone;dialogDone=null;if(cb)cb();persist();
}
function objective(){
  if(progress.chapter===1){const n=progress.c1.fragments.length;return progress.c1.complete?'Zum zentralen Kern gehen · Kapitel 2 starten':n<3?`Signalfragmente sichern · ${n}/3`:'Zur Zentralkonsole gehen';}
  if(progress.chapter===2){
    return [
      'MARA im Funkhaus finden',
      waves?'Roboterwellen überleben · kämpfe!':'Sicherheitsterminal aktivieren',
      'Energiezelle im Nordosten finden',
      `FLUCHT! Zum Evakuierungstunnel · ${Math.ceil(chaseTime)} s`,
      'Kapitel 2 abgeschlossen'
    ][Math.min(4,progress.c2.stage)];
  }
  return [
    `Sicherungsanker freikämpfen · ${progress.c3.locks.length}/2`,
    waves?'Angriffswellen am Relais abwehren':'Signal-Relais aktivieren',
    bossActive?'KERNWÄCHTER BESIEGEN!':'Den Kernwächter aktivieren',
    'Zum ECHO-Portal im Südosten',
    'Kapitel 3 abgeschlossen'
  ][Math.min(4,progress.c3.stage)];
}
function updateHUD(){
  const ch=progress.chapter;$('chapterName').textContent=chapters[ch].name;
  $('quest').textContent='MISSION · '+objective();
  $('status').textContent=ch===1?'ERKUNDUNG':ch===2?(progress.c2.stage===3?'ALARM · EXTRAKTION':'STADT · WIDERSTAND'):'TIEFENANLAGE · SICHERHEITSSTUFE ROT';
  $('hpBar').style.width=Math.max(0,player.hp/player.maxHp*100)+'%';
  $('hpText').textContent=Math.ceil(player.hp)+' / '+player.maxHp;
  $('dashText').textContent=player.dashCd>0?'DASH '+player.dashCd.toFixed(1)+' s':'DASH BEREIT';
  $('dash').disabled=player.dashCd>0;
  $('dash').style.display=ch===1?'none':'flex';$('fire').style.display=ch===1?'none':'flex';
}
function nodeVisible(n){
  if(progress.chapter===2){
    if(n.id==='arena')return progress.c2.stage<=1;
    if(n.id==='battery')return progress.c2.stage>=2;
    if(n.id==='exit')return progress.c2.stage>=3;
  }
  if(progress.chapter===3){
    if(n.id==='relay')return progress.c3.stage>=1;
    if(n.id==='bossConsole')return progress.c3.stage>=2;
    if(n.id==='portal')return progress.c3.stage>=3;
  }
  return true;
}
function nearestNode(){
  let best=null,d=88;
  for(const n of nodes){
    if(!nodeVisible(n))continue;
    const distance=Math.hypot((n.x+.5)*T-player.x,(n.y+.5)*T-player.y);
    if(distance<d){d=distance;best=n;}
  }
  return best;
}
function interact(){
  if(dialogue){advanceDialogue();return;}
  if(mapOpen){toggleMap();return;}
  if(!started||paused||dead)return;
  const n=nearestNode();if(!n){notify('Kein Objekt in Reichweite.');return;}
  if(progress.chapter===1)interactC1(n);
  if(progress.chapter===2)interactC2(n);
  if(progress.chapter===3)interactC3(n);
}
function interactC1(n){
  const s=progress.c1;
  if(n.id==='terminal')return talk([['NOTFALLTERMINAL','AURORA, Jahr 2189. Drei Signalfragmente sind über die Station verteilt.'],['IRIS','Finde Archiv, Gewächshaus und Reaktor. Nur der zentrale Kern kann die Daten entschlüsseln.']]);
  if(n.id==='iris')return talk([['IRIS','Du bist zurück. Ich habe die Station so lange wie möglich offengehalten.'],['DU','Was ist mit ECHO passiert?'],['IRIS','Die Wissenschaftler empfingen eine Botschaft aus der Zukunft. Jemand versuchte, sie zu unterdrücken.']]);
  if(n.type==='fragment'){
    if(s.fragments.includes(n.id))return notify('Dieses Fragment hast du bereits.');
    const fragments={archive:['ARCHIV','Fragment 01: ECHO antwortete auf Fragen mit Erinnerungen.'],garden:['GEWÄCHSHAUS','Fragment 02: Das Signal ließ Pflanzen auf Musik reagieren.'],reactor:['REAKTOR','Fragment 03: Jemand schaltete die Energie absichtlich ab.']};
    return talk([fragments[n.id]],()=>{s.fragments.push(n.id);notify('Fragment gesichert · '+s.fragments.length+'/3');updateHUD();});
  }
  if(n.id==='door')return talk([['SICHERHEITSSCHLEUSE',s.fragments.length<3?`Zugriff eingeschränkt · ${s.fragments.length}/3 Fragmente vorhanden.`:'Zugriff gewährt · der zentrale Kern ist aktiv.']]);
  if(n.id==='core'){
    if(!s.complete){
      if(s.fragments.length<3)return talk([['KERN','Drei Signalfragmente sind erforderlich, bevor sich ECHO entschlüsseln lässt.']]);
      return talk([['IRIS','Das Signal ist vollständig. Die Nachricht stammt nicht aus den Sternen.'],['ECHO','„Eine Erinnerung an das, was diese Welt einmal sein wird.“'],['IRIS','Die Quelle liegt unter der verlassenen Stadt NOCTIS.'],['SYSTEM','KAPITEL 1 ABGESCHLOSSEN · Jetzt beginnt die gefährliche Reise.']],()=>{
        s.complete=true;progress.c2.stage=0;progress.position=null;
        setChapter(2,true);talk([['IRIS','Wir haben die Oberfläche erreicht. Ich erkenne aktive Sicherheitsroboter.'],['IRIS','Suche im alten Funkhaus nach MARA. Sie weiß, wie wir zur Quelle gelangen.']]);
      });
    }
    return talk([['IRIS','Du hast alle drei Fragmente. Sollen wir die Station verlassen?']],()=>{progress.position=null;setChapter(2,true);});
  }
  if(n.id==='log1')return talk([['PERSÖNLICHES LOG','„Manchmal fürchte ich nicht das Unbekannte, sondern das, was wir bereits wissen.“']]);
  if(n.id==='log2')return talk([['FORSCHUNGSNOTIZ','„Die Zukunft hat eine Stimme. Aber wem gehört sie?“']]);
}
function interactC2(n){
  const s=progress.c2;
  if(n.id==='mara'){
    if(s.stage===0)return talk([['MARA','Endlich jemand, der nicht aus Metall besteht. NOCTIS ist seit Wochen verriegelt.'],['DU','Wir suchen den Ursprung von ECHO.'],['MARA','Dann müsst ihr den Strom im Nordosten wiederherstellen. Zuerst musst du aber das Sicherheitsnetz ausschalten.'],['MARA','Nutze das Terminal auf dem großen Platz. Dort erwarten dich mehrere Roboterwellen. Drücke FEUER oder Leertaste, um zu schießen.']],()=>{s.stage=1;notify('NEUE MISSION · Sicherheitsnetz abschalten');updateHUD();});
    return talk([['MARA','Die Energiezelle im Nordosten ist euer Schlüssel. Pass auf die Wachroboter auf.']]);
  }
  if(n.id==='arena'){
    if(s.stage===0)return notify('Suche zuerst MARA im Funkhaus.');
    if(s.stage>=2)return talk([['SICHERHEITSTERMINAL','Wachprotokoll deaktiviert. Zugang zur Energiekammer offen.']]);
    if(waves)return notify('Halte durch! Die Wellen laufen bereits.');
    talk([['SYSTEM','UNBEFUGTER ZUGRIFF ERKANNT. Sicherheitsdrohnen starten Angriff.'],['IRIS','Bleib in Bewegung und schieße! Zwei Wellen, dann können wir den Zugang öffnen.']],()=>startWaves(2,[3,4],['scout','gunner']));return;
  }
  if(n.id==='battery'){
    if(s.stage<2)return talk([['LABOR','Die Energiezelle ist versiegelt. Deaktiviere zuerst das Sicherheitsnetz.']]);
    if(s.stage>=3)return notify('Die Energiezelle ist bereits in deinem Rucksack.');
    return talk([['LABOR','Energiezelle gesichert. Die Türsensoren beginnen zu blinken.'],['IRIS','Alarm! Eine Verfolgungseinheit wurde aktiviert. Wir müssen zum Evakuierungstunnel im SÜDWESTEN.'],['MARA · FUNK','Lauf! Bleib nicht stehen, um jeden Roboter zu besiegen. Du hast 65 Sekunden.']],()=>{
      s.stage=3;chaseTime=65;chaseSpawn=2;player.hp=Math.max(player.hp,65);displayBanner('FLUCHT!','Zum Tunnel im Südwesten · 65 Sekunden',3100);updateHUD();persist();
    });return;
  }
  if(n.id==='exit'){
    if(s.stage<3)return notify('Wir brauchen zuerst die Energiezelle.');
    return talk([['MARA · FUNK','Du hast es geschafft! Die Energiezelle gibt uns Zugang zur unterirdischen Anlage.'],['IRIS','Der Kern unter der Stadt heißt OMEGA. Dort wartet nicht nur ECHO – dort wacht auch sein Wächter.'],['SYSTEM','KAPITEL 2 ABGESCHLOSSEN · Flucht aus NOCTIS gelungen.']],()=>{
      s.complete=true;s.stage=4;progress.position=null;
      setChapter(3,true);
      talk([['IRIS','Willkommen in OMEGA. Die Anlage ist noch aktiv.'],['IRIS','Löse die beiden Sicherungsanker im Süden, überlebe die Relaisverteidigung und finde den Kernwächter.']]);
    });
  }
  if(n.id==='log2a')return talk([['STADTARCHIV','„Projekt OMEGA: Autonome Hüter verteidigen das Echo-Archiv. Deaktivierung nur über zwei Sicherungsanker möglich.“']]);
  if(n.id==='heal2')return healTerminal(n);
}
function interactC3(n){
  const s=progress.c3;
  if(n.id==='iris3')return talk([['IRIS','Die Anker liegen im Südwesten und Südosten. Sie werden von Robotern bewacht.'],['IRIS','Schalte beide frei, dann aktiviere das Relais in der Mitte.']]);
  if(n.type==='lock'){
    if(s.locks.includes(n.id))return notify('Dieser Anker ist bereits gesichert.');
    if(s.stage>0)return notify('Alle Anker sind bereits deaktiviert.');
    if(alarm===n.id||enemies.some(e=>e.guard===n.id))return notify('Besiege zuerst die Wächter dieses Ankers.');
    alarm=n.id;
    talk([['OMEGA · SICHERHEIT','Zugriff verweigert. Zwei Verteidigungseinheiten werden aktiviert.'],['IRIS','Besiege beide Roboter. Dann kann ich den Anker entschlüsseln.']],()=>{
      spawnEnemy('scout',(n.x-2.2)*T,(n.y-2)*T,{guard:n.id});
      spawnEnemy('gunner',(n.x+2.4)*T,(n.y-2)*T,{guard:n.id});
      notify('ANKER-VERTEIDIGUNG · 2 Roboter',1900);
    });return;
  }
  if(n.id==='relay'){
    if(s.stage===0)return notify('Zuerst beide Sicherungsanker sichern.');
    if(s.stage>=2)return talk([['RELAIS','Sicherung abgeschlossen. Der Weg zum Kernwächter ist offen.']]);
    if(waves)return notify('Das Relais muss verteidigt werden!');
    return talk([['IRIS','Das Relais fährt hoch. Die Station schickt einen letzten Abfangtrupp.'],['SYSTEM','DREI VERTEIDIGUNGSWELLEN · Halte die Stellung!']],()=>startWaves(3,[3,4,5],['scout','gunner','heavy']));
  }
  if(n.id==='bossConsole'){
    if(s.stage<2)return notify('Kernwächter versiegelt. Aktiviere zuerst das Relais.');
    if(s.stage>=3)return talk([['IRIS','Der Kernwächter ist deaktiviert. Du hast den Weg zum Portal geöffnet.']]);
    if(bossActive)return notify('Kernwächter aktiv!');
    talk([['OMEGA','PRIMÄRER WÄCHTER ONLINE.'],['IRIS','Achtung: Der Kernwächter setzt Impulsfeuer und Begleitdrohnen ein. Bleib in Bewegung!'],['DU','Dann wird er erfahren, wie hartnäckig Menschen sind.']],()=>{
      bossActive=true;spawnEnemy('boss',50*T,7*T);displayBanner('BOSS · KERNWÄCHTER','Weiche Projektilen aus · greife an',2500);
    });return;
  }
  if(n.id==='portal'){
    if(s.stage<3)return notify('Das Portal wird noch vom Kernwächter geschützt.');
    return talk([['IRIS','ECHO ist kein Feind. Es ist eine Nachricht aus einer Zukunft, die noch nicht geschrieben wurde.'],['ECHO','„Ihr habt gekämpft, um uns zuzuhören. Jetzt könnt ihr entscheiden, was aus dieser Welt wird.“'],['DU','Dann machen wir es besser.'],['SYSTEM','KAPITEL 3 ABGESCHLOSSEN · ENDE DER ERSTEN TRILOGIE.']],()=>{
      s.stage=4;s.complete=true;persist();showEnding();
    });
  }
  if(n.id==='log3a')return talk([['OMEGA · ARCHIV','Die Roboter wurden erschaffen, um das Signal vor Menschen zu schützen – doch irgendwann verwechselten sie jeden Besucher mit einer Bedrohung.']]);
  if(n.id==='heal3')return healTerminal(n);
}
function healTerminal(n){
  if(player.hp>=player.maxHp)return notify('Dein Anzug ist bereits voll geladen.');
  player.hp=Math.min(player.maxHp,player.hp+45);sparkBurst((n.x+.5)*T,(n.y+.5)*T,'#92ffcd',17);notify('Reparatur: +45 HP');updateHUD();
}
function random(min,max){return min+Math.random()*(max-min);}
function spawnEnemy(type,x,y,opts={}){
  const stats={scout:{hp:58,speed:113,r:16,damage:12,color:'#ff7791'},gunner:{hp:64,speed:76,r:17,damage:10,color:'#ffa26a'},heavy:{hp:125,speed:65,r:21,damage:19,color:'#d385ff'},boss:{hp:620,speed:54,r:32,damage:24,color:'#ff6eab'}}[type];
  let sx=x,sy=y;
  for(let n=0;n<12&&solidAt(sx,sy);n++){sx=x+random(-120,120);sy=y+random(-120,120);}
  if(solidAt(sx,sy))return null;
  const enemy={type,x:sx,y:sy,...stats,maxHp:stats.hp,rangedCd:random(.4,1.6),meleeCd:0,phase:0,guard:opts.guard||null,blink:0,knockX:0,knockY:0};
  enemies.push(enemy);return enemy;
}
function visibleLine(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,steps=Math.ceil(Math.hypot(dx,dy)/18);
  for(let i=1;i<steps;i++)if(solidAt(x1+dx*i/steps,y1+dy*i/steps))return false;
  return true;
}
function spawnNearPlayer(type,range=320){
  for(let i=0;i<24;i++){
    const a=random(-Math.PI,Math.PI),dist=random(range*.65,range),x=player.x+Math.cos(a)*dist,y=player.y+Math.sin(a)*dist;
    if(x>50&&x<worldW-50&&y>50&&y<worldH-50&&!solidAt(x,y)&&canMove(x,y,18)&&visibleLine(x,y,player.x,player.y))return spawnEnemy(type,x,y);
  }
  const x=Math.max(75,Math.min(worldW-75,player.x+random(-260,260)));
  const y=Math.max(75,Math.min(worldH-75,player.y+random(-260,260)));
  return spawnEnemy(type,x,y);
}
function startWaves(count,amounts,types){
  waves={count,amounts,types,index:0,pending:1.0};displayBanner('ALARM · ANGRIFFSWELLEN',`${count} Wellen überleben`,2300);notify('Schieße mit FEUER oder Leertaste!');updateHUD();
}
function finishWaves(){
  waves=null;
  if(progress.chapter===2){progress.c2.stage=2;talk([['IRIS','Das Sicherheitsnetz ist ausgefallen. Gut gemacht!'],['MARA · FUNK','Die Energiezelle wartet im Labor im NORDOSTEN.']],()=>{player.hp=Math.min(player.maxHp,player.hp+35);updateHUD();persist();});}
  if(progress.chapter===3){progress.c3.stage=2;talk([['IRIS','Das Relais steht. Die letzte Tür lässt sich öffnen.'],['IRIS','Im NORDOSTEN erwartet uns der Kernwächter. Vorsicht – er ist größer als alle anderen.']],()=>{player.hp=Math.min(player.maxHp,player.hp+40);updateHUD();persist();});}
  displayBanner('WELLEN GESCHAFFT','Abschnitt abgeschlossen',2500);persist();
}
function updateWaves(dt){
  if(!waves)return;
  if(waves.pending>0){
    waves.pending-=dt;
    if(waves.pending<=0){
      const waveNo=waves.index+1;
      displayBanner('WELLE '+waveNo+' / '+waves.count,'Sicherheitsroboter nähern sich',1700);
      let total=0;
      for(let i=0;i<waves.amounts[waves.index];i++){
        const kind=waves.types[Math.min(waves.types.length-1,(waves.index+i)%waves.types.length)];
        if(spawnNearPlayer(kind,random(220,370)))total++;
      }
      if(!total)spawnNearPlayer('scout',180);
      waves.pending=-1;
    }
  }else if(enemies.length===0){
    waves.index++;
    if(waves.index>=waves.count){finishWaves();return;}
    waves.pending=3.2;notify('Welle überstanden! Nächste Welle in 3 Sekunden.');player.hp=Math.min(player.maxHp,player.hp+10);
  }
}
function lineClear(x1,y1,x2,y2){
  const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)/22);
  for(let i=1;i<steps;i++){
    const f=i/steps;
    if(solidAt(x1+(x2-x1)*f,y1+(y2-y1)*f))return false;
  }
  return true;
}
function nearestEnemy(){
  let candidate=null,best=Infinity;
  for(const e of enemies){
    const d=Math.hypot(e.x-player.x,e.y-player.y);
    if(d<best&&lineClear(player.x,player.y,e.x,e.y)){candidate=e;best=d;}
  }
  return candidate;
}
function rebuildFlow(dt){
  pathCooldown-=dt;
  const x=Math.floor(player.x/T),y=Math.floor(player.y/T),cell=x+','+y;
  if(pathCooldown>0&&cell===pathCell)return;
  pathCell=cell;pathCooldown=.65;
  pathFlow=new Int16Array(W*H).fill(32000);
  if(tile(x,y))return;
  let head=0,tail=0;
  const queue=new Int16Array(W*H),start=y*W+x;
  queue[tail++]=start;pathFlow[start]=0;
  while(head<tail){
    const index=queue[head++],cx=index%W,cy=Math.floor(index/W);
    const next=pathFlow[index]+1;
    for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]){
      if(tile(nx,ny)||pathFlow[ny*W+nx]<=next)continue;
      pathFlow[ny*W+nx]=next;queue[tail++]=ny*W+nx;
    }
  }
}
function pathDirection(e){
  if(lineClear(e.x,e.y,player.x,player.y))return null;
  const cx=Math.floor(e.x/T),cy=Math.floor(e.y/T);
  let best=pathFlow[cy*W+cx]??32000,bx=cx,by=cy;
  for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]){
    const score=pathFlow[ny*W+nx];
    if(tile(nx,ny)===0&&score!==undefined&&score<best){best=score;bx=nx;by=ny;}
  }
  if(bx===cx&&by===cy)return null;
  const dx=(bx+.5)*T-e.x,dy=(by+.5)*T-e.y,mag=Math.hypot(dx,dy)||1;
  return [dx/mag,dy/mag];
}
function aimAngle(){
  if(touchMode||!pointer.active){const target=nearestEnemy();if(target)return Math.atan2(target.y-player.y,target.x-player.x);return player.dir;}
  const c=camera();return Math.atan2(pointer.y+c.y-player.y,pointer.x+c.x-player.x);
}
function shoot(){
  if(!started||paused||dead||dialogue||mapOpen||progress.chapter===1||player.fireCd>0)return;
  player.fireCd=.16;
  const angle=aimAngle(),ax=Math.cos(angle),ay=Math.sin(angle);player.aimX=ax;player.aimY=ay;
  const scatter=random(-.028,.028),vx=Math.cos(angle+scatter),vy=Math.sin(angle+scatter);
  shots.push({x:player.x+vx*18,y:player.y+vy*18,vx:vx*710,vy:vy*710,life:.85,damage:27,r:4});
  sparkBurst(player.x+vx*20,player.y+vy*20,'#acfdf6',3);
}
function dash(){
  if(progress.chapter===1||!started||paused||dead||dialogue||mapOpen||player.dashCd>0)return;
  let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;
  let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joy.y;
  const mag=Math.hypot(dx,dy);if(mag<.15){dx=Math.cos(player.dir);dy=Math.sin(player.dir);}else{dx/=mag;dy/=mag;}
  player.dashDx=dx;player.dashDy=dy;player.dashTime=.16;player.invuln=.24;player.dashCd=3.5;
  sparkBurst(player.x,player.y,'#8df8ff',13);
}
function sparkBurst(x,y,color,count){
  for(let i=0;i<count;i++)sparks.push({x,y,vx:random(-130,130),vy:random(-130,130),life:random(.15,.6),max:.6,color,r:random(1.5,3.5)});
  if(sparks.length>300)sparks.splice(0,sparks.length-300);
}
function hurt(amount){
  if(player.invuln>0||dead)return;
  player.hp=Math.max(0,player.hp-amount);player.invuln=.8;sparkBurst(player.x,player.y,'#ff859d',12);updateHUD();
  if(player.hp<=0)die();
}
function die(){
  dead=true;started=false;joy.x=joy.y=0;keys.clear();$('death').style.display='flex';persist();
}
function restartCheckpoint(){
  $('death').style.display='none';dead=false;started=true;dialogue=null;$('dialog').style.display='none';
  progress.position=null;setChapter(progress.chapter,true);
  const ch=progress.chapter;
  if(ch===2){
    const stage=progress.c2.stage;
    const p=stage>=3?[46,12]:stage>=2?[30,19]:stage===1?[27,19]:[7,8];player.x=(p[0]+.5)*T;player.y=(p[1]+.5)*T;
    if(stage===3){chaseTime=65;chaseSpawn=3;}
  }else if(ch===3){
    const stage=progress.c3.stage;
    const p=stage>=3?[46,19]:stage>=2?[45,17]:stage===1?[29,19]:[11,9];player.x=(p[0]+.5)*T;player.y=(p[1]+.5)*T;
  }
  player.hp=100;player.invuln=2;persist();notify('Checkpoint geladen · volle Lebensenergie');
}
function onEnemyDown(e){
  const idx=enemies.indexOf(e);if(idx>=0)enemies.splice(idx,1);
  sparkBurst(e.x,e.y,e.color,e.type==='boss'?45:12);
  if(Math.random()<.19&&e.type!=='boss')pickups.push({x:e.x,y:e.y,life:18});
  if(e.type==='boss'){
    bossActive=false;enemies=[];enemyShots=[];progress.c3.stage=3;
    displayBanner('BOSS BESIEGT','Das ECHO-Portal ist freigegeben',3200);
    talk([['IRIS','Der Kernwächter ist deaktiviert. Das Signal antwortet!'],['ECHO','„Ihr habt die Tür geöffnet. Folgt dem Licht im SÜDOSTEN.“']],()=>{player.hp=100;updateHUD();persist();});
    return;
  }
  if(e.guard&&!enemies.some(other=>other.guard===e.guard)){
    const id=e.guard;alarm=0;
    if(!progress.c3.locks.includes(id))progress.c3.locks.push(id);
    notify(`Sicherungsanker ${id==='lockA'?'A':'B'} freigeschaltet!`);player.hp=Math.min(100,player.hp+15);
    if(progress.c3.locks.length===2){progress.c3.stage=1;talk([['IRIS','Beide Anker deaktiviert. Jetzt kannst du das Signal-Relais im ZENTRUM aktivieren.']],()=>{updateHUD();persist();});}
    updateHUD();persist();
  }
}
function shotHitsEnemy(b,e){return Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r;}
function updateProjectiles(dt){
  for(let i=shots.length-1;i>=0;i--){
    const b=shots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.life<=0||solidAt(b.x,b.y)){shots.splice(i,1);continue;}
    let hit=false;
    for(const e of [...enemies]){
      if(!shotHitsEnemy(b,e))continue;
      hit=true;e.hp-=b.damage;e.blink=.12;
      sparkBurst(b.x,b.y,e.color,4);
      if(e.hp<=0)onEnemyDown(e);
      break;
    }
    if(hit)shots.splice(i,1);
  }
  for(let i=enemyShots.length-1;i>=0;i--){
    const b=enemyShots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.life<=0||solidAt(b.x,b.y)){enemyShots.splice(i,1);continue;}
    if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r){hurt(b.damage);enemyShots.splice(i,1);}
  }
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];p.life-=dt;
    if(Math.hypot(p.x-player.x,p.y-player.y)<31){player.hp=Math.min(100,player.hp+18);sparkBurst(p.x,p.y,'#9effc9',8);pickups.splice(i,1);updateHUD();}
    else if(p.life<=0)pickups.splice(i,1);
  }
  for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;if(p.life<=0)sparks.splice(i,1);}
}
function fireEnemy(e,count=1,spread=0){
  const a=Math.atan2(player.y-e.y,player.x-e.x);
  for(let i=0;i<count;i++){
    const angle=a+((i-(count-1)/2)*spread),speed=e.type==='boss'?255:220;
    enemyShots.push({x:e.x+Math.cos(angle)*(e.r+3),y:e.y+Math.sin(angle)*(e.r+3),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:3.1,damage:e.type==='boss'?16:10,r:e.type==='boss'?7:5,color:e.type==='boss'?'#fc84c9':'#ffa875'});
  }
}
function updateEnemies(dt){
  if(enemies.length)rebuildFlow(dt);
  for(const e of [...enemies]){
    e.meleeCd=Math.max(0,e.meleeCd-dt);e.rangedCd-=dt;e.blink=Math.max(0,e.blink-dt);
    const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1,ax=dx/d,ay=dy/d;
    const route=pathDirection(e);
    const seekX=route?route[0]:ax,seekY=route?route[1]:ay;
    const ideal=route?0:(e.type==='gunner'?185:e.type==='boss'?160:0);
    let move=0;
    if(d>Math.max(ideal,e.r+player.r+4))move=e.speed*dt;
    else if(!route&&e.type==='gunner'&&d<115)move=-e.speed*.5*dt;
    if(move){
      const nx=e.x+seekX*move,ny=e.y+seekY*move;
      if(canMove(nx,e.y,e.r*.65))e.x=nx;
      if(canMove(e.x,ny,e.r*.65))e.y=ny;
    }
    if(d<e.r+player.r+3&&e.meleeCd<=0){hurt(e.damage);e.meleeCd=1.0;}
    if((e.type==='gunner'||e.type==='boss')&&d<550&&e.rangedCd<=0&&visibleLine(e.x,e.y,player.x,player.y)){
      if(e.type==='boss'){
        fireEnemy(e,e.hp<e.maxHp*.48?7:5,.24);e.rangedCd=e.hp<e.maxHp*.5?1.0:1.55;
        if(e.hp<e.maxHp*.66&&e.phase===0){e.phase=1;spawnNearPlayer('scout',260);spawnNearPlayer('gunner',300);notify('BOSS-PHASE 2 · Begleitdrohnen!');}
        if(e.hp<e.maxHp*.32&&e.phase===1){e.phase=2;spawnNearPlayer('scout',220);spawnNearPlayer('heavy',290);notify('BOSS-PHASE 3 · Verstärkung!');}
      }else{fireEnemy(e,1,0);e.rangedCd=random(1.3,2.1);}
    }
  }
}
function updateChase(dt){
  if(progress.chapter!==2||progress.c2.stage!==3)return;
  chaseTime-=dt;chaseSpawn-=dt;
  if(chaseSpawn<=0){
    chaseSpawn=random(3.5,5.2);
    if(enemies.length<9){spawnNearPlayer(Math.random()<.65?'scout':'gunner',random(250,340));}
  }
  if(chaseTime<=0){
    dead=true;started=false;cleanCombat();$('death').style.display='flex';
    $('death').querySelector('p').textContent='Die Verfolgungseinheiten haben den Tunnel abgeriegelt. Wiederhole die Flucht ab dem Energie-Labor.';
  }
}
function tick(dt){
  player.dashCd=Math.max(0,player.dashCd-dt);player.invuln=Math.max(0,player.invuln-dt);player.fireCd=Math.max(0,player.fireCd-dt);
  let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;
  let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joy.y;
  const mag=Math.hypot(dx,dy);
  if(player.dashTime>0){player.dashTime-=dt;relocate(player.dashDx*650*dt,player.dashDy*650*dt);sparkBurst(player.x,player.y,'#77dfff',1);}
  else if(mag>.08){
    dx/=Math.max(1,mag);dy/=Math.max(1,mag);player.dir=Math.atan2(dy,dx);relocate(dx*235*dt,dy*235*dt);
  }
  if(progress.chapter!==1){
    if(keys.has(' ')||keys.has('f')||firePressed)shoot();
    updateProjectiles(dt);updateEnemies(dt);updateWaves(dt);updateChase(dt);
  }else{
    for(let i=sparks.length-1;i>=0;i--){sparks[i].life-=dt;if(sparks[i].life<=0)sparks.splice(i,1);}
  }
  saveClock+=dt;if(saveClock>2.5){persist();saveClock=0;}
  if(frame%5===0)updateHUD();
}
function blockColor(x,y){
  if(progress.chapter===1){return x<24?(y<17?'#152735':'#192432'):(y<17?'#172c40':'#173238');}
  if(progress.chapter===2){
    const street=(y>=16&&y<=24)||(x>=24&&x<=36)||(x<13)||(x>55);
    return street?'#1b283b':'#20334b';
  }
  return '#17273a';
}
function renderTile(x,y){
  const px=x*T,py=y*T,solid=tile(x,y);
  const base=blockColor(x,y);
  ctx.fillStyle=(x+y)%2?base:(progress.chapter===2?'#1a2c42':'#122335');ctx.fillRect(px,py,T,T);
  ctx.strokeStyle='#afd1e50b';ctx.strokeRect(px+.5,py+.5,T-1,T-1);
  if(progress.chapter===2&&!solid){
    if(y>=17&&y<=23&&x%3===0){ctx.fillStyle='#d6bc8655';ctx.fillRect(px+T*.4,py+T*.48,12,3);}
    if(x>=26&&x<=34&&y%4===0){ctx.fillStyle='#d6bc8655';ctx.fillRect(px+T*.4,py+T*.48,3,12);}
  }
  if(progress.chapter===3&&!solid&&((x+y*3)%13===0)){
    ctx.fillStyle='#25c6be24';ctx.fillRect(px+8,py+8,5,5);ctx.fillRect(px+32,py+32,5,5);
  }
  if(solid){
    ctx.fillStyle=progress.chapter===2?'#40566b':'#34485a';ctx.fillRect(px,py,T,T);
    ctx.fillStyle=progress.chapter===2?'#7f8e99':'#547c8c';ctx.fillRect(px+2,py+2,T-4,6);
    ctx.fillStyle='#071522';ctx.fillRect(px+7,py+16,T-14,T-22);
    ctx.fillStyle='#3b6773';ctx.fillRect(px+8,py+T-9,T-16,3);
  }
}
function renderDetail(o){
  const px=o.x*T+9,py=o.y*T+9;
  const col={crate:'#667f94',server:'#45749b',plant:'#3c8068',pipe:'#816b74',roadlamp:'#ffda8a',wreck:'#8a6778',rubble:'#52677c',lamp:'#5beddf'}[o.type];
  ctx.fillStyle=col||'#4c6174';
  if(['roadlamp','lamp'].includes(o.type)){
    ctx.beginPath();ctx.arc(px+16,py+16,9+Math.sin(now*3+o.x)*2,0,Math.PI*2);ctx.fill();
  }else{
    ctx.fillRect(px,py,31,31);ctx.fillStyle='#0e2431';ctx.fillRect(px+5,py+5,21,5);
    if(o.type==='plant'){ctx.fillStyle='#97eab8';ctx.beginPath();ctx.arc(px+15,py+14,12,0,7);ctx.fill();}
  }
}
function renderNode(n){
  if(!nodeVisible(n))return;
  const px=(n.x+.5)*T,py=(n.y+.5)*T;
  const done=(progress.chapter===1&&progress.c1.fragments.includes(n.id))||
    (progress.chapter===3&&progress.c3.locks.includes(n.id))||
    (progress.chapter===2&&((n.id==='arena'&&progress.c2.stage>1)||(n.id==='battery'&&progress.c2.stage>2)));
  ctx.globalAlpha=done?.4:1;
  ctx.fillStyle=n.color+'30';ctx.beginPath();ctx.arc(px,py,25+Math.sin(now*2+n.x)*4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=n.color;ctx.fillRect(px-12,py-12,24,24);ctx.fillStyle='#0c2132';ctx.fillRect(px-7,py-7,14,14);
  textAt(px,py-27,n.name,'#e6f8ff','bold 11px system-ui');ctx.globalAlpha=1;
}
function renderEntity(e){
  ctx.save();ctx.translate(e.x,e.y);
  ctx.fillStyle='#030b19bb';ctx.beginPath();ctx.ellipse(2,9,e.r*1.3,e.r*.65,0,0,Math.PI*2);ctx.fill();
  ctx.shadowColor=e.color;ctx.shadowBlur=13;ctx.fillStyle=e.blink>0?'#ffffff':e.color;
  if(e.type==='boss'){
    ctx.rotate(now*.5);for(let i=0;i<6;i++){ctx.save();ctx.rotate(Math.PI*i/3);ctx.fillRect(e.r*.57,-6,24,12);ctx.restore();}
    ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();ctx.rotate(-now*.5);
  }else if(e.type==='heavy'){
    ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2);
  }else{
    ctx.rotate(Math.atan2(player.y-e.y,player.x-e.x));ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2);ctx.fillRect(e.r-2,-5,11,10);
  }
  ctx.shadowBlur=0;ctx.fillStyle='#071326';ctx.fillRect(-7,-5,14,10);ctx.fillStyle='#ffe1e9';ctx.fillRect(-4,-2,8,4);
  ctx.restore();
  if(e.type==='boss'||e.hp<e.maxHp){
    const bw=e.type==='boss'?110:e.r*2.4;
    ctx.fillStyle='#09121bd9';ctx.fillRect(e.x-bw/2,e.y-e.r-18,bw,6);
    ctx.fillStyle=e.type==='boss'?'#fc77bb':'#f89a87';ctx.fillRect(e.x-bw/2,e.y-e.r-18,bw*Math.max(0,e.hp/e.maxHp),6);
  }
}
function renderPlayer(){
  ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.dir);
  ctx.fillStyle='#8defff0e';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,175,-.35,.35);ctx.closePath();ctx.fill();
  ctx.restore();
  ctx.save();ctx.translate(player.x,player.y);
  ctx.globalAlpha=player.invuln>0&&Math.sin(now*35)>0?.54:1;
  ctx.fillStyle='#020c1c';ctx.beginPath();ctx.ellipse(0,7,20,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#92fbe5';ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#104357';ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();
  const aim=progress.chapter===1?player.dir:aimAngle();ctx.rotate(aim);
  ctx.fillStyle='#d2fcff';ctx.fillRect(9,-4,17,8);ctx.fillStyle='#366679';ctx.fillRect(19,-2,7,4);
  ctx.globalAlpha=1;ctx.restore();
}
function renderMiniMap(){
  if(vw<620||vh<260)return;
  const size=Math.min(148,vw*.18),mh=size*H/W,mx=vw-size-14,my=54;
  ctx.fillStyle='#061222dc';ctx.fillRect(mx-5,my-5,size+10,mh+10);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    ctx.fillStyle=tile(x,y)?'#567386':'#23415a';ctx.fillRect(mx+x*size/W,my+y*mh/H,size/W+.2,mh/H+.2);
  }
  ctx.fillStyle='#9cfce7';ctx.beginPath();ctx.arc(mx+player.x/worldW*size,my+player.y/worldH*mh,3.2,0,7);ctx.fill();
  for(const e of enemies){ctx.fillStyle='#ff748d';ctx.fillRect(mx+e.x/worldW*size-1.5,my+e.y/worldH*mh-1.5,3,3);}
  const n=targetNode();if(n){ctx.fillStyle='#ffdb8c';ctx.beginPath();ctx.arc(mx+(n.x+.5)*T/worldW*size,my+(n.y+.5)*T/worldH*mh,3.1,0,7);ctx.fill();}
}
function targetNode(){
  if(progress.chapter===1)return nodes.find(n=>progress.c1.fragments.length<3&&n.type==='fragment'&&!progress.c1.fragments.includes(n.id))||nodes.find(n=>n.id==='core');
  if(progress.chapter===2)return nodes.find(n=>n.id===['mara','arena','battery','exit','exit'][Math.min(4,progress.c2.stage)]);
  const s=progress.c3;
  const id=s.stage===0?(s.locks.includes('lockA')?'lockB':'lockA'):['','relay','bossConsole','portal','portal'][Math.min(4,s.stage)];
  return nodes.find(n=>n.id===id);
}
function render(){
  if(!W)return;
  ctx.fillStyle='#050b14';ctx.fillRect(0,0,vw,vh);
  const cam=camera();ctx.save();ctx.translate(-cam.x,-cam.y);
  const x0=Math.max(0,Math.floor(cam.x/T)-1),x1=Math.min(W,Math.ceil((cam.x+vw)/T)+1),y0=Math.max(0,Math.floor(cam.y/T)-1),y1=Math.min(H,Math.ceil((cam.y+vh)/T)+1);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)renderTile(x,y);
  for(const d of details){const x=d.x*T,y=d.y*T;if(x<cam.x-60||x>cam.x+vw+60||y<cam.y-60||y>cam.y+vh+60)continue;renderDetail(d);}
  for(const n of nodes){const x=n.x*T,y=n.y*T;if(x<cam.x-100||x>cam.x+vw+100||y<cam.y-100||y>cam.y+vh+100)continue;renderNode(n);}
  for(const p of pickups){ctx.fillStyle='#90ffd3';ctx.beginPath();ctx.arc(p.x,p.y,8+Math.sin(now*6)*2,0,Math.PI*2);ctx.fill();}
  for(const p of shots){ctx.fillStyle='#a4faff';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();}
  for(const p of enemyShots){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
  for(const e of enemies)renderEntity(e);
  renderPlayer();
  for(const p of sparks){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();}
  ctx.globalAlpha=1;ctx.restore();
  const gradient=ctx.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.2,vw/2,vh/2,Math.max(vw,vh)*.9);
  gradient.addColorStop(0,'#0000');gradient.addColorStop(1,'#01061192');ctx.fillStyle=gradient;ctx.fillRect(0,0,vw,vh);
  renderMiniMap();
  const near=nearestNode();$('miniHint').style.display=near&&!dialogue&&!mapOpen&&started&&!paused?'block':'none';
  if(near)$('miniHint').textContent='E / AKTION · '+near.name;
}
function renderMap(){
  const w=mapCanvas.width,h=mapCanvas.height;mc.fillStyle='#071521';mc.fillRect(0,0,w,h);
  const scale=Math.min((w-34)/W,(h-70)/H),ox=(w-W*scale)/2,oy=45+(h-70-H*scale)/2;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    mc.fillStyle=tile(x,y)?'#678398':'#1d4056';mc.fillRect(ox+x*scale,oy+y*scale,scale+.25,scale+.25);
  }
  for(const e of enemies){mc.fillStyle='#fb7895';mc.beginPath();mc.arc(ox+e.x/T*scale,oy+e.y/T*scale,4,0,7);mc.fill();}
  const active=targetNode();
  for(const n of nodes){
    if(!nodeVisible(n))continue;
    mc.fillStyle=n===active?'#ffe49a':n.color;
    mc.beginPath();mc.arc(ox+(n.x+.5)*scale,oy+(n.y+.5)*scale,n===active?8:4,0,Math.PI*2);mc.fill();
  }
  mc.fillStyle='#8affd8';mc.beginPath();mc.arc(ox+player.x/T*scale,oy+player.y/T*scale,7,0,7);mc.fill();
  mc.font='bold 17px system-ui';mc.fillStyle='#bfeefe';mc.fillText('● Du     ● Mission (gelb)     ● Gegner (rot)     ● Orte',28,27);
}
function toggleMap(){
  if(!started||dialogue||dead)return;
  mapOpen=!mapOpen;$('mapOverlay').style.display=mapOpen?'flex':'none';if(mapOpen)renderMap();
}
function showEnding(){
  started=false;paused=false;$('ending').style.display='flex';
  $('endingText').textContent='Du hast die Station AURORA untersucht, die Roboter in NOCTIS besiegt, die Verfolgungsjagd überstanden und den Kernwächter von OMEGA deaktiviert. IRIS spricht wieder mit ECHO. Die Welt kann sich verändern – und die Geschichte ist noch nicht vorbei.';
}
function togglePause(){
  if(!started||dead||dialogue)return;
  paused=!paused;$('pauseBtn').textContent=paused?'WEITER':'PAUSE';
  if(paused)notify('Pausiert · erneut auf WEITER tippen');
}
function refreshStart(){
  const saved=progress.c1.complete;
  if(progress.c3.complete){$('play').textContent='Spielstand ansehen';$('startDescription').textContent='Du hast alle drei Kapitel abgeschlossen! Erkunde weiter oder spiele ein Kapitel erneut.';}
  else if(saved){$('play').textContent='Weiterspielen · Kapitel '+progress.chapter;$('startDescription').textContent='Dein Fortschritt aus Kapitel 1 ist erhalten. Kapitel 2: NOCTIS. Kapitel 3: OMEGA.';}
  else {$('play').textContent=progress.c1.fragments.length?'Spielstand fortsetzen':'Expedition starten';}
  $('chapterBtn').style.display=saved?'block':'none';
}
function chooseChapter(){
  const max=progress.c3.complete?3:progress.c2.complete?3:progress.c1.complete?2:1;
  const choice=prompt('Freigeschaltete Kapitel: 1 bis '+max+'\nGib eine Kapitelnummer ein:');
  if(choice===null)return;
  const n=Number(choice);
  if(!Number.isInteger(n)||n<1||n>max)return alert('Dieses Kapitel ist noch nicht freigeschaltet.');
  if(n!==progress.chapter){progress.position=null;setChapter(n,true);}
  if(n===3&&progress.c3.complete){progress.c3.stage=0;progress.c3.locks=[];progress.c3.complete=false;setChapter(3,true);}
  if(n===2&&progress.c2.complete){progress.c2.stage=0;progress.c2.complete=false;setChapter(2,true);}
  $('start').style.display='none';$('ending').style.display='none';started=true;paused=false;updateHUD();
  if(n===2&&progress.c2.stage===0)talk([['IRIS','Suche MARA im Funkhaus. Roboter patrouillieren noch nicht überall.']]);
}
function startGame(){
  $('start').style.display='none';$('ending').style.display='none';paused=false;
  if(progress.c3.complete&&progress.chapter===3&&progress.c3.stage===4){setChapter(3);showEnding();return;}
  started=true;updateHUD();
  if(progress.chapter===1&&!progress.c1.flags.welcomed){
    talk([['NOTFALLTERMINAL','Station AURORA: Finde drei Signalfragmente und kehre zum zentralen Kern zurück.'],['SYSTEM','Erkunde die vier Stationsflügel. Benutze M oder KARTE, um interessante Orte zu finden.']],()=>{progress.c1.flags.welcomed=true;persist();});
  }else if(progress.chapter===2&&progress.c2.stage===0){
    talk([['IRIS','Die verlassene Stadt NOCTIS wartet. Finde MARA im nördlichen Funkhaus.'],['IRIS','Auf dem Handy visiert FEUER automatisch den nächsten Roboter an.']]);
  }
}
let firePressed=false;
function handleKeyDown(e){
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','e','m','shift','f'].includes(k))e.preventDefault();
  keys.add(k);
  if(e.repeat)return;
  if(k==='e')interact();
  if(k==='m')toggleMap();
  if(k==='shift')dash();
  if(k==='escape'){if(dialogue)advanceDialogue();else if(mapOpen)toggleMap();else togglePause();}
  if(k==='enter'&&dialogue)advanceDialogue();
}
function initControls(){
  window.addEventListener('keydown',handleKeyDown);
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();joy.x=0;joy.y=0;firePressed=false;});
  canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=!touchMode;});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;firePressed=true;}});
  window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')firePressed=false;});
  const stick=$('stick'),nub=$('nub');
  function moveStick(e){
    const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),max=r.width*.33;
    const len=Math.hypot(dx,dy)||1,f=Math.min(len,max)/len;joy.x=dx*f/max;joy.y=dy*f/max;
    nub.style.transform=`translate(${dx*f}px,${dy*f}px)`;
  }
  stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.pointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});
  stick.addEventListener('pointermove',e=>{if(joy.pointer===e.pointerId)moveStick(e);});
  function releaseStick(e){if(joy.pointer!==e.pointerId)return;joy.pointer=null;joy.x=joy.y=0;nub.style.transform='translate(0px,0px)';}
  stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);
  const fire=$('fire');fire.addEventListener('pointerdown',e=>{e.preventDefault();firePressed=true;fire.setPointerCapture(e.pointerId);shoot();});
  fire.addEventListener('pointerup',()=>{firePressed=false;});fire.addEventListener('pointercancel',()=>{firePressed=false;});fire.addEventListener('lostpointercapture',()=>{firePressed=false;});
  $('act').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
  $('dash').addEventListener('pointerdown',e=>{e.preventDefault();dash();});
  $('next').onclick=advanceDialogue;
  $('mapBtn').onclick=toggleMap;$('closeMap').onclick=toggleMap;$('pauseBtn').onclick=togglePause;
  $('play').onclick=startGame;$('chapterBtn').onclick=chooseChapter;$('retry').onclick=restartCheckpoint;
  $('backToMenu').onclick=()=>{$('ending').style.display='none';$('start').style.display='flex';refreshStart();};
  $('replay').onclick=()=>{progress.c3={stage:0,locks:[],complete:false};progress.position=null;setChapter(3,true);$('ending').style.display='none';started=true;};
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();if(started)paused=true;}else if(started)paused=false;});
  window.addEventListener('pagehide',persist);
}
function loop(timestamp){
  const dt=Math.min(.045,Math.max(0,(timestamp-prev)/1000||0));prev=timestamp;now=timestamp/1000;frame++;
  if(started&&!paused&&!dead&&!dialogue&&!mapOpen)tick(dt);
  render();
  if(toastUntil&&timestamp>toastUntil){$('toast').style.display='none';toastUntil=0;}
  if(bannerUntil&&timestamp>bannerUntil){$('banner').style.display='none';bannerUntil=0;}
  requestAnimationFrame(loop);
}
loadProgress();buildMap(progress.chapter);restoreSpot(progress.chapter);initControls();resize();refreshStart();updateHUD();requestAnimationFrame(loop);
})();
