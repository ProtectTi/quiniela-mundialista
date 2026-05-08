import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

import {
  db,
  auth
} from "./firebase/config.js";

import {
  animarNumero
} from "./utils/animations.js";
// ── ESCAPE HTML (prevenir XSS) ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ── PROTECCIÓN REAL CON FIREBASE AUTH ──
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'admin.html';
  }
});

// ── ESTADO GLOBAL ──
let faseActiva = 'jornada1';

// ══════════════════════════════
// NAVBAR
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

window.cerrarSesion = async function() {
  try {
    await signOut(auth);
    window.location.href = 'admin.html';
  } catch (e) {
    console.error(e);
  }
};

window.cambiarSeccion = function(nombre, desdeMobil = false) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + nombre).classList.add('active');

  const tabDesktop = document.getElementById('tab-' + nombre);
  if (tabDesktop) tabDesktop.classList.add('active');

  const tabMovil = document.getElementById('tab-m-' + nombre);
  if (tabMovil) tabMovil.classList.add('active');

  if (desdeMobil) cerrarMenu();

  if (nombre === 'partidos')   cargarFase(faseActiva);
  if (nombre === 'dashboard')  cargarDashboard();
  if (nombre === 'jugadores')  cargarJugadores();
  if (nombre === 'posiciones') cargarPosiciones();
  if (nombre === 'grupos')     cargarGrupos();
  if (nombre === 'config')     cargarFechaLimiteConfig();
};

// ══════════════════════════════
// DASHBOARD — REALTIME ADMIN
// ══════════════════════════════
let unsubscribeDashboardAdmin = [];
let dashboardAdminTimer = null;

function detenerDashboardAdminRealtime() {
  unsubscribeDashboardAdmin.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribeDashboardAdmin = [];
}

function programarRenderDashboardAdmin() {
  clearTimeout(dashboardAdminTimer);

  dashboardAdminTimer = setTimeout(() => {
    renderDashboardAdminRealtime();
  }, 250);
}

function cargarDashboard() {
  detenerDashboardAdminRealtime();

  unsubscribeDashboardAdmin.push(
    onSnapshot(collection(db, 'jugadores'), programarRenderDashboardAdmin)
  );

  unsubscribeDashboardAdmin.push(
    onSnapshot(collection(db, 'predicciones'), programarRenderDashboardAdmin)
  );

  unsubscribeDashboardAdmin.push(
    onSnapshot(collection(db, 'resultados'), programarRenderDashboardAdmin)
  );

  unsubscribeDashboardAdmin.push(
    onSnapshot(doc(db, 'config', 'quinielas'), programarRenderDashboardAdmin)
  );

  renderDashboardAdminRealtime();
}

async function renderDashboardAdminRealtime() {
  try {
    await cargarEstadoPublicacionQuinielas();

    const [jugSnap, predSnap, resJ1, resJ2, resJ3] = await Promise.all([
      getDocs(collection(db, 'jugadores')),
      getDocs(query(collection(db, 'predicciones'), where('jornada', '==', faseActiva))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada1'))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada2'))),
      getDocs(query(collection(db, 'resultados'), where('jornada', '==', 'jornada3'))),
    ]);

    // Registrados
    animarNumero(
      document.getElementById('stat-registrados'),
      jugSnap.size
    );

    // Con quiniela
    const conQuiniela = new Set(
      predSnap.docs.map(d => d.data().jugadorId).filter(Boolean)
    ).size;

    animarNumero(
      document.getElementById('stat-conquiniela'),
      conQuiniela
    );

    // Resultados acumulados
    const totalResultados = resJ1.size + resJ2.size + resJ3.size;

    const resActiva =
      faseActiva === 'jornada1'
        ? resJ1
        : faseActiva === 'jornada2'
          ? resJ2
          : resJ3;

    animarNumero(
      document.getElementById('stat-resultados'),
      totalResultados
    );
    animarNumero(
      document.getElementById('stat-porjugar'),
      Math.max(0, 24 - resActiva.size)
    );

    // Mapa de resultados jornada activa
    const resMap = {};

    resActiva.docs.forEach(d => {
      resMap[(d.data().partidoId || '').toLowerCase()] = d.data();
    });

    renderEstadoPartidos(resMap);

    // Banners jornadas finalizadas
    const resMapJ1 = {};
    const resMapJ2 = {};
    const resMapJ3 = {};

    resJ1.docs.forEach(d => {
      resMapJ1[(d.data().partidoId || '').toLowerCase()] = d.data();
    });

    resJ2.docs.forEach(d => {
      resMapJ2[(d.data().partidoId || '').toLowerCase()] = d.data();
    });

    resJ3.docs.forEach(d => {
      resMapJ3[(d.data().partidoId || '').toLowerCase()] = d.data();
    });

    renderBannersFinalizados(
      {
        jornada1: resMapJ1,
        jornada2: resMapJ2,
        jornada3: resMapJ3
      },
      {
        jornada1: resJ1.size,
        jornada2: resJ2.size,
        jornada3: resJ3.size
      }
    );

  } catch(e) {
    console.error('Error realtime dashboard admin:', e);
  }
}

