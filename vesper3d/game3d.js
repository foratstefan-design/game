import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

/* NEON RIFT: ECHOES / BAUMHOLDER 3D – Edition 3
 * Engine: Three.js. Lightweight mobile-friendly material and geometry setup.
 * No overlapping coplanar road meshes, no shadow maps, no reflective asphalt.
 * Features: third-person movement, stable camera, streets, entry into buildings,
 * interior scene, discoveries, branching NPC dialogue, quest journal, autosave.
 */

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const mobile = matchMedia('(pointer:coarse)').matches;
if (mobile) document.body.classList.add('mobile');

// ── Renderer, scene and hardware budget ───────────────────────────────
const renderer = new THREE.WebGLRenderer({antialias:!mobile, powerPreference:'high-performance', alpha:false});
renderer.domElement.className = 'scene';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.setClearColor(0xa3c5d7);
document.body.insertBefore(renderer.domElement,$('hud'));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa3c5d7);
scene.fog = new THREE.Fog(0xa3c5d7,108,225);
const camera = new THREE.PerspectiveCamera(66,1,.15,260);
scene.add(new THREE.HemisphereLight(0xffffff,0x637b83,2.0));
const sun = new THREE.DirectionalLight(0xffefda,1.45);
sun.position.set(-60,95,32);
sun.castShadow = false;
scene.add(sun);
let quality = 'auto';
function resize(){
  const w=innerWidth,h=innerHeight;
  const dpr=quality==='low'?.68:quality==='high'?Math.min(devicePixelRatio,1.45):Math.min(devicePixelRatio,mobile?.92:1.2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w,h);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize',resize);

// ── Materials: deliberately matte to avoid shiny, flickering streets ──
const materialCache = new Map();
function material(color){
  if (!materialCache.has(color)) materialCache.set(color,new THREE.MeshLambertMaterial({color}));
  return materialCache.get(color);
}
const M={
  soil: material(0x76917b), road:material(0x394653), pavement:material(0xa9aaa5),
  line:material(0xe2ddd0), crossing:material(0xe8e2d7), grass:material(0x6a946c),
  trunk:material(0x746455), leaf:material(0x568a67), lamp:material(0x506375),
  lampFace:new THREE.MeshBasicMaterial({color:0xffe4af}),
  dark:material(0x293e4b), door:material(0x385968), glass:material(0x719bae),
  skyWindow:material(0xb5cdd0), windowDark:material(0x426779),
  roof:material(0x4c5965), wood:material(0x9a7556), skin:material(0xe4b38c),
  hair:material(0x413b3d), pants:material(0x31485d), shoe:material(0x27323e),
  white:material(0xf0ead9), golden:material(0xebbb7e), darkBlue:material(0x29475d)
};
const cube = new THREE.BoxGeometry(1,1,1);
const world = new THREE.Group(); scene.add(world);
const roomScene = new THREE.Group(); roomScene.visible=false; scene.add(roomScene);
function block(parent,w,h,d,x,y,z,mat){
  const mesh=new THREE.Mesh(cube,mat);
  mesh.position.set(x,y,z);
  mesh.scale.set(w,h,d);
  parent.add(mesh);
  return mesh;
}
function flat(parent,w,d,x,z,yTop,thickness,mat){
  return block(parent,w,thickness,d,x,yTop-thickness/2,z,mat);
}
function textSign(parent,label,x,y,z,width=8){
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#233a4d';ctx.fillRect(0,0,512,128);
  ctx.fillStyle='#eaf2f1';ctx.font='bold 48px system-ui, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,68,470);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),
    new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  s.position.set(x,y,z);
  parent.add(s);
  return s;
}

// ── World layout: separated, non-coplanar roads and pavements ───────
// Ground top = 0; asphalt top = 0.035; marking top = 0.045;
// pedestrian path top = 0.14. Crossed asphalt meshes NEVER overlap.
flat(world,326,326,0,0,0,.3,M.soil);
const roadLines=[-104,-52,0,52,104];
const ROAD=12.5;
for(const x of roadLines) flat(world,ROAD,318,x,0,.035,.08,M.road);
const roadBounds=[-159,...roadLines.map(x=>x-ROAD/2),...roadLines.map(x=>x+ROAD/2),159].sort((a,b)=>a-b);
// Horizontal strips only between vertical roads (no z-fighting at intersections).
for(const z of roadLines){
  let start=-159;
  for(const x of roadLines){
    const end=x-ROAD/2;
    if(end>start) flat(world,end-start,ROAD,(start+end)/2,z,.035,.08,M.road);
    start=x+ROAD/2;
  }
  if(start<159) flat(world,159-start,ROAD,(start+159)/2,z,.035,.08,M.road);
}
// Raised but deliberately plain, nonreflective pedestrian pavements.
for(const v of roadLines){
  for(const side of [-1,1]){
    flat(world,2.8,312,v+side*8.4,0,.14,.22,M.pavement);
    // Horizontal sidewalk split to avoid visual overlaps with vertical paths.
    let start=-156;
    for(const x of roadLines){
      let end=x-10;
      if(end>start) flat(world,end-start,2.8,(start+end)/2,v+side*8.4,.14,.22,M.pavement);
      start=x+10;
    }
    if(start<156) flat(world,156-start,2.8,(start+156)/2,v+side*8.4,.14,.22,M.pavement);
  }
}
// Simple road paint; skip every intersection and paint at a distinct height.
const lineInstances=[];
for(const v of roadLines){
  for(let p=-151;p<=151;p+=14){
    if(roadLines.some(c=>Math.abs(p-c)<10)) continue;
    lineInstances.push({x:v,y:.056,z:p,w:.16,h:.017,d:6});
    lineInstances.push({x:p,y:.056,z:v,w:6,h:.017,d:.16});
  }
}
function instanced(parent,records,mat){
  if(!records.length)return;
  const mesh=new THREE.InstancedMesh(cube,mat,records.length);
  const temp=new THREE.Object3D();
  records.forEach((a,i)=>{
    temp.position.set(a.x,a.y,a.z);
    temp.scale.set(a.w,a.h,a.d);
    temp.rotation.set(0,0,0);
    temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.frustumCulled=false;
  parent.add(mesh);
  return mesh;
}
instanced(world,lineInstances,M.line);

// ── City architecture ────────────────────────────────────────────────
const buildings=[];
const cityNPCs=[];
const exteriorInteractions=[];
const interiorInteractions=[];
const windowsBright=[], windowsDark=[], trees=[], lampposts=[];
let rngState=53219;
function random(){rngState=(1664525*rngState+1013904223)>>>0;return rngState/4294967296;}
function choose(array){return array[Math.floor(random()*array.length)];}

const profiles={
  apartment:{wall:0x9dabae,accent:0xbeb4a3,roof:0x485969,sign:'WOHNHAUS',style:'home'},
  radio:{wall:0x7894a7,accent:0xe8ad6a,roof:0x3c5769,sign:'RADIO VEGA',style:'shop'},
  market:{wall:0xad8d7c,accent:0xc4bd96,roof:0x6d534a,sign:'MARKT',style:'market'},
  archive:{wall:0x939aaf,accent:0xdac4aa,roof:0x536175,sign:'ARCHIV',style:'office'},
  aurora:{wall:0x6e889b,accent:0xb7dbd7,roof:0x2a5369,sign:'AURORA',style:'lab'},
  station:{wall:0x9b9da2,accent:0xd8bea2,roof:0x5b6270,sign:'BAHNHOF',style:'station'},
  bakery:{wall:0xd0ac85,accent:0xd9e1bb,roof:0x64534c,sign:'CAFÉ LUNA',style:'cafe'},
  ordinaryA:{wall:0xa5b1ae,accent:0xe4c99b,roof:0x677177,sign:'',style:'home'},
  ordinaryB:{wall:0x94a7b0,accent:0xd8c9c2,roof:0x576574,sign:'',style:'home'},
  ordinaryC:{wall:0xc2a9a3,accent:0xe5d1ba,roof:0x78676b,sign:'',style:'shop'},
  ordinaryD:{wall:0xb0ba9b,accent:0xd3b47d,roof:0x647568,sign:'',style:'home'},
  ordinaryE:{wall:0x8f9aab,accent:0xe0bfb0,roof:0x4b596f,sign:'',style:'office'}
};
const houses = new Map();
function addBuilding(id,x,z,w,d,h,profileName,label=''){
  const spec=profiles[profileName],group=new THREE.Group();
  const facade=material(spec.wall),accent=material(spec.accent),roof=material(spec.roof);
  world.add(group);
  // Core shape: layered facades and colored ground-floor storefronts.
  block(group,w,h-5.3,d,x,(h+5.3)/2,z,facade);
  block(group,w,5.15,d,x,2.575,z,accent);
  block(group,w+.5,.75,d+.5,x,h+.38,z,roof);
  block(group,w+.1,.4,d+.1,x,5.4,z,roof);
  // Door visually distinct and on walkable side facing the positive-Z street.
  const front=z+d/2;
  block(group,2.7,3.7,.12,x,1.9,front+.18,M.door);
  block(group,2.95,.27,.35,x,3.92,front+.30,roof);
  block(group,.2,3.6,.20,x-1.35,1.9,front+.28,roof);
  block(group,.2,3.6,.20,x+1.35,1.9,front+.28,roof);
  block(group,.1,.45,.10,x+.96,1.8,front+.27,M.golden);
  if(spec.style==='shop'||spec.style==='cafe'||spec.style==='market'){
    block(group,w*.85,.55,1.5,x,4.75,front+1.1,material(spec.accent));
    block(group,2.6,2.4,.13,x-3.3,2,front+.17,M.skyWindow);
  }
  if(spec.style==='lab'){
    for(const side of [-1,1])block(group,1.3,h,1.6,x+side*(w/2-1),h/2,front+.3,M.dark);
  }
  if(label||spec.sign)textSign(group,label||spec.sign,x,5.75,front+.26,Math.min(w-2,9));
  // All windows instanced globally with alternating warm/cool colors.
  for(let floor=2;floor<Math.floor((h-1)/4);floor++){
    for(let col=-w/2+2;col<w/2-1;col+=3.5){
      const rec={x:x+col,y:floor*4,z:front+.09,w:1.35,h:1.65,d:.08};
      (random()<.37?windowsBright:windowsDark).push(rec);
      const back={...rec,z:z-d/2-.09};(random()<.32?windowsBright:windowsDark).push(back);
    }
    for(let zz=-d/2+2;zz<d/2-1;zz+=3.8){
      const rec={x:x+w/2+.09,y:floor*4,z:z+zz,w:.08,h:1.55,d:1.4};
      windowsDark.push(rec);
    }
  }
  const door={x,z:front+1.8};
  const building={id,x,z,w,d,h,label:label||spec.sign||'Gebäude',profileName,door,group};
  buildings.push(building);houses.set(id,building);
  exteriorInteractions.push({type:'door',name:`${building.label} betreten`,x:door.x,z:door.z,buildingId:id});
  return building;
}
// Meaningfully distinct landmark streets, not repeated identical tower lots.
addBuilding('apartment',-26,-26,20,20,14,'apartment');
addBuilding('radio',26,-26,22,18,18,'radio');
addBuilding('market',-26,26,22,19,13,'market');
addBuilding('archive',26,26,22,19,23,'archive');
addBuilding('aurora',78,-26,26,21,30,'aurora');
addBuilding('station',-78,26,25,20,17,'station');
addBuilding('bakery',-78,-26,20,18,12,'bakery');
// Distinct neighborhoods: colorful low-rise west, taller research district east.
const landmarkSpots=[[-26,-26],[26,-26],[-26,26],[26,26],[78,-26],[-78,26],[-78,-26]];
let idCount=0;
for(let ix=-3;ix<=2;ix++)for(let iz=-3;iz<=2;iz++){
  const x=ix*52+26,z=iz*52+26;
  if(Math.abs(x)>132||Math.abs(z)>132)continue;
  if(landmarkSpots.some(([a,b])=>Math.hypot(a-x,b-z)<3))continue;
  if(x===-26&&z===-78)continue; // small public park
  if(x===26&&z===-78)continue; // tram plaza
  const pName=choose(x>47?['ordinaryB','ordinaryE','ordinaryA']:z>35?['ordinaryD','ordinaryC','ordinaryA']:['ordinaryA','ordinaryB','ordinaryC','ordinaryD']);
  const w=17+random()*5,d=15+random()*5;
  const h=x>47?18+random()*17:10+random()*15;
  addBuilding(`house${++idCount}`,x+(random()-.5)*3,z+(random()-.5)*3,w,d,h,pName);
}
instanced(world,windowsBright,M.skyWindow);
instanced(world,windowsDark,M.windowDark);

function tree(x,z,scale=1){
  block(world,.8*scale,3.5*scale,.8*scale,x,1.75*scale,z,M.trunk);
  const top=new THREE.Mesh(new THREE.IcosahedronGeometry(2.35*scale,0),M.leaf);
  top.position.set(x,4.9*scale,z);world.add(top);
}
// Park, market stalls and street furniture; very few extra render passes.
flat(world,32,33,-26,-78,.045,.08,M.grass);
for(const [x,z] of [[-36,-89],[-18,-89],[-37,-68],[-15,-70],[-28,-78],[-7,37],[7,37],[-63,-90],[68,26],[97,23]])tree(x,z,.8);
for(const [x,z] of [[-36,-80],[-16,-80],[-26,-70]]){
  block(world,3,.2,.9,x,1.25,z,M.wood);block(world,.19,1.2,.19,x-1.1,.6,z,M.dark);block(world,.19,1.2,.19,x+1.1,.6,z,M.dark);
}
for(const [x,z] of [[-46,37],[-40,37],[-34,37]]){
  block(world,4,1.4,2,x,.7,z,M.wood);
  block(world,4.3,.3,3,x,3.45,z,material(0xe6ad73));
}
// Lamps are emissive-colored patches but NOT realtime point lights.
for(const v of roadLines){
 for(let z=-136;z<=136;z+=52){
  const x=v+9.6;
  block(world,.28,6,.28,x,3,z,M.lamp);
  block(world,1.2,.28,.65,x,6.2,z,M.lampFace);
 }
}
// Tram track along the east boulevard: no overlapping surfaces.
for(let z=-148;z<=148;z+=12){
 block(world,.07,.035,8.2,50.9,.08,z,M.dark);
 block(world,.07,.035,8.2,53.1,.08,z,M.dark);
}

// ── People: lightweight block figures ────────────────────────────────
function person(color,faceColor=M.skin){
  const root=new THREE.Group(); const torso=new THREE.Group();root.add(torso);
  block(torso,1.18,1.5,.72,0,2.35,0,material(color));
  block(torso,.9,.92,.84,0,3.6,0,faceColor);
  block(torso,.96,.22,.86,0,4.15,-.01,M.hair);
  block(torso,.12,.12,.04,-.20,3.65,.435,M.hair);
  block(torso,.12,.12,.04,.20,3.65,.435,M.hair);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group(); arm.position.set(side*.81,2.96,0);
    block(arm,.38,1.26,.52,0,-.61,0,material(color));torso.add(arm);arms.push(arm);
    const leg=new THREE.Group(); leg.position.set(side*.30,1.62,0);
    block(leg,.5,1.3,.62,0,-.65,0,M.pants);
    block(leg,.57,.22,.76,0,-1.23,.08,M.shoe);torso.add(leg);legs.push(leg);
  }
  return {root,torso,arms,legs};
}
const hero=person(0x3b809c);scene.add(hero.root);
function npc(name,x,z,color,role,requires=null){
  const figure=person(color);figure.root.position.set(x,0,z);
  figure.root.rotation.y=Math.PI*.15;
  world.add(figure.root);
  const mark=new THREE.Mesh(new THREE.OctahedronGeometry(.37),new THREE.MeshBasicMaterial({color:0x8ff0d5}));
  mark.position.set(x,5,z);world.add(mark);
  cityNPCs.push({figure,mark,name,x,z,role,requires});
  exteriorInteractions.push({type:'npc',name:`Mit ${name} sprechen`,x,z,role,requires});
}
npc('Melanie',-34,-11,0x9c5367,'mara');
npc('Nico',-33,40,0x39917f,'tarek');
npc('Agnes',18,39,0x9176af,'nora');
npc('Dr. Patrick',87,-9,0x476e9f,'vale');
npc('Rudi',-82,40,0x9b824e,'station');
npc('Alvin',-84,-10,0xad7168,'jun');
// Stadtwerke-Auszubildender mit einer optionalen Stadtmission.
npc('Benni',-20,-61,0x4d718c,'benni');
// Weitere Verwandte der großen Familie: eigene Arbeit, eigene Dialoge.
npc('Annika',-92,-11,0xb27991,'annika'); // Floristin, bei Café Luna
npc('Tobi',17,-61,0x7488ae,'tobi'); // Paketbote, beim Park
// Leon taucht erst nach der Hauptgeschichte auf: sein Verschwinden bleibt ein Rätsel.
npc('Leon',-72,40,0x567d9f,'leo','report');
// Messkasten steht außerhalb von Häusern an der Parkkante.
block(world,1.1,2.05,.78,-26,1.025,-62,M.lamp);
block(world,.72,.6,.10,-26,1.55,-61.56,M.skyWindow);
exteriorInteractions.push({type:'object',name:'Messkasten prüfen',x:-26,z:-62,role:'powerBox'});

// ── Room builder: a real walkable 3D interior for EVERY house ────────
let currentBuilding=null, outsideReturn=null;
let roomWidth=14,roomDepth=13;
function clearRoom(){
  roomScene.children.forEach(child=>{
    if(child.userData.textTexture)child.userData.textTexture.dispose();
  });
  roomScene.clear(); interiorInteractions.length=0;
}
function insideObject(name,x,z,role){
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshBasicMaterial({color:0xffd395}));
  marker.position.set(x,1.8,z);roomScene.add(marker);
  interiorInteractions.push({type:'object',name,x,z,role,marker});
}
function makeRoom(building){
  clearRoom();
  const p=building.profileName;
  const warm=['apartment','bakery','market','ordinaryA','ordinaryC','ordinaryD'].includes(p);
  const wall=material(warm?0xe3d9c5:0xb6c8cf);
  roomWidth=14;roomDepth=13;
  flat(roomScene,14,13,0,0,.02,.25,material(warm?0xbda68e:0x869da5));
  // Three complete walls; the fourth side is a dollhouse open façade so
  // that the third-person camera NEVER stares at an opaque nearby wall.
  block(roomScene,14,6,.45,0,3,-6.5,wall);
  block(roomScene,.45,6,13,-7,3,0,wall);
  block(roomScene,.45,6,13,7,3,0,wall);
  // Door lintel with open central doorway at +Z.
  block(roomScene,5.5,6,.36,-4.25,3,6.5,wall);
  block(roomScene,5.5,6,.36,4.25,3,6.5,wall);
  // No overhead front lintel: third-person camera must see into the room.
  flat(roomScene,2.8,.75,0,6.22,.037,.02,M.golden);
  // Furniture with sensible clear space for movement.
  if(p==='apartment'||p.startsWith('ordinary')){
    block(roomScene,3.8,.6,2.2,-3, .45,-4,M.wood); // bed
    block(roomScene,3.8,.32,.42,-3,.9,-4.8,M.white);
    block(roomScene,2.4,1.3,1.4,3.1,.65,-3.7,M.darkBlue); // desk
    block(roomScene,1.8,2.1,.6,5.4,1.05,-2,M.wood); // shelf
    block(roomScene,2.5,.20,1.2,2.9,1.5,0,M.wood);
    if(p==='apartment') insideObject('Kommunikator',3,-3.2,'homePhone');
  }else if(p==='radio'){
    block(roomScene,4,1.8,2.2,-3,.9,-3.5,M.wood);
    block(roomScene,2.4,1.3,1.3,3,.65,-3.2,M.dark);
    block(roomScene,2.2,1.4,.8,3,1.8,-3.2,M.glass);
    insideObject('Tonbandgerät',-3,-3.3,'tape');
    insideObject('Frequenzpult',3,-3.4,'frequency');
  }else if(p==='archive'){
    for(const x of [-4.5,-2.5,2.5,4.5])block(roomScene,1.6,4,1.1,x,2,-5.2,M.wood);
    block(roomScene,3.4,1.1,1.6,0,.55,-2.1,M.darkBlue);
    insideObject('Alte Baupläne',0,-2.1,'plans');
  }else if(p==='aurora'){
    block(roomScene,4,1.1,2.2,-2,.55,-3.4,M.darkBlue);
    block(roomScene,2.5,2,.3,-2,2,-4.5,M.glass);
    block(roomScene,3,1.5,2.2,3,.75,-3.4,M.dark);
    insideObject('Versiegelter Bericht',-2,-3.4,'report');
  }else if(p==='station'){
    block(roomScene,5,1.1,1.3,0,.55,-4.0,M.wood);
    block(roomScene,3,.15,1.0,3,1.5,-2,M.wood);
    insideObject('Fahrplan',0,-3.8,'timetable');
  }else{
    for(const x of [-3.5,0,3.5]){
      block(roomScene,2.8,1.15,1.8,x,.6,-3,M.wood);
      block(roomScene,2.7,.18,1.65,x,1.25,-3,M.white);
    }
    insideObject('Ladentheke',0,-3,'shopCounter');
  }
  interiorInteractions.push({type:'exit',name:'Auf die Straße gehen',x:0,z:5.15});
  if(['market','bakery'].includes(p))insideObject('Notiz an der Wand',-5,-4.7,'wallNote');
}

// ── Save system: same storage key as previous 3D version ────────────
const SAVE_KEY='neonrift_vesper3d';
const startingSave={
  schema:3, x:-26,z:-9.5, inside:'apartment',metMara:false,metTarek:false,
  metNora:false,metVale:false,metStation:false,metJun:false,metStefan:false,metAnnika:false,metTobi:false,tobiEnvelope:false,metLeo:false,powerReadings:false,powerCompleted:false,
  listened:false,tape:false,frequency:false,decoded:false,report:false,
  foundPhone:false,plans:false,photo:false,ticket:false,station:false,
  sideQuest:false,answer:'',ending:false,visited:[]
};
let stored={};
try{stored=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{}}catch{}
const save={...startingSave,...stored};
if(!Array.isArray(save.visited))save.visited=[];
// Previous editions saved the exterior position; retain it but safely avoid
// spawning inside a building after architecture changes.
if(stored.schema!==3 && Object.keys(stored).length){
  save.inside=null;
  save.schema=3;
}
function persist(){
  if(currentBuilding) save.inside=currentBuilding.id;
  else{save.inside=null;save.x=playerPos.x;save.z=playerPos.z;}
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch(error){console.warn('Save unavailable',error)}
}

// ── Player and physics ───────────────────────────────────────────────
const playerPos = new THREE.Vector3(-26,0,-9.5);
const moveVel = new THREE.Vector2();
let jumpVelocity=0,grounded=true,walking=0;
const keys=Object.create(null);
const joy={x:0,y:0};
let yaw=.22,pitch=.18,camDistance=9.2;
let touchRun=false,started=false,dialogOpen=false,menuOpen=false;
const camAnchor=new THREE.Vector3(),lookAnchor=new THREE.Vector3();
let cameraReady=false;
let nearest=null,toastTimeout=0,autosave=0,mapClock=0;
function streetBlock(x,z,r=.58){
  if(Math.abs(x)>150||Math.abs(z)>150)return true;
  for(const b of buildings){
    if(x>b.x-b.w/2-r&&x<b.x+b.w/2+r&&z>b.z-b.d/2-r&&z<b.z+b.d/2+r)return true;
  }
  return false;
}
function canWalk(x,z){
  if(currentBuilding){
    return x>-roomWidth/2+.8&&x<roomWidth/2-.8&&z>-roomDepth/2+.7&&z<roomDepth/2-.4;
  }
  return !streetBlock(x,z);
}
function moveStep(dt){
  let mx=Number(!!(keys.KeyD||keys.ArrowRight))-Number(!!(keys.KeyA||keys.ArrowLeft))+joy.x;
  let mz=Number(!!(keys.KeyS||keys.ArrowDown))-Number(!!(keys.KeyW||keys.ArrowUp))+joy.y;
  const len=Math.hypot(mx,mz);
  if(len>1){mx/=len;mz/=len;}
  const fwdX=-Math.sin(yaw),fwdZ=-Math.cos(yaw);
  const rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
  const moveX=mx*rightX-mz*fwdX,moveZ=mx*rightZ-mz*fwdZ;
  const fast=keys.ShiftLeft||keys.ShiftRight||touchRun;
  const speed=currentBuilding?(fast?6.6:4.5):(fast?9.0:5.8);
  const alpha=1-Math.exp(-dt*13);
  moveVel.x+=(moveX*speed-moveVel.x)*alpha;
  moveVel.y+=(moveZ*speed-moveVel.y)*alpha;
  const nextX=playerPos.x+moveVel.x*dt;
  const nextZ=playerPos.z+moveVel.y*dt;
  if(canWalk(nextX,playerPos.z))playerPos.x=nextX;else moveVel.x=0;
  if(canWalk(playerPos.x,nextZ))playerPos.z=nextZ;else moveVel.y=0;
  jumpVelocity-=26*dt;
  playerPos.y+=jumpVelocity*dt;
  if(playerPos.y<=0){playerPos.y=0;jumpVelocity=0;grounded=true;}
  const moving=Math.hypot(moveVel.x,moveVel.y);
  if(moving>.26){
    const a=Math.atan2(moveVel.x,moveVel.y);
    let dif=Math.atan2(Math.sin(a-hero.root.rotation.y),Math.cos(a-hero.root.rotation.y));
    hero.root.rotation.y+=dif*Math.min(1,dt*12);
    walking+=dt*moving*1.9;
    const stride=Math.sin(walking)*Math.min(.7,moving/8);
    hero.legs[0].rotation.x=stride;
    hero.legs[1].rotation.x=-stride;
    hero.arms[0].rotation.x=-stride*.55;
    hero.arms[1].rotation.x=stride*.55;
  }else{
    for(const limb of [...hero.legs,...hero.arms])limb.rotation.x*=Math.exp(-dt*12);
  }
  // Body position changes; camera target will smooth independently below.
  hero.root.position.copy(playerPos);
}
function stableCamera(dt){
  const look=new THREE.Vector3(playerPos.x,playerPos.y+2.4,playerPos.z);
  const cos=Math.cos(pitch);
  let offset=new THREE.Vector3(
    Math.sin(yaw)*camDistance*cos,
    2.25+camDistance*(.38+Math.sin(pitch)*.50),
    Math.cos(yaw)*camDistance*cos
  );
  const desired=look.clone().add(offset);
  const t=1-Math.exp(-dt*9);
  const tLook=1-Math.exp(-dt*12);
  if(!cameraReady){camAnchor.copy(desired);lookAnchor.copy(look);cameraReady=true;}
  else{camAnchor.lerp(desired,t);lookAnchor.lerp(look,tLook);}
  camera.position.copy(camAnchor);
  camera.lookAt(lookAnchor);
}
function jump(){if(started&&!dialogOpen&&!menuOpen&&grounded){jumpVelocity=8.6;grounded=false}}

// ── Door transitions and room context ────────────────────────────────
function enterBuilding(id,fromLoad=false){
  const b=houses.get(id);
  if(!b)return;
  if(!fromLoad)outsideReturn={x:playerPos.x,z:playerPos.z};
  currentBuilding=b;
  save.visited=Array.from(new Set([...save.visited,id]));
  world.visible=false;roomScene.visible=true;
  makeRoom(b);
  playerPos.set(0,0,3.45);moveVel.set(0,0);jumpVelocity=0;grounded=true;
  yaw=0;pitch=.14;camDistance=7.0;cameraReady=false;
  updateObjective();persist();
  if(!fromLoad)flash(`${b.label} · Du betrittst das Gebäude.`);
}
function exitBuilding(){
  const b=currentBuilding;
  if(!b)return;
  currentBuilding=null;
  world.visible=true;roomScene.visible=false;
  const x=outsideReturn?.x??b.door.x;
  const z=outsideReturn?.z??b.door.z+1.7;
  playerPos.set(x,0,z);
  if(streetBlock(playerPos.x,playerPos.z))playerPos.set(b.door.x,0,b.door.z+1.6);
  moveVel.set(0,0);jumpVelocity=0;grounded=true;
  yaw=.2;pitch=.2;camDistance=9.2;cameraReady=false;
  persist();updateObjective();
  flash('Zurück auf den Straßen von Baumholder.');
}

// Validate saved outdoor coordinates so update cannot trap an old save inside walls.
if(save.inside && houses.has(save.inside))enterBuilding(save.inside,true);
else{
  currentBuilding=null;
  playerPos.set(Number(save.x)||-26,0,Number(save.z)||-9.5);
  if(streetBlock(playerPos.x,playerPos.z))playerPos.set(-26,0,-9.5);
  hero.root.position.copy(playerPos);
}

// ── Story, dialogue and environmental interactions ───────────────────
function flash(text,time=3600){$('toast').textContent=text;$('toast').style.display='block';toastTimeout=performance.now()+time;}
function updateObjective(){
  let objective;
  if(!save.foundPhone) objective='Stefans Morgen · Sieh dir deinen Kommunikator an.';
  else if(!save.metMara) objective='Melanie wartet im Wohnviertel. Finde sie oder erkunde erst die Stadt.';
  else if(!save.tape) objective='Melanies Mann Leon · Suche das Tonbandgerät im Radio Vega.';
  else if(!save.metNora) objective='Eine Nummer fehlt · Vielleicht kennt Agnes im Archiv den Code.';
  else if(!save.decoded) objective='91.7 · Kehre zum Radio zurück und entschlüssele das Signal.';
  else if(!save.metVale) objective='AURORA · Sprich mit Dr. Patrick vor dem Forschungsgebäude.';
  else if(!save.report) objective='Eine verschlossene Akte · Suche den Bericht in AURORA.';
  else objective='Der erste Tag ist vorbei. Entdecke die Nebenhandlungen der Stadt.';
  $('goal').textContent=(currentBuilding?`${currentBuilding.label} · `:'')+objective;
}
function persistAndGoal(){persist();updateObjective();}
function closeDialogue(){dialogOpen=false;$('dialogue').hidden=true;}
function dialogue(who,title,body,options){
  dialogOpen=true; $('dialogue').hidden=false;
  $('speaker').textContent=who;$('dialogTitle').textContent=title;
  $('dialogueText').textContent=body;
  const choices=$('choices');choices.replaceChildren();
  for(const option of options){
    const btn=document.createElement('button');
    btn.textContent=option.label;
    if(option.secondary)btn.classList.add('secondary');
    btn.onclick=()=>{
      closeDialogue();
      if(option.run)option.run();
      persistAndGoal();
    };
    choices.appendChild(btn);
  }
  if(!options.length){
    const btn=document.createElement('button');btn.textContent='Weiter';btn.onclick=closeDialogue;
    choices.appendChild(btn);
  }
}
function sceneText(who,title,body,options){dialogue(who,title,body,options)}
function eventCard(top,heading,caption,after){
  $('storyEyebrow').textContent=top;
  $('storyTime').textContent=heading;
  $('storyCaption').textContent=caption;
  $('storyCard').classList.add('active');
  setTimeout(()=>{$('storyCard').classList.remove('active');after?.()},2150);
}
function speak(role){
  if(role==='mara'){
    if(save.metLeo){sceneText('MELANIE','Leon ist wieder da', '„Stefan … du hast ihn wirklich gefunden?“ Melanie ringt nach Worten. „Ich weiß nicht, was am Bahnhof passiert ist. Aber heute Abend sitzen wir alle zusammen. Als Familie.“',[{label:'Wir passen aufeinander auf.'}]);return;}
    if(!save.metMara){
      sceneText('MELANIE · WOHNVIERTEL','Drei Anrufe',
        'Melanie sieht sich um, bevor sie spricht. Ihre Jacke ist noch vom Regen nass.\n\n„Mein Mann Leon ist seit Dienstag weg. Er arbeitete beim Radiosender. Gestern kam eine Kassette ohne Absender in meinen Briefkasten. Ich konnte nur fünf Sekunden hören, dann war sie leer.“\n\nAuf die Frage nach der Polizei schüttelt sie den Kopf. „Die haben mir gesagt, Leon hätte nie bei Radio Vega gearbeitet.“',[
        {label:'Wir suchen gemeinsam nach ihm.',run:()=>{save.metMara=true;save.answer='help';sceneText('MELANIE','Eine Vereinbarung','„Stefan, wir sind Familie. Wenn du etwas findest, bring es zuerst zu mir. Versprich mir, dass du nicht allein nach Leon suchst.“', [{label:'Versprochen.'}])}},
        {label:'Was, wenn Leon freiwillig weg ist?',secondary:true,run:()=>{save.metMara=true;save.answer='doubt';sceneText('MELANIE','Vielleicht','„Vielleicht. Aber warum hat mein Mann seine Schlüssel, sein Telefon und sogar seine Schuhe hiergelassen?“', [{label:'Ich sehe mich beim Radio um.'}])}},
        {label:'Später. Ich muss erst nachdenken.',secondary:true}
      ]);
    }else sceneText('MELANIE','Bitte gib nicht auf',
      save.decoded?'„Du hast es gehört, nicht wahr? Diese Stimme … sie klingt wie Leon. Aber der Sender wurde vor zwei Tagen abgeschaltet.“':'„Wenn du zu Radio Vega gehst: Leon versteckte Dinge immer dort, wo niemand freiwillig aufräumt.“',[
        {label:'Ich bleibe dran.'},
        {label:'Was weißt du über AURORA?',run:()=>sceneText('MELANIE','Das Gebäude am Rand',
          '„Dort bekommt jeder einen guten Lohn und niemand darf darüber reden, woran er arbeitet. Leon sagte immer, das sei der freundlichste Ort in Baumholder. Er machte dabei nie ein freundliches Gesicht.“', [{label:'Danke.'}])}
      ]);
  }else if(role==='tarek'){
    if(!save.metTarek)sceneText('NICO · MARKTPLATZ','Die Stadt hat Ohren',
      '„Du schaust aus, als wärst du auf der Suche“, sagt Nico und zieht die Plane über seinen Stand. „Heute Morgen haben sie sämtliche Kameras am Bahnhof ausgetauscht. Ohne Ankündigung. Ohne Uniformen.“\n\nEr legt ein Stück Kreide vor dich. Darauf stehen drei Striche und ein Kreis.',[
        {label:'Was bedeutet das?',run:()=>{save.metTarek=true;save.sideQuest=true;sceneText('NICO','Ein Zeichen aus Kreide','„Früher haben die Bahnarbeiter damit geheime Lieferungen markiert. Heute habe ich es an der Tür von AURORA gesehen.“', [{label:'Ich merke es mir.'}])}},
        {label:'Du übertreibst.',secondary:true,run:()=>{save.metTarek=true;save.sideQuest=true}}
      ]);
    else sceneText('NICO','Ein leiser Hinweis',
      '„Die besten Geheimnisse sind die, die sich als etwas Alltägliches tarnen.“ Er zeigt zum Bahnhof. „Frag nach dem Zug, den es offiziell gar nicht gibt.“', [{label:'Ich werde nachfragen.'}]);
  }else if(role==='nora'){
    if(!save.metNora)sceneText('AGNES · ARCHIV','Eine fehlende Seite',
      'Agnes legt ihre Jacke über einen Stuhl. „Rudi hat heute Früh am Bahnhof wieder etwas Seltsames gesehen. Seit wir verheiratet sind, kann ich an seiner Stimme hören, wann er sich Sorgen macht.“\n\nDann führt sie dich zum Fenster und legt eine Karte der alten Stadt aus. „Ich habe Leon geholfen, die Senderprotokolle zu archivieren. Dann löschte jemand sein ganzes Personalregister.“\n\nSie faltet die Karte und zeigt auf eine handschriftliche Notiz: 2 – 7 – 1.',[
        {label:'Warum diese drei Zahlen?',run:()=>{save.metNora=true;sceneText('AGNES','Das Passwort',
          '„Leon sagte, falls wir jemals getrennt würden, sei das die Reihenfolge. Ich hielt es für einen Witz. Jetzt fürchte ich, es war ein Abschied.“', [{label:'Ich probiere es aus.'}])}},
        {label:'Darf ich die Zahlen behalten?',run:()=>{save.metNora=true;flash('Notiert: 2 – 7 – 1')}}
      ]);
    else sceneText('AGNES','Verdeckte Baupläne',
      '„Baumholder ist älter, als die Stadtverwaltung behauptet. Unter den Neubauten liegen Tunnel von einem früheren Versorgungsnetz. Der Eingang könnte beim Bahnhof sein.“',[
        {label:'Kann ich die Pläne ansehen?',run:()=>sceneText('AGNES','Nicht hier draußen',
          '„Geh in das Archivgebäude. Im hinteren Raum steht ein alter Kartentisch. Vielleicht hat ihn noch niemand entfernt.“', [{label:'Ich sehe nach.'}])},
        {label:'Danke.'}
      ]);
  }else if(role==='vale'){
    if(!save.decoded){
      sceneText('DR. PATRICK · AURORA','Ein Termin, den es nicht gibt',
        '„Sie sind nicht angemeldet“, sagt der Mann vor dem Tor. Sein Blick bleibt einen Moment zu lange an deinem Gesicht hängen. „Und trotzdem … habe ich Sie erwartet.“',[
          {label:'Was meinen Sie damit?',run:()=>sceneText('DR. PATRICK','Eine kurze Pause',
            '„Ich meine, dass Sie besser wieder gehen sollten. Für Ihre eigene Ruhe.“', [{label:'Gut.'}])},
          {label:'Dann komme ich später wieder.',secondary:true}
        ]);
    }else if(!save.metVale){
      sceneText('DR. PATRICK · AURORA','Die Stimme auf dem Band',
        '„Sagen Sie den Satz nicht noch einmal.“ Patrick sieht plötzlich erschöpft aus. „Wir haben diese Aufnahme nie gesendet. Und wir haben alle Kopien verbrannt.“\n\nEr greift in seine Manteltasche und drückt dir einen weißen Ausweis in die Hand. Ohne Foto. Ohne Namen.',[
          {label:'Warum helfen Sie mir?',run:()=>{save.metVale=true;sceneText('DR. PATRICK','Vor dem Sturm',
            '„Weil ich vor Jahren jemandem versprochen habe, beim zweiten Mal nicht wegzusehen. Der Ausweis öffnet das Archiv im Erdgeschoss. Lesen Sie nur die erste Seite.“', [{label:'Ich werde vorsichtig sein.'}])}},
          {label:'Ich will wissen, was Sie verbergen.',run:()=>{save.metVale=true;save.answer='confront';sceneText('DR. PATRICK','Ein Fehler',
            '„Dann sollten Sie sehr schnell lernen, wann man keine Fragen stellt.“ Seine Hand zittert, als er dir den Ausweis gibt.', [{label:'Ich gehe hinein.'}])}}
        ]);
    }else sceneText('DR. PATRICK','Ein letzter Rat','„Wenn Sie im Gebäude etwas finden, das Ihren Namen trägt – lesen Sie zuerst das Datum.“', [{label:'Verstanden.'}]);
  }else if(role==='station'){
    sceneText('RUDI · BAHNHOF','Der Zug um 03:17',
      '„Agnes hat gesagt, ich soll nicht so viel arbeiten“, murmelt Rudi. „Leicht gesagt. Laut Fahrplan fahren nachts keine Züge. Aber ich muss die Weichen jeden Morgen neu stellen. Einer fährt also doch.“\n\nEr tippt auf seine Uhr. „Immer zur gleichen Minute. Und manchmal höre ich Musik aus den leeren Waggons.“',[
        {label:'Wann genau?',run:()=>{save.metStation=true;save.station=true;flash('Hinweis: 03:17 Uhr')}},
        {label:'Haben Sie einen Fahrplan?',run:()=>{save.metStation=true;sceneText('RUDI · BAHNHOF','Ein altes Stück Papier',
          '„Die letzten echten Fahrpläne sind im Bahnhof. Ich habe nichts mehr damit zu tun.“', [{label:'Ich schaue nach.'}])}}
      ]);
  }else if(role==='benni'){
    if (!save.metStefan){
      sceneText('BENNI · STADTWERKE','Ein ungewöhnlicher Ausschlag',
        'Benni sitzt auf einer Bank am Park und faltet einen zerknitterten Messbericht. „Du kennst dich doch mit Technik aus? Seit zwei Tagen meldet ein Messkasten Stromspitzen, obwohl hier gar keine Leitung für so große Lasten verläuft.“\n\nEr blickt zu den Häusern. „Die Leute beschweren sich über flackernde Lampen. Ich möchte nur herausfinden, warum.“',[
          {label:'Ich sehe mir den Messkasten an.',run:()=>{save.metStefan=true;flash('Nebenauftrag: Messkasten am Park untersuchen.')}},
          {label:'Vielleicht später.',secondary:true}
        ]);
    } else if(save.powerReadings&&!save.powerCompleted){
      sceneText('BENNI','Daten, die nicht hierhergehören',
        'Benni liest die Werte zweimal. „Da ist ein Impuls, der jede Nacht zur selben Minute auftaucht. Aber der Verbrauch hat kein Ziel. Das ist, als würde eine ganze Straße Strom ziehen, ohne dass irgendwo ein Licht angeht.“\n\nEr steckt den Bericht ein. „Ich frage morgen in der Stadtverwaltung nach. Danke für deine Hilfe.“',[
          {label:'Sag mir, wenn du etwas findest.',run:()=>{save.powerCompleted=true;flash('Nebenauftrag abgeschlossen · Benni forscht weiter.')}}
        ]);
    } else if(save.powerCompleted){
      sceneText('BENNI','Keine Antwort von der Stadt',
        '„Die Verwaltung behauptet, unsere Geräte seien defekt. Seltsam nur, dass sie heute sämtliche Messprotokolle abgeholt hat.“ Benni lässt seinen Blick über die Straße wandern. „Ich behalte die Sache im Auge.“',[
          {label:'Bleib vorsichtig.'}
        ]);
    } else {
      sceneText('BENNI','Der graue Kasten',
        '„Direkt neben dem Park. Grauer Stromkasten, blauer Aufkleber. Schreib dir die Messwerte auf, bevor jemand die Sicherung herausnimmt.“',[
          {label:'Ich sehe nach.'}
        ]);
    }
  }else if(role==='annika'){
    if(!save.metAnnika){
      sceneText('ANNIKA · BLUMENLADEN','Ein Strauß, der noch nicht fertig ist',
        'Annika sortiert Blumen auf einer Kiste neben dem Café. „Alvin hat heute zum dritten Mal gefragt, welche Farbe ich am liebsten mag. Meinst du, er plant etwas?“ Sie lacht. „Dabei wünsche ich mir eigentlich nur einen freien Nachmittag mit der Familie.“\n\nSie hebt einen Umschlag auf. „Tobi hat ihn vorhin hier vergessen. Ohne Absender, nur mit einer Nummer: 03:17.“',[
          {label:'Frag Alvin doch direkt.',run:()=>{save.metAnnika=true;save.annikaAdvice='honest';sceneText('ANNIKA','Ein guter Rat','„Vielleicht mache ich das. Aber erst muss ich diesen Umschlag zurückgeben. Frag Tobi beim Park, ob er ihn vermisst.“',[{label:'Ich suche Tobi.'}])}},
          {label:'Ich kann Tobi Bescheid sagen.',run:()=>{save.metAnnika=true;save.annikaAdvice='help';flash('Nebenhandlung: Umschlag für Tobi · Suche ihn beim Park.')}}
        ]);
    }else sceneText('ANNIKA','Blumen und Geheimnisse',
      '„Noch ist zwischen Alvin und mir nichts offiziell. Vielleicht ändert sich das bald.“ Sie blickt zu einem vorbeifahrenden Lieferwagen. „Und vergiss Tobi nicht. Der Umschlag macht ihm offenbar Sorgen.“',[
        {label:'Ich rede mit Tobi.'}
      ]);
  }else if(role==='tobi'){
    if(!save.metAnnika){
      sceneText('TOBI · PAKETDIENST','Eine verlorene Sendung',
        '„Stefan! Hast du Annika gesehen? Ich habe vor dem Café einen Brief liegen gelassen. Die Adresse war merkwürdig: Gleis 0. Ich weiß nicht einmal, ob es das hier gibt.“',[
          {label:'Ich suche Annika.',run:()=>{save.metTobi=true;flash('Tobi wartet auf Nachricht von Annika.')}},
          {label:'Nicht gesehen.',secondary:true,run:()=>{save.metTobi=true}}
        ]);
    }else if(!save.tobiEnvelope){
      sceneText('TOBI','Der Brief ohne Absender',
        '„Bei Annika? Zum Glück!“ Tobi rückt seine Tasche zurecht. „Ich habe einen Auftrag, den ich gar nicht angenommen habe. Jeden Morgen steht ein Brief im System, immer mit derselben Uhrzeit.“\n\nEr hält dir ein zerknittertes Formular hin: 03:17 — Empfänger: NICHT VERZEICHNET.',[
          {label:'Formular fotografieren',run:()=>{save.metTobi=true;save.tobiEnvelope=true;flash('Nebenauftrag abgeschlossen · Hinweis 03:17 im Journal.')}},
          {label:'Behalte es lieber.',secondary:true,run:()=>{save.metTobi=true}}
        ]);
    }else sceneText('TOBI','Keine weiteren Pakete',
      '„Seit heute Mittag zeigt mein Scanner keine neuen Zustellungen an. Aber ich höre nachts immer noch diesen Zug.“',[{label:'Pass auf dich auf.'}]);
  }else if(role==='leo'){
    sceneText('LEON · BAHNHOF','Du bist doch verschwunden!',
      'Leon steht auf dem Bahnsteig, als wäre nichts passiert. Seine Jacke trägt das Logo von Radio Vega. „Stefan?“, fragt er leise. „Sag Melanie bitte, dass ich wieder da bin.“\n\nEr schaut an dir vorbei, zur unterirdischen Treppe. „Ich weiß nicht, welchen Tag wir haben. Für mich waren es nur ein paar Minuten.“',[
        {label:'Melanie wartet auf dich.',run:()=>{save.metLeo=true;flash('Leon ist zurück · Sprich mit Melanie.')}},
        {label:'Was ist unter dem Bahnhof?',run:()=>{save.metLeo=true;sceneText('LEON','Kein Licht am Ende','„Da unten haben die Uhren aufgehört zu laufen. Mehr weiß ich nicht. Vielleicht ist es besser so.“',[{label:'Ich werde nachforschen.'}])}}
      ]);
  }else if(role==='jun'){
    sceneText('ALVIN · CAFÉ LUNA','Ein seltsamer Gast',
      '„Annika hilft heute bei der Floristin aus. Ich wollte sie eigentlich fragen, ob wir unser Leben gemeinsam planen wollen“, sagt Alvin und lächelt verlegen. „Den richtigen Moment für die Verlobung suche ich noch.“\n\n„Leon? Klar kenne ich ihn. Er trank jeden Donnerstag Tee, obwohl er Tee hasste. Letzte Woche hat er plötzlich das Glas abgestellt und gesagt: ,Ich glaube, wir sind schon einmal hier gewesen.‘“',[
        {label:'Hat er noch etwas gesagt?',run:()=>{save.metJun=true;sceneText('ALVIN','Eine Erinnerung','„Er hat nach einer alten Fotografie gefragt. Angeblich hing sie mal an der Wand der Markthalle. Ich habe ihm gesagt, dass das Gebäude erst zwölf Jahre alt ist.“',[{label:'Seltsam.'}])}},
        {label:'Danke.',run:()=>{save.metJun=true}}
      ]);
  }
}
function inspect(role){
  switch(role){
    case 'powerBox':
      if(!save.metStefan)sceneText('MESSKASTEN AM PARK','Ein kleiner Defekt?',
        'Ein Zähler klickt im regelmäßigen Takt. An der Seite steht „Stadtwerke BAUMHOLDER“. Das Typenschild ist warm, obwohl der Kasten im Schatten steht.',[
          {label:'Erst jemanden von den Stadtwerken fragen.'}
        ]);
      else if(!save.powerReadings)sceneText('MESSKASTEN AM PARK','Messwerte',
        'Du liest die Daten von Bennis Messgerät ab. Zwischen den normalen Schwankungen steht eine einzige unerklärliche Spitze – jeden Tag um 03:17 Uhr. Eine Kennung taucht wiederholt auf: ECHO / V-0.',[
          {label:'Messung für Benni notieren',run:()=>{save.powerReadings=true;flash('Messdaten gesichert · Sprich wieder mit Benni.')}},
          {label:'Abbrechen',secondary:true}
        ]);
      else sceneText('MESSKASTEN AM PARK','Notiert',
        'Die Daten sind gesichert. Der Zähler tickt jetzt wieder ganz normal.',[
          {label:'Weiter.'}
        ]);
      break;

    case 'homePhone':
      sceneText('DEINE WOHNUNG','Drei verpasste Anrufe',
        '07:14 Uhr. Auf dem Display erscheint eine Nachricht von Melanie: „Bitte komm allein. Ich glaube, Leon steckt in Schwierigkeiten.“\n\nDaneben: eine alte Erinnerung an einen gemeinsamen Ausflug. Vier Personen vor einem riesigen Bahnhof. Du erkennst Melanie, Leon – und dich selbst, Stefan. Die vierte Person wurde aus dem Foto gekratzt.',[
          {label:'Nachricht beantworten',run:()=>{save.foundPhone=true;flash('Hauptgeschichte begonnen · Finde Melanie im Wohnviertel')}},
          {label:'Foto genauer ansehen',run:()=>{save.foundPhone=true;save.photo=true;sceneText('DEINE WOHNUNG','Die vierte Person',
            'Jemand hat das Gesicht so gründlich entfernt, dass sogar das Papier eingerissen ist. Auf der Rückseite steht in deiner eigenen Handschrift: „Erinner mich daran, wenn wir uns wiedersehen.“', [{label:'Einstecken.'}])}}
        ]);break;
    case 'tape':
      if(!save.metMara){
        sceneText('RADIO VEGA','Ein leerer Arbeitsplatz','Auf einem Schreibtisch steht ein altes Tonbandgerät. Der rechte Lautsprecher ist ausgebaut. Auf dem Tisch klebt ein Etikett: LEON.',[{label:'Ich schaue mich später noch einmal um.'}]);
      }else{
        sceneText('RADIO VEGA','Sechs Sekunden',
          'Du drückst die Wiedergabetaste. Erst rauscht es. Dann hörst du ein Klopfen, drei Atemzüge und Leons Stimme: „Agnes hat die Zahlen. Sucht nicht nach mir. Sucht nach dem, was ich gehört habe.“\n\nDas Band stoppt. Obwohl du nichts angefasst hast, beginnt es rückwärts zu laufen.',[
            {label:'Aufnahme sichern',run:()=>{save.tape=true;flash('Die Aufnahme ist gesichert. Wer ist Agnes?')}},
            {label:'Noch einmal hören',run:()=>{save.tape=true;sceneText('RADIO VEGA','Das zweite Geräusch',
              'Zwischen zwei Knacksern hörst du leise Schritte. Es klingt, als würde jemand durch einen langen Gang laufen. Dann eine Tür. Dann absolute Stille.', [{label:'Ich brauche Hilfe bei der Entschlüsselung.'}])}}
          ]);
      }break;
    case 'frequency':
      if(!save.tape)sceneText('RADIO VEGA','Verschlüsseltes Empfangspult','Auf dem Display flackert nur eine Zahl: 91.7. Das Gerät ist gesperrt.',[{label:'Später noch einmal.'}]);
      else if(!save.metNora)sceneText('RADIO VEGA','Drei Stellen fehlen','Das Gerät verlangt einen dreistelligen Code. Ein Klebezettel verweist auf „A. / altes Archiv“. Vielleicht gibt es dort eine Antwort.',[{label:'A. könnte Agnes sein.'}]);
      else if(!save.decoded)sceneText('RADIO VEGA','Entschlüsseln',
        'Das Display fragt nach einer dreistelligen Folge. Du erinnerst dich an die Notiz von Agnes.',[
          {label:'2 – 7 – 1',run:()=>{save.decoded=true;save.frequency=true;eventCard('RADIO VEGA','SIGNAL GEFUNDEN','Ein einzelner Ton durchbricht das Rauschen.',()=>sceneText('RADIO VEGA','Die Stimme',
            '„Hier ist Station Null. Falls ihr mich hört: Sagt Patrick, dass die Türen längst offen sind.“\n\nDu blickst zum Fenster. Für einen Augenblick flackern sämtliche Straßenlampen gleichzeitig.',[{label:'Patrick finden.'}]))}},
          {label:'2 – 1 – 7',run:()=>{flash('ZUGRIFF VERWEIGERT · Die Reihenfolge stimmt nicht.')}},
          {label:'7 – 2 – 1',run:()=>{flash('ZUGRIFF VERWEIGERT · Noch einmal versuchen.')}}
        ]);
      else sceneText('RADIO VEGA','Station Null','Die letzte Meldung bleibt im Speicher: „Sagt Patrick, dass die Türen längst offen sind.“', [{label:'Zurück.'}]);
      break;
    case 'plans':
      sceneText('ARCHIV','Pläne unter der Stadt',
        'Der Kartentisch zeigt mehrere Versionen desselben Straßennetzes. Auf dem ältesten Plan gibt es unter AURORA einen Bahnhof. Auf dem neuesten ist dort nur noch eine weiße Fläche.',[
          {label:'Pläne abzeichnen',run:()=>{save.plans=true;flash('Archivpläne im Journal notiert.')}},
          {label:'Wer hat das geändert?',run:()=>{save.plans=true;sceneText('ARCHIV','Ein roter Stempel',
            'Auf der Rückseite steht: „Freigabe ausschließlich durch P. / Ebene 0“. Mehr findest du nicht.', [{label:'Merken.'}])}}
        ]);break;
    case 'report':
      if(!save.metVale)sceneText('AURORA','Zutritt verweigert','Die Konsole verlangt einen Sonderausweis. Die Akte ist versiegelt.',[{label:'Schließen.'}]);
      else if(!save.report)sceneText('AURORA','Ein Bericht ohne Namen',
        'Du legst den weißen Ausweis auf den Scanner. Eine Datei öffnet sich: PROJEKT ECHO — VORVERSUCH 01.\n\nDie erste Seite enthält nur einen Lageplan, einen Termin für morgen früh und den Vermerk „Sprachsystem: ChatGPT / Testmodus“ sowie einen Satz: „Wenn die Erinnerung beginnt, ist die erste Phase bereits abgeschlossen.“\n\nDu hast keine Ahnung, was das bedeuten soll. Dein Kommunikator klingelt. Es ist Melanie.',[
          {label:'Melanie zurückrufen',run:()=>{save.report=true;eventCard('KAPITEL 6 · ENDE DES ERSTEN TAGES','20:46 UHR','Und irgendwo unter Baumholder fährt ein Zug ab.',()=>sceneText('MELANIE · ANRUF','Nicht nach Hause gehen',
            '„Jemand war in deiner Wohnung. Sie haben nichts mitgenommen. Nur das alte Foto ist weg.“\n\nBevor du antworten kannst, hörst du eine fremde Stimme. „Melanie? Mit wem sprichst du?“ Die Verbindung bricht ab.',[{label:'Fortsetzung folgt …',run:()=>flash('Kapitel 6 abgeschlossen · Die Stadt bleibt weiter erkundbar.')}]))}},
          {label:'Erste Seite fotografieren',run:()=>{save.report=true;eventCard('KAPITEL 6 · ENDE DES ERSTEN TAGES','20:46 UHR','Das Telefon klingelt. Niemand geht ran.',()=>flash('Kapitel 6 abgeschlossen · Alle Nebenhandlungen bleiben offen.'))}}
        ]);
      else sceneText('AURORA','Projekt Echo','Du hast den Lageplan bereits kopiert. Du kommst immer wieder auf die gleiche Frage zurück: Warum hatte Patrick damit gerechnet, dass du ihn lesen wirst?', [{label:'Zurück.'}]);
      break;
    case 'timetable':
      sceneText('BAHNHOF','Unvollständiger Fahrplan',
        'Zwischen ausgeblichenen Aushängen steckt ein neues Ticket: Ziel unbekannt, Gleis 0. Die Druckfarbe ist noch frisch.',[
          {label:'Ticket mitnehmen',run:()=>{save.ticket=true;flash('Geheimnisvolles Ticket gefunden.')}},
          {label:'Zurücklegen.'}
        ]);break;
    case 'wallNote':
      sceneText('BAUMHOLDER · FUNDSACHE','Das Foto aus der Markthalle',
        'An der Wand hängt ein verwittertes Bild der Stadt. Jemand hat eine Ecke mit Tinte geschwärzt. Daneben steht: „Unsere Stadt war nicht immer hier.“',[
          {label:'Notiz fotografieren',run:()=>{save.photo=true;flash('Neue Fundsache im Journal.')}},
          {label:'Weitergehen.'}
        ]);break;
    case 'shopCounter':
      sceneText('LADEN','Ein freundlicher Nachmittag',
        'Auf der Theke liegt ein handgeschriebener Zettel: „Heute früher geschlossen. Für alle, die eine Antwort suchen: Das Café Luna hat noch offen.“', [{label:'Alles klar.'}]);break;
  }
}
function interact(){
  if(!started||dialogOpen||menuOpen||!nearest)return;
  if(nearest.type==='door') enterBuilding(nearest.buildingId);
  else if(nearest.type==='exit')exitBuilding();
  else if(nearest.type==='npc')speak(nearest.role);
  else if(nearest.type==='object')inspect(nearest.role);
}
function scanInteractions(){
  const options=currentBuilding?interiorInteractions:exteriorInteractions;
  let best=null,dist=currentBuilding?3.0:3.25;
  for(const candidate of options){
    if(candidate.requires&&!save[candidate.requires])continue;
    const d=Math.hypot(candidate.x-playerPos.x,candidate.z-playerPos.z);
    if(d<dist){best=candidate;dist=d;}
  }
  nearest=best;
  $('prompt').style.display=nearest&&!dialogOpen&&!menuOpen?'block':'none';
  if(nearest)$('prompt').textContent=`${mobile?'AKTION':'E'}  ·  ${nearest.name}`;
}

// ── Journal ───────────────────────────────────────────────────────────
function journal(){
  const quests=[
    ['Familie in Baumholder','Stefan (du), Agnes & Rudi (verheiratet), Melanie & Leon (verheiratet), Alvin & Annika (noch nicht verlobt), Benni, Tobi, Nico und Patrick. Jeder hat seinen eigenen Alltag.'],
    ['Hauptgeschichte',save.report?'Kapitel 6 abgeschlossen. Die Stadt bleibt zugänglich.':$('goal').textContent],
    ['Melanies Mann Leon ist verschwunden',save.metMara?'Melanie sucht ihren Mann Leon.':'Melanie will dringend mit dir sprechen.'],
    ['Die Frequenz 91.7',save.decoded?'Die Meldung von Station Null wurde entschlüsselt.':save.tape?'Tonband gefunden. Ein dreistelliger Code fehlt.':'Suche nach Hinweisen bei Radio Vega.'],
    ['Die verschwundenen Gleise',save.plans?'Unter AURORA gab es einst einen Bahnhof.':save.metNora?'Agnes erwähnt verdeckte Baupläne.':'Im Archiv könntest du alte Pläne finden.'],
    ['Der Zug um 03:17',save.ticket?'Ein ungewöhnliches Ticket wurde gefunden.':save.station?'Ein Zug fährt jede Nacht, obwohl er nicht auf dem Plan steht.':'Sprich mit Rudi am Bahnhof.'],
    ['Störungen im Stromnetz',save.powerCompleted?'Benni hat die Messdaten. Die Stadtverwaltung schweigt.':save.powerReadings?'Du hast die seltsamen Messdaten. Sprich mit Benni.':save.metStefan?'Benni bittet dich, den Kasten am Park zu überprüfen.':'Beim Park untersucht Benni ungewöhnliche Stromspitzen.'],
    ['Tobis rätselhafter Umschlag',save.tobiEnvelope?'03:17 und Gleis 0 stehen auf einem Formular.':save.metAnnika?'Annika erwähnt einen Umschlag. Suche Tobi beim Park.':'Sprich mit Annika und Tobi.'],
    ['Ein Foto ohne Datum',save.photo?'Du hast ein beschädigtes Foto gefunden.':'Ein merkwürdiges Foto soll in der Markthalle hängen.']
  ];
  const list=$('journalBody');list.replaceChildren();
  for(const [heading,detail] of quests){
    const el=document.createElement('div');el.className='quest';
    const strong=document.createElement('strong');strong.textContent=heading;
    const p=document.createElement('p');p.textContent=detail;
    el.append(strong,p);list.append(el);
  }
}
$('menuBtn').onclick=()=>{if(!started||dialogOpen)return;menuOpen=true;$('menu').hidden=false;journal()};
$('closeMenu').onclick=()=>{menuOpen=false;$('menu').hidden=true};
$('resetSave').onclick=()=>{if(confirm('Nur den BAUMHOLDER-3D-Spielstand wirklich löschen und von vorne anfangen?')){localStorage.removeItem(SAVE_KEY);location.reload()}};
$('qualityBtn').onclick=()=>{
  quality=quality==='auto'?'low':quality==='low'?'high':'auto';
  $('qualityBtn').textContent='Grafik: '+({auto:'Auto',low:'Schnell',high:'Hoch'})[quality];
  resize();
  flash(quality==='low'?'Schnellmodus aktiviert.':'Grafikqualität: '+quality);
};
$('start').onclick=()=>{
  started=true;$('intro').hidden=true;
  hero.root.position.copy(playerPos);
  updateObjective();
  flash(currentBuilding?'Stefan, sieh dir die Dinge in deiner Wohnung an.':'Baumholder erwacht. Dein erster Tag beginnt.');
};
$('act').onclick=interact;

// ── Keyboard, touch joystick and non-jittery orbit controls ──────────
addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if(e.code==='KeyE'&&!e.repeat)interact();
  if(e.code==='Space'&&!e.repeat)jump();
  if(e.code==='Escape'){
    if(dialogOpen)closeDialogue();
    else if(menuOpen){menuOpen=false;$('menu').hidden=true;}
  }
});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const key in keys)keys[key]=false;touchRun=false;joy.x=0;joy.y=0;});
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump()});
$('run').addEventListener('pointerdown',e=>{e.preventDefault();touchRun=true});
for(const ev of ['pointerup','pointercancel','pointerleave'])$('run').addEventListener(ev,()=>touchRun=false);
const stick=$('stick'),nub=$('nub');
let stickPointer=null;
function updateStick(e){
  const rect=stick.getBoundingClientRect();
  const x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;
  const radius=rect.width*.32;
  const len=Math.hypot(x,y),factor=len>radius?radius/len:1;
  joy.x=x*factor/radius;joy.y=y*factor/radius;
  nub.style.transform=`translate(${x*factor}px,${y*factor}px)`;
}
stick.addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e)});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e)});
for(const ev of ['pointerup','pointercancel'])stick.addEventListener(ev,e=>{
  if(e.pointerId!==stickPointer)return;
  stickPointer=null;joy.x=joy.y=0;nub.style.transform='translate(0,0)';
});
let drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!started||dialogOpen||menuOpen)return;
  if(mobile&&e.clientX<innerWidth*.42)return; // left area belongs to joystick
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  yaw-=clamp(e.clientX-drag.x,-85,85)*.005;
  pitch=clamp(pitch+clamp(e.clientY-drag.y,-75,75)*.0038,-.18,.7);
  drag.x=e.clientX;drag.y=e.clientY;
});
for(const ev of ['pointerup','pointercancel'])renderer.domElement.addEventListener(ev,()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{
  e.preventDefault();camDistance=clamp(camDistance+Math.sign(e.deltaY)*.65,5.5,13);
},{passive:false});

