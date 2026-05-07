import { initializeApp }                from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getFirestore, collection,
         getDocs, getDoc, doc, setDoc,
         query, where, onSnapshot }     from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ── CONFIG FIREBASE ──
const firebaseConfig = {
  apiKey:            "AIzaSyBkOqWfEpPNDun1jHJNV0g1creQAUCdgMo",
  authDomain:        "quiniela-mundialista-202-bff2f.firebaseapp.com",
  projectId:         "quiniela-mundialista-202-bff2f",
  storageBucket:     "quiniela-mundialista-202-bff2f.firebasestorage.app",
  messagingSenderId: "366645558738",
  appId:             "1:366645558738:web:82c13047ea5151f6f2dc0b"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── PROTECCIÓN DE RUTA ──
const jugadorData = localStorage.getItem('jugador');
if (!jugadorData) window.location.href = 'jugador.html';
const jugador = JSON.parse(jugadorData);

// ── ESTADO GLOBAL ──
let seccionActiva = 'inicio';

// ── INIT ──
window.addEventListener('load', async () => {
  document.getElementById('navbar-username').textContent = jugador.nombre;
  document.getElementById('menu-username').textContent   = jugador.nombre;

  await cargarInicio();

  // Auto-refresh cada 30 segundos
  setInterval(async () => {
    if (seccionActiva === 'inicio') await cargarInicio();
  }, 30000);

  // Listeners en tiempo real
  iniciarPrediccionesListener();
  iniciarConfigListener();
  iniciarTimerLimite();
  iniciarTimerAparicion();
});

// ══════════════════════════════
// BANNER Y BADGES TIEMPO REAL
// ══════════════════════════════
let bannerListener  = null;
let badgesListener  = null;
let configListener  = null;
let limiteTimer     = null;

function iniciarConfigListener() {
  if (configListener) { configListener(); configListener = null; }

  // Escuchar cambios en config de las 3 jornadas
  ['jornada1','jornada2','jornada3'].forEach(jornada => {
    onSnapshot(doc(db, 'config', `fechaLimite_${jornada}`), () => {
      if (seccionActiva === 'miquiniela') {
        const modoKey = `_modoEdicion${jornada.charAt(0).toUpperCase() + jornada.slice(1)}`;
        window[modoKey] = false;
        cargarMiQuiniela();
      }
      iniciarTimerLimite();
    });
  });

  // Escuchar cambios en aparición de J2 y J3
  ['jornada2','jornada3'].forEach(jornada => {
    onSnapshot(doc(db, 'config', `aparicion_${jornada}`), () => {
      if (seccionActiva === 'miquiniela') cargarMiQuiniela();
      iniciarTimerAparicion();
    });
  });
}

function iniciarTimerAparicion() {
  ['jornada2','jornada3'].forEach(jornada => {
    getDoc(doc(db, 'config', `aparicion_${jornada}`)).then(snap => {
      if (!snap.exists()) return;
      const aparece = new Date(snap.data().fecha + 'T' + snap.data().hora + ':00');
      const ahora   = new Date();
      const ms      = aparece - ahora;
      if (ms > 0) {
        setTimeout(() => {
          if (seccionActiva === 'miquiniela') cargarMiQuiniela();
        }, ms);
      }
    }).catch(e => console.error(e));
  });
}

function iniciarTimerLimite() {
  if (limiteTimer) { clearTimeout(limiteTimer); limiteTimer = null; }

  ['jornada1','jornada2','jornada3'].forEach(jornada => {
    getDoc(doc(db, 'config', `fechaLimite_${jornada}`)).then(snap => {
      if (!snap.exists()) return;
      const limite = new Date(snap.data().fecha + 'T' + snap.data().hora + ':00');
      const ahora  = new Date();
      const msRestantes = limite - ahora;

      if (msRestantes > 0) {
        setTimeout(() => {
          const modoKey = `_modoEdicion${jornada.charAt(0).toUpperCase() + jornada.slice(1)}`;
          window[modoKey] = false;
          if (seccionActiva === 'miquiniela') {
            const contenedor = document.getElementById('quiniela-contenido');
            if (contenedor) {
              const aviso = document.createElement('div');
              aviso.className = 'reset-msg error';
              aviso.textContent = `⏰ El tiempo límite de Jornada ${jornada.slice(-1)} ha terminado. Se conservaron tus picks guardados.`;
              aviso.style.margin = '0 1.25rem 1rem';
              contenedor.prepend(aviso);
              setTimeout(() => aviso.remove(), 4000);
            }
            cargarMiQuiniela();
          }
        }, msRestantes);
      }
    }).catch(e => console.error(e));
  });
}

function iniciarBannerTiempoReal() {
  if (bannerListener) { bannerListener(); bannerListener = null; }
  if (badgesListener) { badgesListener(); badgesListener = null; }

  // Listener 1: Banner resumen (quiniela-resumen)
  bannerListener = onSnapshot(collection(db, 'resultados'), async (resSnap) => {
    const totalRes      = resSnap.size;
    const totalPartidos = 104;
    const pendientes    = Math.max(0, totalPartidos - totalRes);

    const resMap = {};
    resSnap.docs.forEach(d => { resMap[(d.data().partidoId || '').toLowerCase()] = d.data().lev; });

    let aciertos = 0;
    try {
      const predSnap = await getDocs(query(
        collection(db, 'predicciones'),
        where('jugadorId', '==', jugador.id || '')
      ));
      predSnap.docs.forEach(d => {
        const { partidoId, pick } = d.data();
        if (resMap[(partidoId || '').toLowerCase()] === pick) aciertos++;
      });
    } catch(e) { console.error(e); }

    // Actualizar banner principal
    const resumen = document.getElementById('quiniela-resumen');
    if (resumen) {
      resumen.textContent = `Total acumulado: ${aciertos} aciertos de ${totalRes} partidos · ${pendientes} pendientes`;
    }

    // Actualizar badges por jornada
    const resJ = { jornada1: 0, jornada2: 0, jornada3: 0 };
    const resMapJ = { jornada1: {}, jornada2: {}, jornada3: {} };
    resSnap.docs.forEach(d => {
      const data = d.data();
      const jornada = data.jornada;
      if (resJ[jornada] !== undefined) {
        resJ[jornada]++;
        resMapJ[jornada][(data.partidoId || '').toLowerCase()] = data.lev;
      }
    });

    try {
      const predSnap = await getDocs(query(
        collection(db, 'predicciones'),
        where('jugadorId', '==', jugador.id || '')
      ));

      const aciertosJ = { jornada1: 0, jornada2: 0, jornada3: 0 };
      predSnap.docs.forEach(d => {
        const { partidoId, pick, jornada } = d.data();
        const res = resMapJ[jornada]?.[(partidoId || '').toLowerCase()];
        if (res && res === pick) aciertosJ[jornada]++;
      });

      // Actualizar cada badge visible
      ['jornada1', 'jornada2', 'jornada3'].forEach(j => {
        const badge = document.getElementById(`badge-aciertos-${j}`);
        if (badge) {
          const total = resJ[j] > 0 ? resJ[j] : PARTIDOS_MUNDIAL[j]?.length || 24;
          badge.textContent = `${aciertosJ[j]}/${total} aciertos`;
        }
      });

      // Si está en Mi quiniela con vista compacta, recargar para mostrar ✓/✗
      if (seccionActiva === 'miquiniela' && !window._modoEdicionJornada1) {
        clearTimeout(window._resultadosTimer);
        window._resultadosTimer = setTimeout(() => cargarMiQuiniela(), 500);
      }
    } catch(e) { console.error(e); }
  });
}

let prediccionesListener = null;
let totalPicksGuardados  = 0;
let debounceTimer        = null;
let inicioListener       = null;

function iniciarPrediccionesListener() {
  if (prediccionesListener) { prediccionesListener(); prediccionesListener = null; }

  prediccionesListener = onSnapshot(
    query(collection(db, 'predicciones'), where('jugadorId', '==', jugador.id || '')),
    (snap) => {
      const nuevoTotal = snap.size;

      // Actualizar sección inicio en tiempo real
      if (seccionActiva === 'inicio') cargarInicio();

      // Solo recargar Mi quiniela si picks disminuyeron (admin reseteó)
      if (nuevoTotal < totalPicksGuardados && seccionActiva === 'miquiniela') {
        // Resetear modo edición de todas las jornadas
        window._modoEdicionJornada1 = false;
        window._modoEdicionJornada2 = false;
        window._modoEdicionJornada3 = false;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => cargarMiQuiniela(), 300);
      }
      totalPicksGuardados = nuevoTotal;
    }
  );
}

