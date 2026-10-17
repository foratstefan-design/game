// BAUMHOLDER 3D bridge, Build 2. This deliberately replaces the outdated 2D city.
(()=>{'use strict';
  const go3D=()=>{ window.location.assign(new URL('./vesper3d/index.html?v=9', window.location.href).href); };
  const button=document.getElementById('openCity');
  if(button){ button.textContent='30 Jahre zuvor · BAUMHOLDER 3D'; button.addEventListener('click',go3D); }
  window.NEON_CITY={start:go3D,hasCompleted5:()=>{
    try{return Boolean(JSON.parse(localStorage.getItem('neon-rift-echoes-ch45-v1')||'{}').completed5)}catch{return false}
  }};
})();
