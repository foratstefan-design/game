// Kuselwies map test 12: Load the 3D engine with fallbacks, not just a single CDN.
// This is still Three.js r164 everywhere (no mixing engine versions).
const THREE = await (async () => {
  const sources = [
    'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',
    'https://unpkg.com/three@0.164.1/build/three.module.js',
    'https://esm.sh/three@0.164.1'
  ];
  const failures = [];
  for (const address of sources) {
    try {
      const engine = await import(address);
      if (engine.WebGLRenderer && engine.Scene && engine.Vector3) return engine;
      throw new Error('Unvollständiges 3D-Modul');
    } catch (error) {
      failures.push(new URL(address).hostname + ': ' + (error?.message || String(error)));
      console.warn('[BAUMHOLDER 3D] Three.js Anbieter nicht erreichbar:', address, error);
    }
  }
  throw new Error('Die 3D-Grafikbibliothek konnte nicht geladen werden.\n' + failures.join('\n'));
})();

/* NEON RIFT: ECHOES / KUSELWIES MAP TEST 12
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
let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:!mobile, powerPreference:'high-performance', alpha:false, stencil:false});
} catch (error) {
  throw new Error('Der 3D-Grafikmodus (WebGL) konnte nicht gestartet werden: ' + (error?.message || String(error)));
}
renderer.domElement.className = 'scene';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.setClearColor(0xbad5df);
document.body.insertBefore(renderer.domElement,$('hud'));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbad5df);
scene.fog = new THREE.Fog(0xbad5df,170,410);
const camera = new THREE.PerspectiveCamera(65,1,.18,620);
scene.add(new THREE.HemisphereLight(0xf5faff,0x667a63,1.85));
const sun = new THREE.DirectionalLight(0xffe3ba,2.05);
sun.position.set(-72,120,25);
sun.castShadow = false;
scene.add(sun);
let quality = mobile ? 'auto' : 'high';
function resize(){
  const w=innerWidth,h=innerHeight;
  const dpr=quality==='low'?.62:quality==='high'?Math.min(devicePixelRatio,mobile?1.0:1.65):Math.min(devicePixelRatio,mobile?.78:Math.min(devicePixelRatio,1.35));
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
  if (!materialCache.has(color)) materialCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0}));
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

// ── KUSELWIES HD · fictional layout based on the described area ─────────
// The only road is OUTSIDE the residential lots; the park is an inner green area.
// IMPORTANT: This is concept-inspired; no exact real-world houses or parcel data.
const MAP_LIMIT=155;
const qualityBudget={};
function canvasTexture(draw,size=256,repeatX=1,repeatY=1){
 const c=document.createElement('canvas');c.width=c.height=size;
 const g=c.getContext('2d');draw(g,size);
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(repeatX,repeatY);t.colorSpace=THREE.SRGBColorSpace;
 t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy?.()||1);
 return t;
}
function noise(seed){let v=seed>>>0;return ()=>((v=(1664525*v+1013904223)>>>0)/4294967296)}
function stipple(g,size,fill,seed,quantity,alpha=.1){
 const rand=noise(seed);g.fillStyle=fill;
 for(let i=0;i<quantity;i++){g.globalAlpha=alpha*(.3+rand());const x=rand()*size,y=rand()*size;
 g.fillRect(x,y,rand()*2+.6,rand()*2+.6);}g.globalAlpha=1;
}
const textures={
 asphalt:canvasTexture((g,s)=>{g.fillStyle='#747775';g.fillRect(0,0,s,s);stipple(g,s,'#17232a',120,4500,.22);stipple(g,s,'#faf5e7',7,2500,.13);for(let i=0;i<12;i++){g.strokeStyle='#8c9190';g.globalAlpha=.1;g.lineWidth=.35;g.beginPath();g.moveTo(i*28-15,0);g.lineTo(i*28-7,s);g.stroke()}g.globalAlpha=1;},256,10,10),
 cobble:canvasTexture((g,s)=>{g.fillStyle='#c8c5b9';g.fillRect(0,0,s,s);g.strokeStyle='#979b93';g.lineWidth=1.2;for(let y=0;y<s;y+=21){g.beginPath();g.moveTo(0,y);g.lineTo(s,y);g.stroke();for(let x=(y/21%2)*19;x<s;x+=38){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+21);g.stroke()}}stipple(g,s,'#4d5a4d',23,900,.11)},256,7,7),
 stucco:canvasTexture((g,s)=>{g.fillStyle='#fffaf0';g.fillRect(0,0,s,s);stipple(g,s,'#706d61',25,4500,.06);stipple(g,s,'#ffffff',17,3700,.09)},256,2,2),
 brick:canvasTexture((g,s)=>{g.fillStyle='#bd8073';g.fillRect(0,0,s,s);g.lineWidth=3;g.strokeStyle='#e5c9b1';for(let y=0;y<s;y+=28){g.beginPath();g.moveTo(0,y);g.lineTo(s,y);g.stroke();for(let x=(y/28%2)*27;x<s;x+=54){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+28);g.stroke()}}stipple(g,s,'#50382e',123,1800,.10)},256,2,2),
 roof:canvasTexture((g,s)=>{g.fillStyle='#c2bdba';g.fillRect(0,0,s,s);g.strokeStyle='#686d71';g.lineWidth=1.7;for(let y=0;y<s;y+=19){g.beginPath();g.moveTo(0,y);g.lineTo(s,y);g.stroke();for(let x=(y/19%2)*19;x<s;x+=38){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+19);g.stroke()}}stipple(g,s,'#343b43',44,900,.11)},256,3,3),
 lawn:canvasTexture((g,s)=>{g.fillStyle='#b6c39c';g.fillRect(0,0,s,s);stipple(g,s,'#456d44',14,4600,.15);stipple(g,s,'#ecdf9d',78,1800,.13)},256,22,16),
 wood:canvasTexture((g,s)=>{g.fillStyle='#e3c099';g.fillRect(0,0,s,s);g.strokeStyle='#7f5c3f';for(let x=0;x<s;x+=21){g.globalAlpha=.16;g.beginPath();g.moveTo(x,0);g.lineTo(x+3,s);g.stroke()}g.globalAlpha=1;stipple(g,s,'#613e2c',55,900,.08)},256,2,2)
};
const TX={
 asphalt:new THREE.MeshStandardMaterial({map:textures.asphalt,color:0xffffff,roughness:1}),
 cobble:new THREE.MeshStandardMaterial({map:textures.cobble,color:0xffffff,roughness:1}),
 grass:new THREE.MeshStandardMaterial({map:textures.lawn,color:0xe8ffdd,roughness:1}),
 sand:new THREE.MeshStandardMaterial({color:0xc9b38b,roughness:1}),
 cedar:new THREE.MeshStandardMaterial({map:textures.wood,color:0xffffff,roughness:1}),
 glass:new THREE.MeshStandardMaterial({color:0x83b5c9,roughness:.35,metalness:.08}),
 roof:new THREE.MeshStandardMaterial({map:textures.roof,color:0xd6d6d4,roughness:1}),
 pavement:new THREE.MeshStandardMaterial({color:0xb2b2a8,roughness:1}),
 white:new THREE.MeshStandardMaterial({color:0xf7f3e8,roughness:1})
};
// Ground is one plane, no depth fighting or reflective asphalt.
flat(world,322,259,0,0,-.10,.22,TX.grass);
const ROAD_POINTS=[[-129,-108],[-47,-111],[67,-110],[131,-104],[136,-55],[136,40],[133,102],[65,112],[-56,113],[-129,105],[-137,47],[-137,-55]];
function ribbon(parent,points,width,y,mat,closed=false){
 const verts=[],uvs=[],indices=[];
 const V=points.map(p=>new THREE.Vector3(p[0],0,p[1]));
 const curve=new THREE.CatmullRomCurve3(V,closed,'centripetal',.4);
 const samples=closed?Math.max(96,points.length*12):Math.max(8,points.length*10),L=curve.getLength();
 for(let i=0;i<=samples;i++){
  const t=i/samples, pt=curve.getPoint(t),dir=curve.getTangent(t), nx=-dir.z,nz=dir.x;
  verts.push(pt.x+nx*width/2,y,pt.z+nz*width/2,pt.x-nx*width/2,y,pt.z-nz*width/2);
  uvs.push(0,t*L/13,1,t*L/13);
  if(i<samples){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
 const m=new THREE.Mesh(geo,mat);m.material.side=THREE.DoubleSide;parent.add(m);return m;
}
// Raised sidewalks and curb edges are DIFFERENT heights from the car road.
ribbon(world,ROAD_POINTS,18,.011,TX.cobble,true);
ribbon(world,ROAD_POINTS,12,.035,TX.asphalt,true);
// Paint short centreline dashes along the outer road only.
function roadMarkings(){
 const curve=new THREE.CatmullRomCurve3(ROAD_POINTS.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal',.4);
 for(let i=0;i<36;i++){
  const p=curve.getPoint((i+.12)/36),d=curve.getTangent((i+.12)/36);
  const m=flat(world,.16,3.6,p.x,p.z,.057,.009,M.line);
  m.rotation.y=Math.atan2(-d.z,d.x);
 }
}roadMarkings();
const OUTER_ROAD=[{x:0,z:-110,w:265,d:12},{x:0,z:110,w:265,d:12},{x:-132,z:0,w:12,d:208},{x:132,z:0,w:12,d:208}];
// A BIG, inner playground. This is NOT a car roundabout.
const playground={x:0,z:0,rx:49,rz:36};
const grassPatch=new THREE.Mesh(new THREE.CircleGeometry(1,80),TX.grass);
grassPatch.rotation.x=-Math.PI/2;grassPatch.scale.set(playground.rx,playground.rz,1);grassPatch.position.y=.026;world.add(grassPatch);
const ACCESS_PATHS=[{x1:-25,z1:93,x2:-24,z2:29,width:3.3},{x1:24,z1:-93,x2:24,z2:-31,width:3.3}];
function makePath(parent,x1,z1,x2,z2,width,mat,y=.074){
 const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);const s=flat(parent,width,len,(x1+x2)/2,(z1+z2)/2,y,.036,mat);
 s.rotation.y=Math.atan2(dx,dz);return s;
}
for(const p of ACCESS_PATHS)makePath(world,p.x1,p.z1,p.x2,p.z2,p.width,TX.cobble);
// Park footpaths connect zones without making an unnatural round road.
for(const [a,b,c,d,w] of [[-42,-2,40,-2,2.5],[-27,-17,-16,27,2.1],[16,-30,31,24,2.1]])
 makePath(world,a,b,c,d,w,TX.cobble,.067);
// Symmetrical playground equipment; clear zones and sensible grouping.
function cylinder(parent,r1,r2,h,x,y,z,mat,sides=9){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,sides),mat);m.position.set(x,y,z);parent.add(m);return m;
}
function beam(parent,x1,y1,z1,x2,y2,z2,r,mat){
 const a=new THREE.Vector3(x1,y1,z1),b=new THREE.Vector3(x2,y2,z2),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),9),mat);
 m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());parent.add(m);return m;
}
const playWood=material(0xb58c5b),playBlue=material(0x3b8faf),playRed=material(0xbf624e),rope=material(0xa49c83);
function disk(x,z,rx,rz,color){const m=new THREE.Mesh(new THREE.CircleGeometry(1,48),color);m.rotation.x=-Math.PI/2;m.scale.set(rx,rz,1);m.position.set(x,.053,z);world.add(m)}
// Main wooden climbing tower and slides grouped in the centre, not scattered randomly.
disk(0,0,23,18,TX.sand);
for(const [x,z] of [[-8,-4],[-8,4],[0,-4],[0,4]])cylinder(world,.20,.26,4.5,x,2.25,z,playWood);
flat(world,8,8,-4,0,2.5,.3,TX.cedar);
const roofTower=new THREE.Mesh(new THREE.ConeGeometry(6.3,2.8,4),TX.roof);roofTower.rotation.y=Math.PI/4;roofTower.position.set(-4,6.7,0);world.add(roofTower);
for(const [x1,z1,x2,z2] of [[-8,-4,0,-4],[-8,4,0,4],[-8,-4,-8,4]])beam(world,x1,4.4,z1,x2,4.4,z2,.13,playWood);
// Clearly angled slide with a lip at the lower end.
const chute=block(world,2.5,.19,7.4,-4,1.39,8.4,playBlue);chute.rotation.x=.36;
for(const dx of [-1.26,1.26]){const rail=block(world,.17,.47,7.5,-4+dx,1.7,8.4,playBlue);rail.rotation.x=.36;}
for(let i=0;i<5;i++){block(world,3.2,.18,.18,-4,.4+i*.42,-5.8-i*.8,playWood)}
// Swings side-by-side in one fenced zone.
disk(27,3,14,13,TX.sand);
for(const cx of [23,30]){
 beam(world,cx-2,0,0,cx-1.25,4.8,0,.15,playWood);
 beam(world,cx+2,0,0,cx+1.25,4.8,0,.15,playWood);
 beam(world,cx-1.25,4.8,0,cx+1.25,4.8,0,.16,playWood);
 for(const d of [-.75,.75])beam(world,cx+d,4.8,.05,cx+d,1.5,.05,.035,rope);
 block(world,1.8,.13,.54,cx,1.35,.05,playRed);
}
// Sandbox and stepping stones in the small children's zone.
disk(-29,2,11.5,10,TX.sand);
block(world,12,.33,9,-29,.20,2,TX.cedar);
flat(world,11.2,8.2,-29,2,.39,.06,TX.sand);
for(const x of [-34.5,-23.5])for(const z of [-1.9,5.9])cylinder(world,.27,.27,.5,x,.28,z,playWood);
// A few deliberately located benches near paths; no random boxes.
function bench(x,z,r=0){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;world.add(g);
 block(g,3,.2,.77,0,.78,0,TX.cedar);block(g,3,.85,.17,0,1.28,-.38,TX.cedar);
 for(const s of [-1.15,1.15]){block(g,.16,.82,.18,s,.41,0,material(0x434c4a));}
}
for(const p of [[-41,22,.20],[40,22,-.6],[-41,-23,1.2],[9,-29,-.1]])bench(...p);
// Small playground information board at the southern access.
block(world,1.5,2.15,.22,24,1.28,-39,TX.cedar);
const info=textSign(world,'SPIELPLATZ',24,2.65,-39.15,4.0);
// Forged curved landscape and hills at distance, but all WALKABLE ground stays flat for smooth collision.
const horizon=material(0x6e8e78);
function hill(cx,cz,rx,rz,height,tint){
 const mat=material(tint),mesh=new THREE.Mesh(new THREE.ConeGeometry(rx,height,7),mat);
 mesh.position.set(cx,height*.25,cz);mesh.scale.z=rz/rx;world.add(mesh);
}
for(const h of [[-210,-210,130,95,32,0x749279],[-65,-243,170,120,44,0x65846a],[190,-223,140,86,26,0x7a997b],[-230,120,110,70,24,0x758f6e],[250,100,160,80,34,0x759378]])hill(...h);
// Fine grass silhouettes & clusters confined to the playground and outer lots.
const instanced=(parent,records,mat)=>{
 if(!records.length)return;
 const mesh=new THREE.InstancedMesh(cube,mat,records.length);const obj=new THREE.Object3D();
 records.forEach((r,i)=>{obj.position.set(r.x,r.y,r.z);obj.scale.set(r.w,r.h,r.d);obj.rotation.set(0,0,0);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix)});
 mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;parent.add(mesh);return mesh;
};

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
 apartment:{wall:0xf1e9d9,accent:0xd4d0c8,roof:0x51535b,sign:'STEFANS ZUHAUSE',style:'home'},
 radio:{wall:0xd3e0dc,accent:0x97afa8,roof:0x535e62,sign:'RADIO VEGA',style:'shop'},
 market:{wall:0xe5d8c8,accent:0x9cb1a0,roof:0x6c5352,sign:'MARKT',style:'market'},
 archive:{wall:0xeee9d9,accent:0xc6c0af,roof:0x6b6668,sign:'ARCHIV',style:'office'},
 aurora:{wall:0xb6c8c3,accent:0xb8d0c9,roof:0x555e68,sign:'AURORA',style:'lab'},
 station:{wall:0xeee5d4,accent:0xb8b2a5,roof:0x555f65,sign:'BAHNHOF',style:'station'},
 bakery:{wall:0xffead2,accent:0xc29f7f,roof:0x895f51,sign:'CAFÉ LUNA',style:'cafe'},
 ordinaryA:{wall:0xe8e1d5,accent:0xf0e5d2,roof:0x525c61,sign:'',style:'home'},
 ordinaryB:{wall:0xf3d2c1,accent:0xe9ccb9,roof:0x865552,sign:'',style:'home'},
 ordinaryC:{wall:0xd0d9d0,accent:0xc2cabf,roof:0x545d58,sign:'',style:'home'},
 ordinaryD:{wall:0xf5ecda,accent:0xe6d9c0,roof:0x76685a,sign:'',style:'home'},
 ordinaryE:{wall:0xd6dce5,accent:0xbbc7d5,roof:0x515d73,sign:'',style:'home'}
};
const houses=new Map();
const facadeMat=new Map(),roofMat=new Map();
function facade(color){if(!facadeMat.has(color))facadeMat.set(color,new THREE.MeshStandardMaterial({map:textures.stucco,color,roughness:1}));return facadeMat.get(color);}
function tiles(color){if(!roofMat.has(color))roofMat.set(color,new THREE.MeshStandardMaterial({map:textures.roof,color,roughness:1,side:THREE.DoubleSide}));return roofMat.get(color);}
function houseRoof(parent,x,z,w,d,h,color){
 // A REAL pitch roof: two sloped roof surfaces + triangular gables, not two fake boxes.
 const e=.62, ridge=h+3.0, edge=h+.25, left=x-w/2-e,right=x+w/2+e,front=z+d/2+e,back=z-d/2-e;
 const positions=[left,edge,front, right,edge,front, x,ridge,front,
                  left,edge,back, x,ridge,back, right,edge,back];
 const idx=[0,1,2, 3,4,5, 0,2,3, 2,4,3, 2,1,5, 2,5,4];
 // Explicitly build two sloped quads and two gable triangles.
 const verts=[left,edge,front, x,ridge,front, left,edge,back, x,ridge,back,
               x,ridge,front,right,edge,front,x,ridge,back,right,edge,back];
 const uv=[0,0,1,0,0,1,1,1, 0,0,1,0,0,1,1,1];
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([0,1,2,2,1,3,4,5,6,6,5,7]);geometry.computeVertexNormals();
 parent.add(new THREE.Mesh(geometry,tiles(color)));
 // Triangular gables front and back, pitched edge.
 for(const zz of [z-d/2-.015,z+d/2+.015]){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x-w/2,edge,zz,x+w/2,edge,zz,x,ridge-.15,zz],3));geo.computeVertexNormals();
  parent.add(new THREE.Mesh(geo,facade(0xe3d9cd)));
 }
 // Chimneys only on some roofs; tactile tiles and softly dark metal gutters.
 block(parent,w+1,.13,.13,x,edge-.08,front,material(0x5a5555));
 block(parent,w+1,.13,.13,x,edge-.08,back,material(0x5a5555));
}
function windowModule(parent,x,y,z,side=false,shutters=false){
 const window=TX.glass,trim=TX.white,dark=material(0x404e51);
 if(!side){
  block(parent,1.6,2.0,.09,x,y,z,trim);
  block(parent,1.35,1.75,.115,x,y,z+.09,window);
  block(parent,.075,1.8,.14,x,y,z+.16,trim);
  block(parent,1.4,.072,.13,x,y,z+.16,trim);
  block(parent,1.95,.15,.33,x,y-1.0,z+.16,material(0xc4c2b5));
  if(shutters){block(parent,.33,1.9,.11,x-1,y,z+.12,material(0x76928a));block(parent,.33,1.9,.11,x+1,y,z+.12,material(0x76928a));}
 }else{
  block(parent,.09,2.0,1.6,x,y,z,trim);
  block(parent,.13,1.75,1.35,x+.07,y,z,window);
  block(parent,.14,1.80,.07,x+.14,y,z,trim);
  block(parent,.13,.07,1.44,x+.14,y,z,trim);
 }
}
function addBuilding(id,x,z,w,d,h,profileName,label=''){
 const spec=profiles[profileName],group=new THREE.Group(); world.add(group);
 const isHome=spec.style==='home'||['cafe','market'].includes(spec.style);
 // Real proportions: height ~7–10 m, pitched roofs, multiple facade details.
 const front=z+d/2;
 const wall=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),facade(spec.wall));wall.position.set(x,h/2,z);group.add(wall);
 // Foundation, base trim, lintels and secondary volumes.
 block(group,w+.38,.48,d+.40,x,.24,z,material(0xb0aaa1));
 block(group,w+.30,.17,d+.35,x,h-.18,z,material(0xe8e3d9));
 if(isHome)houseRoof(group,x,z,w,d,h,spec.roof);
 else{
  flat(group,w+1,d+1,x,z,h+.24,.48,tiles(spec.roof));
  block(group,w+.65,.24,.38,x,h+.28,front+.24,material(0xc5b7a6));
 }
 // Make the front facade a recognisable German residential front door.
 const doorOffset=isHome?1.1:0;
 const doorX=x+doorOffset;
 block(group,2.0,3.0,.13,doorX,1.7,front+.09,material(0x596c65));
 block(group,2.18,3.20,.14,doorX,1.74,front+.06,material(0xf5eee1));
 block(group,1.83,2.85,.17,doorX,1.70,front+.17,material(isHome?0x678377:0x667786));
 block(group,.10,.42,.17,doorX+.63,1.75,front+.27,M.golden);
 block(group,2.4,.12,.8,doorX,.065,front+.65,TX.cobble);
 if(isHome){
  // Garage and driveway fitted to the left; no fake holes in walls.
  const gar=block(group,4.0,3.1,3.9,x-w/2+1.7,1.55,z+d/2+1.20,material(0xe9e4d7));
  block(group,3.45,2.43,.13,x-w/2+1.7,1.29,z+d/2+3.20,material(0xc8caca));
  for(const d of [-.75,0,.75])block(group,3.32,.035,.16,x-w/2+1.7,1.05+d,z+d/2+3.30,material(0x9ba8ab));
  flat(world,4.45,7.3,x-w/2+1.7,z+d/2+7.3,.055,.055,TX.cobble);
 }
 // Windows, including on the street side and side facades, with physical white frames.
 for(const zz of [front+.04,z-d/2-.04]){
  const flip=zz<z;
  for(const ix of [-1,1]){
    const wx=x+ix*w*.31;
    windowModule(group,wx,2.15,zz+(flip?-.09:.09),false,isHome && (id.length%2===0));
    if(h>8.5)windowModule(group,wx,5.55,zz+(flip?-.09:.09),false);
  }
 }
 for(const side of [-1,1]){
   for(const zz of [z-2.65,z+2.65])windowModule(group,x+side*(w/2+.08),4.5,zz,true);
 }
 // Rooftop dormers and shrubs connect the house more to the natural world.
 if(isHome && id.length%3===1){
   const dormer=block(group,2.2,1.45,1.2,x-w*.18,h+1.05,front-2.2,facade(spec.wall));
   block(group,1.2,.95,.06,x-w*.18,h+1.12,front-1.54,TX.glass);
   flat(group,2.65,1.6,x-w*.18,front-2.2,h+1.84,.12,tiles(spec.roof));
 }
 if(['shop','market','cafe'].includes(spec.style)){
   block(group,w*.70,.16,1.9,x,3.8,front+1.0,material(0x937968));
 }
 if(label||spec.sign)textSign(group,label||spec.sign,x,3.55,front+.35,Math.min(w*.70,8.3));
 const door={x:doorX,z:front+2.3};
 const b={id,x,z,w,d,h,label:label||spec.sign||'Wohnhaus',profileName,door,group};
 buildings.push(b);houses.set(id,b);
 exteriorInteractions.push({type:'door',name:`${b.label} betreten`,x:door.x,z:door.z,buildingId:id});
 return b;
}
// Seven important locations retain their IDs and all related dialogs & interiors.
addBuilding('apartment',-75,48,14,11,8.2,'apartment');
addBuilding('radio',-75,-60,19,13,9.0,'radio');
addBuilding('market',45,-65,16,12,8.3,'market');
addBuilding('archive',84,-54,20,14,10.5,'archive');
addBuilding('aurora',85,48,20,14,10.5,'aurora');
addBuilding('station',-100,47,18,13,9.1,'station');
addBuilding('bakery',48,49,17,12,8.3,'bakery');
// Ring of DIFFERENT pitched-roof houses, set outside playground and paths.
const ordinaryLots=[
 [-114,-78,14,12],[-89,-84,14,12],[-51,-85,15,12],[-5,-84,14,12],
 [58,-86,15,12],[101,-86,14,12],[-110,-16,14,13],[-110,15,14,13],
 [110,-23,13,12],[111,17,14,12],[-46,71,15,12],[-7,77,14,12],
 [29,75,14,12],[68,79,14,12],[103,78,15,12]
];
ordinaryLots.forEach(([x,z,w,d],i)=>{
  const height=7.7+(i%3)*.55;
  const p=['ordinaryA','ordinaryB','ordinaryD','ordinaryC','ordinaryE'][i%5];
  addBuilding(`house${i+1}`,x,z,w,d,height,p);
});
// Ground-floor planted gardens and modest hedges, intentionally outside paths.
const woodFence=material(0x987e61),hedge=material(0x6e9c5d);
const noObstacle=[];
function shrub(x,z,s=1){
 const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.80*s,1),material(0x598756));
 mesh.scale.set(1,.77,1);mesh.position.set(x,.65*s,z);world.add(mesh);
}
function tree(x,z,s=1){
 // Soft shaded, more organic 3-piece canopy instead of a single icosahedron.
 cylinder(world,.15*s,.28*s,3.8*s,x,1.9*s,z,material(0x715946),8);
 for(const [dx,dy,dz,sc,c] of [[0,4.8,0,1.85,0x699a60],[-1.1,4.35,.3,1.48,0x719f66],[1.1,4.15,-.4,1.45,0x4f875c]]){
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(sc*s,1),material(c));m.position.set(x+dx*s,dy*s,z+dz*s);world.add(m);
 }
}
// Plant fixed groups, no clutter in road / front of NPCs / two access paths.
const treeLocations=[[-42,-38,1.1],[-39,26,1.0],[43,-25,1.0],[41,29,1.15],[-34,-15,.8],[-3,31,.85],[36,15,.9],
 [-91,74,.9],[-57,52,.9],[70,55,.9],[-105,-50,.95],[102,-53,.9],[-44,-63,.8],[48,-40,.8],
 [0,-44,.8],[-53,0,1.0],[56,0,1.1],[95,8,.9],[-94,12,.9],[-16,3,.67]];
for(const [x,z,s] of treeLocations)tree(x,z,s);
for(const [x,z] of [[-48,37],[-51,25],[52,21],[54,32],[-54,-16],[54,-11],[-45,-23],[-18,42],[32,-45],[-53,58],[79,66]])shrub(x,z,.95);
// Park boundary as low mixed hedges, with clear breaks where access paths begin.
for(let i=0;i<52;i++){
  const a=i*Math.PI*2/52,x=54*Math.cos(a),z=41*Math.sin(a);
  if((z>31 && x<-10&&x>-36)||(z<-31&&x>10&&x<35))continue;
  if(i%2===0)shrub(x,z,.65);
}
// Garden frontage hedges away from entrances.
for(const [x,z,w] of [[-107,55,9],[-58,62,8],[101,60,8],[69,-68,7],[-104,-65,7]]){
  block(world,w,1.0,.72,x,.58,z,hedge);
}
// Street lights with warm bulb models, not expensive per-object light sources.
function lantern(x,z){
 cylinder(world,.11,.14,5.5,x,2.75,z,material(0x464b4f),10);
 block(world,1.15,.14,.22,x+.54,5.45,z,material(0x50575c));
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),new THREE.MeshBasicMaterial({color:0xffe1a1}));bulb.position.set(x+1.0,5.27,z);world.add(bulb);
}
for(const p of [[-122,71],[-120,-60],[-58,100],[55,-100],[119,75],[120,-71],[60,99],[-55,-99]])lantern(...p);
// Park signs and an intentional viewpoint toward the distant hills.
textSign(world,'KUSELWIES',-120,3,91,6.8);

// ── People: lightweight block figures ────────────────────────────────
function person(color,faceColor=M.skin){
  const root=new THREE.Group(); const torso=new THREE.Group();root.add(torso);
  block(torso,1.18,1.5,.72,0,2.35,0,material(color));
  block(torso,.9,.92,.84,0,3.6,0,faceColor);
  block(torso,.96,.22,.86,0,4.15,-.01,M.hair);
  block(torso,.68,.92,.29,0,2.4,-.50,material(0x454b46)); // backpack
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
npc('Melanie',-75,64,0x9c5367,'mara');
npc('Nico',45,-46,0x39917f,'tarek');
npc('Agnes',84,-36,0x9176af,'nora');
npc('Dr. Patrick',85,67,0x476e9f,'vale');
npc('Rudi',-100,65,0x9b824e,'station');
npc('Alwin',48,67,0xad7168,'jun');
npc('Benny',8,44,0x4d718c,'benni');
npc('Annika',56,68,0xb27991,'annika');
npc('Tobi',-11,-45,0x7488ae,'tobi');
npc('Leon',-75,-42,0x567d9f,'leo','report');
// One believable power distribution box at park border, not random clutter.
block(world,1.1,1.9,.70,8,.95,42,M.lamp);
block(world,.8,.44,.12,8,1.42,42.4,M.skyWindow);
exteriorInteractions.push({type:'object',name:'Messkasten prüfen',x:8,z:42,role:'powerBox'});

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
const SAVE_KEY='neonrift_kuselwies_hd_v13';
const startingSave={
  schema:3, x:-75,z:66, inside:'apartment',metMara:false,metTarek:false,
  metNora:false,metVale:false,metStation:false,metJun:false,metStefan:false,metAnnika:false,metTobi:false,tobiEnvelope:false,metLeo:false,powerReadings:false,powerCompleted:false,
  listened:false,tape:false,frequency:false,decoded:false,report:false,
  foundPhone:false,plans:false,photo:false,ticket:false,station:false,
  sideQuest:false,answer:'',ending:false,visited:[]
};
let stored={};
try{
  const prior=localStorage.getItem(SAVE_KEY);
  if(prior) stored=JSON.parse(prior)||{};
  else {
    // Read-only import of existing quest progress; do not import coordinates from old city.
    const previous=JSON.parse(localStorage.getItem('neonrift_vesper3d')||'{}')||{};
    const {x,z,inside,schema,...questProgress}=previous;
    stored={...questProgress};
  }
}catch{}
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
const playerPos = new THREE.Vector3(-75,0,66);
const moveVel = new THREE.Vector2();
let jumpVelocity=0,grounded=true,walking=0;
const keys=Object.create(null);
const joy={x:0,y:0};
let yaw=.22,pitch=.20,camDistance=9.7;
let touchRun=false,started=false,dialogOpen=false,menuOpen=false;
const camAnchor=new THREE.Vector3(),lookAnchor=new THREE.Vector3();
let cameraReady=false;
let nearest=null,toastTimeout=0,autosave=0,mapClock=0;
function streetBlock(x,z,r=.58){
  if(Math.abs(x)>MAP_LIMIT||Math.abs(z)>124)return true;
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
  playerPos.set(Number(save.x) || -75,0,Number(save.z) || 66);
  if(streetBlock(playerPos.x,playerPos.z))playerPos.set(-75,0,66);
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
      sceneText('BENNY · STADTWERKE','Ein ungewöhnlicher Ausschlag',
        'Benny sitzt auf einer Bank am Park und faltet einen zerknitterten Messbericht. „Du kennst dich doch mit Technik aus? Seit zwei Tagen meldet ein Messkasten Stromspitzen, obwohl hier gar keine Leitung für so große Lasten verläuft.“\n\nEr blickt zu den Häusern. „Die Leute beschweren sich über flackernde Lampen. Ich möchte nur herausfinden, warum.“',[
          {label:'Ich sehe mir den Messkasten an.',run:()=>{save.metStefan=true;flash('Nebenauftrag: Messkasten am Park untersuchen.')}},
          {label:'Vielleicht später.',secondary:true}
        ]);
    } else if(save.powerReadings&&!save.powerCompleted){
      sceneText('BENNY','Daten, die nicht hierhergehören',
        'Benny liest die Werte zweimal. „Da ist ein Impuls, der jede Nacht zur selben Minute auftaucht. Aber der Verbrauch hat kein Ziel. Das ist, als würde eine ganze Straße Strom ziehen, ohne dass irgendwo ein Licht angeht.“\n\nEr steckt den Bericht ein. „Ich frage morgen in der Stadtverwaltung nach. Danke für deine Hilfe.“',[
          {label:'Sag mir, wenn du etwas findest.',run:()=>{save.powerCompleted=true;flash('Nebenauftrag abgeschlossen · Benny forscht weiter.')}}
        ]);
    } else if(save.powerCompleted){
      sceneText('BENNY','Keine Antwort von der Stadt',
        '„Die Verwaltung behauptet, unsere Geräte seien defekt. Seltsam nur, dass sie heute sämtliche Messprotokolle abgeholt hat.“ Benny lässt seinen Blick über die Straße wandern. „Ich behalte die Sache im Auge.“',[
          {label:'Bleib vorsichtig.'}
        ]);
    } else {
      sceneText('BENNY','Der graue Kasten',
        '„Direkt neben dem Park. Grauer Stromkasten, blauer Aufkleber. Schreib dir die Messwerte auf, bevor jemand die Sicherung herausnimmt.“',[
          {label:'Ich sehe nach.'}
        ]);
    }
  }else if(role==='annika'){
    if(!save.metAnnika){
      sceneText('ANNIKA · BLUMENLADEN','Ein Strauß, der noch nicht fertig ist',
        'Annika sortiert Blumen auf einer Kiste neben dem Café. „Alwin hat heute zum dritten Mal gefragt, welche Farbe ich am liebsten mag. Meinst du, er plant etwas?“ Sie lacht. „Dabei wünsche ich mir eigentlich nur einen freien Nachmittag mit der Familie.“\n\nSie hebt einen Umschlag auf. „Tobi hat ihn vorhin hier vergessen. Ohne Absender, nur mit einer Nummer: 03:17.“',[
          {label:'Frag Alwin doch direkt.',run:()=>{save.metAnnika=true;save.annikaAdvice='honest';sceneText('ANNIKA','Ein guter Rat','„Vielleicht mache ich das. Aber erst muss ich diesen Umschlag zurückgeben. Frag Tobi beim Park, ob er ihn vermisst.“',[{label:'Ich suche Tobi.'}])}},
          {label:'Ich kann Tobi Bescheid sagen.',run:()=>{save.metAnnika=true;save.annikaAdvice='help';flash('Nebenhandlung: Umschlag für Tobi · Suche ihn beim Park.')}}
        ]);
    }else sceneText('ANNIKA','Blumen und Geheimnisse',
      '„Noch ist zwischen Alwin und mir nichts offiziell. Vielleicht ändert sich das bald.“ Sie blickt zu einem vorbeifahrenden Lieferwagen. „Und vergiss Tobi nicht. Der Umschlag macht ihm offenbar Sorgen.“',[
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
    sceneText('ALWIN · CAFÉ LUNA','Ein seltsamer Gast',
      '„Annika hilft heute bei der Floristin aus. Ich wollte sie eigentlich fragen, ob wir unser Leben gemeinsam planen wollen“, sagt Alwin und lächelt verlegen. „Den richtigen Moment für die Verlobung suche ich noch.“\n\n„Leon? Klar kenne ich ihn. Er trank jeden Donnerstag Tee, obwohl er Tee hasste. Letzte Woche hat er plötzlich das Glas abgestellt und gesagt: ,Ich glaube, wir sind schon einmal hier gewesen.‘“',[
        {label:'Hat er noch etwas gesagt?',run:()=>{save.metJun=true;sceneText('ALWIN','Eine Erinnerung','„Er hat nach einer alten Fotografie gefragt. Angeblich hing sie mal an der Wand der Markthalle. Ich habe ihm gesagt, dass das Gebäude erst zwölf Jahre alt ist.“',[{label:'Seltsam.'}])}},
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
        'Du liest die Daten von Bennys Messgerät ab. Zwischen den normalen Schwankungen steht eine einzige unerklärliche Spitze – jeden Tag um 03:17 Uhr. Eine Kennung taucht wiederholt auf: ECHO / V-0.',[
          {label:'Messung für Benny notieren',run:()=>{save.powerReadings=true;flash('Messdaten gesichert · Sprich wieder mit Benny.')}},
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
    ['Familie in Baumholder','Stefan (du), Agnes & Rudi (verheiratet), Melanie & Leon (verheiratet), Alwin & Annika (noch nicht verlobt), Benny, Tobi, Nico und Patrick. Jeder hat seinen eigenen Alltag.'],
    ['Hauptgeschichte',save.report?'Kapitel 6 abgeschlossen. Die Stadt bleibt zugänglich.':$('goal').textContent],
    ['Melanies Mann Leon ist verschwunden',save.metMara?'Melanie sucht ihren Mann Leon.':'Melanie will dringend mit dir sprechen.'],
    ['Die Frequenz 91.7',save.decoded?'Die Meldung von Station Null wurde entschlüsselt.':save.tape?'Tonband gefunden. Ein dreistelliger Code fehlt.':'Suche nach Hinweisen bei Radio Vega.'],
    ['Die verschwundenen Gleise',save.plans?'Unter AURORA gab es einst einen Bahnhof.':save.metNora?'Agnes erwähnt verdeckte Baupläne.':'Im Archiv könntest du alte Pläne finden.'],
    ['Der Zug um 03:17',save.ticket?'Ein ungewöhnliches Ticket wurde gefunden.':save.station?'Ein Zug fährt jede Nacht, obwohl er nicht auf dem Plan steht.':'Sprich mit Rudi am Bahnhof.'],
    ['Störungen im Stromnetz',save.powerCompleted?'Benny hat die Messdaten. Die Stadtverwaltung schweigt.':save.powerReadings?'Du hast die seltsamen Messdaten. Sprich mit Benny.':save.metStefan?'Benny bittet dich, den Kasten am Park zu überprüfen.':'Beim Park untersucht Benny ungewöhnliche Stromspitzen.'],
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
$('qualityBtn').textContent='Grafik: '+(quality==='high'?'Hoch':'Auto');
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
    for(const r of OUTER_ROAD){
      ctx.fillRect(ox+(r.x-r.w/2)*scale,oz+(r.z-r.d/2)*scale,r.w*scale,r.d*scale);
    }
    ctx.fillStyle='#5a9368';
    ctx.beginPath();ctx.ellipse(ox+playground.x*scale,oz+playground.z*scale,
      playground.rx*scale,playground.rz*scale,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#dbcaa5';ctx.lineWidth=3;
    for(const p of ACCESS_PATHS){ctx.beginPath();ctx.moveTo(ox+p.x1*scale,oz+p.z1*scale);
       ctx.lineTo(ox+p.x2*scale,oz+p.z2*scale);ctx.stroke();}
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
let previous=performance.now();let perfClock=0,fpsFrames=0,frameRate=60;let slowIntervals=0,fastIntervals=0;
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
  if(mapClock>.20){minimap();mapClock=0;}
  renderer.render(scene,camera);
  perfClock+=elapsed;fpsFrames++;
  if(perfClock>2){frameRate=Math.round(fpsFrames/perfClock);perfClock=0;fpsFrames=0;
    // Adaptive resolution prioritises frame rate; no heavy bloom, shadowmaps or reflections.
    if(quality==='auto'){
      slowIntervals=frameRate<35?slowIntervals+1:0;
      fastIntervals=frameRate>55?fastIntervals+1:0;
      const current=renderer.getPixelRatio();
      if(slowIntervals>=2 && current>.57){
        renderer.setPixelRatio(Math.max(.56,+(current-.12).toFixed(2)));
        renderer.setSize(innerWidth,innerHeight);slowIntervals=0;fastIntervals=0;
      }else if(fastIntervals>=4 && current<(mobile?.78:Math.min(devicePixelRatio,1.35))){
        renderer.setPixelRatio(Math.min(mobile?.78:Math.min(devicePixelRatio,1.35),+(current+.08).toFixed(2)));
        renderer.setSize(innerWidth,innerHeight);fastIntervals=0;
      }
    }
    window.__KUSELWIES_DIAGNOSTICS={fps:frameRate,pixelRatio:renderer.getPixelRatio(),
      buildings:buildings.length,npcs:cityNPCs.length,map:'Kuselwies HD · V13'};
  }
}
updateObjective();hero.root.position.copy(playerPos);requestAnimationFrame(frame);
addEventListener('pagehide',persist);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();flash('Grafikverbindung verloren. Bitte die Seite neu laden.',10000)});
