import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
  return {
    partidos: c.partidos.map(p=>({l:p[0], v:p[1]})),
    resultados: c.resultados,
    publicado: c.publicado
  };
}
function cfgDesdeFirestore(d){
  return {
    partidos: d.partidos.map(p=> Array.isArray(p) ? p : [p.l||'Local', p.v||'Visitante']),
    resultados: d.resultados||new Array(d.partidos.length).fill(null),
    publicado: d.publicado||false
  };
}


// ── PARTIDOS MUNDIAL 2026 - FASE DE GRUPOS COMPLETA ──
// Grupos confirmados: A-L (12 grupos × 6 partidos = 72 partidos)
const PARTIDOS_MUNDIAL_2026 = [
  // ── GRUPO A: México, Corea del Sur, Sudáfrica, Rep. Checa ──
  ["México","Sudáfrica"],
  ["Corea del Sur","Rep. Checa"],
  ["México","Corea del Sur"],
  ["Rep. Checa","Sudáfrica"],
  ["Sudáfrica","Corea del Sur"],
  ["Rep. Checa","México"],
  // ── GRUPO B: Canadá, Suiza, Qatar, Bosnia y Herzegovina ──
  ["Canadá","Bosnia y Herzegovina"],
  ["Qatar","Suiza"],
  ["Canadá","Qatar"],
  ["Suiza","Bosnia y Herzegovina"],
  ["Bosnia y Herzegovina","Qatar"],
  ["Suiza","Canadá"],
  // ── GRUPO C: Brasil, Marruecos, Escocia, Haití ──
  ["Brasil","Escocia"],
  ["Marruecos","Haití"],
  ["Brasil","Marruecos"],
  ["Haití","Escocia"],
  ["Escocia","Marruecos"],
  ["Haití","Brasil"],
  // ── GRUPO D: Estados Unidos, Turquía, Australia, Paraguay ──
  ["Estados Unidos","Paraguay"],
  ["Australia","Turquía"],
  ["Estados Unidos","Australia"],
  ["Turquía","Paraguay"],
  ["Paraguay","Australia"],
  ["Turquía","Estados Unidos"],
  // ── GRUPO E: Alemania, Ecuador, Costa de Marfil, Curazao ──
  ["Alemania","Ecuador"],
  ["Costa de Marfil","Curazao"],
  ["Alemania","Costa de Marfil"],
  ["Ecuador","Curazao"],
  ["Curazao","Alemania"],
  ["Ecuador","Costa de Marfil"],
  // ── GRUPO F: Países Bajos, Japón, Túnez, Suecia ──
  ["Países Bajos","Japón"],
  ["Túnez","Suecia"],
  ["Países Bajos","Túnez"],
  ["Japón","Suecia"],
  ["Suecia","Países Bajos"],
  ["Japón","Túnez"],
  // ── GRUPO G: Bélgica, Irán, Egipto, Nueva Zelanda ──
  ["Bélgica","Irán"],
  ["Egipto","Nueva Zelanda"],
  ["Bélgica","Egipto"],
  ["Irán","Nueva Zelanda"],
  ["Nueva Zelanda","Bélgica"],
  ["Irán","Egipto"],
  // ── GRUPO H: España, Uruguay, Arabia Saudita, Cabo Verde ──
  ["España","Uruguay"],
  ["Arabia Saudita","Cabo Verde"],
  ["España","Arabia Saudita"],
  ["Uruguay","Cabo Verde"],
  ["Cabo Verde","España"],
  ["Uruguay","Arabia Saudita"],
  // ── GRUPO I: Francia, Senegal, Noruega, Irak ──
  ["Francia","Noruega"],
  ["Senegal","Irak"],
  ["Francia","Senegal"],
  ["Noruega","Irak"],
  ["Irak","Francia"],
  ["Noruega","Senegal"],
  // ── GRUPO J: Argentina, Austria, Argelia, Jordania ──
  ["Argentina","Argelia"],
  ["Austria","Jordania"],
  ["Argentina","Austria"],
  ["Argelia","Jordania"],
  ["Jordania","Argentina"],
  ["Argelia","Austria"],
  // ── GRUPO K: Portugal, Colombia, Uzbekistán, RD Congo ──
  ["Portugal","Uzbekistán"],
  ["Colombia","RD Congo"],
  ["Portugal","Colombia"],
  ["Uzbekistán","RD Congo"],
  ["RD Congo","Portugal"],
  ["Uzbekistán","Colombia"],
  // ── GRUPO L: Inglaterra, Croacia, Panamá, Ghana ──
  ["Inglaterra","Panamá"],
  ["Croacia","Ghana"],
  ["Inglaterra","Croacia"],
  ["Panamá","Ghana"],
  ["Ghana","Inglaterra"],
  ["Panamá","Croacia"],
];