function renderEstadoPartidos(resMap) {
  const contenedor = document.getElementById('estado-partidos');
  if (!contenedor) return;

  const partidos = PARTIDOS_MUNDIAL[faseActiva] || [];
  if (!partidos.length) return;

  let num = 1;
  let html = '';

  partidos.forEach(p => {
    const res       = resMap[p.id.toLowerCase()];
    const flagLocal = BANDERAS[p.local]    || 'un';
    const flagVisit = BANDERAS[p.visitante] || 'un';
    const tieneRes  = res && res.lev;

    let resultadoHtml = tieneRes
      ? `<div class="estado-resultado ${res.lev === 'E' ? 'empate' : ''}">
           ${res.lev !== 'E' ? `<img src="https://flagcdn.com/16x12/${res.lev === 'L' ? flagLocal : flagVisit}.png" class="bandera-sm">` : '<span>Empate</span>'}
           <span class="estado-res-nombre">${res.lev === 'L' ? p.local : res.lev === 'V' ? p.visitante : ''}</span>
           <span class="estado-check">✓</span>
         </div>`
      : `<div class="estado-pendiente">—</div>`;

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

  contenedor.innerHTML = html;
}

function renderBannersFinalizados(resMaps, sizes) {
  const contenedor = document.getElementById('banners-jornadas');
  if (!contenedor) return;

  let html = '';

  for (const jornada of ['jornada1', 'jornada2', 'jornada3']) {
    if (jornada === faseActiva || sizes[jornada] === 0) continue;

    const label = jornada === 'jornada1' ? 'Jornada 1' : jornada === 'jornada2' ? 'Jornada 2' : 'Jornada 3';
    const partidosHtml = generarPartidosJornada(jornada, resMaps[jornada]);

    html += `
      <div class="banner-jornada-fin" id="banner-${jornada}">
        <div class="banner-jornada-header" onclick="toggleBannerJornada('${jornada}')">
          <span class="banner-jornada-titulo">${label} — Finalizada</span>
          <span class="banner-jornada-sub">${sizes[jornada]}/24 resultados</span>
          <span class="banner-jornada-arrow" id="arrow-${jornada}">▼</span>
        </div>
        <div class="banner-jornada-body" id="body-${jornada}" style="display:none;">
          ${partidosHtml}
        </div>
      </div>`;
  }

  contenedor.innerHTML = html;
}

function generarPartidosJornada(jornada, resMap) {
  const partidos = PARTIDOS_MUNDIAL[jornada] || [];
  let html = '';
  let num  = 1;

  partidos.forEach(p => {
    const res       = resMap[p.id.toLowerCase()];
    const flagLocal = BANDERAS[p.local]    || 'un';
    const flagVisit = BANDERAS[p.visitante] || 'un';
    const tieneRes  = res && res.lev;

    const resHtml = tieneRes
      ? `<div class="estado-resultado ${res.lev === 'E' ? 'empate' : ''}">
           ${res.lev !== 'E' ? `<img src="https://flagcdn.com/24x18/${res.lev === 'L' ? flagLocal : flagVisit}.png" class="bandera-sm">` : '<span>Empate</span>'}
           <span class="estado-res-nombre">${res.lev === 'L' ? p.local : res.lev === 'V' ? p.visitante : ''}</span>
           <span class="estado-check">✓</span>
         </div>`
      : `<div class="estado-pendiente">—</div>`;

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
            <td class="estado-td-res">${resHtml}</td>
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

window.toggleBannerJornada = function(jornada) {
  const body  = document.getElementById(`body-${jornada}`);
  const arrow = document.getElementById(`arrow-${jornada}`);
  const abierto = body.style.display !== 'none';

  body.style.display = abierto ? 'none' : 'block';
  arrow.textContent  = abierto ? '▼' : '▲';
};

// ══════════════════════════════
// TOGGLE PUBLICAR QUINIELAS
// ══════════════════════════════
async function cargarEstadoPublicacionQuinielas() {
  const banner  = document.getElementById('banner-quinielas');
  const btn     = document.getElementById('btn-publicar');
  const title   = banner?.querySelector('.banner-title');
  const sub     = banner?.querySelector('.banner-sub');

  if (!banner || !btn || !title || !sub) return;

  try {
    const snap = await getDoc(doc(db, 'config', 'quinielas'));

    const publicadas = snap.exists()
      ? snap.data().publicadas === true
      : false;

    actualizarUIQuinielasPublicadas(publicadas, false);
  } catch (e) {
    console.error('Error cargando estado de quinielas:', e);
  }
}

function actualizarUIQuinielasPublicadas(publicadas, mostrarMensaje = true) {
  const banner  = document.getElementById('banner-quinielas');
  const btn     = document.getElementById('btn-publicar');
  const title   = banner?.querySelector('.banner-title');
  const sub     = banner?.querySelector('.banner-sub');
  const mensaje = document.getElementById('mensaje-estado');

  if (!banner || !btn || !title || !sub) return;

  if (publicadas) {
    btn.classList.add('publicado');
    banner.classList.add('publicado');

    btn.textContent   = 'Ocultar';
    title.textContent = 'Quinielas Publicadas';
    sub.textContent   = 'Los jugadores pueden ver las quinielas de otros.';

    if (mostrarMensaje && mensaje) {
      mensaje.className = 'mensaje-estado publicadas';
      mensaje.textContent = '✅ Quinielas Publicadas';
      mensaje.style.display = 'block';
      setTimeout(() => { mensaje.style.display = 'none'; }, 3000);
    }
  } else {
    btn.classList.remove('publicado');
    banner.classList.remove('publicado');

    btn.textContent   = 'Publicar';
    title.textContent = 'Quinielas Ocultas';
    sub.textContent   = 'Los jugadores no pueden ver las quinielas de otros aún.';

    if (mostrarMensaje && mensaje) {
      mensaje.className = 'mensaje-estado ocultas';
      mensaje.textContent = '🔒 Quinielas Ocultas';
      mensaje.style.display = 'block';
      setTimeout(() => { mensaje.style.display = 'none'; }, 3000);
    }
  }
}

window.togglePublicar = async function() {
  const btn = document.getElementById('btn-publicar');
  const publicadoActual = btn.classList.contains('publicado');
  const nuevoEstado = !publicadoActual;

  btn.disabled = true;

  try {
    await setDoc(doc(db, 'config', 'quinielas'), {
      publicadas: nuevoEstado,
      actualizadoEn: new Date()
    });

    actualizarUIQuinielasPublicadas(nuevoEstado, true);
  } catch (e) {
    console.error('Error publicando quinielas:', e);
    alert('Error al cambiar el estado de las quinielas.');
  } finally {
    btn.disabled = false;
  }
};

// ══════════════════════════════
// PARTIDOS
// ══════════════════════════════
window.cargarFase = async function(fase) {
  const fasesBloqueadas = ['16avos', 'octavos', 'cuartos', 'semifinal', 'final'];
  if (fasesBloqueadas.includes(fase)) return;

  faseActiva = fase;

  document.querySelectorAll('.btn-fase').forEach(b => b.classList.remove('seleccionada'));

  const mapaBotones = { jornada1: 'fase-j1', jornada2: 'fase-j2', jornada3: 'fase-j3' };
  const btnActivo = document.getElementById(mapaBotones[fase]);

  if (btnActivo) btnActivo.classList.add('seleccionada');

  const partidos   = PARTIDOS_MUNDIAL[fase];
  const contenedor = document.getElementById('lista-partidos');

  if (!partidos) return;

  const snap = await getDocs(
    query(collection(db, 'resultados'), where('jornada', '==', fase))
  );

  const resMap = {};
  snap.docs.forEach(d => { resMap[(d.data().partidoId || "").toLowerCase()] = d.data(); });

  document.getElementById('partidos-count').textContent = `${partidos.length} PARTIDOS`;

  const meses = { 'Jun': 6, 'Jul': 7 };
  const partidosOrdenados = [...partidos].sort((a, b) => {
    const [diaA, mesA] = a.fecha.split(' ');
    const [diaB, mesB] = b.fecha.split(' ');
    const fechaA = new Date(2026, meses[mesA] - 1, parseInt(diaA), parseInt(a.hora));
    const fechaB = new Date(2026, meses[mesB] - 1, parseInt(diaB), parseInt(b.hora));
    return fechaA - fechaB;
  });

  let html = '';
  let num  = 1;

  partidosOrdenados.forEach(p => {
    const flagLocal = BANDERAS[p.local]    || 'un';
    const flagVisit = BANDERAS[p.visitante] || 'un';
    const res       = resMap[p.id.toLowerCase()];
    const gl        = res ? res.golesLocal     : 0;
    const gv        = res ? res.golesVisitante : 0;
    const lev       = res ? res.lev            : '';

    html += `
      <div class="partido-row" id="partido-${p.id}">

        <div class="partido-desktop">
          <span class="partido-num">${num++}</span>
          <div class="partido-equipo local">
            <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera">
            <span>${p.local}</span>
          </div>
          <span class="partido-vs-txt">vs</span>
          <div class="partido-equipo visitante">
            <img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera">
            <span>${p.visitante}</span>
          </div>
          <div class="partido-marcador">
            <input type="number" class="marcador-input" id="gol-local-${p.id}" min="0" max="99" value="${gl}" />
            <span class="marcador-sep">:</span>
            <input type="number" class="marcador-input" id="gol-visit-${p.id}" min="0" max="99" value="${gv}" />
          </div>
          <div class="partido-lev">
            <button class="btn-lev ${lev==='L'?'activo':''}" id="lev-l-${p.id}" onclick="setLEV('${p.id}','L')">L</button>
            <button class="btn-lev ${lev==='E'?'activo':''}" id="lev-e-${p.id}" onclick="setLEV('${p.id}','E')">E</button>
            <button class="btn-lev ${lev==='V'?'activo':''}" id="lev-v-${p.id}" onclick="setLEV('${p.id}','V')">V</button>
          </div>
          <div class="partido-detalle">
            <span class="partido-fecha-hora">📅 ${p.fecha} · ${p.hora}</span>
            <span class="partido-estadio">📍 ${p.estadio}</span>
          </div>
        </div>

        <div class="partido-movil">
          <div class="partido-movil-top">
            <div class="partido-equipo local">
              <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera">
              <span>${p.local}</span>
            </div>
            <span class="partido-vs-txt">vs</span>
            <div class="partido-equipo visitante">
              <img src="https://flagcdn.com/24x18/${flagVisit}.png" class="bandera">
              <span>${p.visitante}</span>
            </div>
          </div>
          <div class="partido-movil-mid">
            <div class="partido-marcador">
              <input type="number" class="marcador-input" id="gol-local-m-${p.id}" min="0" max="99" value="${gl}" oninput="syncMarcador('${p.id}','local',this.value)" />
              <span class="marcador-sep">:</span>
              <input type="number" class="marcador-input" id="gol-visit-m-${p.id}" min="0" max="99" value="${gv}" oninput="syncMarcador('${p.id}','visit',this.value)" />
            </div>
            <div class="partido-lev">
              <button class="btn-lev ${lev==='L'?'activo':''}" id="lev-l-m-${p.id}" onclick="setLEV('${p.id}','L')">L</button>
              <button class="btn-lev ${lev==='E'?'activo':''}" id="lev-e-m-${p.id}" onclick="setLEV('${p.id}','E')">E</button>
              <button class="btn-lev ${lev==='V'?'activo':''}" id="lev-v-m-${p.id}" onclick="setLEV('${p.id}','V')">V</button>
            </div>
          </div>
          <div class="partido-movil-bot">
            <span class="partido-fecha-hora">📅 ${p.fecha} · ${p.hora}</span>
            <span>·</span>
            <span class="partido-estadio">📍 ${p.estadio}</span>
          </div>
        </div>

      </div>`;
  });

  contenedor.innerHTML = html;
};

window.setLEV = function(id, resultado) {
  ['L','E','V'].forEach(r => {
    const btnD = document.getElementById(`lev-${r.toLowerCase()}-${id}`);
    const btnM = document.getElementById(`lev-${r.toLowerCase()}-m-${id}`);

    if (btnD) btnD.classList.toggle('activo', r === resultado);
    if (btnM) btnM.classList.toggle('activo', r === resultado);
  });
};

window.syncMarcador = function(id, tipo, val) {
  const desktop = document.getElementById(`gol-${tipo}-${id}`);
  if (desktop) desktop.value = val;
};

window.resultadosAleatorios = function() {
  document.querySelectorAll('.partido-row').forEach(row => {

    const id = row.id.replace('partido-', '');

    const gl = Math.floor(Math.random() * 6);
    const gv = Math.floor(Math.random() * 6);

    // ── INPUTS DESKTOP ──
    const localDesktop = document.getElementById(`gol-local-${id}`);
    const visitDesktop = document.getElementById(`gol-visit-${id}`);

    // ── INPUTS MÓVIL ──
    const localMovil = document.getElementById(`gol-local-m-${id}`);
    const visitMovil = document.getElementById(`gol-visit-m-${id}`);

    // ── ASIGNAR VALORES ──
    if (localDesktop) localDesktop.value = gl;
    if (visitDesktop) visitDesktop.value = gv;

    if (localMovil) localMovil.value = gl;
    if (visitMovil) visitMovil.value = gv;

    // ── LEV ──
    window.setLEV(
      id,
      gl > gv ? 'L' : gl < gv ? 'V' : 'E'
    );

  });
};

window.guardarTodo = async function() {
  const btn = document.querySelector('.btn-guardar-todo');
  btn.disabled   = true;
  btn.textContent = 'Guardando...';

  try {
    const partidos = PARTIDOS_MUNDIAL[faseActiva] || [];
    let guardados  = 0;

    for (const p of partidos) {
      const gl  = Math.max(0, Math.min(99, parseInt(document.getElementById(`gol-local-${p.id}`)?.value)  || 0));
      const gv  = Math.max(0, Math.min(99, parseInt(document.getElementById(`gol-visit-${p.id}`)?.value) || 0));

      const lev = document.getElementById(`lev-l-${p.id}`)?.classList.contains('activo') ? 'L'
                : document.getElementById(`lev-e-${p.id}`)?.classList.contains('activo') ? 'E'
                : document.getElementById(`lev-v-${p.id}`)?.classList.contains('activo') ? 'V'
                : null;

      if (lev) {
        // Validar consistencia marcador vs LEV
        const levEsperado = gl > gv ? 'L' : gl < gv ? 'V' : 'E';
        if (lev !== levEsperado) {
          btn.textContent = 'Guardar todo';
          btn.disabled    = false;
          alert(`⚠️ Marcador inconsistente en ${p.local} vs ${p.visitante}:\n${gl}-${gv} no coincide con "${lev === 'L' ? 'Local' : lev === 'V' ? 'Visitante' : 'Empate'}".\n\nCorrige el resultado antes de guardar.`);
          return;
        }

        await setDoc(doc(db, 'resultados', p.id), {
          partidoId:       p.id,
          jornada:         faseActiva,
          grupo:           p.grupo,
          local:           p.local,
          visitante:       p.visitante,
          golesLocal:      gl,
          golesVisitante:  gv,
          lev,
          fecha:           p.fecha,
          hora:            p.hora,
          estadio:         p.estadio,
          guardadoEn:      new Date()
        });

        guardados++;
      }
    }

    btn.textContent = `✅ Guardado (${guardados} partidos)`;

    setTimeout(() => {
      btn.textContent = 'Guardar todo';
      btn.disabled    = false;
    }, 2500);

  } catch(e) {
    console.error(e);
    btn.textContent = '❌ Error al guardar';
    btn.disabled    = false;
  }
};

// ══════════════════════════════
// GRUPOS — REALTIME ADMIN
// ══════════════════════════════
let unsubscribeGruposAdmin = [];
let gruposAdminTimer = null;

function detenerGruposAdminRealtime() {
  unsubscribeGruposAdmin.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribeGruposAdmin = [];
}

function programarRenderGruposAdmin() {
  clearTimeout(gruposAdminTimer);

  gruposAdminTimer = setTimeout(() => {
    renderGruposAdminRealtime();
  }, 250);
}

window.cargarGrupos = function() {
  const contenedor = document.getElementById('grupos-contenedor');

  if (!contenedor) return;

  detenerGruposAdminRealtime();

  contenedor.innerHTML = `
    <div class="text-center py-5" style="color:var(--text-muted);">
      Cargando grupos en tiempo real...
    </div>
  `;

  unsubscribeGruposAdmin.push(
    onSnapshot(collection(db, 'resultados'), programarRenderGruposAdmin)
  );

  renderGruposAdminRealtime();
};

async function renderGruposAdminRealtime() {
  const contenedor = document.getElementById('grupos-contenedor');

  if (!contenedor) return;

  try {
    const resSnap = await getDocs(collection(db, 'resultados'));
    const resultados = resSnap.docs.map(d => d.data());

    contenedor.innerHTML = renderGruposHtml(resultados);
  } catch(e) {
    console.error('Error realtime grupos admin:', e);

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
// POSICIONES — REALTIME ADMIN
// ══════════════════════════════
let unsubscribePosicionesAdmin = [];
let posicionesAdminTimer = null;

function detenerPosicionesAdminRealtime() {
  unsubscribePosicionesAdmin.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribePosicionesAdmin = [];
}

function programarRenderPosicionesAdmin() {
  clearTimeout(posicionesAdminTimer);

  posicionesAdminTimer = setTimeout(() => {
    renderPosicionesAdminRealtime();
  }, 250);
}

window.cargarPosiciones = function() {
  const tbody = document.getElementById('posiciones-tbody');

  if (!tbody) return;

  detenerPosicionesAdminRealtime();

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-4" style="color:var(--text-muted);">
        Cargando posiciones en tiempo real...
      </td>
    </tr>
  `;

  unsubscribePosicionesAdmin.push(
    onSnapshot(collection(db, 'jugadores'), programarRenderPosicionesAdmin)
  );

  unsubscribePosicionesAdmin.push(
    onSnapshot(collection(db, 'predicciones'), programarRenderPosicionesAdmin)
  );

  unsubscribePosicionesAdmin.push(
    onSnapshot(collection(db, 'resultados'), programarRenderPosicionesAdmin)
  );

  renderPosicionesAdminRealtime();
};

async function renderPosicionesAdminRealtime() {
  const tbody = document.getElementById('posiciones-tbody');

  if (!tbody) return;

  try {
    const [jugSnap, predSnap, resSnap] = await Promise.all([
      getDocs(collection(db, 'jugadores')),
      getDocs(collection(db, 'predicciones')),
      getDocs(collection(db, 'resultados'))
    ]);

    const totalResultados = resSnap.size;

    const resMap = {};
    resSnap.docs.forEach(d => {
      const data = d.data();
      resMap[(data.partidoId || '').toLowerCase()] = data.lev;
    });

    const aciertosMap = {};

    predSnap.docs.forEach(d => {
      const data = d.data();
      const resultadoReal = resMap[(data.partidoId || '').toLowerCase()];

      if (resultadoReal && resultadoReal === data.pick) {
        aciertosMap[data.jugadorId] = (aciertosMap[data.jugadorId] || 0) + 1;
      }
    });

    const count = document.getElementById('posiciones-count');
    if (count) count.textContent = `${jugSnap.size} JUGADORES`;

    if (jugSnap.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4" style="color:var(--text-muted);">
            No hay jugadores registrados.
          </td>
        </tr>
      `;
      return;
    }

    const jugadores = jugSnap.docs.map(d => ({
      id: d.id,
      nombre: d.data().nombre,
      aciertos: aciertosMap[d.id] || 0
    })).sort((a, b) => {
      if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
      return a.nombre.localeCompare(b.nombre);
    });

    let html = '';
    let posicionActual = 0;
    let aciertosAnterior = null;

    jugadores.forEach((j, index) => {
      if (j.aciertos !== aciertosAnterior) {
        posicionActual = index + 1;
        aciertosAnterior = j.aciertos;
      }

      const porcentaje = totalResultados > 0
        ? Math.round((j.aciertos / totalResultados) * 100)
        : 0;

      const medalla =
        posicionActual === 1 ? '🥇'
        : posicionActual === 2 ? '🥈'
        : posicionActual === 3 ? '🥉'
        : posicionActual;

      const posClass =
        posicionActual === 1 ? 'top1'
        : posicionActual === 2 ? 'top2'
        : posicionActual === 3 ? 'top3'
        : '';

      html += `
        <tr>
          <td>
            <span class="pos-numero ${posClass}">
              ${medalla}
            </span>
          </td>

          <td>
            <span class="jugador-nombre">${escapeHtml(j.nombre)}</span>
          </td>

          <td>
            <span class="badge-quiniela ${j.aciertos > 0 ? 'si' : 'no'}">
              ${j.aciertos}/${totalResultados}
            </span>
          </td>

          <td>
            <span class="jugador-aciertos">${porcentaje}%</span>
          </td>

          <td>
            <div class="progreso-bar-wrap">
              <div class="progreso-bar" style="width:${porcentaje}%"></div>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

  } catch(e) {
    console.error('Error realtime posiciones admin:', e);

    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4" style="color:#ff6b7a;">
          Error al cargar posiciones.
        </td>
      </tr>
    `;
  }
}

// ══════════════════════════════
// JUGADORES — REALTIME ADMIN
// ══════════════════════════════
let unsubscribeJugadoresAdmin = [];
let jugadoresAdminTimer = null;

function detenerJugadoresAdminRealtime() {

  unsubscribeJugadoresAdmin.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });

  unsubscribeJugadoresAdmin = [];

}

function programarRenderJugadoresAdmin() {

  clearTimeout(jugadoresAdminTimer);

  jugadoresAdminTimer = setTimeout(() => {
    renderJugadoresAdminRealtime();
  }, 250);

}

window.cargarJugadores = function() {

  const tbody = document.getElementById('jugadores-tbody');

  if (!tbody) return;

  detenerJugadoresAdminRealtime();

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-4" style="color:var(--text-muted);">
        Cargando jugadores en tiempo real...
      </td>
    </tr>
  `;

  // ── LISTENERS ──
  unsubscribeJugadoresAdmin.push(
    onSnapshot(
      collection(db, 'jugadores'),
      programarRenderJugadoresAdmin
    )
  );

  unsubscribeJugadoresAdmin.push(
    onSnapshot(
      collection(db, 'predicciones'),
      programarRenderJugadoresAdmin
    )
  );

  unsubscribeJugadoresAdmin.push(
    onSnapshot(
      collection(db, 'resultados'),
      programarRenderJugadoresAdmin
    )
  );

  renderJugadoresAdminRealtime();

};

async function renderJugadoresAdminRealtime() {

  const tbody = document.getElementById('jugadores-tbody');

  if (!tbody) return;

  try {

    const [
      jugSnap,
      predSnap,
      resSnap
    ] = await Promise.all([
      getDocs(collection(db, 'jugadores')),
      getDocs(collection(db, 'predicciones')),
      getDocs(collection(db, 'resultados'))
    ]);

    const totalResultados = resSnap.size;

    // ─────────────────────────
    // RESULTADOS
    // ─────────────────────────
    const resultadosMap = {};

    resSnap.docs.forEach(d => {

      const data = d.data();

      resultadosMap[
        (data.partidoId || '').toLowerCase()
      ] = data.lev;

    });

    // ─────────────────────────
    // MAPS
    // ─────────────────────────
    const quinielasMap = {};
    const aciertosMap  = {};

    predSnap.docs.forEach(d => {

      const data = d.data();

      const jugadorId = data.jugadorId;

      if (!jugadorId) return;

      quinielasMap[jugadorId] = true;

      const resultadoReal =
        resultadosMap[
          (data.partidoId || '').toLowerCase()
        ];

      if (
        resultadoReal &&
        resultadoReal === data.pick
      ) {

        aciertosMap[jugadorId] =
          (aciertosMap[jugadorId] || 0) + 1;

      }

    });

    // ─────────────────────────
    // COUNT
    // ─────────────────────────
    const count = document.getElementById('jugadores-count');

    if (count) {
      count.textContent = jugSnap.size;
    }

    // ─────────────────────────
    // VACÍO
    // ─────────────────────────
    if (jugSnap.empty) {

      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4" style="color:var(--text-muted);">
            No hay jugadores registrados aún.
          </td>
        </tr>
      `;

      return;
    }

    // ─────────────────────────
    // RENDER
    // ─────────────────────────
    let html = '';
    let num  = 1;

    jugSnap.docs.forEach(d => {

      const j = d.data();

      const fecha = j.creadoEn
        ? new Date(
            j.creadoEn.seconds * 1000
          ).toLocaleDateString(
            'es-MX',
            {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }
          )
        : '—';

      const tieneQ = !!quinielasMap[d.id];

      const aciertos =
        aciertosMap[d.id] || 0;

      html += `
        <tr>

          <td style="color:var(--text-muted); font-size:0.78rem;">
            ${num++}
          </td>

          <td>
            <span class="jugador-nombre">
              ${escapeHtml(j.nombre)}
            </span>
          </td>

          <td>
            <span class="jugador-fecha">
              ${fecha}
            </span>
          </td>

          <td>
            <span class="badge-quiniela ${tieneQ ? 'si' : 'no'}">
              ${tieneQ ? '✓ Sí' : '✗ No'}
            </span>
          </td>

          <td>
            <span class="jugador-aciertos">
              ${aciertos} / ${totalResultados}
            </span>
          </td>

          <td>
            <button
              class="btn-eliminar"
              onclick="eliminarJugador('${d.id}', '${escapeHtml(j.nombre).replace(/'/g, "&#39;")}')"
            >
              🗑 Eliminar
            </button>
          </td>

        </tr>
      `;

    });

    tbody.innerHTML = html;

  } catch(e) {

    console.error(
      'Error realtime jugadores admin:',
      e
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4" style="color:#ff6b7a;">
          Error al cargar jugadores.
        </td>
      </tr>
    `;

  }

}

window.eliminarJugador = async function(id, nombre) {
  if (!confirm(`¿Eliminar al jugador "${nombre}"? Esto no se puede deshacer.`)) return;

  try {
    await deleteDoc(doc(db, 'jugadores', id));
    cargarJugadores();
  } catch(e) {
    console.error(e);
    alert('Error al eliminar. Intenta de nuevo.');
  }
};

// ══════════════════════════════
// FECHA LÍMITE PICKS
// ══════════════════════════════
window.guardarFechaLimite = async function(jornada) {
  const fecha = document.getElementById(`cfg-fecha-${jornada === 'jornada1' ? 'j1' : jornada === 'jornada2' ? 'j2' : 'j3'}`).value;
  const hora  = document.getElementById(`cfg-hora-${jornada === 'jornada1' ? 'j1' : jornada === 'jornada2' ? 'j2' : 'j3'}`).value;
  const sufijo = jornada === 'jornada1' ? 'j1' : jornada === 'jornada2' ? 'j2' : 'j3';
  const msg   = document.getElementById(`cfg-fecha-msg-${sufijo}`);

  if (!fecha || !hora) {
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Por favor selecciona fecha y hora.';
    return;
  }

  try {
    await setDoc(doc(db, 'config', `fechaLimite_${jornada}`), {
      jornada,
      fecha,
      hora,
      timestamp:      new Date(`${fecha}T${hora}:00`),
      actualizadoEn:  new Date()
    });

    msg.style.display = 'block';
    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Fecha límite guardada.';

    mostrarFechaActual(sufijo, fecha, hora);

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Error al guardar.';
  }
};

function mostrarFechaActual(sufijo, fecha, hora) {
  const el = document.getElementById(`cfg-fecha-actual-${sufijo}`);
  if (el) el.textContent = `📅 Límite actual: ${fecha} a las ${hora} (CDMX)`;
}

async function cargarFechaLimiteConfig() {
  try {
    const [snapJ1, snapJ2, snapJ3, snapAJ2, snapAJ3] = await Promise.all([
      getDoc(doc(db, 'config', 'fechaLimite_jornada1')),
      getDoc(doc(db, 'config', 'fechaLimite_jornada2')),
      getDoc(doc(db, 'config', 'fechaLimite_jornada3')),
      getDoc(doc(db, 'config', 'aparicion_jornada2')),
      getDoc(doc(db, 'config', 'aparicion_jornada3')),
    ]);

    [['j1', snapJ1], ['j2', snapJ2], ['j3', snapJ3]].forEach(([sufijo, snap]) => {
      if (snap.exists()) {
        const data = snap.data();

        document.getElementById(`cfg-fecha-${sufijo}`).value = data.fecha;
        document.getElementById(`cfg-hora-${sufijo}`).value  = data.hora;

        mostrarFechaActual(sufijo, data.fecha, data.hora);
      }
    });

    [['j2', snapAJ2], ['j3', snapAJ3]].forEach(([sufijo, snap]) => {
      if (snap.exists()) {
        const data = snap.data();

        document.getElementById(`cfg-aparicion-fecha-${sufijo}`).value = data.fecha;
        document.getElementById(`cfg-aparicion-hora-${sufijo}`).value  = data.hora;

        document.getElementById(`cfg-aparicion-actual-${sufijo}`).textContent =
          `📅 Aparece el: ${data.fecha} a las ${data.hora} (CDMX)`;
      }
    });
  } catch(e) {
    console.error(e);
  }
}

window.cambiarPassword = async function() {
  const passActual = document.getElementById('cfg-pass-actual')?.value || '';
  const pass1 = document.getElementById('cfg-pass1').value;
  const pass2 = document.getElementById('cfg-pass2').value;
  const msg   = document.getElementById('cfg-pass-msg');

  msg.style.display = 'block';

  if (pass1.length < 4) {
    msg.className = 'reset-msg error';
    msg.textContent = '❌ La contraseña debe tener al menos 4 caracteres.';
    return;
  }

  if (pass1 !== pass2) {
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Las contraseñas no coinciden.';
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No hay sesión activa.');

    // Re-autenticar antes de cambiar contraseña (requerido por Firebase)
    if (passActual) {
      const credential = EmailAuthProvider.credential(user.email, passActual);
      await reauthenticateWithCredential(user, credential);
    }

    await updatePassword(user, pass1);

    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Contraseña de Firebase actualizada correctamente.';

    document.getElementById('cfg-pass-actual') && (document.getElementById('cfg-pass-actual').value = '');
    document.getElementById('cfg-pass1').value = '';
    document.getElementById('cfg-pass2').value = '';

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.className = 'reset-msg error';
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      msg.textContent = '❌ Contraseña actual incorrecta.';
    } else if (e.code === 'auth/requires-recent-login') {
      msg.textContent = '❌ Sesión expirada. Ingresa tu contraseña actual para continuar.';
    } else {
      msg.textContent = '❌ Error al actualizar. Intenta de nuevo.';
    }
  }
};

window.reiniciarTodo = async function() {
  const confirmado = confirm('⚠️ ¿Estás seguro? Esto borrará TODOS los jugadores, quinielas y resultados. Esta acción no se puede deshacer.');
  if (!confirmado) return;

  const msg = document.getElementById('reiniciar-msg');

  msg.style.display = 'block';
  msg.className = 'reset-msg cargando';
  msg.textContent = 'Borrando todo...';

  try {
    let total = 0;

    for (const col of ['jugadores', 'predicciones', 'resultados']) {
      const snap = await getDocs(collection(db, col));

      for (const d of snap.docs) {
        await deleteDoc(doc(db, col, d.id));
        total++;
      }
    }

    // Limpiar también configuraciones (fechas límite y aparición de jornadas)
    const configKeys = [
      'fechaLimite_jornada1', 'fechaLimite_jornada2', 'fechaLimite_jornada3',
      'aparicion_jornada2',   'aparicion_jornada3'
    ];
    for (const key of configKeys) {
      try { await deleteDoc(doc(db, 'config', key)); total++; } catch(_) {}
    }

    msg.className = 'reset-msg exito';
    msg.textContent = `✅ Se borraron ${total} registros correctamente.`;

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Error al reiniciar. Intenta de nuevo.';
  }
};

window.guardarAparicion = async function(jornada) {
  const sufijo = jornada === 'jornada2' ? 'j2' : 'j3';
  const fecha  = document.getElementById(`cfg-aparicion-fecha-${sufijo}`).value;
  const hora   = document.getElementById(`cfg-aparicion-hora-${sufijo}`).value;
  const msg    = document.getElementById(`cfg-aparicion-msg-${sufijo}`);

  if (!fecha || !hora) {
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Por favor selecciona fecha y hora.';
    return;
  }

  try {
    await setDoc(doc(db, 'config', `aparicion_${jornada}`), {
      jornada,
      fecha,
      hora,
      timestamp:     new Date(`${fecha}T${hora}:00`),
      actualizadoEn: new Date()
    });

    msg.style.display = 'block';
    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Fecha de aparición guardada.';

    document.getElementById(`cfg-aparicion-actual-${sufijo}`).textContent =
      `📅 Aparece el: ${fecha} a las ${hora} (CDMX)`;

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Error al guardar.';
  }
};

window.resetAparicion = async function(jornada) {
  const sufijo = jornada === 'jornada2' ? 'j2' : 'j3';
  const msg    = document.getElementById(`cfg-aparicion-msg-${sufijo}`);

  if (!confirm(`¿Borrar la fecha de aparición de ${jornada === 'jornada2' ? 'Jornada 2' : 'Jornada 3'}? La jornada dejará de ser visible para los jugadores.`)) return;

  try {
    await deleteDoc(doc(db, 'config', `aparicion_${jornada}`));

    document.getElementById(`cfg-aparicion-fecha-${sufijo}`).value = '';
    document.getElementById(`cfg-aparicion-hora-${sufijo}`).value  = '';
    document.getElementById(`cfg-aparicion-actual-${sufijo}`).textContent = '';

    msg.style.display = 'block';
    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Fecha de aparición eliminada.';

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Error al borrar.';
  }
};

window.resetFechaLimite = async function(jornada) {
  const sufijo = jornada === 'jornada1' ? 'j1' : jornada === 'jornada2' ? 'j2' : 'j3';
  const msg    = document.getElementById(`cfg-fecha-msg-${sufijo}`);

  if (!confirm(`¿Borrar la fecha límite de ${jornada === 'jornada1' ? 'Jornada 1' : jornada === 'jornada2' ? 'Jornada 2' : 'Jornada 3'}?`)) return;

  try {
    await deleteDoc(doc(db, 'config', `fechaLimite_${jornada}`));

    document.getElementById(`cfg-fecha-${sufijo}`).value = '';
    document.getElementById(`cfg-hora-${sufijo}`).value  = '';
    document.getElementById(`cfg-fecha-actual-${sufijo}`).textContent = '';

    msg.style.display = 'block';
    msg.className     = 'reset-msg exito';
    msg.textContent   = '✅ Fecha límite eliminada.';

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.style.display = 'block';
    msg.className     = 'reset-msg error';
    msg.textContent   = '❌ Error al borrar.';
  }
};

window.resetJornada = async function(jornada) {
  const labels = {
    jornada1: 'Jornada 1 (borra todo)',
    jornada2: 'Jornada 2 y Jornada 3',
    jornada3: 'Jornada 3'
  };

  const confirmado = confirm(`¿Seguro que quieres borrar los resultados Y predicciones de ${labels[jornada]}?`);
  if (!confirmado) return;

  const msg = document.getElementById('reset-msg');

  msg.style.display = 'block';
  msg.className = 'reset-msg cargando';
  msg.textContent = 'Borrando...';

  try {
    const jornadasABorrar = jornada === 'jornada1'
      ? ['jornada1','jornada2','jornada3']
      : jornada === 'jornada2'
        ? ['jornada2','jornada3']
        : ['jornada3'];

    let totalBorrados = 0;

    for (const j of jornadasABorrar) {
      const resSnap = await getDocs(query(collection(db, 'resultados'), where('jornada', '==', j)));

      for (const d of resSnap.docs) {
        await deleteDoc(doc(db, 'resultados', d.id));
        totalBorrados++;
      }

      const predSnap = await getDocs(query(collection(db, 'predicciones'), where('jornada', '==', j)));

      for (const d of predSnap.docs) {
        await deleteDoc(doc(db, 'predicciones', d.id));
        totalBorrados++;
      }
    }

    msg.className   = 'reset-msg exito';
    msg.textContent = `✅ Se borraron ${totalBorrados} registros correctamente.`;

    setTimeout(() => { msg.style.display = 'none'; }, 3000);

    if (document.getElementById('sec-dashboard').classList.contains('active')) {
      cargarDashboard();
    }

  } catch(e) {
    console.error(e);
    msg.className   = 'reset-msg error';
    msg.textContent = '❌ Error al borrar. Intenta de nuevo.';
  }
};

window.addEventListener('load', async () => {
  await cargarFase('jornada1');
  await cargarDashboard();
});