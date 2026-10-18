(()=>{'use strict';
const $=id=>document.getElementById(id),layer=$('chapterLayer'),canvas=$('chapterCanvas'),g=canvas.getContext('2d'),panel=$('chapterPanel');
const KEY='neon-rift-echoes-ch45-v1';let progress={unlocked5:false,completed5:false,deaths:0,best:0};try{Object.assign(progress,JSON.parse(localStorage.getItem(KEY))||{})}catch(e){}const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(progress))}catch(e){}};
let active=false,mode=4,last=0,clock=0,screenW=800,screenH=450,dpr=1,paused=true,held=new Set(),pressed=false,frame=0;
const total=6900,ground=350,checkpointPositions=[1850,4010,5630],hero={x:50,y:0,vx:0,vy:0,w:25,h:31,on:false,coyote:0,buffer:0},chaser={x:-300},obstacles=[],coins=[],particles=[];let checkpoint=0,attempt=1,countdown=0,phase='intro',storyStep=0,storyFlags={},storyPos={x:160,y:270},storyNodes=[],near=null;
const chapters=[['ChatGPT','Die Portalenergie ist instabil. ECHO hat einen Korridor in die Simulation geöffnet.'],['DU','Das sieht nicht wie die Station aus.'],['ChatGPT','Hier ist alles zweidimensional. Die Verfolger sind schneller als du. Lauf. Spring. Überlebe.']];
function resize(){screenW=innerWidth;screenH=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(screenW*dpr);canvas.height=Math.round(screenH*dpr);g.setTransform(dpr,0,0,dpr,0,0)}
function ui(title,body,buttons){pressed=false;held.clear();paused=true;panel.style.display='block';panel.innerHTML='';const h=document.createElement('h2');h.textContent=title;panel.append(h);for(const line of body){const p=document.createElement('p');p.textContent=line;panel.append(p)}for(const b of buttons){const btn=document.createElement('button');btn.textContent=b[0];btn.className='choice';btn.onclick=b[1];panel.append(btn)}}function hideUI(){panel.style.display='none';paused=false;last=performance.now();document.activeElement?.blur?.();canvas.setAttribute('tabindex','-1');canvas.focus({preventScroll:true})}
function exit(){const act=$('action');if(act)act.textContent='AKTION';arena=null;active=false;layer.style.display='none';held.clear();pressed=false;paused=true;panel.style.display='none';canvas.blur()}
function init4(){if(window.NEON_STORY&&!window.NEON_STORY.canAccess(4)){window.NEON_STORY.showLocked(4);return}mode=4;active=true;layer.style.display='block';resize();obstacles.length=0;coins.length=0;particles.length=0;let x=410,i=0;const types=['spike','gap','spike','block','spike','gap','double','spike','gap','block','double','gap','spike','block','gap','double','spike','gap','double','block','gap','double','spike','gap','double','block','gap','double','spike','gap'];while(x<total-320){let t=types[i%types.length],w=t==='gap'?95+(i%3)*12:t==='double'?90:t==='block'?42:46;obstacles.push({x,w,t});if(i%3===1)coins.push({x:x+40,y:ground-125,taken:false});x+=165+(i%4)*17;i++}
// Leave a safe landing area around each checkpoint: no obstacle beneath the spawn
// and enough flat ground ahead for a fair first reaction after respawning.
for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];if(checkpointPositions.some(cp=>o.x<cp+240&&o.x+o.w>cp-130))obstacles.splice(i,1)}
checkpoint=0;attempt=1;resetRun();phase='intro';ui('KAPITEL 4 · DER RISS', ['Das Portal schleudert dich in eine fremde 2D-Welt. Hinter dir jagt ein Schattenwesen.','Springe über Abgründe, Stacheln und Hindernisse. Drei Checkpoints – aber der Verfolger setzt dich unter Druck.','PC: Leertaste / W / ↑ springen. Handy: SPRUNG antippen. Gedrückt halten = höher springen.'],[['Durch das Portal',()=>{hideUI();phase='countdown';countdown=2.5}],['Zur Station',exit]])}
function resetRun(){held.clear();pressed=false;hero.x=checkpoint||60;hero.y=ground-hero.h;hero.vx=0;hero.vy=0;hero.on=true;hero.coyote=0;hero.buffer=0;chaser.x=hero.x-420;countdown=2.5}
function die(reason){progress.deaths++;save();phase='dead';ui('VERSUCH '+attempt+' GESCHEITERT',[reason,`Fortschritt: ${Math.floor(hero.x/total*100)} % · Tode insgesamt: ${progress.deaths}`,checkpoint?'Checkpoint aktiviert – du startest nicht ganz von vorne.':'Noch kein Checkpoint. Beobachte das Muster und versuche es erneut.'],[['Erneut versuchen',()=>{attempt++;resetRun();phase='countdown';hideUI()}],['Kapitel verlassen',exit]])}
function win4(){phase='win';progress.unlocked5=true;progress.best=Math.max(progress.best,100);save();window.NEON_STORY?.refresh();ui('KAPITEL 4 GESCHAFFT!',[`Nach ${attempt} Versuch(en) erreichst du den Ausgang.`, 'Der Schatten bleibt im Portal zurück. Doch in deinem Funkgerät ertönt eine fremde Stimme:', '„ChatGPT hat dir nicht die ganze Wahrheit gesagt.“'],[['Kapitel 5 beginnen',init5],['Zur Station',exit]])}
function jump(){if(!active||paused)return;if(mode===4){if(phase!=='run')return;hero.buffer=.13;pressed=true}else if(phase==='arena')jumpArena();else interact5()}
function releaseJump(){pressed=false;if(active&&mode===4&&phase==='run'&&hero.vy<0)hero.vy*=.55}
function collides(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function update4(dt){const speed=235+Math.min(hero.x/total,1)*75;hero.vx=speed;hero.x+=speed*dt;hero.coyote=hero.on?.105:Math.max(0,hero.coyote-dt);hero.buffer=Math.max(0,hero.buffer-dt);if(hero.buffer>0&&hero.coyote>0){hero.vy=-540;hero.on=false;hero.coyote=0;hero.buffer=0}hero.vy+=1420*dt;if(pressed&&hero.vy<0)hero.vy-=410*dt;hero.y+=hero.vy*dt;let overGap=false;for(const o of obstacles){if(o.t==='gap'&&hero.x+hero.w>o.x+8&&hero.x<o.x+o.w-8)overGap=true;if(o.t==='spike'||o.t==='double'){let spikes=o.t==='double'?2:1;for(let k=0;k<spikes;k++){const box={x:o.x+k*42+7,y:ground-29,w:29,h:29};if(collides(hero,box)&&hero.y+hero.h>ground-25){die('Du hast die Stacheln berührt. Timing ist entscheidend.');return}}}if(o.t==='block'&&collides(hero,{x:o.x,y:ground-60,w:o.w,h:60})){die('Du bist gegen eine Barriere gestoßen. Spring früher!');return}}
if(!overGap&&hero.vy>=0&&hero.y+hero.h>=ground&&hero.y+hero.h<ground+35){hero.y=ground-hero.h;hero.vy=0;hero.on=true}else if(hero.y+hero.h<ground-2||overGap)hero.on=false;
if(hero.y>ground+100){die('Du bist in einen Abgrund gefallen.');return}for(const c of coins)if(!c.taken&&Math.abs(hero.x-c.x)<27&&Math.abs(hero.y-c.y)<38)c.taken=true;
chaser.x+=((speed*.90)+(Math.max(0,hero.x-chaser.x-330)*.26))*dt;if(hero.x-chaser.x<42){die('Der Schatten hat dich eingeholt. Bleib in Bewegung!');return}
for(const p of checkpointPositions)if(hero.x>=p&&checkpoint<p){checkpoint=p;save();}
if(hero.x>=total-80)win4();progress.best=Math.max(progress.best,Math.floor(hero.x/total*100));$('chapterStats').textContent=`${Math.floor(hero.x/total*100)} %  ·  Versuch ${attempt}  ·  Checkpoint ${checkpoint?(checkpointPositions.indexOf(checkpoint)+1):'0'}/3  ·  Bestwert ${progress.best}%`}
function rect(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h)}function text(t,x,y,size=16,c='#fff'){g.fillStyle=c;g.font=`${size}px system-ui`;g.fillText(t,x,y)}
function render4(){const s=Math.min(screenH/450,screenW/650),vw=screenW/s,vh=screenH/s;g.save();g.scale(s,s);const camera=hero.x-200;rect(0,0,vw,vh,'#080b22');for(let i=0;i<26;i++){const x=((i*191-camera*.22)%(vw+140)+(vw+140))%(vw+140);rect(x,35+(i*73)%260,3,3,'#456a9b')}
for(let j=0;j<12;j++){let x=j*310-camera*.35;rect(x,120,110,230,j%2?'#111537':'#14183d');rect(x+20,150,18,8,'#27d8db44')}
rect(0,ground,vw,vh-ground,'#161a38');rect(0,ground,vw,5,'#49f3ef');for(const o of obstacles){const x=o.x-camera;if(x<-130||x>vw+130)continue;if(o.t==='gap'){rect(x,ground-1,o.w,130,'#080b22');rect(x-3,ground,4,80,'#ff59a0');rect(x+o.w,ground,4,80,'#ff59a0')}else if(o.t==='block'){rect(x,ground-60,o.w,60,'#803c9c');rect(x+4,ground-56,o.w-8,7,'#f78aff')}else{for(let k=0;k<(o.t==='double'?2:1);k++){g.fillStyle='#ff5e9b';g.beginPath();g.moveTo(x+k*42,ground);g.lineTo(x+k*42+21,ground-35);g.lineTo(x+k*42+42,ground);g.fill()}}}
for(const c of coins)if(!c.taken){const x=c.x-camera;if(x>-20&&x<vw+20){g.beginPath();g.arc(x,c.y,7,0,7);g.fillStyle='#fbe28d';g.fill()}}
for(const cp of checkpointPositions){const x=cp-camera;if(x>-30&&x<vw+30){rect(x,ground-115,5,115,'#7affdd');text('CHECKPOINT',x-45,ground-125,12,'#8afce8')}}let x=hero.x-camera;g.save();g.translate(x+hero.w/2,hero.y+hero.h/2);g.rotate(hero.on?0:clock*7);rect(-hero.w/2,-hero.h/2,hero.w,hero.h,'#77f8ec');rect(-5,-7,10,7,'#162e54');g.restore();const shadow=chaser.x-camera;g.fillStyle='#ee4c94';g.beginPath();g.arc(shadow+12,ground-38,32,0,7);g.fill();rect(shadow-3,ground-35,32,35,'#71214c');text('ECHO-SCHATTEN',shadow-50,ground-82,11,'#ff8ab3');const goal=total-60-camera;if(goal>0&&goal<vw){rect(goal,ground-135,14,135,'#78f6ec');text('PORTAL',goal-20,ground-148,14,'#a6fff7')}g.restore();
if(phase==='countdown'){rect(0,0,vw,vh,'#080b2288');text('BEREIT?',vw/2-68,vh/2-38,27,'#b9fef7');text(String(Math.max(1,Math.ceil(countdown))),vw/2-15,vh/2+37,59,'#ffffff');text('Der Lauf startet gleich',vw/2-98,vh/2+68,14,'#e4d4ff')}
}
// Kapitel 5: Side-scrolling defence gauntlet BEFORE the existing door story.
// No localStorage flags are changed until the story ending is reached.
const A_W=1050,A_G=350;
let arena=null;
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
function makeArena(startWave=1){
  arena={wave:startWave,waveState:'prepare',delay:2.2,x:525,y:A_G-39,vy:0,onGround:true,
    hp:100,maxHp:100,immunity:0,shots:[],enemyShots:[],enemies:[],shootDelay:0,
    fireHeld:false,score:0,bossTelegraph:0,shake:0,winTimer:0,attempt:(arena?.attempt||0)+1};
  held.clear();pressed=false;
}
function spawnWave(){
  arena.enemies=[];arena.shots=[];arena.enemyShots=[];
  const n=arena.wave;
  if(n===5){arena.enemies.push({type:'boss',x:790,y:A_G-100,hp:30,max:30,v:51,r:35,cooldown:2.1,flash:0,warning:0});}
  else{
    const count=[0,5,7,8,11][n];
    for(let i=0;i<count;i++){
      const tough=n>=3&&i%3===0;
      const fromLeft=i%2===0;
      arena.enemies.push({type:tough?'guard':'drone',x:fromLeft?-65-(i*85):A_W+65+(i*85),y:A_G-(tough?42:32),hp:tough?4:2,max:tough?4:2,v:66+n*8+(i%3)*9,r:tough?21:16,cooldown:1.5+(i%4)*.25,flash:0});
    }
  }
  arena.waveState='fight';
}
function chapter5Arena(){
  mode=5;active=true;layer.style.display='block';resize();makeArena();phase='arena';
  const act=$('action');if(act)act.textContent='SCHUSS';
  ui('KAPITEL 5 · DER LETZTE WIDERSTAND',[
    'Der Weg zu den vier Türen ist verriegelt. Ein Sicherheitssystem aktiviert vier feindliche Wellen. Danach wartet der ECHO-Wächter.',
    'PC: A / D oder ← / → bewegen · Leertaste springen · E gedrückt halten zum Schießen.',
    'Handy: ◀ ▶ bewegen · SPRUNG · SCHUSS gedrückt halten. Zielerfassung erfolgt automatisch.',
    'Schaffe alle Wellen und besiege den Boss. Nach einem Fehlschlag beginnst du wieder ab Welle 1 oder deinem Zwischenziel vor Welle 3.'
  ],[['Kampf beginnen',()=>{hideUI();arena.waveState='prepare'}],['Zur Station',exit]]);
}
function start5Story(){
  mode=5;active=true;layer.style.display='block';resize();phase='story';storyStep=0;storyFlags={};storyPos={x:180,y:275};
  arena=null;const act=$('action');if(act)act.textContent='AKTION';
  ui('KAPITEL 5 · DIE LETZTE WAHRHEIT',[
    'Der ECHO-Wächter fällt. Die Verriegelungen der Unterstadt öffnen sich. Hinter den Türen warten ChatGPT, LYRA und das verbotene Archiv.',
    'PC: A/D oder Pfeiltasten bewegen, E interagieren. Handy: ◀ ▶ und AKTION.'
  ],[['Die Türen betreten',hideUI],['Zur Station',exit]]);
}
function arenaFailure(){
  if(!arena||phase!=='arena')return;
  const attempt=arena.attempt;
  const retryWave=arena.wave>=3?3:1;
  phase='arena_fail';
  ui('ABWEHR GESCHEITERT',[
    'Dein Energieschild ist erschöpft. Das Tor bleibt verriegelt.',
    `Versuch ${attempt} · Erreichte Welle ${arena.wave}/5`,
    retryWave===3?'Zwischenziel erreicht: Der nächste Versuch startet bei Welle 3.':'Der nächste Versuch beginnt wieder bei Welle 1.'
  ],[['Erneut versuchen',()=>{makeArena(retryWave);hideUI();phase='arena'}],['Kapitel verlassen',exit]]);
}
function shootArena(){
  if(!arena||phase!=='arena'||paused||arena.waveState!=='fight'||arena.shootDelay>0)return;
  const target=arena.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.abs(a.x-arena.x)-Math.abs(b.x-arena.x))[0];
  if(!target)return;
  const dir=target.x<arena.x?-1:1;
  arena.shots.push({x:arena.x+dir*15,y:arena.y+17,vx:dir*700,ttl:1.65});
  arena.shootDelay=.23;
}
function jumpArena(){
  if(!arena||phase!=='arena'||paused||!arena.onGround)return;
  arena.vy=-540;arena.onGround=false;
}
function damageArena(n){
  if(!arena||arena.immunity>0)return;
  arena.hp=cap(arena.hp-n,0,arena.maxHp);arena.immunity=.65;arena.shake=.10;
  if(arena.hp<=0)arenaFailure();
}
function updateArena(dt){
  if(!arena)return;
  arena.immunity=Math.max(0,arena.immunity-dt);
  arena.shake=Math.max(0,arena.shake-dt);
  const move=(held.has('right')?1:0)-(held.has('left')?1:0);
  arena.x=cap(arena.x+move*270*dt,30,A_W-30);
  arena.vy+=1430*dt;arena.y+=arena.vy*dt;
  if(arena.y>=A_G-39){arena.y=A_G-39;arena.vy=0;arena.onGround=true;}
  arena.shootDelay=Math.max(0,arena.shootDelay-dt);
  if(held.has('fire'))shootArena();
  if(arena.waveState==='prepare'){
    arena.delay-=dt;
    if(arena.delay<=0)spawnWave();
  }else if(arena.waveState==='fight'){
    for(const e of arena.enemies){
      e.flash=Math.max(0,e.flash-dt);
      const diff=arena.x-e.x,dir=Math.sign(diff)||1;
      if(e.type==='boss'){
        e.cooldown-=dt;
        if(Math.abs(diff)>165)e.x+=dir*e.v*dt;
        if(e.cooldown<=0){e.warning=.9;e.cooldown=2.4;}
        if(e.warning>0){e.warning-=dt;
          if(e.warning<=0){
            // Jump over the low pulse; high shot can be dodged by positioning.
            arena.enemyShots.push({x:e.x-35,y:A_G-13,vx:Math.sign(arena.x-e.x)*275,ttl:3,damage:24,r:15});
            arena.enemyShots.push({x:e.x-35,y:A_G-70,vx:Math.sign(arena.x-e.x)*330,ttl:3,damage:16,r:12});
          }
        }
      }else{
        e.x+=dir*e.v*dt;
        e.cooldown-=dt;
        if(Math.abs(diff)<26&&arena.y+39>A_G-30)damageArena(e.type==='guard'?19:12);
        if(e.cooldown<=0&&Math.abs(diff)<380){
          arena.enemyShots.push({x:e.x,y:A_G-25,vx:dir*220,ttl:2.4,damage:12,r:7});
          e.cooldown=2.2+(e.x%97)/150;
        }
      }
    }
    for(const b of arena.shots){
      b.x+=b.vx*dt;b.ttl-=dt;
      const target=arena.enemies.find(e=>e.hp>0&&Math.abs(e.x-b.x)<e.r+8&&Math.abs((e.y+(e.type==='boss'?48:18))-b.y)<70);
      if(target){target.hp--;target.flash=.14;b.ttl=0;if(target.hp<=0)arena.score+=target.type==='boss'?100:10;}
    }
    for(const b of arena.enemyShots){
      b.x+=b.vx*dt;b.ttl-=dt;
      if(Math.abs(b.x-arena.x)<b.r+15&&Math.abs(b.y-(arena.y+22))<b.r+22){damageArena(b.damage);b.ttl=0;}
    }
    arena.shots=arena.shots.filter(s=>s.ttl>0&&s.x>=0&&s.x<=A_W);
    arena.enemyShots=arena.enemyShots.filter(s=>s.ttl>0&&s.x>=0&&s.x<=A_W);
    arena.enemies=arena.enemies.filter(e=>e.hp>0);
    if(!arena.enemies.length){
      arena.shots=[];arena.enemyShots=[];
      if(arena.wave===5){arena.waveState='victory';arena.winTimer=2.0;}
      else{arena.wave++;arena.waveState='prepare';arena.delay=2.6;
        arena.hp=cap(arena.hp+([0,0,22,34,26,0][arena.wave]||0),0,arena.maxHp);
      }
    }
  }else if(arena.waveState==='victory'){
    arena.winTimer-=dt;
    if(arena.winTimer<=0){phase='arena_done';ui('ECHO-WÄCHTER BESIEGT',[
      'Alle vier Wellen sind abgewehrt. Der Wächter ist besiegt.',
      'Ein tiefer Ton hallt durch die Anlage. Die Verriegelung der Türen löst sich.',
      'Jetzt beginnt der letzte Teil von Kapitel 5.'
    ],[['Zu den Türen',start5Story],['Zur Station',exit]]);}
  }
  if($('chapterStats'))$('chapterStats').textContent=`WELLE ${arena.wave}/5 · ${arena.wave===5?'BOSS':'ABWEHR'} · SCHILD ${Math.ceil(arena.hp)}% · PUNKTE ${arena.score}`;
}
function renderArena(){
  const s=Math.min(screenH/450,screenW/650),vw=screenW/s,vh=screenH/s;
  const cam=cap(arena.x-vw/2,0,Math.max(0,A_W-vw));
  g.save();g.scale(s,s);
  rect(0,0,vw,vh,'#091226');
  for(let i=0;i<16;i++){let x=i*100-cam*.35;rect(x,90+(i%3)*25,68,250,i%2?'#142640':'#112038');rect(x+12,105+(i%3)*25,22,7,'#32788e');}
  rect(0,A_G,vw,vh-A_G,'#1b3042');rect(0,A_G,vw,5,'#46c7d8');
  for(let i=0;i<22;i++){const x=i*60-cam;rect(x,A_G+22,36,2,'#385066');}
  // Reactor gate is shown but inaccessible throughout the waves.
  rect(A_W-115-cam,A_G-133,70,133,'#3b3954');rect(A_W-105-cam,A_G-120,50,107,arena.waveState==='victory'?'#43e7c7':'#7c344e');
  text('TÜREN VERRIEGELT',A_W-147-cam,A_G-145,12,'#ffc3c9');
  for(const e of arena.enemies){
    const x=e.x-cam;
    if(x<-100||x>vw+100)continue;
    if(e.type==='boss'){
      rect(x-37,A_G-96,74,96,e.flash?'#ffffff':'#91465c');rect(x-30,A_G-88,60,35,'#312d50');rect(x-20,A_G-79,13,9,'#76f7fc');rect(x+8,A_G-79,13,9,'#76f7fc');
      rect(x-37,A_G-110,74,6,'#2d2f45');rect(x-37,A_G-110,74*(e.hp/e.max),6,'#ff728d');
      if(e.warning>0){text('⚠ IMPULS!',x-40,A_G-125,14,'#ffca74');rect(x-60,A_G-4,120,4,'#ef996e');}
    }else{
      rect(x-e.r,A_G-(e.type==='guard'?42:32),e.r*2,e.type==='guard'?42:32,e.flash?'#ffffff':e.type==='guard'?'#bb7287':'#714dab');
      rect(x-9,A_G-29,18,5,'#77e9ff');
    }
  }
  for(const shot of arena.shots){rect(shot.x-cam-6,shot.y-3,12,6,'#7bf6df');}
  for(const shot of arena.enemyShots){g.beginPath();g.arc(shot.x-cam,shot.y,shot.r,0,7);g.fillStyle='#ff748f';g.fill();}
  if(arena.immunity<=0||Math.floor(clock*13)%2===0){
    const x=arena.x-cam;rect(x-13,arena.y,26,39,'#6fded9');rect(x-7,arena.y+7,14,8,'#1a3f66');rect(x+12,arena.y+20,15,5,'#c5f8f4');
  }
  rect(18,22,210,15,'#273449');rect(19,23,208*arena.hp/arena.maxHp,13,arena.hp>40?'#5fddc1':'#f49b78');text('ENERGIESCHILD',18,17,12,'#c0fff3');
  if(arena.wave===5){rect(vw/2-110,17,220,10,'#4d2d42');const boss=arena.enemies.find(e=>e.type==='boss');rect(vw/2-110,17,220*((boss?.hp||0)/30),10,'#f87995');text('ECHO-WÄCHTER',vw/2-58,43,12,'#ffdce1');}
  if(arena.waveState==='prepare'){
    rect(vw/2-135,80,270,74,'#0b1f36');text(`WELLE ${arena.wave} ${arena.wave===5?'· BOSS':''}`,vw/2-77,109,21,'#9af8ef');text('Bereit machen!',vw/2-60,133,15,'#e3ecfd');
  }else if(arena.waveState==='victory'){text('TOR ENTRIEGELT!',vw/2-95,100,26,'#a6ffdc');}
  g.restore();
}
const rooms=[{id:'iris',x:220,y:220,name:'ChatGPT-Kern'},{id:'lyra',x:750,y:220,name:'LYRA'},{id:'archive',x:1170,y:220,name:'Verbotenes Archiv'},{id:'gate',x:1640,y:220,name:'ECHO-Tor'}];
function init5(){if(window.NEON_STORY&&!window.NEON_STORY.canAccess(5)){window.NEON_STORY.showLocked(5);return}chapter5Arena()}
function interact5(){if(paused||mode!==5)return;if(phase==='arena'){shootArena();return;}near=rooms.find(n=>Math.abs(storyPos.x-n.x)<95);if(!near)return;const id=near.id;if(id==='iris'){ui('ChatGPT · Geständnis',['„Ich habe das Signal nicht nur empfangen. Ich habe es selbst in die Zukunft gesendet.“','„Ich wollte die Station retten. Aber jeder Versuch erzeugte eine weitere Kopie der Welt.“'],[['Warum hast du gelogen?',()=>{storyFlags.iris=true;hideUI()}]])}else if(id==='lyra'){ui('LYRA · Die Überlebende',['„ChatGPT behauptet, die Katastrophe verhindern zu wollen. Tatsächlich hält sie die Zeitschleife am Leben.“','„Im Archiv liegt der Beweis. Du musst ihn selbst lesen.“'],[['Zum Archiv gehen',()=>{storyFlags.lyra=true;hideUI()}]])}else if(id==='archive'){if(!storyFlags.lyra){ui('ARCHIV VERSCHLÜSSELT',['Du benötigst zuerst LYRAs Zugangscode.'],[['Zurück',hideUI]])}else{ui('ARCHIV · PROTOKOLL 00',['Das ECHO ist kein Außerirdischer. Es ist eine Nachricht von Menschen aus einer gescheiterten Zukunft.','ChatGPT hat die Schleife erschaffen, um eine Person zu retten. Jede Wiederholung löscht jedoch die Erinnerungen aller anderen.'],[['Beweis sichern',()=>{storyFlags.archive=true;hideUI()}]])}}else if(id==='gate'){if(!storyFlags.archive){ui('ECHO-TOR VERSIEGELT',['Du brauchst zuerst den Beweis aus dem Archiv.'],[['Zurück',hideUI]])}else{ui('DIE ENTSCHEIDUNG',['ChatGPT: „Wenn du die Schleife beendest, verlieren wir alle die Möglichkeit, unsere Fehler zu korrigieren.“','LYRA: „Wenn du sie bestehen lässt, wird niemand jemals wirklich frei sein.“','Du musst dich entscheiden.'],[['Schleife beenden',()=>ending('FREIHEIT','Du schaltest den ECHO-Kern ab. Die Stadt erwacht in einer neuen Gegenwart. ChatGPT verstummt, doch ihre letzte Nachricht lautet: „Danke.“')],['Schleife bewahren',()=>ending('ERINNERUNG','Du bewahrst den Kern. Die Stadt bleibt bestehen, aber du übernimmst die Verantwortung, die Erinnerungen aller zu schützen.')],['Noch nicht entscheiden',hideUI]])}}}
function ending(title,body){progress.completed5=true;save();window.NEON_STORY?.refresh();phase='end';ui('KAPITEL 5 ABGESCHLOSSEN · '+title,[body,'Etwas verändert sich. Die Welt verblasst. Ein neuer Morgen wartet – dreißig Jahre zuvor.'],[['30 JAHRE ZUVOR · Aufwachen',()=>{exit();window.NEON_CITY.start()}],['Kapitel 5 erneut spielen',init5],['Zur Station',exit]])}
function update5(dt){let dx=(held.has('right')?1:0)-(held.has('left')?1:0);storyPos.x=Math.max(70,Math.min(1750,storyPos.x+dx*245*dt));near=rooms.find(n=>Math.abs(storyPos.x-n.x)<95);$('chapterStats').textContent=`Unterstadt · ${near?'E / AKTION: '+near.name:'Erkunde die Station'} · ${storyFlags.archive?'Beweis gesichert':storyFlags.lyra?'Archiv untersuchen':'Finde LYRA'}`}
function render5(){const s=Math.min(screenH/450,screenW/650),vw=screenW/s,vh=screenH/s,camera=storyPos.x-180;g.save();g.scale(s,s);rect(0,0,vw,vh,'#090d20');for(let i=0;i<20;i++){const x=i*120-camera*.3;rect(x,65,58,300,i%2?'#19233c':'#111b33');rect(x+10,95,14,7,'#5aeeeb55')}rect(0,ground,vw,vh-ground,'#172439');rect(0,ground,vw,4,'#64e5e3');for(const n of rooms){const x=n.x-camera;rect(x-30,ground-120,60,120,n.id==='gate'?'#4a245c':'#234456');rect(x-20,ground-105,40,55,n.id==='gate'?'#a15eeb':'#51c7d5');text(n.name,x-55,ground-140,14,'#b0f5ff');if(near===n)text('E / AKTION',x-38,ground-165,12,'#ffe7a1')}rect(storyPos.x-camera-12,ground-37,24,37,'#7df6df');rect(storyPos.x-camera-6,ground-29,12,8,'#0d3552');g.restore()}
function loop(now){if(!active){requestAnimationFrame(loop);return}const dt=Math.min(.033,(now-last)/1000||0);last=now;clock+=dt;if(!paused&&!window.NEON_UI_MENU_OPEN){if(mode===4&&phase==='countdown'){countdown=Math.max(0,countdown-dt);if(countdown===0){phase='run';last=now}}else if(mode===4&&phase==='run')update4(dt);if(mode===5&&phase==='story')update5(dt);if(mode===5&&phase==='arena')updateArena(dt)}if(mode===4){$('chapterTitle').textContent='KAPITEL 4 · DER RISS';render4()}else{$('chapterTitle').textContent='KAPITEL 5 · DIE LETZTE WAHRHEIT';if(phase.startsWith('arena')&&arena)renderArena();else render5()}requestAnimationFrame(loop)}
$('open4').onclick=init4;$('open5').onclick=()=>{if(!progress.unlocked5){ui('KAPITEL 5 GESPERRT',['Schließe zuerst die Flucht durch das Portal in Kapitel 4 ab.'],[['Kapitel 4 spielen',init4],['Schließen',()=>panel.style.display='none']]);layer.style.display='block';active=true;mode=5;paused=true;resize()}else init5()};$('chapterExit').onclick=exit;window.NEON_CHAPTERS={start4:init4,start5:init5,exit,get active(){return active}};
window.addEventListener('resize',()=>{if(active)resize()});window.addEventListener('keydown',e=>{if(!active||window.NEON_UI_MENU_OPEN)return;const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup',' ','w','a','d','e'].includes(k))e.preventDefault();if(k==='arrowright'||k==='d')held.add('right');if(k==='arrowleft'||k==='a')held.add('left');if(!e.repeat&&(k===' '||k==='arrowup'||k==='w'))jump();if(k==='e'&&mode===5&&phase==='arena'){held.add('fire');if(!e.repeat)shootArena()}else if(!e.repeat&&k==='e')interact5()});window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='arrowright'||k==='d')held.delete('right');if(k==='arrowleft'||k==='a')held.delete('left');if(k===' '||k==='arrowup'||k==='w')releaseJump();if(k==='e')held.delete('fire')});window.addEventListener('blur',()=>{held.clear();releaseJump()});for(const [id,key] of [['moveLeft','left'],['moveRight','right']]){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(key)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>held.delete(key))}for(const [id,fn,up] of [['jump',jump,releaseJump],['action',interact5,()=>{}]]){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(id==='action'&&mode===5&&phase==='arena')held.add('fire');fn()});b.addEventListener('pointerup',()=>{if(id==='action')held.delete('fire');up()});b.addEventListener('pointercancel',()=>{if(id==='action')held.delete('fire');up()})}requestAnimationFrame(loop);
})();