async function cargarMundial(){
  if(!confirm('¿Cargar los 36 partidos de fase de grupos del Mundial 2026? Esto reemplazará los partidos actuales.')) return;
  showLoader(true);
  try {
    const partidos = PARTIDOS_MUNDIAL_2026.map(p => [...p]);
    const resultados = new Array(partidos.length).fill(null);
    cfg.partidos = partidos;
    cfg.resultados = resultados;
    await setDoc(configRef, cfgParaFirestore(cfg), { merge: true });
    renderPartidos();
    mostrarAlerta('al-pt', `✓ ${partidos.length} partidos de fase de grupos del Mundial 2026 cargados (Grupos A-L).`, 'exito');
  } catch(e) {
    mostrarAlerta('al-pt', 'Error al cargar partidos.', 'error');
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
    const calcR=p.picks&&cfg?calcPts(p.picks,cfg.resultados):{pts:'-',pend:'-',total:0};const{pts,pend}=calcR;const total=calcR.total||cfg?.partidos.length||0;
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
      <td>${p.picks?'<span style="color:var(--vd);font-size:12px;">✓ Registrada</span>':'<span class="sin-q">Sin quiniela</span>'}</td>
      <td>${p.picks?`<span class="pts-badge">${pts}/${total}</span>`:'—'}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        ${p.picks?`<button class="btn-reset-q" onclick="event.stopPropagation();window.resetearQuiniela('${p.id}','${p.nombre}')">Resetear picks</button>`:''}
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
  if(!confirm(`¿Resetear la quiniela de "${nombre}"? Su cuenta se mantiene pero sus picks se borran.`))return;
  try{
    await updateDoc(doc(db,'jugadores',id),{picks:null});
    mostrarAlerta('al-jug',`Quiniela de ${nombre} reseteada. Ya puede volver a llenarla.`,'exito');
    renderJugadores();
  }catch(e){
    mostrarAlerta('al-jug','Error al resetear.','error');
  }
}

// ── POSICIONES ──
async function renderPos(){
  if(!cfg)return;
  const cont=document.getElementById('cont-pos');
  showLoader(true);
  const snaps=await getDocs(jugadoresC);
  const jugadores=[];snaps.forEach(d=>{if(d.data().picks)jugadores.push(d.data());});
  showLoader(false);
  if(!jugadores.length){cont.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:28px;">No hay jugadores con quiniela.</td></tr>`;return;}
  const totalPartidos=cfg.partidos.length;
  const ranking=jugadores.map(p=>{const{pts,pend}=calcPts(p.picks,cfg.resultados);return{nombre:p.nombre,pts,pend,total:totalPartidos};}).sort((a,b)=>b.pts-a.pts);
  document.getElementById('tbody-pos').innerHTML=ranking.map((r,i)=>{
    const cls=i===0?'pos oro':i===1?'pos plata':i===2?'pos bronce':'pos';
    const pc=totalPartidos>0?Math.round(r.pts/totalPartidos*100):0;
    return `<tr><td class="${cls}">${i+1}</td><td style="font-weight:500;">${r.nombre}</td>
    <td><span class="pts-badge">${r.pts}/${totalPartidos}</span></td><td style="color:var(--tx3);font-size:12px;">${r.pend}</td>
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
function mostrarAlerta(id,msg,tipo){const el=document.getElementById(id);el.textContent=msg;el.className='alerta '+tipo+' visible';setTimeout(()=>el.classList.remove('visible'),3500);}

window.login=login;window.salir=salir;window.irA=irA;window.cargarMundial=cargarMundial;
window.setPub=setPub;window.setRes=setRes;window.guardarPartidos=guardarPartidos;
window.agregarPartido=agregarPartido;window.quitarPartido=quitarPartido;
window.filtrarEquipos=filtrarEquipos;window.mostrarDropdown=mostrarDropdown;window.enfocarEquipo=enfocarEquipo;
window.ocultarDropdown=ocultarDropdown;window.elegirEquipo=elegirEquipo;
window.togPicks=togPicks;window.borrarJugador=borrarJugador;window.resetearQuiniela=resetearQuiniela;
window.cambiarPwd=cambiarPwd;window.resetearTodo=resetearTodo;
