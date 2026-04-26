import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import EQUIPOS from "./equipos.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmn1Hu69KrWM33dlhzLr3q6oDRwybiHeU",
  authDomain: "quiniela-mundialista-746ab.firebaseapp.com",
  projectId: "quiniela-mundialista-746ab",
  storageBucket: "quiniela-mundialista-746ab.firebasestorage.app",
  messagingSenderId: "720496448416",
  appId: "1:720496448416:web:167b169f30ca848f6e8ac5"
};

const fbApp=initializeApp(firebaseConfig);
const db=getFirestore(fbApp);
const configRef=doc(db,'quiniela','config');
const jugadoresC=collection(db,'jugadores');

const PWD_KEY='qp_admin_pwd';
const DEFAULT_PWD='admin123';
const getPwd=()=>localStorage.getItem(PWD_KEY)||DEFAULT_PWD;

let cfg=null;
const showLoader=v=>{const l=document.getElementById('loader');if(l)l.style.display=v?'flex':'none';};
const getEquipo=nombre=>EQUIPOS.find(e=>e.nombre===nombre)||null;

// Firestore no soporta arrays anidados — convertimos antes de guardar/leer
function cfgParaFirestore(c){
  const obj = {
    partidos: c.partidos.map(p=>({l:p[0], v:p[1]})),
    resultados: c.resultados,
    publicado: c.publicado,
    jornada: c.jornada||1,
  };
  // Guardar historial convirtiendo partidos anidados
  if(c.historial && Object.keys(c.historial).length > 0){
    obj.historial = {};
    for(const [clave, val] of Object.entries(c.historial)){
      obj.historial[clave] = {
        partidos: val.partidos.map(p => Array.isArray(p) ? {l:p[0],v:p[1]} : p),
        resultados: val.resultados
      };
    }
  }
  return obj;
}

function cfgDesdeFirestore(d){
  const historial = {};
  if(d.historial){
    for(const [clave, val] of Object.entries(d.historial)){
      historial[clave] = {
        partidos: (val.partidos||[]).map(p => Array.isArray(p) ? p : [p.l||'Local', p.v||'Visitante']),
        resultados: val.resultados||[]
      };
    }
  }
  return {
    partidos: (d.partidos||[]).map(p=> Array.isArray(p) ? p : [p.l||'Local', p.v||'Visitante']),
    resultados: d.resultados||(d.partidos||[]).map(()=>null),
    publicado: d.publicado||false,
    jornada: d.jornada||1,
    historial
  };
}


// ── PARTIDOS MUNDIAL 2026 POR RONDA ──
// Cada ronda tiene 24 partidos (2 por grupo × 12 grupos)

const RONDA1 = [
  // Jornada 1 — Partido 1 de cada grupo
  ["México","Sudáfrica"],          // A
  ["Corea del Sur","Rep. Checa"],  // A
  ["Canadá","Bosnia y Herzegovina"],// B
  ["Qatar","Suiza"],               // B
  ["Brasil","Escocia"],            // C
  ["Marruecos","Haití"],           // C
  ["Estados Unidos","Paraguay"],   // D
  ["Australia","Turquía"],         // D
  ["Alemania","Ecuador"],          // E
  ["Costa de Marfil","Curazao"],   // E
  ["Países Bajos","Japón"],        // F
  ["Túnez","Suecia"],              // F
  ["Bélgica","Irán"],              // G
  ["Egipto","Nueva Zelanda"],      // G
  ["España","Uruguay"],            // H
  ["Arabia Saudita","Cabo Verde"], // H
  ["Francia","Noruega"],           // I
  ["Senegal","Irak"],              // I
  ["Argentina","Argelia"],         // J
  ["Austria","Jordania"],          // J
  ["Portugal","Uzbekistán"],       // K
  ["Colombia","RD Congo"],         // K
  ["Inglaterra","Panamá"],         // L
  ["Croacia","Ghana"],             // L
];

