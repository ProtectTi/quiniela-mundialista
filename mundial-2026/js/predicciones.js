import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import { db } from "./firebase/config.js";

import {
  animarNumero
} from "./utils/animations.js";

import {
  showToast
} from "./utils/toasts.js";

import {
  getFlag,
  getModoKey,
  getLabelJornada,
  getFechaConfig,
  formatearFechaLimite,
  escapeHtml
} from "./utils/helpers.js";

// ── PROTECCIÓN DE RUTA ──
const jugadorData = localStorage.getItem('jugador');

if (!jugadorData) {
  window.location.href = 'jugador.html';
}

let jugador = null;

try {
  jugador = JSON.parse(jugadorData);
} catch (e) {
  localStorage.removeItem('jugador');
  window.location.href = 'jugador.html';
}

if (!jugador || !jugador.id || !jugador.nombre) {
  localStorage.removeItem('jugador');
  window.location.href = 'jugador.html';
}

// ── ESTADO GLOBAL ──
let seccionActiva = 'inicio';
const guardandoPicks = {};

// ── HELPERS GENERALES ──
const JORNADAS = ['jornada1', 'jornada2', 'jornada3'];
const TOTAL_PARTIDOS_MUNDIAL = 72; // Fase de grupos (3 jornadas × 24 partidos)

function crearMapaResultados(snap, valor = 'lev') {
  const mapa = {};
  snap.docs.forEach(d => {
    const data = d.data();
    mapa[(data.partidoId || '').toLowerCase()] = valor ? data[valor] : data;
  });
  return mapa;
}

function crearMapaPicks(predSnap) {
  const mapa = {};
  predSnap.docs.forEach(d => {
    mapa[d.data().partidoId] = d.data().pick;
  });
  return mapa;
}

// ── INIT ──
window.addEventListener('load', async () => {
  document.getElementById('navbar-username').textContent = jugador.nombre;
  document.getElementById('menu-username').textContent   = jugador.nombre;

  await cargarInicio();

  iniciarInicioRealtime();

  iniciarPrediccionesListener();
  iniciarConfigListener();
  iniciarTimerLimite();
  iniciarTimerAparicion();
  showToast('✅ Sistema listo', 'success');
});


// ══════════════════════════════
// INICIO — REALTIME
// ══════════════════════════════
let unsubscribeInicio = [];
let inicioRenderTimer = null;

function detenerInicioRealtime() {
  unsubscribeInicio.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribeInicio = [];
}

function programarRenderInicio() {
  clearTimeout(inicioRenderTimer);

  inicioRenderTimer = setTimeout(() => {
    if (seccionActiva === 'inicio') {
      cargarInicio();
    }
  }, 250);
}

function iniciarInicioRealtime() {
  detenerInicioRealtime();

  unsubscribeInicio.push(
    onSnapshot(collection(db, 'resultados'), programarRenderInicio)
  );

  unsubscribeInicio.push(
    onSnapshot(
      query(collection(db, 'predicciones'), where('jugadorId', '==', jugador.id || '')),
      programarRenderInicio
    )
  );
}

// ══════════════════════════════
// BANNER Y BADGES TIEMPO REAL
// ══════════════════════════════
let bannerListener  = null;
let badgesListener  = null;
let configListener  = null;
let limiteTimer     = null;

function iniciarConfigListener() {
  if (configListener) {
    configListener();
    configListener = null;
  }

  JORNADAS.forEach(jornada => {
    onSnapshot(doc(db, 'config', `fechaLimite_${jornada}`), () => {
      if (seccionActiva === 'miquiniela') {
        const modoKey = getModoKey(jornada);
        window[modoKey] = false;
        cargarMiQuiniela();
      }
      iniciarTimerLimite();
    });
  });

  ['jornada2', 'jornada3'].forEach(jornada => {
    onSnapshot(doc(db, 'config', `aparicion_${jornada}`), () => {
      if (seccionActiva === 'miquiniela') cargarMiQuiniela();
      iniciarTimerAparicion();
    });
  });
}

function iniciarTimerAparicion() {
  ['jornada2', 'jornada3'].forEach(jornada => {
    getDoc(doc(db, 'config', `aparicion_${jornada}`))
      .then(snap => {
        if (!snap.exists()) return;

        const aparece = getFechaConfig(snap.data());
        const ahora   = new Date();
        const ms      = aparece - ahora;

        if (ms > 0) {
          setTimeout(() => {
            if (seccionActiva === 'miquiniela') cargarMiQuiniela();
          }, ms);
        }
      })
      .catch(e => console.error(e));
  });
}