// ── Minimap: 8 FPS, no per-frame canvas drawing ──────────────────────
function minimap(){
  const c=$('minimap'),ctx=c.getContext('2d');
  const w=c.width,h=c.height;ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#243d45';ctx.fillRect(0,0,w,h);
  if(currentBuilding){
    ctx.fillStyle='#849a9e';ctx.fillRect(22,20,212,216);
    ctx.fillStyle='#c1b4a0';ctx.fillRect(34,33,188,190);
    ctx.fillStyle='#364c5a';ctx.fillRect(106,218,44,12);
    ctx.fillStyle='#ffe3aa';ctx.fillText(currentBuilding.label,16,18);
  }else{
    const scale=.83,ox=w/2-playerPos.x*scale,oz=h/2-playerPos.z*scale;
    ctx.fillStyle='#566775';
    for(const v of roadLines){
      ctx.fillRect(ox+(v-6.2)*scale,0,12.5*scale,h);
      ctx.fillRect(0,oz+(v-6.2)*scale,w,12.5*scale);
    }
    ctx.fillStyle='#adc2bb';
    for(const b of buildings){
      ctx.fillRect(ox+(b.x-b.w/2)*scale,oz+(b.z-b.d/2)*scale,b.w*scale,b.d*scale);
    }
    ctx.fillStyle='#7ff3d8';
    for(const point of exteriorInteractions){
      if(point.type==='door')continue;
      const x=ox+point.x*scale,y=oz+point.z*scale;
      if(x>=0&&x<=w&&y>=0&&y<=h){ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
    }
  }
  ctx.fillStyle='#ffdf94';ctx.beginPath();ctx.arc(w/2,h/2,5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffdf94';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2,h/2);
  ctx.lineTo(w/2-Math.sin(yaw)*16,h/2-Math.cos(yaw)*16);ctx.stroke();
}

// ── Animation frame loop ─────────────────────────────────────────────
let previous=performance.now();let perfClock=0,fpsFrames=0,frameRate=60;
function frame(t){
  requestAnimationFrame(frame);
  const elapsed=Math.min(Math.max((t-previous)/1000,0),.062);previous=t;
  if(started&&!dialogOpen&&!menuOpen){
    moveStep(elapsed);
    scanInteractions();
    autosave+=elapsed;
    if(autosave>6){persist();autosave=0;}
  }
  stableCamera(Math.max(elapsed,.001));
  if(currentBuilding){
    for(const o of interiorInteractions){if(o.marker)o.marker.rotation.y+=elapsed*1.2;}
  }else{
    for(const n of cityNPCs){
      const shown=!n.requires||Boolean(save[n.requires]);
      n.figure.root.visible=shown; n.mark.visible=shown;
      if(shown)n.mark.rotation.y+=elapsed*.55;
    }
  }
  if(t>toastTimeout)$('toast').style.display='none';
  mapClock+=elapsed;
  if(mapClock>.125){minimap();mapClock=0;}
  renderer.render(scene,camera);
  perfClock+=elapsed;fpsFrames++;
  if(perfClock>2){frameRate=Math.round(fpsFrames/perfClock);perfClock=0;fpsFrames=0;
    // Auto-scale only downward on slow mobile devices, once after a sustained average.
    if(mobile&&quality==='auto'&&frameRate<24&&renderer.getPixelRatio()>.76){renderer.setPixelRatio(.76);renderer.setSize(innerWidth,innerHeight);}
  }
}
updateObjective();hero.root.position.copy(playerPos);requestAnimationFrame(frame);
addEventListener('pagehide',persist);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();flash('Grafikverbindung verloren. Bitte die Seite neu laden.',10000)});