const RONDA2 = [
  // Jornada 2 — Partido 2 de cada grupo
  ["México","Corea del Sur"],      // A
  ["Rep. Checa","Sudáfrica"],      // A
  ["Canadá","Qatar"],              // B
  ["Suiza","Bosnia y Herzegovina"],// B
  ["Brasil","Marruecos"],          // C
  ["Haití","Escocia"],             // C
  ["Estados Unidos","Australia"],  // D
  ["Turquía","Paraguay"],          // D
  ["Alemania","Costa de Marfil"],  // E
  ["Ecuador","Curazao"],           // E
  ["Países Bajos","Túnez"],        // F
  ["Japón","Suecia"],              // F
  ["Bélgica","Egipto"],            // G
  ["Irán","Nueva Zelanda"],        // G
  ["España","Arabia Saudita"],     // H
  ["Uruguay","Cabo Verde"],        // H
  ["Francia","Senegal"],           // I
  ["Noruega","Irak"],              // I
  ["Argentina","Austria"],         // J
  ["Argelia","Jordania"],          // J
  ["Portugal","Colombia"],         // K
  ["Uzbekistán","RD Congo"],       // K
  ["Inglaterra","Croacia"],        // L
  ["Panamá","Ghana"],              // L
];

const RONDA3 = [
  // Jornada 3 — Partido 3 de cada grupo (simultáneos)
  ["Sudáfrica","Corea del Sur"],   // A
  ["Rep. Checa","México"],         // A
  ["Bosnia y Herzegovina","Qatar"],// B
  ["Suiza","Canadá"],              // B
  ["Escocia","Marruecos"],         // C
  ["Haití","Brasil"],              // C
  ["Paraguay","Australia"],        // D
  ["Turquía","Estados Unidos"],    // D
  ["Curazao","Alemania"],          // E
  ["Ecuador","Costa de Marfil"],   // E
  ["Suecia","Países Bajos"],       // F
  ["Japón","Túnez"],               // F
  ["Nueva Zelanda","Bélgica"],     // G
  ["Irán","Egipto"],               // G
  ["Cabo Verde","España"],         // H
  ["Uruguay","Arabia Saudita"],    // H
  ["Irak","Francia"],              // I
  ["Noruega","Senegal"],           // I
  ["Jordania","Argentina"],        // J
  ["Argelia","Austria"],           // J
  ["RD Congo","Portugal"],         // K
  ["Uzbekistán","Colombia"],       // K
  ["Ghana","Inglaterra"],          // L
  ["Panamá","Croacia"],            // L
];

async function cargarRonda(num){
  const rondas = {1: RONDA1, 2: RONDA2, 3: RONDA3};
  const nuevosPartidos = rondas[num];

  const msg = num === 1
    ? `¿Cargar Jornada 1?\n⚠️ Borrará partidos y picks actuales de todos.`
    : `¿Cargar Jornada ${num}?\nLos jugadores deberán llenar sus picks nuevamente para esta jornada.\nLos resultados anteriores se conservan.`;

  if(!confirm(msg)) return;
  showLoader(true);

  try {
    // Guardar jornada activa y sus partidos en config
    // Cada jornada se guarda en su propia clave: jornada1, jornada2, jornada3
    // La jornada activa es la que los jugadores ven

    // 1. Si hay jornada previa, guardar sus resultados antes de cambiar
    if(num > 1 && cfg.jornada){
      const claveAnterior = `jornada${cfg.jornada}`;
      // Guardar partidos y resultados de jornada anterior en config
      const historial = cfg.historial || {};
      historial[claveAnterior] = {
        partidos: cfg.partidos,
        resultados: cfg.resultados
      };
      cfg.historial = historial;
    }

    // 2. Cargar nueva jornada como activa
    cfg.partidos = nuevosPartidos.map(p => [...p]);
    cfg.resultados = new Array(nuevosPartidos.length).fill(null);
    cfg.publicado = false;
    cfg.jornada = num;

    await setDoc(configRef, cfgParaFirestore(cfg), { merge: true });

    // 3. Borrar TODOS los picks de todos los jugadores (limpio total)
    const snaps = await getDocs(jugadoresC);
    const updates = [];
    snaps.forEach(d => {
      const data = d.data();
      // Construir objeto para borrar picks y todos los picksJ anteriores
      const update = { picks: null };
      // Borrar picksJ1, picksJ2, picksJ3 si existen
      for(let j=1; j<=3; j++){
        if(data[`picksJ${j}`] !== undefined){
          update[`picksJ${j}`] = deleteField();
        }
      }
      updates.push(updateDoc(doc(db,'jugadores',d.id), update));
    });
    await Promise.all(updates);

    renderPartidos();
    mostrarAlerta('al-pt', `✓ Jornada ${num} cargada. Todos los picks reseteados completamente.`, 'exito');
  } catch(e) {
    mostrarAlerta('al-pt', 'Error: ' + e.message, 'error');
    console.error(e);
  }
  showLoader(false);
}