window.toggleMenu = function() {
  document.getElementById('menu-lateral').classList.toggle('open');
  document.getElementById('menu-overlay').classList.toggle('open');
  document.getElementById('btn-hamburguesa').classList.toggle('open');
};

window.cerrarMenu = function() {
  document.getElementById('menu-lateral').classList.remove('open');
  document.getElementById('menu-overlay').classList.remove('open');
  document.getElementById('btn-hamburguesa').classList.remove('open');
};

window.cerrarSesion = function() {
  localStorage.removeItem('jugador');
  window.location.href = 'jugador.html';
};

window.cambiarSeccion = function(nombre, desdeMobil = false) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('sec-' + nombre).classList.add('active');

  const tabD = document.getElementById('tab-' + nombre);
  if (tabD) tabD.classList.add('active');
  const tabM = document.getElementById('tab-m-' + nombre);
  if (tabM) tabM.classList.add('active');

  if (desdeMobil) cerrarMenu();

  seccionActiva = nombre;
  if (nombre === 'inicio')      cargarInicio();
  if (nombre === 'miquiniela')  { iniciarBannerTiempoReal(); cargarMiQuiniela(); }
};

// ══════════════════════════════
// INICIO
// ══════════════════════════════
// ══════════════════════════════
// MI QUINIELA
// ══════════════════════════════
window.cargarMiQuiniela = async function() {
  const contenedor = document.getElementById('quiniela-contenido');
  contenedor.innerHTML = `<div class="text-center py-4" style="color:var(--text-muted);">Cargando...</div>`;

  try {
    // Traer config de fechas límite, predicciones y resultados en paralelo
    const [cfgJ1, cfgJ2, cfgJ3, predSnap, resJ1, resJ2, resJ3, aparJ2, aparJ3] = await Promise.all([
      getDoc(doc(db, 'config', 'fechaLimite_jornada1')),
      getDoc(doc(db, 'config', 'fechaLimite_jornada2')),
      getDoc(doc(db, 'config', 'fechaLimite_jornada3')),
      getDocs(query(collection(db, 'predicciones'), where('jugadorId', '==', jugador.id || ''))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada1'))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada2'))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada3'))),
      getDoc(doc(db, 'config', 'aparicion_jornada2')),
      getDoc(doc(db, 'config', 'aparicion_jornada3')),
    ]);

    // Mapa de predicciones del jugador
    const picksMap = {};
    predSnap.docs.forEach(d => { picksMap[d.data().partidoId] = d.data().pick; });

    // Calcular aciertos
    const resMap = {};
    [resJ1, resJ2, resJ3].forEach(snap => {
      snap.docs.forEach(d => { resMap[d.data().partidoId] = d.data().lev; });
    });

    const totalPicks    = predSnap.size;
    const totalRes      = resJ1.size + resJ2.size + resJ3.size;
    let   totalAciertos = 0;
    predSnap.docs.forEach(d => {
      const { partidoId, pick } = d.data();
      if (resMap[partidoId] && resMap[partidoId] === pick) totalAciertos++;
    });

    // Banner resumen
    const totalPartidos = 104;
    const pendientes    = Math.max(0, totalPartidos - totalRes);
    document.getElementById('quiniela-resumen').textContent =
      `Total acumulado: ${totalAciertos} aciertos de ${totalRes} partidos · ${pendientes} pendientes`;

    // Fechas límite por jornada
    const limites = {
      jornada1: cfgJ1.exists() ? new Date(cfgJ1.data().fecha + 'T' + cfgJ1.data().hora + ':00') : null,
      jornada2: cfgJ2.exists() ? new Date(cfgJ2.data().fecha + 'T' + cfgJ2.data().hora + ':00') : null,
      jornada3: cfgJ3.exists() ? new Date(cfgJ3.data().fecha + 'T' + cfgJ3.data().hora + ':00') : null,
    };

    const ahora = new Date();

    // Fecha de aparición por jornada
    const aparicion = {
      jornada1: true,
      jornada2: aparJ2.exists() && ahora >= new Date(aparJ2.data().fecha + 'T' + aparJ2.data().hora + ':00'),
      jornada3: aparJ3.exists() && ahora >= new Date(aparJ3.data().fecha + 'T' + aparJ3.data().hora + ':00'),
    };

    const resSnaps = { jornada1: resJ1, jornada2: resJ2, jornada3: resJ3 };

    // Picks y aciertos por jornada
    const picksJ    = { jornada1: 0, jornada2: 0, jornada3: 0 };
    const aciertosJ = { jornada1: 0, jornada2: 0, jornada3: 0 };
    const resMapAll = {};
    [resJ1, resJ2, resJ3].forEach(snap => {
      snap.docs.forEach(d => { resMapAll[(d.data().partidoId||'').toLowerCase()] = d.data(); });
    });
    predSnap.docs.forEach(d => {
      const { partidoId, pick, jornada } = d.data();
      if (picksJ[jornada] !== undefined) picksJ[jornada]++;
      const res = resMapAll[(partidoId||'').toLowerCase()];
      if (res && res.lev === pick) aciertosJ[jornada]++;
    });

    let html = '';

    ['jornada1', 'jornada2', 'jornada3'].forEach((jornada, idx) => {
      if (!aparicion[jornada]) return;

      const num        = idx + 1;
      const limite     = limites[jornada];
      const bloqueado  = limite ? ahora > limite : false;
      const partidos   = PARTIDOS_MUNDIAL[jornada] || [];
      const resSnap    = resSnaps[jornada];
      const tienePicks = picksJ[jornada] > 0;
      const aciertos   = aciertosJ[jornada];
      const resJornada = resSnap.size;
      const modoKey    = `_modoEdicion${jornada.charAt(0).toUpperCase() + jornada.slice(1)}`;
      const enModoEdicion = !tienePicks || window[modoKey] === true;
      const contraido  = tienePicks && !enModoEdicion;

      const resMapJ = {};
      resSnap.docs.forEach(d => { resMapJ[(d.data().partidoId||'').toLowerCase()] = d.data().lev; });

      const limiteTexto = limite
        ? `⏰ Cierra: ${limite.toLocaleDateString('es-MX')} ${limite.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}`
        : '⏰ Sin fecha límite definida';

      const titulo = resJornada >= partidos.length
        ? `Jornada ${num} — FINALIZADA`
        : tienePicks ? `Jornada ${num} — EN CURSO`
        : `Jornada ${num} — Llena tus picks`;

      html += `
        <div class="jornada-picks-card" id="card-${jornada}">
          <div class="jornada-picks-header" onclick="toggleJornada('${jornada}')" style="cursor:pointer;">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="jornada-picks-titulo">🌐 ${titulo}</span>
              ${tienePicks ? `<span class="jornada-aciertos-badge" id="badge-aciertos-${jornada}">${aciertos}/${resJornada > 0 ? resJornada : partidos.length} aciertos</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              ${!bloqueado && enModoEdicion && !tienePicks ? `<button class="btn-seleccion-auto" onclick="event.stopPropagation();seleccionAutomatica('${jornada}')">🎲 Selección automática</button>` : ''}
              ${!bloqueado && tienePicks && !enModoEdicion ? `<button class="btn-modificar" onclick="event.stopPropagation();activarModoEdicion('${jornada}')">✏️ Modificar quiniela</button>` : ''}
              ${!bloqueado && enModoEdicion && tienePicks ? `<button class="btn-seleccion-auto" onclick="event.stopPropagation();seleccionAutomatica('${jornada}')">🎲 Selección automática</button>` : ''}
              <span class="jornada-toggle-icon" id="icon-${jornada}">${contraido ? '▼' : '▲'}</span>
            </div>
          </div>
          <div class="jornada-picks-body${contraido ? ' contraido' : ''}" id="body-${jornada}">`;

      if (tienePicks && !enModoEdicion) {
        partidos.forEach((p, i) => {
          const flagLocal  = BANDERAS[p.local]    || 'un';
          const flagVisit  = BANDERAS[p.visitante] || 'un';
          const pick       = picksMap[p.id] || '';
          const resReal    = resMapJ[p.id.toLowerCase()];
          const acerto     = resReal && pick && resReal === pick;
          const fallo      = resReal && pick && resReal !== pick;
          const flagPick   = pick === 'L' ? flagLocal : pick === 'V' ? flagVisit : null;
          const nombrePick = pick === 'L' ? p.local : pick === 'V' ? p.visitante : 'Empate';
          let resultadoIcon = '';
          if (acerto)     resultadoIcon = `<span class="pick-resultado acerto">✓</span>`;
          else if (fallo) resultadoIcon = `<span class="pick-resultado fallo">✗</span>`;

          html += `
            <div class="pick-compacto">
              <table class="pick-compacto-tabla"><tr>
                <td class="pick-td-num">${i + 1}</td>
                <td class="pick-td-local"><div class="inner"><img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm"><span class="pick-compacto-nombre">${p.local}</span></div></td>
                <td class="pick-td-vs">vs</td>
                <td class="pick-td-visit"><div class="inner"><img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera-sm"><span class="pick-compacto-nombre">${p.visitante}</span></div></td>
                <td class="pick-td-sel">
                  <span class="pick-compacto-sel ${pick === 'E' ? 'empate' : pick === 'L' ? 'local' : 'visita'}">
                    ${flagPick ? `<img src="https://flagcdn.com/24x18/${flagPick}.png" class="bandera-sm">` : ''}
                    <span class="${pick === 'E' ? '' : 'pick-sel-nombre'}">${nombrePick}</span>
                    ${resultadoIcon}
                  </span>
                </td>
                <td class="pick-td-fecha">
                  <span class="estado-fecha-hora">${p.fecha} · ${p.hora}</span>
                  <span class="estado-estadio">${p.estadio}</span>
                </td>
              </tr></table>
            </div>`;
        });
      } else {
        html += `
          <div class="jornada-picks-sub">
            <span>Selecciona el equipo ganador o empate</span>
            <span class="fecha-limite-badge ${!bloqueado ? 'ok' : ''}">${limiteTexto}</span>
          </div>`;

        partidos.forEach((p, i) => {
          const flagLocal = BANDERAS[p.local]    || 'un';
          const flagVisit = BANDERAS[p.visitante] || 'un';
          const pick      = picksMap[p.id] || '';

          html += `
            <div class="partido-pick">
              <div class="partido-pick-num">Partido ${i + 1} · Grupo ${p.grupo} · ${p.fecha} ${p.hora}</div>
              <div class="partido-pick-equipos">
                <div class="partido-pick-local"><span>${p.local}</span><img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm"></div>
                <span class="partido-pick-vs">VS</span>
                <div class="partido-pick-visit"><img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera-sm"><span>${p.visitante}</span></div>
              </div>
              <div class="pick-btns">
                <button class="btn-pick local ${pick==='L'?'seleccionado local':''}" id="pick-l-${p.id}" onclick="setPick('${p.id}','L','${jornada}')" ${bloqueado?'disabled':''}>
                  <img src="https://flagcdn.com/16x12/${flagLocal}.png" style="width:16px;height:12px;border-radius:1px;flex-shrink:0">
                  <span class="pick-nombre">Gana ${p.local}</span><span class="pick-nombre-corto">L</span>
                </button>
                <button class="btn-pick empate ${pick==='E'?'seleccionado empate':''}" id="pick-e-${p.id}" onclick="setPick('${p.id}','E','${jornada}')" ${bloqueado?'disabled':''}>
                  <span class="pick-nombre">Empate</span><span class="pick-nombre-corto">E</span>
                </button>
                <button class="btn-pick visita ${pick==='V'?'seleccionado visita':''}" id="pick-v-${p.id}" onclick="setPick('${p.id}','V','${jornada}')" ${bloqueado?'disabled':''}>
                  <img src="https://flagcdn.com/16x12/${flagVisit}.png" style="width:16px;height:12px;border-radius:1px;flex-shrink:0">
                  <span class="pick-nombre">Gana ${p.visitante}</span><span class="pick-nombre-corto">V</span>
                </button>
              </div>
            </div>`;
        });

        if (bloqueado) {
          html += `<div class="picks-bloqueado">🔒 Esta jornada ya no acepta modificaciones</div>`;
        } else {
          html += `
            <div style="padding: 1rem 1.25rem;">
              <button class="btn-guardar-quiniela" id="btn-guardar-${jornada}" onclick="guardarPicks('${jornada}')">💾 Guardar predicciones</button>
              <div class="picks-msg" id="picks-msg-${jornada}"></div>
            </div>`;
        }
      }

      html += `</div></div>`;
    });

    contenedor.innerHTML = html;

  } catch(e) {
    console.error(e);
    contenedor.innerHTML = `<div class="text-center py-4" style="color:#ff6b7a;">Error al cargar. Intenta de nuevo.</div>`;
  }
};

// ── MODO EDICION ──
window.activarModoEdicion = function(jornada) {
  const modoKey = `_modoEdicion${jornada.charAt(0).toUpperCase() + jornada.slice(1)}`;
  window[modoKey] = true;
  cargarMiQuiniela();
};
window.toggleJornada = function(jornada) {
  const body = document.getElementById(`body-${jornada}`);
  const icon = document.getElementById(`icon-${jornada}`);
  if (!body) return;
  body.classList.toggle('contraido');
  icon.textContent = body.classList.contains('contraido') ? '▼' : '▲';
};
window.setPick = function(partidoId, pick, jornada) {
  ['L','E','V'].forEach(t => {
    const btn = document.getElementById(`pick-${t.toLowerCase()}-${partidoId}`);
    if (!btn) return;
    btn.classList.remove('seleccionado', 'local', 'empate', 'visita');
    if (t === pick) {
      btn.classList.add('seleccionado', t === 'L' ? 'local' : t === 'E' ? 'empate' : 'visita');
    }
  });
};

// ── SELECCIÓN AUTOMÁTICA ──
window.seleccionAutomatica = function(jornada) {
  const partidos = PARTIDOS_MUNDIAL[jornada] || [];
  partidos.forEach(p => {
    const opciones = ['L', 'E', 'V'];
    const random   = opciones[Math.floor(Math.random() * 3)];
    window.setPick(p.id, random, jornada);
  });
};

// ── GUARDAR PICKS ──
window.guardarPicks = async function(jornada) {
  const btn = document.getElementById(`btn-guardar-${jornada}`);
  const msg = document.getElementById(`picks-msg-${jornada}`);
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    const partidos = PARTIDOS_MUNDIAL[jornada] || [];
    let guardados  = 0;

    for (const p of partidos) {
      const btnL = document.getElementById(`pick-l-${p.id}`);
      const btnE = document.getElementById(`pick-e-${p.id}`);
      const btnV = document.getElementById(`pick-v-${p.id}`);

      const pick = btnL?.classList.contains('seleccionado') ? 'L'
                 : btnE?.classList.contains('seleccionado') ? 'E'
                 : btnV?.classList.contains('seleccionado') ? 'V'
                 : null;

      if (pick) {
        await setDoc(doc(db, 'predicciones', `${jugador.id}_${p.id}`), {
          jugadorId:  jugador.id,
          jugadorNombre: jugador.nombre,
          partidoId:  p.id,
          jornada,
          pick,
          guardadoEn: new Date()
        });
        guardados++;
      }
    }

    msg.className   = 'picks-msg exito';
    msg.textContent = `✅ ${guardados} predicciones guardadas correctamente.`;
    btn.textContent = 'Guardar predicciones';
    btn.disabled    = false;

    // Desactivar modo edición y recargar
    const modoKey = `_modoEdicion${jornada.charAt(0).toUpperCase() + jornada.slice(1)}`;
    window[modoKey] = false;
    setTimeout(() => cargarMiQuiniela(), 800);

  } catch(e) {
    console.error(e);
    msg.className   = 'picks-msg error';
    msg.textContent = '❌ Error al guardar. Intenta de nuevo.';
    btn.textContent = 'Guardar predicciones';
    btn.disabled    = false;
  }
};

// ══════════════════════════════
// INICIO
// ══════════════════════════════
window.cargarInicio = async function() {
  try {
    // Traer todo en paralelo
    const [resJ1, resJ2, resJ3, predSnap] = await Promise.all([
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada1'))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada2'))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada3'))),
      getDocs(query(collection(db, 'predicciones'), where('jugadorId', '==', jugador.id || '')))
    ]);

    const totalResultados = resJ1.size + resJ2.size + resJ3.size;
    const totalPartidos   = 104;
    const porJugar        = Math.max(0, totalPartidos - totalResultados);

    document.getElementById('stat-partidos').textContent   = totalPartidos;
    document.getElementById('stat-resultados').textContent = totalResultados;
    document.getElementById('stat-porjugar').textContent   = porJugar;

    // Verificar si tiene quiniela
    const tieneQuiniela = predSnap.size > 0;
    document.getElementById('bienvenido-sub').textContent = tieneQuiniela
      ? 'Tu quiniela está registrada ✓'
      : 'Aún no has registrado tu quiniela';
    document.getElementById('bienvenido-sub').style.color = tieneQuiniela ? '#6fe0a8' : '#ff6b7a';

    // Si no tiene quiniela mostrar mensaje, si tiene mostrar partidos
    if (!tieneQuiniela) {
      document.getElementById('lista-partidos').innerHTML = `
        <div class="text-center py-5">
          <div style="font-size:2.5rem; margin-bottom:0.75rem;">⚽</div>
          <div style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; letter-spacing:1.5px; color:#fff; margin-bottom:0.4rem;">¡Llena tu quiniela!</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Ve a <span style="color:var(--gold); cursor:pointer; font-weight:700;" onclick="cambiarSeccion('miquiniela')">Mi quiniela</span> para hacer tus pronósticos.</div>
        </div>`;
      return;
    }

    // Determinar jornada activa
    const jornada = resJ1.size < 24 ? 'jornada1' : resJ2.size < 24 ? 'jornada2' : 'jornada3';
    const labelJ  = jornada === 'jornada1' ? 'Jornada 1' : jornada === 'jornada2' ? 'Jornada 2' : 'Jornada 3';

    // Actualizar título
    const tituloEl = document.getElementById('inicio-jornada-titulo');
    if (tituloEl) tituloEl.textContent = `Partidos — ${labelJ}`;

    // Mapas de resultados
    const resMapJ1 = {}, resMapJ2 = {}, resMapJ3 = {};
    resJ1.docs.forEach(d => { resMapJ1[(d.data().partidoId||'').toLowerCase()] = d.data(); });
    resJ2.docs.forEach(d => { resMapJ2[(d.data().partidoId||'').toLowerCase()] = d.data(); });
    resJ3.docs.forEach(d => { resMapJ3[(d.data().partidoId||'').toLowerCase()] = d.data(); });

    const resActiva = jornada === 'jornada1' ? resMapJ1 : jornada === 'jornada2' ? resMapJ2 : resMapJ3;
    const sizes     = { jornada1: resJ1.size, jornada2: resJ2.size, jornada3: resJ3.size };

    // Banners jornadas finalizadas fuera de la card
    let bannersHtml = '';
    for (const j of ['jornada1', 'jornada2', 'jornada3']) {
      if (j === jornada || sizes[j] === 0) continue;
      const label = j === 'jornada1' ? 'Jornada 1' : j === 'jornada2' ? 'Jornada 2' : 'Jornada 3';
      const resMapJ = j === 'jornada1' ? resMapJ1 : j === 'jornada2' ? resMapJ2 : resMapJ3;

      bannersHtml += `
        <div class="banner-jornada-fin mb-2" id="banner-inicio-${j}">
          <div class="banner-jornada-header" onclick="toggleBannerInicio('${j}')">
            <span class="banner-jornada-titulo">${label} — Finalizada</span>
            <span class="banner-jornada-sub">${sizes[j]}/24 resultados</span>
            <span class="banner-jornada-arrow" id="arrow-inicio-${j}">▼</span>
          </div>
          <div class="banner-jornada-body" id="body-inicio-${j}" style="display:none;">
            ${renderPartidosJornadaHtml(j, resMapJ)}
          </div>
        </div>`;
    }
    const bannersEl = document.getElementById('banners-inicio');
    if (bannersEl) bannersEl.innerHTML = bannersHtml;

    // Jornada activa en lista-partidos
    document.getElementById('lista-partidos').innerHTML = '<div id="lista-partidos-activa"></div>';
    renderPartidosJornada(jornada, resActiva);

  } catch(e) {
    console.error('Error cargarInicio:', e);
  }
}

function renderPartidosJornada(jornada, resMap) {
  const contenedor = document.getElementById('lista-partidos-activa');
  if (!contenedor) return;
  contenedor.innerHTML = renderPartidosJornadaHtml(jornada, resMap);
}

function renderPartidosJornadaHtml(jornada, resMap) {
  const partidos = PARTIDOS_MUNDIAL[jornada] || [];
  let num  = 1;
  let html = '';

  partidos.forEach(p => {
    const flagLocal = BANDERAS[p.local]    || 'un';
    const flagVisit = BANDERAS[p.visitante] || 'un';
    const res       = resMap[p.id.toLowerCase()];
    const tieneRes  = res && res.lev;

    let resultadoHtml = '';
    if (tieneRes) {
      resultadoHtml = `
        <div class="estado-resultado ${res.lev === 'E' ? 'empate' : ''}">
          ${res.lev !== 'E' ? `<img src="https://flagcdn.com/16x12/${res.lev === 'L' ? flagLocal : flagVisit}.png" class="bandera-sm">` : '<span>Empate</span>'}
          <span class="estado-res-nombre">${res.lev === 'L' ? p.local : res.lev === 'V' ? p.visitante : ''}</span>
          <span class="estado-check">✓</span>
        </div>`;
    } else {
      resultadoHtml = `<div class="estado-pendiente">—</div>`;
    }

    html += `
      <div class="estado-row ${tieneRes ? 'con-resultado' : ''}">
        <table class="estado-tabla">
          <tr>
            <td class="estado-td-num">${num++}</td>
            <td class="estado-td-local">
              <div class="inner">
                <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm">
                <span class="estado-nombre">${p.local}</span>
              </div>
            </td>
            <td class="estado-td-vs">vs</td>
            <td class="estado-td-visit">
              <div class="inner">
                <img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera-sm">
                <span class="estado-nombre">${p.visitante}</span>
              </div>
            </td>
            <td class="estado-td-res">${resultadoHtml}</td>
            <td class="estado-td-fecha">
              <span class="estado-fecha-hora">${p.fecha} · ${p.hora}</span>
              <span class="estado-estadio">${p.estadio}</span>
            </td>
          </tr>
        </table>
      </div>`;
  });

  return html;
}

window.toggleBannerInicio = function(jornada) {
  const body  = document.getElementById(`body-inicio-${jornada}`);
  const arrow = document.getElementById(`arrow-inicio-${jornada}`);
  if (!body) return;
  const visible = body.style.display !== 'none';
  body.style.display  = visible ? 'none' : 'block';
  arrow.textContent   = visible ? '▼' : '▲';
};