function iniciarTimerLimite() {
  if (limiteTimer) {
    clearTimeout(limiteTimer);
    limiteTimer = null;
  }

  JORNADAS.forEach(jornada => {
    getDoc(doc(db, 'config', `fechaLimite_${jornada}`))
      .then(snap => {
        if (!snap.exists()) return;

        const limite = getFechaConfig(snap.data());
        const ahora  = new Date();
        const msRestantes = limite - ahora;

        if (msRestantes > 0) {
          setTimeout(() => {
            const modoKey = getModoKey(jornada);
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
      })
      .catch(e => console.error(e));
  });
}

function iniciarBannerTiempoReal() {
  if (bannerListener) {
    bannerListener();
    bannerListener = null;
  }

  if (badgesListener) {
    badgesListener();
    badgesListener = null;
  }

  bannerListener = onSnapshot(collection(db, 'resultados'), async (resSnap) => {
    const totalRes   = resSnap.size;
    const pendientes = Math.max(0, TOTAL_PARTIDOS_MUNDIAL - totalRes);

    const resMap = {};
    resSnap.docs.forEach(d => {
      resMap[(d.data().partidoId || '').toLowerCase()] = d.data().lev;
    });

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
    } catch (e) {
      console.error(e);
    }

    const resumen = document.getElementById('quiniela-resumen');
    if (resumen) {
      resumen.textContent = `Total acumulado: ${aciertos} aciertos de ${totalRes} partidos · ${pendientes} pendientes`;
    }

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

      JORNADAS.forEach(j => {
        const badge = document.getElementById(`badge-aciertos-${j}`);

        if (badge) {
          const total = resJ[j] > 0 ? resJ[j] : PARTIDOS_MUNDIAL[j]?.length || 24;
          badge.textContent = `${aciertosJ[j]}/${total} aciertos`;
        }
      });

      if (seccionActiva === 'miquiniela' && !window._modoEdicionJornada1) {
        clearTimeout(window._resultadosTimer);
        window._resultadosTimer = setTimeout(() => cargarMiQuiniela(), 500);
      }
    } catch (e) {
      console.error(e);
    }
  });
}

let prediccionesListener = null;
let totalPicksGuardados  = 0;
let debounceTimer        = null;
let inicioListener       = null;

function iniciarPrediccionesListener() {
  if (prediccionesListener) {
    prediccionesListener();
    prediccionesListener = null;
  }

  prediccionesListener = onSnapshot(
    query(collection(db, 'predicciones'), where('jugadorId', '==', jugador.id || '')),
    (snap) => {
      const nuevoTotal = snap.size;

      if (seccionActiva === 'inicio') cargarInicio();

      if (nuevoTotal < totalPicksGuardados && seccionActiva === 'miquiniela') {
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

// ══════════════════════════════
// MENU / NAVEGACIÓN
// ══════════════════════════════
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

  if (nombre === 'inicio') cargarInicio();

  if (nombre === 'miquiniela') {
    iniciarBannerTiempoReal();
    cargarMiQuiniela();
  }

  if (nombre === 'quinielas') {
    cargarQuinielas();
  }

  if (nombre === 'posiciones') {
  cargarPosiciones();
  }

  if (nombre === 'grupos') {
  cargarGrupos();
  }
};

// ══════════════════════════════
// MI QUINIELA
// ══════════════════════════════
window.cargarMiQuiniela = async function() {
  const contenedor = document.getElementById('quiniela-contenido');
  contenedor.innerHTML = `
  <div class="row g-3">

    ${Array.from({ length: 6 }).map(() => `
      <div class="col-12">

        <div class="skeleton-card">

          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="skeleton-line w-40"></div>
            <div class="skeleton-line w-20"></div>
          </div>

          <div class="skeleton-line w-100"></div>

          <div class="d-flex gap-2 mt-3">
            <div class="skeleton-line w-30"></div>
            <div class="skeleton-line w-30"></div>
            <div class="skeleton-line w-30"></div>
          </div>

        </div>

      </div>
    `).join('')}

  </div>
`;

  try {
    const datos = await obtenerDatosQuiniela();
    const html = renderMiQuiniela(datos);

    contenedor.innerHTML = html;
  } catch (e) {
    console.error(e);
    contenedor.innerHTML = `<div class="text-center py-4" style="color:#ff6b7a;">Error al cargar. Intenta de nuevo.</div>`;
  }
};

async function obtenerDatosQuiniela() {
  const [
    cfgJ1,
    cfgJ2,
    cfgJ3,
    predSnap,
    resJ1,
    resJ2,
    resJ3,
    aparJ2,
    aparJ3
  ] = await Promise.all([
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

  const ahora = new Date();

  const limites = {
    jornada1: cfgJ1.exists() ? getFechaConfig(cfgJ1.data()) : null,
    jornada2: cfgJ2.exists() ? getFechaConfig(cfgJ2.data()) : null,
    jornada3: cfgJ3.exists() ? getFechaConfig(cfgJ3.data()) : null,
  };

  const aparicion = {
    jornada1: true,
    jornada2: aparJ2.exists() && ahora >= getFechaConfig(aparJ2.data()),
    jornada3: aparJ3.exists() && ahora >= getFechaConfig(aparJ3.data()),
  };

  const picksMap = crearMapaPicks(predSnap);

  const resSnaps = {
    jornada1: resJ1,
    jornada2: resJ2,
    jornada3: resJ3,
  };

  const resMapAll = {};
  [resJ1, resJ2, resJ3].forEach(snap => {
    snap.docs.forEach(d => {
      resMapAll[(d.data().partidoId || '').toLowerCase()] = d.data();
    });
  });

  const totalRes = resJ1.size + resJ2.size + resJ3.size;
  let totalAciertos = 0;

  predSnap.docs.forEach(d => {
    const { partidoId, pick } = d.data();
    const res = resMapAll[(partidoId || '').toLowerCase()];
    if (res && res.lev === pick) totalAciertos++;
  });

  const picksJ = { jornada1: 0, jornada2: 0, jornada3: 0 };
  const aciertosJ = { jornada1: 0, jornada2: 0, jornada3: 0 };

  predSnap.docs.forEach(d => {
    const { partidoId, pick, jornada } = d.data();

    if (picksJ[jornada] !== undefined) picksJ[jornada]++;

    const res = resMapAll[(partidoId || '').toLowerCase()];
    if (res && res.lev === pick) aciertosJ[jornada]++;
  });

  return {
    ahora,
    predSnap,
    picksMap,
    resSnaps,
    limites,
    aparicion,
    totalRes,
    totalAciertos,
    picksJ,
    aciertosJ,
  };
}

function renderMiQuiniela(datos) {
  const pendientes = Math.max(0, TOTAL_PARTIDOS_MUNDIAL - datos.totalRes);

  const resumen = document.getElementById('quiniela-resumen');
  if (resumen) {
    resumen.textContent = `Total acumulado: ${datos.totalAciertos} aciertos de ${datos.totalRes} partidos · ${pendientes} pendientes`;
  }

  let html = '';

  JORNADAS.forEach((jornada, idx) => {
    if (!datos.aparicion[jornada]) return;

    html += renderJornadaQuiniela(jornada, idx, datos);
  });

  return html;
}

function renderJornadaQuiniela(jornada, idx, datos) {
  const num        = idx + 1;
  const limite     = datos.limites[jornada];
  const bloqueado  = limite ? datos.ahora > limite : false;
  const partidos   = PARTIDOS_MUNDIAL[jornada] || [];
  const resSnap    = datos.resSnaps[jornada];
  const tienePicks = datos.picksJ[jornada] > 0;
  const aciertos   = datos.aciertosJ[jornada];
  const resJornada = resSnap.size;
  const modoKey    = getModoKey(jornada);

  const enModoEdicion = !tienePicks || window[modoKey] === true;
  const contraido     = tienePicks && !enModoEdicion;

  const resMapJ = crearMapaResultados(resSnap, 'lev');

  const titulo = resJornada >= partidos.length
    ? `Jornada ${num} — FINALIZADA`
    : tienePicks
      ? `Jornada ${num} — EN CURSO`
      : `Jornada ${num} — Llena tus picks`;

  let html = `
    <div class="jornada-picks-card" id="card-${jornada}">
      <div class="jornada-picks-header" onclick="toggleJornada('${jornada}')" style="cursor:pointer;">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="jornada-picks-titulo">🌐 ${titulo}</span>
          ${tienePicks ? `<span class="jornada-aciertos-badge" id="badge-aciertos-${jornada}">${aciertos}/${resJornada > 0 ? resJornada : partidos.length} aciertos</span>` : ''}
        </div>

        <div class="d-flex align-items-center gap-2">
          ${renderAccionesJornada(jornada, bloqueado, tienePicks, enModoEdicion)}
          <span class="jornada-toggle-icon" id="icon-${jornada}">${contraido ? '▼' : '▲'}</span>
        </div>
      </div>

      <div class="jornada-picks-body${contraido ? ' contraido' : ''}" id="body-${jornada}">
  `;

  if (tienePicks && !enModoEdicion) {
    partidos.forEach((p, i) => {
      html += renderPickCompacto(p, i, datos.picksMap, resMapJ);
    });
  } else {
    html += renderFormularioJornada(jornada, partidos, datos.picksMap, bloqueado, limite);
  }

  html += `</div></div>`;

  return html;
}

function renderAccionesJornada(jornada, bloqueado, tienePicks, enModoEdicion) {
  if (bloqueado) return '';

  if (enModoEdicion && !tienePicks) {
    return `<button class="btn-seleccion-auto" onclick="event.stopPropagation();seleccionAutomatica('${jornada}')">🎲 Selección automática</button>`;
  }

  if (tienePicks && !enModoEdicion) {
    return `<button class="btn-modificar" onclick="event.stopPropagation();activarModoEdicion('${jornada}')">✏️ Modificar quiniela</button>`;
  }

  if (enModoEdicion && tienePicks) {
    return `<button class="btn-seleccion-auto" onclick="event.stopPropagation();seleccionAutomatica('${jornada}')">🎲 Selección automática</button>`;
  }

  return '';
}

function renderPickCompacto(p, i, picksMap, resMapJ) {
  const flagLocal = getFlag(p.local);
  const flagVisit = getFlag(p.visitante);
  const pick      = picksMap[p.id] || '';
  const resReal   = resMapJ[p.id.toLowerCase()];
  const acerto    = resReal && pick && resReal === pick;
  const fallo     = resReal && pick && resReal !== pick;
  const flagPick  = pick === 'L' ? flagLocal : pick === 'V' ? flagVisit : null;

  const nombrePick = pick === 'L'
    ? p.local
    : pick === 'V'
      ? p.visitante
      : 'Empate';

  let resultadoIcon = '';

  if (acerto) {
    resultadoIcon = `<span class="pick-resultado acerto">✓</span>`;
  } else if (fallo) {
    resultadoIcon = `<span class="pick-resultado fallo">✗</span>`;
  }

  return `
    <div class="pick-compacto">
      <table class="pick-compacto-tabla">
        <tr>
          <td class="pick-td-num">${i + 1}</td>

          <td class="pick-td-local">
            <div class="inner">
              <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm">
              <span class="pick-compacto-nombre">${p.local}</span>
            </div>
          </td>

          <td class="pick-td-vs">vs</td>

          <td class="pick-td-visit">
            <div class="inner">
              <img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera-sm">
              <span class="pick-compacto-nombre">${p.visitante}</span>
            </div>
          </td>

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
        </tr>
      </table>
    </div>
  `;
}

function renderFormularioJornada(jornada, partidos, picksMap, bloqueado, limite) {
  let html = `
    <div class="jornada-picks-sub">
      <span>Selecciona el equipo ganador o empate</span>
      <span class="fecha-limite-badge ${!bloqueado ? 'ok' : ''}">${formatearFechaLimite(limite)}</span>
    </div>
  `;

  partidos.forEach((p, i) => {
    html += renderPartidoEditable(jornada, p, i, picksMap[p.id] || '', bloqueado);
  });

  if (bloqueado) {
    html += `<div class="picks-bloqueado">🔒 Esta jornada ya no acepta modificaciones</div>`;
  } else {
    html += renderBotonGuardar(jornada);
  }

  return html;
}

function renderPartidoEditable(jornada, p, i, pick, bloqueado) {
  const flagLocal = getFlag(p.local);
  const flagVisit = getFlag(p.visitante);

  return `
    <div class="partido-pick">
      <div class="partido-pick-num">Partido ${i + 1} · Grupo ${p.grupo} · ${p.fecha} ${p.hora}</div>

      <div class="partido-pick-equipos">
        <div class="partido-pick-local">
          <span>${p.local}</span>
          <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm">
        </div>

        <span class="partido-pick-vs">VS</span>

        <div class="partido-pick-visit">
          <img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera-sm">
          <span>${p.visitante}</span>
        </div>
      </div>

      <div class="pick-btns">
        ${renderBotonPick('L', p, pick, jornada, bloqueado)}
        ${renderBotonPick('E', p, pick, jornada, bloqueado)}
        ${renderBotonPick('V', p, pick, jornada, bloqueado)}
      </div>
    </div>
  `;
}

function renderBotonPick(tipo, partido, pick, jornada, bloqueado) {
  const esLocal  = tipo === 'L';
  const esEmpate = tipo === 'E';

  const clase = esLocal
    ? 'local'
    : esEmpate
      ? 'empate'
      : 'visita';

  const seleccionado = pick === tipo ? `seleccionado ${clase}` : '';

  const flag = esLocal
    ? getFlag(partido.local)
    : getFlag(partido.visitante);

  const texto = esLocal
    ? `Gana ${partido.local}`
    : esEmpate
      ? 'Empate'
      : `Gana ${partido.visitante}`;

  return `
    <button
      class="btn-pick ${clase} ${seleccionado}"
      id="pick-${tipo.toLowerCase()}-${partido.id}"
      onclick="setPick('${partido.id}','${tipo}','${jornada}')"
      ${bloqueado ? 'disabled' : ''}>

      ${!esEmpate ? `
        <img
          src="https://flagcdn.com/16x12/${flag}.png"
          style="width:16px;height:12px;border-radius:1px;flex-shrink:0">
      ` : ''}

      <span class="pick-nombre">${texto}</span>
      <span class="pick-nombre-corto">${tipo}</span>
    </button>
  `;
}

function renderBotonGuardar(jornada) {
  return `
    <div style="padding: 1rem 1.25rem;">
      <button class="btn-guardar-quiniela" id="btn-guardar-${jornada}" onclick="guardarPicks('${jornada}')">💾 Guardar predicciones</button>
      <div class="picks-msg" id="picks-msg-${jornada}"></div>
    </div>
  `;
}

// ── MODO EDICION ──
window.activarModoEdicion = function(jornada) {
  const modoKey = getModoKey(jornada);
  window[modoKey] = true;
  cargarMiQuiniela();
};

window.toggleJornada = function(jornada) {
  const body = document.getElementById(`body-${jornada}`);
  const icon = document.getElementById(`icon-${jornada}`);

  if (!body) return;

  body.classList.toggle('contraido');

  if (icon) {
    icon.textContent = body.classList.contains('contraido') ? '▼' : '▲';
  }
};

window.setPick = function(partidoId, pick, jornada) {
  ['L', 'E', 'V'].forEach(t => {
    const btn = document.getElementById(`pick-${t.toLowerCase()}-${partidoId}`);

    if (!btn) return;

    btn.classList.remove('seleccionado', 'local', 'empate', 'visita');

    if (t === pick) {
      btn.classList.add(
        'seleccionado',
        t === 'L' ? 'local' : t === 'E' ? 'empate' : 'visita'
      );
    }
  });
};

// ── SELECCIÓN AUTOMÁTICA ──
window.seleccionAutomatica = function(jornada) {
  const partidos = PARTIDOS_MUNDIAL[jornada] || [];

  // Detectar si ya hay picks seleccionados en el formulario
  const yaHayPicks = partidos.some(p =>
    document.getElementById(`pick-l-${p.id}`)?.classList.contains('seleccionado') ||
    document.getElementById(`pick-e-${p.id}`)?.classList.contains('seleccionado') ||
    document.getElementById(`pick-v-${p.id}`)?.classList.contains('seleccionado')
  );

  if (yaHayPicks) {
    const confirmado = confirm('🎲 ¿Reemplazar tus selecciones actuales con picks aleatorios?\n\nEsto sobreescribirá todo lo que ya elegiste en esta jornada.');
    if (!confirmado) return;
  }

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

  if (!navigator.onLine) {
    msg.className = 'picks-msg error';
    msg.textContent = '📡 No tienes conexión a internet. Revisa tu red antes de guardar.';
    return;
  }

  if (guardandoPicks[jornada]) return;
  guardandoPicks[jornada] = true;

  const partidos = PARTIDOS_MUNDIAL[jornada] || [];
  const picksPendientes = [];
  const picksActuales = {};

  for (const p of partidos) {
    const btnL = document.getElementById(`pick-l-${p.id}`);
    const btnE = document.getElementById(`pick-e-${p.id}`);
    const btnV = document.getElementById(`pick-v-${p.id}`);

    const pick = btnL?.classList.contains('seleccionado') ? 'L'
               : btnE?.classList.contains('seleccionado') ? 'E'
               : btnV?.classList.contains('seleccionado') ? 'V'
               : null;

    if (!pick) {
      picksPendientes.push(p);
    } else {
      picksActuales[p.id] = pick;
    }
  }

  if (picksPendientes.length > 0) {
    msg.className = 'picks-msg error';
    msg.textContent = `⚠️ Te faltan ${picksPendientes.length} partidos por seleccionar. Completa toda la jornada antes de guardar.`;

    const primerPendiente = picksPendientes[0];
    const cardPendiente = document.getElementById(`pick-l-${primerPendiente.id}`)?.closest('.partido-pick');

    if (cardPendiente) {
      cardPendiente.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardPendiente.classList.add('partido-pick-error');

      setTimeout(() => {
        cardPendiente.classList.remove('partido-pick-error');
      }, 2200);
    }

    guardandoPicks[jornada] = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const predSnap = await getDocs(query(
      collection(db, 'predicciones'),
      where('jugadorId', '==', jugador.id),
      where('jornada', '==', jornada)
    ));

    const picksGuardados = {};

    predSnap.docs.forEach(d => {
      const data = d.data();
      picksGuardados[data.partidoId] = data.pick;
    });

    let guardados = 0;
    let sinCambios = 0;

    for (const p of partidos) {
      const pickNuevo = picksActuales[p.id];
      const pickAnterior = picksGuardados[p.id];

      if (pickNuevo === pickAnterior) {
        sinCambios++;
        continue;
      }

      await setDoc(doc(db, 'predicciones', `${jugador.id}_${p.id}`), {
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
        partidoId: p.id,
        jornada,
        pick: pickNuevo,
        guardadoEn: new Date()
      });

      guardados++;
    }

    if (guardados === 0) {

        showToast(
            'ℹ️ No hubo cambios nuevos en tu quiniela.',
            'info'
        );

    } else {

        showToast(
            `✅ ${guardados} cambios guardados correctamente.`,
            'success'
        );

    }

    btn.textContent = 'Guardar predicciones';
    btn.disabled = false;

    const modoKey = getModoKey(jornada);
    window[modoKey] = false;

    guardandoPicks[jornada] = false;

    setTimeout(() => cargarMiQuiniela(), 800);

  } catch (e) {
    console.error(e);

    showToast(
        '❌ Error al guardar. Revisa tu conexión.',
        'error'
    );

    btn.textContent = 'Guardar predicciones';
    btn.disabled = false;
    guardandoPicks[jornada] = false;
  }
};

// ══════════════════════════════
// QUINIELAS DE TODOS — REALTIME
// ══════════════════════════════
let unsubscribeQuinielas = [];
let quinielasRenderTimer = null;

function detenerQuinielasRealtime() {
  unsubscribeQuinielas.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribeQuinielas = [];
}

function programarRenderQuinielasRealtime() {
  clearTimeout(quinielasRenderTimer);

  quinielasRenderTimer = setTimeout(() => {
    renderQuinielasRealtime();
  }, 250);
}

window.cargarQuinielas = function() {
  const contenedor = document.getElementById('quinielas-contenido');
  const resumen    = document.getElementById('quinielas-resumen');

  if (!contenedor) return;

  detenerQuinielasRealtime();

  contenedor.innerHTML = `
  <div class="quinielas-grid">
    ${Array.from({ length: 5 }).map(() => `
      <div class="skeleton-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-line w-30"></div>
        </div>

        <div class="skeleton-line w-80"></div>
        <div class="skeleton-line w-60"></div>
      </div>
    `).join('')}
  </div>
`;

  if (resumen) {
    resumen.textContent = 'Conectando en tiempo real...';
  }

  unsubscribeQuinielas.push(
    onSnapshot(doc(db, 'config', 'quinielas'), programarRenderQuinielasRealtime)
  );

  unsubscribeQuinielas.push(
    onSnapshot(collection(db, 'jugadores'), programarRenderQuinielasRealtime)
  );

  unsubscribeQuinielas.push(
    onSnapshot(collection(db, 'predicciones'), programarRenderQuinielasRealtime)
  );

  unsubscribeQuinielas.push(
    onSnapshot(collection(db, 'resultados'), programarRenderQuinielasRealtime)
  );

  renderQuinielasRealtime();
};

async function renderQuinielasRealtime() {
  const contenedor = document.getElementById('quinielas-contenido');
  const resumen    = document.getElementById('quinielas-resumen');

  if (!contenedor) return;

  try {
    const [cfgSnap, jugSnap, predSnap, resSnap] = await Promise.all([
      getDoc(doc(db, 'config', 'quinielas')),
      getDocs(collection(db, 'jugadores')),
      getDocs(collection(db, 'predicciones')),
      getDocs(collection(db, 'resultados'))
    ]);

    const publicadas = cfgSnap.exists()
      ? cfgSnap.data().publicadas === true
      : false;

    if (!publicadas) {
      if (resumen) resumen.textContent = 'Las quinielas aún están ocultas.';
      contenedor.innerHTML = renderQuinielasOcultas();
      return;
    }

    const jugadores = jugSnap.docs.map(d => ({
      id: d.id,
      nombre: d.data().nombre || 'Jugador'
    }));

    const prediccionesPorJugador = {};

    predSnap.docs.forEach(d => {
      const data = d.data();

      if (!prediccionesPorJugador[data.jugadorId]) {
        prediccionesPorJugador[data.jugadorId] = [];
      }

      prediccionesPorJugador[data.jugadorId].push(data);
    });

    const resultadosMap = {};

    resSnap.docs.forEach(d => {
      const data = d.data();
      resultadosMap[(data.partidoId || '').toLowerCase()] = data.lev;
    });

    const jugadoresConQuiniela = jugadores
        .filter(j =>
            prediccionesPorJugador[j.id] &&
            prediccionesPorJugador[j.id].length > 0
        )
        .sort((a, b) =>
            a.nombre.localeCompare(
                b.nombre,
                'es',
                { sensitivity: 'base' }
            )
        );

    if (resumen) {
      resumen.textContent = `${jugadoresConQuiniela.length} jugadores con quiniela registrada.`;
    }

    if (!jugadoresConQuiniela.length) {
      contenedor.innerHTML = `
        <div class="text-center py-5" style="color:var(--text-muted);">
          Aún no hay quinielas registradas.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = renderListadoQuinielas(
      jugadoresConQuiniela,
      prediccionesPorJugador,
      resultadosMap
    );

  } catch (e) {
    console.error('Error realtime quinielas:', e);

    if (resumen) {
      resumen.textContent = 'Error al cargar quinielas.';
    }

    contenedor.innerHTML = `
      <div class="text-center py-5" style="color:#ff6b7a;">
        Error al cargar quinielas. Intenta de nuevo.
      </div>
    `;
  }
}

function renderQuinielasOcultas() {
  return `
    <div class="quinielas-empty">
      <div class="quinielas-empty-icon">🔒</div>
      <div class="quinielas-empty-title">Quinielas ocultas</div>
      <div class="quinielas-empty-sub">
        El administrador aún no ha publicado las quinielas de los jugadores.
      </div>
    </div>
  `;
}

function renderListadoQuinielas(jugadores, prediccionesPorJugador, resultadosMap) {
  let html = `<div class="quinielas-grid">`;

  jugadores.forEach((j, index) => {
    const predicciones = prediccionesPorJugador[j.id] || [];
    const aciertos = calcularAciertosJugador(predicciones, resultadosMap);
    const total = predicciones.length;

    html += `
      <div class="quiniela-jugador-card">
        <div class="quiniela-jugador-header" onclick="toggleQuinielaJugador('${j.id}')">
          <div>
            <div class="quiniela-jugador-nombre">${index + 1}. ${escapeHtml(j.nombre)}</div>
            <div class="quiniela-jugador-sub">${total} predicciones registradas</div>
          </div>

          <div class="quiniela-jugador-right">
            <span class="quiniela-aciertos-badge">${aciertos} aciertos</span>
            <span class="quiniela-arrow" id="arrow-quiniela-${j.id}">▼</span>
          </div>
        </div>

        <div class="quiniela-jugador-body" id="body-quiniela-${j.id}" style="display:none;">
          ${renderDetalleQuinielaJugador(predicciones, resultadosMap)}
        </div>
      </div>
    `;
  });

  html += `</div>`;

  return html;
}

function calcularAciertosJugador(predicciones, resultadosMap) {
  let aciertos = 0;

  predicciones.forEach(p => {
    const resultado = resultadosMap[(p.partidoId || '').toLowerCase()];
    if (resultado && resultado === p.pick) aciertos++;
  });

  return aciertos;
}

function renderDetalleQuinielaJugador(predicciones, resultadosMap) {
  let html = '';

  JORNADAS.forEach(jornada => {
    const predJornada = predicciones.filter(p => p.jornada === jornada);

    if (!predJornada.length) return;

    html += `
      <div class="quiniela-jornada-block">
        <div class="quiniela-jornada-title">${getLabelJornada(jornada)}</div>
        ${renderPrediccionesJornadaJugador(jornada, predJornada, resultadosMap)}
      </div>
    `;
  });

  return html || `
    <div class="text-center py-3" style="color:var(--text-muted);">
      Este jugador aún no tiene predicciones.
    </div>
  `;
}

function renderPrediccionesJornadaJugador(jornada, predicciones, resultadosMap) {
  const partidos = PARTIDOS_MUNDIAL[jornada] || [];
  const picksMap = {};

  predicciones.forEach(p => {
    picksMap[p.partidoId] = p.pick;
  });

  let html = '';

  partidos.forEach((partido, index) => {
    const pick = picksMap[partido.id];

    if (!pick) return;

    html += renderFilaQuinielaJugador(partido, index + 1, pick, resultadosMap);
  });

  return html;
}

function renderFilaQuinielaJugador(partido, numero, pick, resultadosMap) {

  const flagLocal = getFlag(partido.local);
  const flagVisit = getFlag(partido.visitante);

  const resultado = resultadosMap[(partido.id || '').toLowerCase()];

  const acerto = resultado && resultado === pick;
  const fallo  = resultado && resultado !== pick;

  const textoPick =
    pick === 'L'
      ? partido.local
      : pick === 'V'
        ? partido.visitante
        : 'Empate';

  const flagPick =
    pick === 'L'
      ? flagLocal
      : pick === 'V'
        ? flagVisit
        : null;

  // ── COLOR PICK ──
  const pickClass =
    pick === 'L'
      ? 'pick-local'
      : pick === 'V'
        ? 'pick-visitante'
        : 'pick-empate';

  let estadoHtml = `<span class="quiniela-pick-pendiente">•</span>`;

  if (acerto) {
    estadoHtml = `<span class="quiniela-pick-ok">✓</span>`;
  } else if (fallo) {
    estadoHtml = `<span class="quiniela-pick-error">✗</span>`;
  }

  return `
    <div class="quiniela-pick-row">

      <div class="quiniela-pick-num">
        ${numero}
      </div>

      <div class="quiniela-equipo">
        <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm">
        <span>${partido.local}</span>
      </div>

      <div class="quiniela-vs">
        VS
      </div>

      <div class="quiniela-equipo">
        <img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera-sm">
        <span>${partido.visitante}</span>
      </div>

      <div class="quiniela-pick-seleccion ${pickClass}">

        ${flagPick
          ? `<img src="https://flagcdn.com/16x12/${flagPick}.png" class="bandera-sm">`
          : ''}

        <span>${textoPick}</span>

        ${estadoHtml}

      </div>

    </div>
  `;
}

window.toggleQuinielaJugador = function(jugadorId) {
  const body = document.getElementById(`body-quiniela-${jugadorId}`);
  const arrow = document.getElementById(`arrow-quiniela-${jugadorId}`);

  if (!body) return;

  const visible = body.style.display !== 'none';

  body.style.display = visible ? 'none' : 'block';

  if (arrow) {
    arrow.textContent = visible ? '▼' : '▲';
  }
};

// ══════════════════════════════
// POSICIONES — REALTIME
// ══════════════════════════════
let unsubscribePosiciones = [];
let posicionesRenderTimer = null;

function detenerPosicionesRealtime() {
  unsubscribePosiciones.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribePosiciones = [];
}

function programarRenderPosiciones() {
  clearTimeout(posicionesRenderTimer);

  posicionesRenderTimer = setTimeout(() => {
    renderPosicionesRealtime();
  }, 250);
}

window.cargarPosiciones = function() {
  const contenedor = document.getElementById('posiciones-contenido');
  const resumen = document.getElementById('posiciones-resumen');

  if (!contenedor) return;

  detenerPosicionesRealtime();

  contenedor.innerHTML = `
  <div class="row g-3">

    ${Array.from({ length: 6 }).map(() => `
      <div class="col-12">
        <div class="skeleton-card">

          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="skeleton-line w-30"></div>
            <div class="skeleton-line w-20"></div>
          </div>

          <div class="skeleton-line w-80"></div>
          <div class="skeleton-line w-100"></div>
          <div class="skeleton-line w-60"></div>

        </div>
      </div>
    `).join('')}

  </div>
`;

  if (resumen) {
    resumen.textContent = 'Conectando en tiempo real...';
  }

  unsubscribePosiciones.push(
    onSnapshot(collection(db, 'jugadores'), programarRenderPosiciones)
  );

  unsubscribePosiciones.push(
    onSnapshot(collection(db, 'predicciones'), programarRenderPosiciones)
  );

  unsubscribePosiciones.push(
    onSnapshot(collection(db, 'resultados'), programarRenderPosiciones)
  );

  renderPosicionesRealtime();
};

async function renderPosicionesRealtime() {
  const contenedor = document.getElementById('posiciones-contenido');
  const resumen = document.getElementById('posiciones-resumen');

  if (!contenedor) return;

  try {
    const [jugSnap, predSnap, resSnap] = await Promise.all([
      getDocs(collection(db, 'jugadores')),
      getDocs(collection(db, 'predicciones')),
      getDocs(collection(db, 'resultados'))
    ]);

    const totalResultados = resSnap.size;

    const resultadosMap = {};
    resSnap.docs.forEach(d => {
      const data = d.data();
      resultadosMap[(data.partidoId || '').toLowerCase()] = data.lev;
    });

    const statsJugadores = {};

    jugSnap.docs.forEach(d => {
      statsJugadores[d.id] = {
        id: d.id,
        nombre: d.data().nombre || 'Jugador',
        picks: 0,
        aciertos: 0
      };
    });

    predSnap.docs.forEach(d => {
      const data = d.data();
      const jugadorId = data.jugadorId;

      if (!statsJugadores[jugadorId]) return;

      statsJugadores[jugadorId].picks++;

      const resultadoReal = resultadosMap[(data.partidoId || '').toLowerCase()];

      if (resultadoReal && resultadoReal === data.pick) {
        statsJugadores[jugadorId].aciertos++;
      }
    });

    const jugadores = Object.values(statsJugadores)
      .sort((a, b) => {
        if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
        if (b.picks !== a.picks) return b.picks - a.picks;
        return a.nombre.localeCompare(b.nombre);
      });

    if (resumen) {
      resumen.textContent = `${jugadores.length} jugadores · ${totalResultados} resultados capturados`;
    }

    if (!jugadores.length) {
      contenedor.innerHTML = `
        <div class="posiciones-empty">
          <div class="posiciones-empty-icon">🏆</div>
          <div class="posiciones-empty-title">Sin jugadores</div>
          <div class="posiciones-empty-sub">Aún no hay jugadores registrados.</div>
        </div>
      `;
      return;
    }

    contenedor.innerHTML = renderTablaPosiciones(jugadores, totalResultados);

  } catch (e) {
    console.error('Error cargando posiciones:', e);

    if (resumen) {
      resumen.textContent = 'Error al cargar posiciones.';
    }

    contenedor.innerHTML = `
      <div class="text-center py-5" style="color:#ff6b7a;">
        Error al cargar posiciones. Intenta de nuevo.
      </div>
    `;
  }
}

function renderTablaPosiciones(jugadores, totalResultados) {
  let html = `
    <div class="posiciones-card">
      <div class="posiciones-table-header d-none d-md-grid">
        <div>#</div>
        <div>Jugador</div>
        <div>Aciertos</div>
        <div>Porcentaje</div>
        <div>Progreso</div>
      </div>

      <div class="posiciones-list">
  `;

  let posicionActual = 0;
  let aciertosAnterior = null;

  jugadores.forEach((j, index) => {
    if (j.aciertos !== aciertosAnterior) {
      posicionActual = index + 1;
      aciertosAnterior = j.aciertos;
    }

    html += renderFilaPosicion(j, posicionActual, totalResultados);
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

function renderFilaPosicion(jugador, posicion, totalResultados) {
  const porcentaje = totalResultados > 0
    ? Math.round((jugador.aciertos / totalResultados) * 100)
    : 0;


  const medalla =
    posicion === 1 ? '🥇'
    : posicion === 2 ? '🥈'
    : posicion === 3 ? '🥉'
    : posicion;

  const topClass =
    posicion === 1 ? 'top1'
    : posicion === 2 ? 'top2'
    : posicion === 3 ? 'top3'
    : '';

  return `
    <div class="posiciones-row ${topClass}">
      <div class="posiciones-col posicion-num">
        ${medalla}
      </div>

      <div class="posiciones-col posicion-jugador">
        <span>${escapeHtml(jugador.nombre)}</span>
        <small>${jugador.picks} picks registrados</small>
      </div>

      <div class="posiciones-col posicion-aciertos">
        <span>${jugador.aciertos}/${totalResultados}</span>
      </div>

      <div class="posiciones-col posicion-porcentaje">
        ${porcentaje}%
      </div>

      <div class="posiciones-col posicion-progreso">
        <div class="posiciones-progress-wrap">
          <div class="posiciones-progress-bar" style="width:${porcentaje}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════
// GRUPOS — REALTIME JUGADOR
// ══════════════════════════════
let unsubscribeGruposJugador = [];
let gruposJugadorTimer = null;

function detenerGruposJugadorRealtime() {
  unsubscribeGruposJugador.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribeGruposJugador = [];
}

function programarRenderGruposJugador() {
  clearTimeout(gruposJugadorTimer);

  gruposJugadorTimer = setTimeout(() => {
    renderGruposJugadorRealtime();
  }, 250);
}

window.cargarGrupos = function() {
  const contenedor = document.getElementById('grupos-contenedor');

  if (!contenedor) return;

  detenerGruposJugadorRealtime();

  contenedor.innerHTML = `
    <div class="text-center py-5" style="color:var(--text-muted);">
      Cargando grupos en tiempo real...
    </div>
  `;

  unsubscribeGruposJugador.push(
    onSnapshot(collection(db, 'resultados'), programarRenderGruposJugador)
  );

  renderGruposJugadorRealtime();
};

async function renderGruposJugadorRealtime() {
  const contenedor = document.getElementById('grupos-contenedor');

  if (!contenedor) return;

  try {
    const resSnap = await getDocs(collection(db, 'resultados'));
    const resultados = resSnap.docs.map(d => d.data());

    contenedor.innerHTML = renderGruposHtml(resultados);
  } catch(e) {
    console.error('Error realtime grupos jugador:', e);

    contenedor.innerHTML = `
      <div class="text-center py-4" style="color:#ff6b7a;">
        Error al cargar grupos.
      </div>
    `;
  }
}

function calcularGrupos(resultados) {
  const stats = {};

  const iniciar = (equipo, grupo) => {
    if (!stats[equipo]) {
      stats[equipo] = {
        grupo,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0
      };
    }
  };

  resultados.forEach(r => {
    if (!r.local || !r.visitante || r.golesLocal === undefined) return;

    const gl = parseInt(r.golesLocal);
    const gv = parseInt(r.golesVisitante);

    iniciar(r.local, r.grupo);
    iniciar(r.visitante, r.grupo);

    stats[r.local].pj++;
    stats[r.visitante].pj++;

    stats[r.local].gf += gl;
    stats[r.local].gc += gv;

    stats[r.visitante].gf += gv;
    stats[r.visitante].gc += gl;

    if (gl > gv) {
      stats[r.local].pg++;
      stats[r.visitante].pp++;
    } else if (gl < gv) {
      stats[r.visitante].pg++;
      stats[r.local].pp++;
    } else {
      stats[r.local].pe++;
      stats[r.visitante].pe++;
    }
  });

  ['jornada1', 'jornada2', 'jornada3'].forEach(jornada => {
    (PARTIDOS_MUNDIAL[jornada] || []).forEach(p => {
      iniciar(p.local, p.grupo);
      iniciar(p.visitante, p.grupo);
    });
  });

  const grupos = {};

  Object.entries(stats).forEach(([equipo, s]) => {
    if (!grupos[s.grupo]) grupos[s.grupo] = [];
    grupos[s.grupo].push({ equipo, ...s });
  });

  const pts = s => s.pg * 3 + s.pe;
  const dg  = s => s.gf - s.gc;

  Object.keys(grupos).forEach(g => {
    grupos[g].sort((a, b) =>
      pts(b) - pts(a) ||
      dg(b) - dg(a) ||
      b.gf - a.gf ||
      a.equipo.localeCompare(b.equipo, 'es', { sensitivity: 'base' })
    );
  });

  return grupos;
}

function renderGruposHtml(resultados) {
  const grupos = calcularGrupos(resultados);
  const letras = Object.keys(grupos).sort();

  let html = '<div class="row g-3">';

  letras.forEach(letra => {
    html += renderGrupoCard(letra, grupos[letra]);
  });

  html += '</div>';

  return html;
}

function renderGrupoCard(letra, equipos) {
  return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="grupo-card">
        <div class="grupo-header">Grupo ${letra}</div>

        <table class="table table-dark table-hover grupo-tabla mb-0">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>PJ</th>
              <th>PG</th>
              <th>PE</th>
              <th>PP</th>
              <th>GF</th>
              <th>GC</th>
              <th>DG</th>
              <th>PTS</th>
            </tr>
          </thead>

          <tbody>
            ${equipos.map((e, i) => renderEquipoGrupoRow(e, i)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEquipoGrupoRow(e, index) {
  const pts = e.pg * 3 + e.pe;
  const dg  = e.gf - e.gc;
  const flag = BANDERAS[e.equipo] || 'un';

  return `
    <tr>
      <td>
        <div class="grupo-equipo">
          <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
          <span>${e.equipo}</span>
        </div>
      </td>

      <td>${e.pj}</td>
      <td>${e.pg}</td>
      <td>${e.pe}</td>
      <td>${e.pp}</td>
      <td>${e.gf}</td>
      <td>${e.gc}</td>
      <td class="grupo-dg ${dg > 0 ? 'pos' : dg < 0 ? 'neg' : ''}">
        ${dg > 0 ? '+' + dg : dg}
      </td>
      <td>
        <span class="grupo-pts ${index === 0 ? 'lider' : ''}">
          ${pts}
        </span>
      </td>
    </tr>
  `;
}

// ══════════════════════════════
// INICIO
// ══════════════════════════════
window.cargarInicio = async function() {
  try {
    const datos = await obtenerDatosInicio();

    actualizarStatsInicio(datos);
    actualizarEstadoBienvenida(datos.tieneQuiniela);

    if (!datos.tieneQuiniela) {
      renderMensajeSinQuiniela();
      return;
    }

    const jornada = obtenerJornadaActiva(datos.sizes);
    const resActiva = obtenerMapaResultadoPorJornada(jornada, datos.resMaps);

    actualizarTituloJornadaInicio(jornada);
    renderBannersInicio(jornada, datos.sizes, datos.resMaps);
    renderListaPartidosInicio(jornada, resActiva);
  } catch (e) {
    console.error('Error cargarInicio:', e);
  }
};

async function obtenerDatosInicio() {
  const [resJ1, resJ2, resJ3, predSnap] = await Promise.all([
    getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada1'))),
    getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada2'))),
    getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada3'))),
    getDocs(query(collection(db, 'predicciones'), where('jugadorId', '==', jugador.id || '')))
  ]);

  const totalResultados = resJ1.size + resJ2.size + resJ3.size;

  return {
    totalResultados,
    porJugar: Math.max(0, TOTAL_PARTIDOS_MUNDIAL - totalResultados),
    tieneQuiniela: predSnap.size > 0,
    sizes: {
      jornada1: resJ1.size,
      jornada2: resJ2.size,
      jornada3: resJ3.size,
    },
    resMaps: {
      jornada1: crearMapaResultados(resJ1, null),
      jornada2: crearMapaResultados(resJ2, null),
      jornada3: crearMapaResultados(resJ3, null),
    }
  };
}

function actualizarStatsInicio(datos) {
  document.getElementById('stat-partidos').textContent   = TOTAL_PARTIDOS_MUNDIAL;
  document.getElementById('stat-resultados').textContent = datos.totalResultados;
  document.getElementById('stat-porjugar').textContent   = datos.porJugar;
}

function actualizarEstadoBienvenida(tieneQuiniela) {
  const sub = document.getElementById('bienvenido-sub');

  sub.textContent = tieneQuiniela
    ? 'Tu quiniela está registrada ✓'
    : 'Aún no has registrado tu quiniela';

  sub.style.color = tieneQuiniela ? '#6fe0a8' : '#ff6b7a';
}

function renderMensajeSinQuiniela() {
  document.getElementById('lista-partidos').innerHTML = `
    <div class="text-center py-5">
      <div style="font-size:2.5rem; margin-bottom:0.75rem;">⚽</div>
      <div style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; letter-spacing:1.5px; color:#fff; margin-bottom:0.4rem;">¡Llena tu quiniela!</div>
      <div style="font-size:0.85rem; color:var(--text-muted);">
        Ve a <span style="color:var(--gold); cursor:pointer; font-weight:700;" onclick="cambiarSeccion('miquiniela')">Mi quiniela</span> para hacer tus pronósticos.
      </div>
    </div>
  `;
}

function obtenerJornadaActiva(sizes) {
  if (sizes.jornada1 < 24) return 'jornada1';
  if (sizes.jornada2 < 24) return 'jornada2';
  return 'jornada3';
}

function obtenerMapaResultadoPorJornada(jornada, resMaps) {
  return resMaps[jornada] || {};
}

function actualizarTituloJornadaInicio(jornada) {
  const tituloEl = document.getElementById('inicio-jornada-titulo');

  if (tituloEl) {
    tituloEl.textContent = `Partidos — ${getLabelJornada(jornada)}`;
  }
}

function renderBannersInicio(jornadaActiva, sizes, resMaps) {
  let bannersHtml = '';

  for (const jornada of JORNADAS) {
    if (jornada === jornadaActiva || sizes[jornada] === 0) continue;

    bannersHtml += renderBannerJornadaInicio(jornada, sizes[jornada], resMaps[jornada]);
  }

  const bannersEl = document.getElementById('banners-inicio');

  if (bannersEl) {
    bannersEl.innerHTML = bannersHtml;
  }
}

function renderBannerJornadaInicio(jornada, totalResultados, resMap) {
  return `
    <div class="banner-jornada-fin mb-2" id="banner-inicio-${jornada}">
      <div class="banner-jornada-header" onclick="toggleBannerInicio('${jornada}')">
        <span class="banner-jornada-titulo">${getLabelJornada(jornada)} — Finalizada</span>
        <span class="banner-jornada-sub">${totalResultados}/24 resultados</span>
        <span class="banner-jornada-arrow" id="arrow-inicio-${jornada}">▼</span>
      </div>

      <div class="banner-jornada-body" id="body-inicio-${jornada}" style="display:none;">
        ${renderPartidosJornadaHtml(jornada, resMap)}
      </div>
    </div>
  `;
}

function renderListaPartidosInicio(jornada, resMap) {
  document.getElementById('lista-partidos').innerHTML = '<div id="lista-partidos-activa"></div>';
  renderPartidosJornada(jornada, resMap);
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
    html += renderFilaPartidoInicio(p, num++, resMap);
  });

  return html;
}

function renderFilaPartidoInicio(p, num, resMap) {
  const flagLocal = getFlag(p.local);
  const flagVisit = getFlag(p.visitante);
  const res       = resMap[p.id.toLowerCase()];
  const tieneRes  = res && res.lev;

  return `
    <div class="estado-row ${tieneRes ? 'con-resultado' : ''}">
      <table class="estado-tabla">
        <tr>
          <td class="estado-td-num">${num}</td>

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

          <td class="estado-td-res">${renderResultadoPartidoInicio(p, res, flagLocal, flagVisit)}</td>

          <td class="estado-td-fecha">
            <span class="estado-fecha-hora">${p.fecha} · ${p.hora}</span>
            <span class="estado-estadio">${p.estadio}</span>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderResultadoPartidoInicio(p, res, flagLocal, flagVisit) {
  if (!res || !res.lev) {
    return `<div class="estado-pendiente">—</div>`;
  }

  return `
    <div class="estado-resultado ${res.lev === 'E' ? 'empate' : ''}">
      ${res.lev !== 'E'
        ? `<img src="https://flagcdn.com/16x12/${res.lev === 'L' ? flagLocal : flagVisit}.png" class="bandera-sm">`
        : '<span>Empate</span>'
      }
      <span class="estado-res-nombre">${res.lev === 'L' ? p.local : res.lev === 'V' ? p.visitante : ''}</span>
      <span class="estado-check">✓</span>
    </div>
  `;
}

window.toggleBannerInicio = function(jornada) {
  const body  = document.getElementById(`body-inicio-${jornada}`);
  const arrow = document.getElementById(`arrow-inicio-${jornada}`);

  if (!body) return;

  const visible = body.style.display !== 'none';

  body.style.display = visible ? 'none' : 'block';

  if (arrow) {
    arrow.textContent = visible ? '▼' : '▲';
  }
};

window.addEventListener('offline', () => {
  const aviso = document.createElement('div');
  aviso.className = 'conexion-aviso offline';
  aviso.id = 'conexion-aviso';
  aviso.textContent = '📡 Sin conexión a internet';

  if (!document.getElementById('conexion-aviso')) {
    document.body.appendChild(aviso);
  }
});

window.addEventListener('online', () => {
  const aviso = document.getElementById('conexion-aviso');

  if (aviso) {
    aviso.className = 'conexion-aviso online';
    aviso.textContent = '✅ Conexión restaurada';

    setTimeout(() => {
      aviso.remove();
    }, 2500);
  }
});