// ── LOGIN ──
function login(){
  const v=document.getElementById('inp-pwd').value;
  if(v===getPwd()){
    document.getElementById('pantalla-login').style.display='none';
    document.getElementById('pantalla-app').style.display='block';
    iniciarListeners();irA('dashboard');
  } else {
    const err=document.getElementById('err-login');err.style.display='block';
    setTimeout(()=>err.style.display='none',2500);
  }
}
function salir(){
  if(window._unsubCfg)window._unsubCfg();
  document.getElementById('pantalla-login').style.display='flex';
  document.getElementById('pantalla-app').style.display='none';
  document.getElementById('inp-pwd').value='';
}

function iniciarListeners(){
  window._unsubCfg=onSnapshot(configRef,snap=>{
    if(snap.exists()){
      cfg=cfgDesdeFirestore(snap.data());
    } else {
      cfg={
        partidos:Array.from({length:14},(_,i)=>['Local '+(i+1),'Visitante '+(i+1)]),
        resultados:new Array(14).fill(null),publicado:false
      };
    }
    refrescarVista();
  });
}

function refrescarVista(){
  const activa=document.querySelector('.vista.activa');if(!activa)return;
  const v=activa.id.replace('vista-','');
  if(v==='dashboard')renderDash();
  if(v==='partidos')renderPartidos();
  if(v==='jugadores')renderJugadores();
  if(v==='posiciones')renderPos();
}

