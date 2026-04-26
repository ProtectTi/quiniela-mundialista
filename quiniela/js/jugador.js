import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import EQUIPOS from "./equipos.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmn1Hu69KrWM33dlhzLr3q6oDRwybiHeU",
  authDomain: "quiniela-mundialista-746ab.firebaseapp.com",
  projectId: "quiniela-mundialista-746ab",
  storageBucket: "quiniela-mundialista-746ab.firebasestorage.app",
  messagingSenderId: "720496448416",
  appId: "1:720496448416:web:167b169f30ca848f6e8ac5"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const configRef  = doc(db, 'quiniela', 'config');
const jugadoresC = collection(db, 'jugadores');

const SES_KEY = 'qp_sesion';
const getS   = () => { try { const s=localStorage.getItem(SES_KEY); return s?JSON.parse(s):null; } catch(e){return null;} };
const saveS  = s => localStorage.setItem(SES_KEY, JSON.stringify(s));
const clearS = () => localStorage.removeItem(SES_KEY);

let sesion = getS();
let picks  = [];
let cfg    = null;

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

// Buscar equipo por nombre
function getEquipo(nombre) {
  return EQUIPOS.find(e => e.nombre === nombre) || null;
}

// Render bandera + nombre
function renderEquipo(nombre) {
  const eq = getEquipo(nombre);
  if (!eq) return `<span>${nombre}</span>`;
  return `<img src="${eq.bandera}" alt="${nombre}" onerror="this.style.display='none'"><span>${nombre}</span>`;
}

const showLoader = v => { const l=document.getElementById('loader'); if(l) l.style.display=v?'flex':'none'; };

// ── TABS ──
function setTab(t) {
  document.getElementById('tab-login').style.display    = t==='login'?'block':'none';
  document.getElementById('tab-registro').style.display = t==='registro'?'block':'none';
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='registro')));
}

// ── LOGIN ──
async function login() {
  const nombre=document.getElementById('l-nombre').value.trim();
  const pwd=document.getElementById('l-pwd').value;
  const err=document.getElementById('err-login');
  if(!nombre||!pwd){mostrarErr(err,'Completa todos los campos.');return;}
  showLoader(true);
  try {
    const snap=await getDoc(doc(db,'jugadores',nombre.toLowerCase()));
    if(!snap.exists()||snap.data().pwd!==pwd){mostrarErr(err,'Nombre o contraseña incorrectos.');}
    else{saveS({nombre:snap.data().nombre});sesion={nombre:snap.data().nombre};entrarApp();}
  } catch(e){mostrarErr(err,'Error de conexión.');}
  showLoader(false);
}

// ── REGISTRO ──
async function registrar() {
  const nombre=document.getElementById('r-nombre').value.trim();
  const pwd=document.getElementById('r-pwd').value;
  const pwd2=document.getElementById('r-pwd2').value;
  const err=document.getElementById('err-reg');
  if(!nombre){mostrarErr(err,'Ingresa tu nombre.');return;}
  if(pwd.length<4){mostrarErr(err,'Mínimo 4 caracteres.');return;}
  if(pwd!==pwd2){mostrarErr(err,'Las contraseñas no coinciden.');return;}
  showLoader(true);
  try {
    const snap=await getDoc(doc(db,'jugadores',nombre.toLowerCase()));
    if(snap.exists()){mostrarErr(err,'Ese nombre ya está en uso.');showLoader(false);return;}
    await setDoc(doc(db,'jugadores',nombre.toLowerCase()),{nombre,pwd,picks:null,creadoEn:Date.now()});
    saveS({nombre});sesion={nombre};entrarApp();
  } catch(e){mostrarErr(err,'Error al registrar.');}
  showLoader(false);
}

function entrarApp(){
  document.getElementById('auth-wrap').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('user-label').textContent=sesion.nombre;
  iniciarListeners();irA('inicio');
}

function cerrarSesion(){
  clearS();sesion=null;picks=new Array(cfg.partidos.length).fill(null);
  if(window._unsubCfg)window._unsubCfg();
  document.getElementById('app').style.display='none';
  document.getElementById('auth-wrap').style.display='flex';
  document.getElementById('l-nombre').value='';
  document.getElementById('l-pwd').value='';
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
  if(v==='inicio')renderInicio();
  if(v==='quinielas')renderQuinielas();
  if(v==='posiciones')renderPos();
}