function irA(v){
  document.querySelectorAll('.vista').forEach(x=>x.classList.remove('activa'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('vista-'+v).classList.add('activa');
  ['dashboard','partidos','jugadores','posiciones','config'].forEach((n,i)=>{if(n===v)document.querySelectorAll('.nav-btn')[i].classList.add('active');});
  if(v==='dashboard')renderDash();
  if(v==='partidos')renderPartidos();
  if(v==='jugadores')renderJugadores();
  if(v==='posiciones')renderPos();
}

// ── DASHBOARD ──
async function renderDash(){
  if(!cfg)return;
  const comp=cfg.resultados.filter(r=>r!==null).length;
  showLoader(true);
  const snaps=await getDocs(jugadoresC);
  let total=0,conQ=0;snaps.forEach(d=>{total++;if(d.data().picks)conQ++;});
  showLoader(false);
  document.getElementById('stats-db').innerHTML=`
    <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">Registrados</div></div>
    <div class="stat"><div class="stat-n">${conQ}</div><div class="stat-l">Con quiniela</div></div>
    <div class="stat"><div class="stat-n">${comp}</div><div class="stat-l">Resultados</div></div>
    <div class="stat"><div class="stat-n">${cfg.partidos.length-comp}</div><div class="stat-l">Por jugar</div></div>`;
  document.getElementById('pub-banner-wrap').innerHTML=cfg.publicado
    ?`<div class="pub-banner"><div><div class="pub-t">Quinielas publicadas</div><div class="pub-s">Los jugadores ya pueden ver los pronósticos.</div></div><button class="btn-s" onclick="window.setPub(false)">Ocultar</button></div>`
    :`<div class="pub-banner" style="background:linear-gradient(135deg,#1a1a00,#2a2a00);border-color:var(--am);"><div><div class="pub-t" style="color:var(--am);">Quinielas ocultas</div><div class="pub-s" style="color:#cca020;">Los jugadores no pueden ver las quinielas de otros aún.</div></div><button class="btn-vd" onclick="window.setPub(true)">Publicar</button></div>`;
  document.getElementById('db-lista').innerHTML=cfg.partidos.map(([l,v],i)=>{
    const r=cfg.resultados[i];
    const ganador=r==='L'?l:r==='V'?v:null;
    const eq=ganador?getEquipo(ganador):null;
    const eqL=getEquipo(l);const eqV=getEquipo(v);
    const chip=r
      ?`<span class="chip chip-v" style="display:flex;align-items:center;gap:4px;">${eq?`<img src="${eq.bandera}" style="width:16px;height:11px;object-fit:cover;border-radius:2px;" alt="">`:''} ${ganador||'Empate'}</span>`
      :`<span class="chip chip-g">Pendiente</span>`;
    return `<div class="p-row">
      <span style="color:var(--tx3);font-size:11px;width:22px;">${i+1}</span>
      <span style="flex:1;display:flex;align-items:center;gap:5px;">${eqL?`<img src="${eqL.bandera}" style="width:18px;height:12px;object-fit:cover;border-radius:2px;" alt="">`:''} ${l}</span>
      <span style="color:var(--tx3);padding:0 6px;font-size:10px;">vs</span>
      <span style="flex:1;display:flex;align-items:center;gap:5px;color:var(--tx2);">${eqV?`<img src="${eqV.bandera}" style="width:18px;height:12px;object-fit:cover;border-radius:2px;" alt="">`:''} ${v}</span>
      ${chip}
    </div>`;
  }).join('');
}

async function setPub(val){
  await setDoc(configRef, cfgParaFirestore({...cfg, publicado:val}), { merge: true });
  mostrarAlerta('al-db',val?'Quinielas publicadas.':'Quinielas ocultadas.','exito');
}

// ── PARTIDOS con buscador de equipos ──
function renderPartidos(){
  if(!cfg)return;
  const n=cfg.partidos.length;
  const countEl=document.getElementById('partidos-count');
  if(countEl) countEl.textContent=`${n} partido${n!==1?'s':''}`;

  document.getElementById('partidos-edit').innerHTML=cfg.partidos.map(([l,v],i)=>{
    const eqL=getEquipo(l);const eqV=getEquipo(v);
    const r=cfg.resultados[i];
    return `<div class="partido-row-mundial" id="prow-${i}">
      <span class="p-idx">${i+1}</span>
      <div class="selector-equipo">
        <img class="bandera-preview" id="bL-${i}" src="${eqL?eqL.bandera:''}" alt="" style="${eqL?'':'display:none'}" onerror="this.style.display='none'">
        <input class="inp-equipo" id="pl-${i}" value="${l}" placeholder="Equipo local" autocomplete="off"
          oninput="window.filtrarEquipos(${i},'L')"
          onfocus="window.enfocarEquipo(${i},'L')"
          onblur="window.ocultarDropdown(${i},'L',300)">
        <div class="dropdown-equipos" id="ddL-${i}"></div>
      </div>
      <span class="vs-sep">vs</span>
      <div class="selector-equipo">
        <img class="bandera-preview" id="bV-${i}" src="${eqV?eqV.bandera:''}" alt="" style="${eqV?'':'display:none'}" onerror="this.style.display='none'">
        <input class="inp-equipo" id="pv-${i}" value="${v}" placeholder="Equipo visitante" autocomplete="off"
          oninput="window.filtrarEquipos(${i},'V')"
          onfocus="window.enfocarEquipo(${i},'V')"
          onblur="window.ocultarDropdown(${i},'V',300)">
        <div class="dropdown-equipos" id="ddV-${i}"></div>
      </div>
      <div class="res-btns">
        <button class="res-btn${r==='L'?' sel-L':''}" onclick="window.setRes(${i},'L')">L</button>
        <button class="res-btn${r==='E'?' sel-E':''}" onclick="window.setRes(${i},'E')">E</button>
        <button class="res-btn${r==='V'?' sel-V':''}" onclick="window.setRes(${i},'V')">V</button>
        <button class="btn-del" onclick="window.quitarPartido(${i})" title="Quitar partido">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function agregarPartido(){
  // Sync current input values into cfg first
  _syncPartidos();
  // Add new partido locally
  cfg.partidos.push(['Local','Visitante']);
  cfg.resultados.push(null);
  // Re-render immediately (no wait for Firebase)
  renderPartidos();
  // Save to Firebase in background
  setDoc(configRef, cfgParaFirestore(cfg), { merge: true }).catch(e=>console.error(e));
  // Scroll to new row
  setTimeout(()=>{
    const rows=document.querySelectorAll('.partido-row-mundial');
    if(rows.length)rows[rows.length-1].scrollIntoView({behavior:'smooth',block:'center'});
  },80);
}

async function quitarPartido(idx){
  if(cfg.partidos.length<=1){mostrarAlerta('al-pt','Debe haber al menos 1 partido.','error');return;}
  if(!confirm(`¿Quitar el partido ${idx+1}?`))return;
  // Sync inputs, remove, re-render immediately
  _syncPartidos();
  cfg.partidos.splice(idx,1);
  cfg.resultados.splice(idx,1);
  renderPartidos();
  // Save to Firebase in background
  setDoc(configRef, cfgParaFirestore(cfg), { merge: true }).catch(e=>console.error(e));
  mostrarAlerta('al-pt','Partido eliminado.','info');
}

function _syncPartidos(){
  const n=cfg.partidos.length;
  for(let i=0;i<n;i++){
    const l=document.getElementById('pl-'+i)?.value.trim();
    const v=document.getElementById('pv-'+i)?.value.trim();
    if(l)cfg.partidos[i][0]=l;
    if(v)cfg.partidos[i][1]=v;
  }
}

function filtrarEquipos(i,lado){
  const id=lado==='L'?`pl-${i}`:`pv-${i}`;
  const ddId=lado==='L'?`ddL-${i}`:`ddV-${i}`;
  const query=document.getElementById(id).value.toLowerCase();
  const dd=document.getElementById(ddId);
  const filtrados=EQUIPOS.filter(e=>e.nombre.toLowerCase().includes(query)).slice(0,8);
  dd.innerHTML=filtrados.map(e=>`<div class="dropdown-item" onmousedown="window.elegirEquipo(${i},'${lado}','${e.nombre}')">
    <img src="${e.bandera}" alt="${e.nombre}" onerror="this.style.display='none'">
    <span>${e.nombre}</span>
  </div>`).join('');
  dd.classList.toggle('visible', filtrados.length>0 && query.length>0);
}

function mostrarDropdown(i,lado){
  filtrarEquipos(i,lado);
}

function enfocarEquipo(i,lado){
  const inpId = lado==='L' ? `pl-${i}` : `pv-${i}`;
  const bId   = lado==='L' ? `bL-${i}` : `bV-${i}`;
  const inp   = document.getElementById(inpId);
  const img   = document.getElementById(bId);
  // Siempre limpiamos el campo y la bandera al hacer foco
  inp.value = '';
  if(img){ img.src=''; img.style.display='none'; }
  filtrarEquipos(i,lado);
}

function ocultarDropdown(i,lado,delay){
  setTimeout(()=>{
    const ddId=lado==='L'?`ddL-${i}`:`ddV-${i}`;
    document.getElementById(ddId)?.classList.remove('visible');
  },delay);
}

function elegirEquipo(i,lado,nombre){
  const inpId=lado==='L'?`pl-${i}`:`pv-${i}`;
  const bId=lado==='L'?`bL-${i}`:`bV-${i}`;
  const ddId=lado==='L'?`ddL-${i}`:`ddV-${i}`;
  document.getElementById(inpId).value=nombre;
  const eq=getEquipo(nombre);
  const img=document.getElementById(bId);
  if(eq&&img){img.src=eq.bandera;img.style.display='block';}
  document.getElementById(ddId)?.classList.remove('visible');
}

async function setRes(i,opt){
  // Sync inputs first
  _syncPartidos();
  // Toggle result locally
  cfg.resultados[i]=cfg.resultados[i]===opt?null:opt;
  // Re-render immediately
  renderPartidos();
  // Save to Firebase
  setDoc(configRef, cfgParaFirestore(cfg), { merge: true }).catch(e=>console.error(e));
}

async function guardarPartidos(){
  showLoader(true);
  try {
    const partidos=cfg.partidos.map((p,i)=>{
      const l=document.getElementById('pl-'+i)?.value.trim()||p[0];
      const v=document.getElementById('pv-'+i)?.value.trim()||p[1];
      return [l,v];
    });
    const resultados=partidos.map((_,i)=>cfg.resultados[i]??null);
    cfg.partidos=partidos;
    cfg.resultados=resultados;
    await setDoc(configRef, cfgParaFirestore(cfg), { merge: true });
    renderPartidos();
    mostrarAlerta('al-pt','¡Partidos guardados correctamente!','exito');
  } catch(e) {
    console.error('Error guardando partidos:',e);
    mostrarAlerta('al-pt','Error al guardar: '+e.message,'error');
  }
  showLoader(false);
}

// ── JUGADORES ──
async function renderJugadores(){
  showLoader(true);
  const snaps=await getDocs(jugadoresC);
  const jugadores=[];snaps.forEach(d=>jugadores.push({id:d.id,...d.data()}));
  showLoader(false);
  const n=jugadores.length;
  document.getElementById('jug-h').textContent=`${n} jugador${n!==1?'es':''} registrado${n!==1?'s':''}`;
  const tbody=document.getElementById('tbody-jug');
  if(!n){tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:28px;">No hay jugadores.</td></tr>`;return;}
  tbody.innerHTML=jugadores.map((p,pi)=>{
    const calcR=calcPtsTotales(p);const{pts,pend,total}=calcR;
    const picksHtml=p.picks&&cfg?cfg.partidos.map(([l,v],i)=>{
      const r=cfg.resultados[i];const ok=r!==null&&p.picks[i]===r;const mal=r!==null&&p.picks[i]!==r;
      const elegido=p.picks[i]==='L'?l:p.picks[i]==='V'?v:null;
      const eq=elegido?getEquipo(elegido):null;
      return `<div class="pick-item${ok?' pick-ok':mal?' pick-mal':''}">
        <span class="pick-partido">${l} vs ${v}</span>
        <span class="p-opt p-${p.picks[i]}" style="display:flex;align-items:center;gap:2px;">${eq?`<img src="${eq.bandera}" style="width:13px;height:9px;object-fit:cover;border-radius:1px;" alt="">`:''} ${p.picks[i]==='E'?'E':eq?eq.nombre:p.picks[i]}</span>
      </div>`;
    }).join(''):'';
    return `<tr class="fila-jug" onclick="${p.picks?'window.togPicks('+pi+')':''}">
      <td style="color:var(--tx3);font-size:12px;">${pi+1}</td>
      <td style="font-weight:500;">${p.nombre}</td>
      <td>${p.bloqueado?'<span style="color:var(--rj);font-size:12px;">🔒 Bloqueado</span>':p.picks?'<span style="color:var(--vd);font-size:12px;">✓ Registrada</span>':'<span class="sin-q">Sin quiniela</span>'}</td>
      <td>${p.picks?`<span class="pts-badge">${pts}/${total}</span>`:'—'}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn-reset-q" onclick="event.stopPropagation();window.resetearQuiniela('${p.id}','${p.nombre}')">Resetear picks</button>
        ${p.bloqueado?`<button class="btn-restablecer" onclick="event.stopPropagation();window.restablecerJornadas('${p.id}','${p.nombre}')">Restablecer</button>`:''}
        <button class="btn-del" onclick="event.stopPropagation();window.borrarJugador('${p.id}','${p.nombre}')">Borrar cuenta</button>
      </td>
    </tr>
    ${p.picks?`<tr><td colspan="5" style="padding:0;"><div class="picks-detalle" id="picks-${pi}"><div class="picks-wrap"><div class="picks-grid">${picksHtml}</div></div></div></td></tr>`:''}`;
  }).join('');
}

function togPicks(pi){const el=document.getElementById('picks-'+pi);if(el)el.classList.toggle('open');}

async function borrarJugador(id,nombre){
  if(!confirm(`¿Borrar la cuenta de "${nombre}"? Esto elimina su cuenta y quiniela.`))return;
  await deleteDoc(doc(db,'jugadores',id));
  mostrarAlerta('al-jug','Jugador eliminado.','info');
  renderJugadores();
}

async function resetearQuiniela(id,nombre){
  if(!confirm(`¿Resetear TODOS los picks de "${nombre}"?\n\nEl jugador no podrá ver resultados ni jornadas anteriores hasta que uses "Restablecer jornadas".`))return;
  try{
    const snap = await getDoc(doc(db,'jugadores',id));
    if(!snap.exists()) return;
    const data = snap.data();
    // Borrar picks, todos los picksJ y marcar como bloqueado
    const update = { picks: null, bloqueado: true };
    Object.keys(data).forEach(k => {
      if(k.startsWith('picksJ')) update[k] = deleteField();
    });
    await updateDoc(doc(db,'jugadores',id), update);
    mostrarAlerta('al-jug',`Picks de ${nombre} reseteados. El jugador está bloqueado.`,'exito');
    renderJugadores();
  }catch(e){
    mostrarAlerta('al-jug','Error al resetear: '+e.message,'error');
  }
}

async function restablecerJornadas(id,nombre){
  if(!confirm(`¿Restablecer acceso a jornadas para "${nombre}"?\n\nPodrá ver los resultados y llenar sus picks nuevamente.`))return;
  try{
    await updateDoc(doc(db,'jugadores',id),{ bloqueado: false, picks: null });
    mostrarAlerta('al-jug',`Acceso restablecido para ${nombre}.`,'exito');
    renderJugadores();
  }catch(e){
    mostrarAlerta('al-jug','Error: '+e.message,'error');
  }
}

// ── POSICIONES ──
async function renderPos(){
  if(!cfg)return;
  const cont=document.getElementById('cont-pos');
  showLoader(true);
  const snaps=await getDocs(jugadoresC);
  const jugadores=[];snaps.forEach(d=>jugadores.push(d.data()));
  showLoader(false);
  const conPicks=jugadores.filter(p=>p.picks||Object.keys(p).some(k=>k.startsWith('picksJ')));
  if(!conPicks.length){cont.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:28px;">No hay jugadores con quiniela.</td></tr>`;return;}
  const ranking=conPicks.map(p=>{const{pts,pend,total}=calcPtsTotales(p);return{nombre:p.nombre,pts,pend,total};}).sort((a,b)=>b.pts-a.pts);
  document.getElementById('tbody-pos').innerHTML=ranking.map((r,i)=>{
    const cls=i===0?'pos oro':i===1?'pos plata':i===2?'pos bronce':'pos';
    const pc=r.total>0?Math.round(r.pts/r.total*100):0;
    return `<tr><td class="${cls}">${i+1}</td><td style="font-weight:500;">${r.nombre}</td>
    <td><span class="pts-badge">${r.pts}/${r.total}</span></td><td style="color:var(--tx3);font-size:12px;">${r.pend}</td>
    <td><div style="height:4px;background:var(--borde);border-radius:2px;overflow:hidden;min-width:60px;"><div style="height:100%;width:${pc}%;background:var(--vd);border-radius:2px;"></div></div></td></tr>`;
  }).join('');
}

// ── CONFIG ──
function cambiarPwd(){
  const n=document.getElementById('pwd-nueva').value;const c=document.getElementById('pwd-conf').value;
  if(n.length<4){mostrarAlerta('al-cfg','Mínimo 4 caracteres.','error');return;}
  if(n!==c){mostrarAlerta('al-cfg','Las contraseñas no coinciden.','error');return;}
  localStorage.setItem(PWD_KEY,n);mostrarAlerta('al-cfg','Contraseña actualizada.','exito');
  document.getElementById('pwd-nueva').value='';document.getElementById('pwd-conf').value='';
}

async function resetearTodo(){
  if(!confirm('¿Reiniciar todo?'))return;
  showLoader(true);
  const snaps=await getDocs(jugadoresC);
  await Promise.all([...snaps.docs.map(d=>deleteDoc(doc(db,'jugadores',d.id)))]);
  await setDoc(configRef,{partidos:Array.from({length:14},(_,i)=>['Local '+(i+1),'Visitante '+(i+1)]),resultados:new Array(14).fill(null),publicado:false}, { merge: false });
  showLoader(false);mostrarAlerta('al-cfg','Todo reiniciado.','exito');
}

function calcPts(ps,res){
  // Only count up to the current number of partidos
  const n=Math.min(ps.length, res.length, cfg?cfg.partidos.length:ps.length);
  let pts=0,pend=0;
  for(let i=0;i<n;i++){
    if(res[i]===null)pend++;
    else if(ps[i]===res[i])pts++;
  }
  return{pts,pend,total:n};
}

function calcPtsTotales(jugData){
  if(!cfg)return{pts:0,pend:0,total:0};
  let ptsTotal=0,totalPartidos=0,pendTotal=0;
  const historial=cfg.historial||{};
  for(let j=1;j<(cfg.jornada||1);j++){
    const picksJ=jugData[`picksJ${j}`];
    const histJ=historial[`jornada${j}`];
    if(picksJ&&histJ){
      const resJ=histJ.resultados||[];
      const partJ=(histJ.partidos||[]).map(p=>Array.isArray(p)?p:[p.l,p.v]);
      const n=Math.min(picksJ.length,resJ.length,partJ.length);
      totalPartidos+=n;
      for(let i=0;i<n;i++){if(resJ[i]!==null&&picksJ[i]===resJ[i])ptsTotal++;}
    }
  }
  const picksActual=jugData.picks;
  const res=cfg.resultados||[];
  const nAct=cfg.partidos.length;
  totalPartidos+=nAct;
  if(picksActual){
    const n=Math.min(picksActual.length,res.length,nAct);
    for(let i=0;i<n;i++){if(res[i]===null)pendTotal++;else if(picksActual[i]===res[i])ptsTotal++;}
    pendTotal+=nAct-Math.min(picksActual.length,nAct);
  }else{pendTotal+=nAct;}
  return{pts:ptsTotal,pend:pendTotal,total:totalPartidos};
}
function mostrarAlerta(id,msg,tipo){const el=document.getElementById(id);el.textContent=msg;el.className='alerta '+tipo+' visible';setTimeout(()=>el.classList.remove('visible'),3500);}

window.login=login;window.salir=salir;window.irA=irA;window.cargarRonda=cargarRonda;
window.setPub=setPub;window.setRes=setRes;window.guardarPartidos=guardarPartidos;
window.agregarPartido=agregarPartido;window.quitarPartido=quitarPartido;
window.filtrarEquipos=filtrarEquipos;window.mostrarDropdown=mostrarDropdown;window.enfocarEquipo=enfocarEquipo;
window.ocultarDropdown=ocultarDropdown;window.elegirEquipo=elegirEquipo;
window.togPicks=togPicks;window.borrarJugador=borrarJugador;window.resetearQuiniela=resetearQuiniela;window.restablecerJornadas=restablecerJornadas;
window.cambiarPwd=cambiarPwd;window.resetearTodo=resetearTodo;