function irA(v){
  document.querySelectorAll('.vista').forEach(x=>x.classList.remove('activa'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('vista-'+v).classList.add('activa');
  ['inicio','miquiniela','quinielas','posiciones'].forEach((n,i)=>{if(n===v)document.querySelectorAll('.nav-btn')[i].classList.add('active');});
  if(v==='inicio')renderInicio();
  if(v==='miquiniela')renderMiQ();
  if(v==='quinielas')renderQuinielas();
  if(v==='posiciones')renderPos();
}

// ── INICIO ──
async function renderInicio(){
  if(!cfg)return;
  const comp=cfg.resultados.filter(r=>r!==null).length;
  const snap=await getDoc(doc(db,'jugadores',sesion.nombre.toLowerCase()));
  const jug=snap.exists()?snap.data():null;

  // Si el jugador está bloqueado, mostrar pantalla en blanco
  if(jug&&jug.bloqueado){
    document.getElementById('ini-sub').textContent='Tu quiniela ha sido reseteada por el administrador.';
    document.getElementById('stats-ini').innerHTML='';
    document.getElementById('ini-partidos').innerHTML=`
      <div class="bloqueado">
        <div style="font-size:36px;margin-bottom:10px;">🔒</div>
        <div class="bloq-t">Acceso restringido</div>
        <div class="bloq-s">El administrador ha reseteado tu quiniela.<br>Espera a que te restablezca el acceso.</div>
      </div>`;
    return;
  }

  // Si fue restablecido (sin picks), mostrar partidos siempre como Pendiente
  const fueRestablecido = jug && !jug.picks && !jug.bloqueado && jug.creadoEn;
  const sinPicks = !jug || (!jug.picks && !Object.keys(jug).some(k=>k.startsWith('picksJ')));

  document.getElementById('ini-sub').textContent=jug&&jug.picks?'Tu quiniela está registrada ✓':'Aún no has llenado tu quiniela';
  const tot=cfg.partidos.length;
  document.getElementById('stats-ini').innerHTML=`
    <div class="stat"><div class="stat-n">${tot}</div><div class="stat-l">Partidos</div></div>
    <div class="stat"><div class="stat-n">${comp}</div><div class="stat-l">Resultados</div></div>
    <div class="stat"><div class="stat-n">${tot-comp}</div><div class="stat-l">Por jugar</div></div>`;
  document.getElementById('ini-partidos').innerHTML=cfg.partidos.map(([l,v],i)=>{
    const r=cfg.resultados[i];
    const ganador = r==='L'?l:r==='V'?v:null;
    const eq = ganador ? getEquipo(ganador) : null;
    const chip = r
      ? `<span class="chip chip-v" style="display:flex;align-items:center;gap:4px;">${eq?`<img src="${eq.bandera}" style="width:16px;height:11px;object-fit:cover;border-radius:2px;" alt="">`:''}${ganador||'Empate'}</span>`
      : `<span class="chip chip-g">Pendiente</span>`;
    const eqL=getEquipo(l); const eqV=getEquipo(v);
    return `<div class="p-row">
      <span style="color:var(--tx3);font-size:11px;width:22px;">${i+1}</span>
      <span style="flex:1;display:flex;align-items:center;gap:5px;">${eqL?`<img src="${eqL.bandera}" style="width:18px;height:12px;object-fit:cover;border-radius:2px;" alt="">`:''}${l}</span>
      <span style="color:var(--tx3);padding:0 6px;font-size:10px;">vs</span>
      <span style="flex:1;display:flex;align-items:center;gap:5px;color:var(--tx2);">${eqV?`<img src="${eqV.bandera}" style="width:18px;height:12px;object-fit:cover;border-radius:2px;" alt="">`:''}${v}</span>
      ${chip}
    </div>`;
  }).join('');
}

// ── MI QUINIELA ──
async function renderMiQ(){
  if(!cfg)return;
  showLoader(true);
  const snap=await getDoc(doc(db,'jugadores',sesion.nombre.toLowerCase()));
  const jug=snap.exists()?snap.data():null;
  const cont=document.getElementById('mq-contenido');
  showLoader(false);

  // Función para renderizar picks de una jornada
  function renderPicksJornada(picksJ, partidosJ, resultadosJ, numJ, offset){
    return partidosJ.map(([l,v],i)=>{
      const r=resultadosJ[i];
      const ok=r!==null&&picksJ[i]===r;
      const mal=r!==null&&picksJ[i]!==r;
      const elegido=picksJ[i]==='L'?l:picksJ[i]==='V'?v:null;
      const eq=elegido?getEquipo(elegido):null;
      const eqL=getEquipo(l);const eqV=getEquipo(v);
      const color=ok?'var(--vd)':mal?'#f88':'var(--tx2)';
      return `<div class="pr-card${ok?' pick-ok':mal?' pick-mal':''}">
        <div class="pr-num">${offset+i+1}</div>
        <div class="pr-enfrentamiento">
          <div class="pr-equipo">${eqL?`<img src="${eqL.bandera}" alt="${l}">`:''}
            <span>${l}</span></div>
          <span class="pr-vs">VS</span>
          <div class="pr-equipo">${eqV?`<img src="${eqV.bandera}" alt="${v}">`:''}
            <span>${v}</span></div>
        </div>
        <div class="pr-resultado" style="color:${color}">
          ${eq?`<img src="${eq.bandera}" alt="${eq.nombre}">`:''}
          <span>${picksJ[i]==='E'?'Empate':eq?eq.nombre:'-'}</span>
          ${ok?'✓':mal?'✗':''}
        </div>
      </div>`;
    }).join('');
  }

  // Si el jugador está bloqueado, no mostrar nada
  if(jug&&jug.bloqueado){
    cont.innerHTML=`
      <div class="bloqueado">
        <div style="font-size:36px;margin-bottom:10px;">🔒</div>
        <div class="bloq-t">Acceso restringido</div>
        <div class="bloq-s">El administrador ha reseteado tu quiniela.<br>Espera a que te restablezca el acceso para poder llenarla nuevamente.</div>
      </div>`;
    return;
  }

  if(jug){
    const{pts,pend,total:totalPartidos}=calcPtsTotales(jug);
    const historial=cfg.historial||{};
    const jornadaActual=cfg.jornada||1;
    let seccionesHTML='';
    let offsetPartidos=0;

    // Mostrar jornadas anteriores (historial)
    for(let j=1;j<jornadaActual;j++){
      const picksJ=jug[`picksJ${j}`];
      const histJ=historial[`jornada${j}`];
      if(picksJ&&histJ){
        const partJ=(histJ.partidos||[]).map(p=>Array.isArray(p)?p:[p.l,p.v]);
        const resJ=histJ.resultados||[];
        const ptsJ=resJ.filter((r,i)=>r!==null&&picksJ[i]===r).length;
        const totalJ=partJ.length;
        seccionesHTML+=`
          <div class="jornada-seccion">
            <div class="jornada-header">
              <span class="jornada-titulo">Jornada ${j}</span>
              <span class="jornada-pts">${ptsJ}/${totalJ} aciertos ✓</span>
            </div>
            <div class="picks-lista">${renderPicksJornada(picksJ,partJ,resJ,j,offsetPartidos)}</div>
          </div>`;
        offsetPartidos+=totalJ;
      }
    }

    // Jornada actual
    if(jug.picks){
      const picksActual=jug.picks;
      const partidosActual=cfg.partidos;
      const resActual=cfg.resultados;
      const ptsAct=resActual.filter((r,i)=>r!==null&&picksActual[i]===r).length;
      seccionesHTML+=`
        <div class="jornada-seccion">
          <div class="jornada-header">
            <span class="jornada-titulo">Jornada ${jornadaActual} — En curso</span>
            <span class="jornada-pts">${ptsAct}/${partidosActual.length} aciertos</span>
          </div>
          <div class="picks-lista">${renderPicksJornada(picksActual,partidosActual,resActual,jornadaActual,offsetPartidos)}</div>
        </div>`;

      // Partidos nuevos sin picks
      const partidosNuevos=cfg.partidos.slice(picksActual.length);
      if(partidosNuevos.length>0){
        if(picks.length!==partidosNuevos.length) picks=new Array(partidosNuevos.length).fill(null);
        const formNuevos=partidosNuevos.map(([l,v],ii)=>{
          const eqL=getEquipo(l);const eqV=getEquipo(v);
          return `<div class="q-partido-mundial">
            <div class="q-partido-num-mundial">Partido ${offsetPartidos+picksActual.length+ii+1}</div>
            <div class="q-partido-equipos">
              <div class="q-equipo-lado">${eqL?`<img src="${eqL.bandera}" alt="${l}">`:''}
                <span>${l}</span></div>
              <span class="q-vs-badge">VS</span>
              <div class="q-equipo-lado visitante">${eqV?`<img src="${eqV.bandera}" alt="${v}">`:''}
                <span>${v}</span></div>
            </div>
            <div class="q-opciones-mundial">
              <button id="pick-nuevo-${ii}-L" class="btn-pick-local${picks[ii]==='L'?' activo':''}" onclick="window.setPickNuevo(${ii},'L')">
                ${eqL?`<img src="${eqL.bandera}" alt="">`:''}
                <span>Gana ${l}</span>
              </button>
              <button id="pick-nuevo-${ii}-E" class="btn-pick-empate${picks[ii]==='E'?' activo':''}" onclick="window.setPickNuevo(${ii},'E')">E</button>
              <button id="pick-nuevo-${ii}-V" class="btn-pick-visit${picks[ii]==='V'?' activo':''}" onclick="window.setPickNuevo(${ii},'V')">
                ${eqV?`<img src="${eqV.bandera}" alt="">`:''}
                <span>Gana ${v}</span>
              </button>
            </div>
          </div>`;
        }).join('');
        seccionesHTML+=`
          <div class="nuevos-banner">
            <div class="nuevos-t">⚽ Partidos sin pronosticar</div>
            <div class="nuevos-s">${partidosNuevos.length} partido${partidosNuevos.length!==1?'s':''} nuevo${partidosNuevos.length!==1?'s':''} disponible${partidosNuevos.length!==1?'s':''}.</div>
          </div>
          <div id="form-nuevos">${formNuevos}</div>
          <div style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <button class="btn-p" onclick="window.guardarPicksNuevos(${picksActual.length})">Guardar picks</button>
            <span id="prog-nuevo-lbl" style="font-size:13px;color:var(--tx2);"></span>
          </div>`;
      }
    } else {
      // No tiene picks de jornada actual — mostrar formulario
      picks=new Array(cfg.partidos.length).fill(null);
      seccionesHTML+=`
        <div class="nuevos-banner">
          <div class="nuevos-t">⚽ Jornada ${jornadaActual} disponible</div>
          <div class="nuevos-s">Llena tus ${cfg.partidos.length} pronósticos para la jornada ${jornadaActual}.</div>
        </div>`;
      cont.innerHTML=`
        <div class="mq-banner">
          <div class="mq-t">Quiniela Mundialista 🔒</div>
          <div class="mq-s">${pts} aciertos acumulados de ${totalPartidos} partidos</div>
        </div>
        ${seccionesHTML}
        <div class="card card-p" style="margin-bottom:0;margin-top:14px;">
          <div style="font-size:13px;color:var(--tx2);margin-bottom:14px;">Selecciona el equipo ganador o empate para cada partido</div>
          <div id="q-form"></div>
          <div style="margin-top:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <button class="btn-p" onclick="window.guardarPicks()">Guardar quiniela</button>
            <span id="prog-lbl" style="font-size:13px;color:var(--tx2);"></span>
          </div>
          <div class="progreso-wrap"><div class="progreso-fill" id="prog-fill" style="width:0%"></div></div>
        </div>`;
      renderFormPicks();
      return;
    }

    cont.innerHTML=`
      <div class="mq-banner">
        <div class="mq-t">Quiniela Mundialista 🔒</div>
        <div class="mq-s">Total: ${pts} aciertos de ${totalPartidos} partidos · ${pend} pendientes</div>
      </div>
      ${seccionesHTML}`;
  } else {
    picks=new Array(cfg.partidos.length).fill(null);
    cont.innerHTML=`<div class="card card-p" style="margin-bottom:0">
      <div style="font-size:13px;color:var(--tx2);margin-bottom:14px;">Selecciona el equipo que crees que ganará o si habrá empate</div>
      <div id="q-form"></div>
      <div style="margin-top:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <button class="btn-p" onclick="window.guardarPicks()">Guardar quiniela</button>
        <span id="prog-lbl" style="font-size:13px;color:var(--tx2);"></span>
      </div>
      <div class="progreso-wrap"><div class="progreso-fill" id="prog-fill" style="width:0%"></div></div>
    </div>`;
    renderFormPicks();
  }
}

function renderFormPicks(){
  if(!cfg)return;
  const cont=document.getElementById('q-form');if(!cont)return;
  cont.innerHTML=cfg.partidos.map(([l,v],i)=>{
    const eqL=getEquipo(l); const eqV=getEquipo(v);
    const selL=picks[i]==='L'; const selE=picks[i]==='E'; const selV=picks[i]==='V';
    return `<div class="q-partido-mundial">
      <div class="q-partido-num-mundial">Partido ${i+1}</div>
      <div class="q-partido-equipos">
        <div class="q-equipo-lado">
          ${eqL?`<img src="${eqL.bandera}" alt="${l}">`:''}
          <span>${l}</span>
        </div>
        <span class="q-vs-badge">VS</span>
        <div class="q-equipo-lado visitante">
          ${eqV?`<img src="${eqV.bandera}" alt="${v}">`:''}
          <span>${v}</span>
        </div>
      </div>
      <div class="q-opciones-mundial">
        <button class="btn-pick-local${selL?' activo':''}" onclick="window.setPick(${i},'L')">
          ${eqL?`<img src="${eqL.bandera}" alt="">`:''}
          <span>Gana ${l}</span>
        </button>
        <button class="btn-pick-empate${selE?' activo':''}" onclick="window.setPick(${i},'E')">E</button>
        <button class="btn-pick-visit${selV?' activo':''}" onclick="window.setPick(${i},'V')">
          ${eqV?`<img src="${eqV.bandera}" alt="">`:''}
          <span>Gana ${v}</span>
        </button>
      </div>
    </div>`;
  }).join('');
  const c=picks.filter(p=>p!==null).length;
  const lbl=document.getElementById('prog-lbl');const fill=document.getElementById('prog-fill');
  const total=cfg.partidos.length;if(lbl)lbl.textContent=`${c} / ${total}`;if(fill)fill.style.width=(c/total*100)+'%';
}

function setPick(i,opt){picks[i]=picks[i]===opt?null:opt;renderFormPicks();}

function setPickNuevo(ii, opt){
  // Toggle pick
  picks[ii] = picks[ii] === opt ? null : opt;

  // Update only the 3 buttons of this partido without re-rendering everything
  const opciones = ['L','E','V'];
  opciones.forEach(o => {
    const btn = document.getElementById(`pick-nuevo-${ii}-${o}`);
    if(!btn) return;
    btn.classList.remove('activo');
    if(picks[ii] === o) btn.classList.add('activo');
  });

  // Update counter
  const c = picks.filter(p => p !== null).length;
  const lbl = document.getElementById('prog-nuevo-lbl');
  if(lbl) lbl.textContent = `${c} / ${picks.length}`;
}

async function guardarPicksNuevos(picksExistentesLen){
  const al = document.getElementById('al-mq');
  if(!picks.length || picks.some(p => p === null)){
    mostrarAlerta(al, 'Debes pronosticar todos los partidos nuevos.', 'error');
    return;
  }
  showLoader(true);
  try{
    const snap = await getDoc(doc(db, 'jugadores', sesion.nombre.toLowerCase()));
    const existentes = snap.exists() && snap.data().picks ? snap.data().picks : [];
    const completos = [...existentes, ...picks];
    await updateDoc(doc(db, 'jugadores', sesion.nombre.toLowerCase()), {picks: completos});
    picks = [];
    mostrarAlerta(al, '¡Picks guardados!', 'exito');
    setTimeout(() => renderMiQ(), 500);
  } catch(e){
    mostrarAlerta(al, 'Error al guardar.', 'error');
    console.error(e);
  }
  showLoader(false);
}

async function guardarPicks(){
  const al=document.getElementById('al-mq');
  picks=picks.slice(0,cfg.partidos.length);if(picks.some(p=>p===null)||picks.length<cfg.partidos.length){mostrarAlerta(al,'Debes pronosticar todos los partidos.','error');return;}
  showLoader(true);
  try{
    await updateDoc(doc(db,'jugadores',sesion.nombre.toLowerCase()),{picks:[...picks]});
    picks=new Array(cfg.partidos.length).fill(null);
    mostrarAlerta(al,'¡Quiniela guardada!','exito');
    setTimeout(()=>renderMiQ(),500);
  }catch(e){mostrarAlerta(al,'Error al guardar.','error');}
  showLoader(false);
}

async function editarQ(){
  const snap=await getDoc(doc(db,'jugadores',sesion.nombre.toLowerCase()));
  if(snap.exists()&&snap.data().picks)picks=[...snap.data().picks];
  await updateDoc(doc(db,'jugadores',sesion.nombre.toLowerCase()),{picks:null});
  renderMiQ();
}

// ── QUINIELAS ──
async function renderQuinielas(){
  if(!cfg)return;
  const cont=document.getElementById('cont-quinielas');
  // Verificar si el jugador está bloqueado
  const snapJug=await getDoc(doc(db,'jugadores',sesion.nombre.toLowerCase()));
  if(snapJug.exists()&&snapJug.data().bloqueado){
    cont.innerHTML=`<div class="bloqueado"><div style="font-size:36px;margin-bottom:10px;">🔒</div><div class="bloq-t">Acceso restringido</div><div class="bloq-s">El administrador ha reseteado tu quiniela.</div></div>`;
    return;
  }
  if(!cfg.publicado){
    cont.innerHTML=`<div class="bloqueado"><div style="font-size:36px;margin-bottom:10px;">🔒</div><div class="bloq-t">Quinielas ocultas</div><div class="bloq-s">El administrador publicará las quinielas cuando inicie la jornada.</div></div>`;
    return;
  }
  showLoader(true);
  try{
    const snaps=await getDocs(jugadoresC);
    const jugadores=[];snaps.forEach(d=>{if(d.data().picks)jugadores.push(d.data());});
    if(!jugadores.length){cont.innerHTML=`<div class="bloqueado"><div style="font-size:36px;margin-bottom:10px;">📋</div><div class="bloq-s">Nadie ha registrado su quiniela aún.</div></div>`;showLoader(false);return;}
    cont.innerHTML=jugadores.map((p,pi)=>{
      const{pts,pend}=calcPts(p.picks,cfg.resultados);const esYo=p.nombre===sesion.nombre;
      const items=cfg.partidos.map(([l,v],i)=>{
        const r=cfg.resultados[i];const ok=r!==null&&p.picks[i]===r;const mal=r!==null&&p.picks[i]!==r;
        const elegido=p.picks[i]==='L'?l:p.picks[i]==='V'?v:null;
        const eq=elegido?getEquipo(elegido):null;
        return `<div class="pick-item${ok?' pick-ok':mal?' pick-mal':''}">
          <span class="pick-partido" style="display:flex;align-items:center;gap:3px;flex-wrap:wrap;">${l} vs ${v}</span>
          <span class="p-opt p-${p.picks[i]}" style="display:flex;align-items:center;gap:2px;">${eq?`<img src="${eq.bandera}" style="width:13px;height:9px;object-fit:cover;border-radius:1px;" alt="">`:''} ${p.picks[i]==='E'?'E':eq?eq.nombre:p.picks[i]}</span>
        </div>`;
      }).join('');
      return `<div class="jugador-card"><div class="jc-h" onclick="window.togQ(${pi})">
        <span class="jc-nombre">${p.nombre}${esYo?' <span style="font-size:11px;color:var(--am);margin-left:6px;">(tú)</span>':''}</span>
        <div style="display:flex;gap:12px;align-items:center;"><div style="text-align:right;"><div class="jc-pts">${pts}</div><div class="jc-sub">${pend} pend.</div></div><span class="jc-arr" id="jarr-${pi}">▾</span></div>
      </div><div class="jc-body" id="jbody-${pi}"><div class="picks-grid">${items}</div></div></div>`;
    }).join('');
  }catch(e){cont.innerHTML=`<div class="bloqueado"><div class="bloq-s">Error al cargar.</div></div>`;}
  showLoader(false);
}

function togQ(pi){document.getElementById('jbody-'+pi).classList.toggle('visible');document.getElementById('jarr-'+pi).classList.toggle('open');}

// ── POSICIONES ──
async function renderPos(){
  if(!cfg)return;
  const cont=document.getElementById('cont-pos');
  showLoader(true);
  try{
    const snaps=await getDocs(jugadoresC);
    const jugadores=[];snaps.forEach(d=>{if(d.data().picks)jugadores.push(d.data());});
    if(!jugadores.length){cont.innerHTML=`<div class="bloqueado"><div style="font-size:36px;margin-bottom:10px;">🏆</div><div class="bloq-t">Sin jugadores aún</div><div class="bloq-s">Las posiciones aparecerán cuando los jugadores registren sus quinielas.</div></div>`;showLoader(false);return;}
    const totalPartidos=cfg.partidos.length;
  const ranking=jugadores.map(p=>{const{pts,pend,total}=calcPtsTotales(p);return{nombre:p.nombre,pts,pend,total};}).sort((a,b)=>b.pts-a.pts);
    const filas=ranking.map((r,i)=>{
      const esYo=r.nombre===sesion.nombre;const cls=i===0?'pos oro':i===1?'pos plata':i===2?'pos bronce':'pos';
      const pc=r.total>0?Math.round(r.pts/r.total*100):0;
      return `<tr class="${esYo?'yo-row':''}"><td class="${cls}">${i+1}</td><td style="font-weight:500;">${r.nombre}${esYo?' <span style="font-size:11px;color:var(--am);">(tú)</span>':''}</td>
      <td><span class="pts-badge">${r.pts}/${r.total}</span></td><td style="color:var(--tx3);font-size:12px;">${r.pend}</td>
      <td><div style="height:4px;background:var(--borde);border-radius:2px;overflow:hidden;min-width:60px;"><div style="height:100%;width:${pc}%;background:var(--vd);border-radius:2px;"></div></div></td></tr>`;
    }).join('');
    cont.innerHTML=`<div class="card"><table><thead><tr><th>#</th><th>Jugador</th><th>Aciertos</th><th>Pend.</th><th>Progreso</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }catch(e){cont.innerHTML=`<div class="bloqueado"><div class="bloq-s">Error al cargar.</div></div>`;}
  showLoader(false);
}

function calcPts(ps,res){
  const n=Math.min(ps.length,res.length,cfg?cfg.partidos.length:ps.length);
  let pts=0,pend=0;
  for(let i=0;i<n;i++){if(res[i]===null)pend++;else if(ps[i]===res[i])pts++;}
  return{pts,pend,total:n};
}

function calcPtsTotales(jugData){
  if(!cfg)return{pts:0,pend:0,total:0};
  let ptsTotal=0,totalPartidos=0,pendTotal=0;
  const historial=cfg.historial||{};
  // Sumar jornadas anteriores
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
  // Jornada actual
  const picksActual=jugData.picks;
  const res=cfg.resultados||[];
  const nAct=cfg.partidos.length;
  totalPartidos+=nAct;
  if(picksActual){
    const n=Math.min(picksActual.length,res.length,nAct);
    for(let i=0;i<n;i++){
      if(res[i]===null)pendTotal++;
      else if(picksActual[i]===res[i])ptsTotal++;
    }
    pendTotal+=nAct-Math.min(picksActual.length,nAct);
  } else {
    pendTotal+=nAct;
  }
  return{pts:ptsTotal,pend:pendTotal,total:totalPartidos};
}
function mostrarAlerta(el,msg,tipo){el.textContent=msg;el.className='alerta '+tipo+' visible';setTimeout(()=>el.classList.remove('visible'),3500);}
function mostrarErr(el,msg){el.textContent=msg;el.style.display='block';setTimeout(()=>el.style.display='none',3000);}

window.setTab=setTab;window.login=login;window.registrar=registrar;
window.cerrarSesion=cerrarSesion;window.irA=irA;
window.setPick=setPick;window.guardarPicks=guardarPicks;window.togQ=togQ;window.setPickNuevo=setPickNuevo;window.guardarPicksNuevos=guardarPicksNuevos;

if(sesion){
  getDoc(doc(db,'jugadores',sesion.nombre.toLowerCase())).then(snap=>{
    if(snap.exists()){entrarApp();}else{clearS();}
  });
}
