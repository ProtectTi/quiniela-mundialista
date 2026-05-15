import {
  collection,
  getDocs,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot,
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

const FASES_ELIMINATORIAS = {
  '16avos': {
    firestore: 'dieciseisavos',
    boton: 'fase-16',
    label: 'Dieciseisavos'
  },
  'octavos': {
    firestore: 'octavos',
    boton: 'fase-8',
    label: 'Octavos'
  },
  'cuartos': {
    firestore: 'cuartos',
    boton: 'fase-4',
    label: 'Cuartos'
  },
  'semifinal': {
    firestore: 'semifinal',
    boton: 'fase-sf',
    label: 'Semifinal'
  },

  'tercer': {
    firestore: 'tercer',
    boton: 'fase-3',
    label: '3er Lugar'
  },

  'final': {
    firestore: 'final',
    boton: 'fase-f',
    label: 'Final'
  }
};

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
  if (FASES_ELIMINATORIAS[fase]) {
    const btn = document.getElementById(FASES_ELIMINATORIAS[fase].boton);

    if (btn && btn.classList.contains('bloqueada')) {
      alert('🔒 Esta eliminatoria aún no está publicada.');
      return;
    }

    faseActiva = fase;

    document.querySelectorAll('.btn-fase').forEach(b => b.classList.remove('seleccionada'));

    if (btn) btn.classList.add('seleccionada');

    await cargarEliminatoria(fase);
    return;
  }

  faseActiva = fase;

  document.querySelectorAll('.btn-fase').forEach(b => b.classList.remove('seleccionada'));

  const mapaBotones = {
    jornada1: 'fase-j1',
    jornada2: 'fase-j2',
    jornada3: 'fase-j3'
  };

  const btnActivo = document.getElementById(mapaBotones[fase]);

  if (btnActivo) btnActivo.classList.add('seleccionada');

  const acciones = document.querySelector('.partidos-acciones');

  if (acciones) {
    acciones.style.display = 'flex';
    acciones.innerHTML = `
      <button class="btn-guardar-todo" onclick="guardarTodo()">Guardar todo</button>
      <button class="btn-aleatorio" onclick="resultadosAleatorios()">🌐 Resultados aleatorios (prueba)</button>
    `;
  }

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

async function cargarEliminatoria(fase) {
  const config = FASES_ELIMINATORIAS[fase];
  const contenedor = document.getElementById('lista-partidos');

  const acciones = document.querySelector('.partidos-acciones');

  if (acciones) {
    acciones.style.display = 'flex';
    acciones.innerHTML = `
      <button class="btn-guardar-todo" onclick="guardarTodoEliminatoria()">Guardar todo</button>
      <button class="btn-aleatorio" onclick="resultadosAleatoriosEliminatoria()">🌐 Resultados aleatorios (prueba)</button>
    `;
  }

  contenedor.innerHTML = `
    <div class="text-center py-5" style="color:var(--text-muted);">
      Cargando ${config.label}...
    </div>
  `;

  try {
    const snap = await getDocs(
      query(collection(db, 'eliminatorias'), where('fase', '==', config.firestore))
    );

    const partidos = snap.docs
      .map(d => ({ idDoc: d.id, ...d.data() }))
      .sort((a, b) => (a.numero || 0) - (b.numero || 0));

    document.getElementById('partidos-count').textContent =
      `${partidos.length} PARTIDOS`;

    if (!partidos.length) {
      contenedor.innerHTML = `
        <div class="panel-card text-center" style="color:var(--text-muted);">
          No hay partidos publicados para ${config.label}.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = `
      <div class="row g-3">
        ${partidos.map(p => renderEliminatoriaCard(p)).join('')}
      </div>
    `;

  } catch(e) {
    console.error(e);

    contenedor.innerHTML = `
      <div class="panel-card text-center" style="color:#ff6b7a;">
        Error al cargar ${config.label}.
      </div>
    `;
  }
}

function iniciarEliminatoriasListenerAdmin() {
  onSnapshot(collection(db, 'eliminatorias'), (snap) => {
    const fasesPublicadas = new Set();

    snap.docs.forEach(d => {
      const fase = d.data().fase;
      if (fase) fasesPublicadas.add(fase);
    });

    Object.entries(FASES_ELIMINATORIAS).forEach(([faseKey, cfg]) => {
      const btn = document.getElementById(cfg.boton);
      if (!btn) return;

      const publicada = fasesPublicadas.has(cfg.firestore);

      btn.classList.toggle('bloqueada', !publicada);
      btn.classList.toggle('pendiente', publicada);

      if (publicada) {
        btn.innerHTML = `🟢 ${cfg.label}`;
      } else {
        btn.innerHTML = `⚪ ${cfg.label}`;
      }
    });
    if (document.getElementById('sec-grupos')?.classList.contains('active')) {
      renderGruposAdminRealtime();
    }
  });
}

function renderEliminatoriaCard(p) {
  const flagLocal = BANDERAS[p.local] || 'mx';
  const flagVisita = BANDERAS[p.visita] || 'mx';

  const ml = p.marcadorLocal ?? 0;
  const mv = p.marcadorVisita ?? 0;
  const ganador = p.ganador || '';

  return `
    <div class="${faseActiva === 'cuartos' ? 'col-12 col-md-6 col-xl-3': faseActiva === 'semifinal' ? 'col-12 col-lg-6' : 'col-12 col-md-6 col-xl-4'}">
      <div class="dieciseisavos-card">
        <div class="dieciseisavos-card-top">
          <span>Partido n.º ${p.numero}</span>
          <strong>${p.hora}</strong>
        </div>

        <div class="dieciseisavos-teams">

          <div class="dieciseisavos-team">
            <span class="slot-label">${p.slotLocal || ''}</span>
            <div class="dieciseisavos-team-main">
              <img src="https://flagcdn.com/24x18/${flagLocal}.png" class="bandera-sm">
              <strong>${p.local || 'Por definir'}</strong>
            </div>
            <small>Local</small>
          </div>

          <div class="elim-marcador">
            <input type="number" min="0" max="99" value="${ml}" id="elim-local-${p.idDoc}">
            <span>:</span>
            <input type="number" min="0" max="99" value="${mv}" id="elim-visita-${p.idDoc}">
          </div>

          <div class="dieciseisavos-team">
            <span class="slot-label">${p.slotVisita || ''}</span>
            <div class="dieciseisavos-team-main">
              <img src="https://flagcdn.com/24x18/${flagVisita}.png" class="bandera-sm">
              <strong>${p.visita || 'Por definir'}</strong>
            </div>
            <small>Visitante</small>
          </div>

        </div>

        <div class="elim-ganador">
          <button class="${ganador === 'L' ? 'activo' : ''}" onclick="setGanadorEliminatoria('${p.idDoc}', 'L')">
            Gana ${p.local}
          </button>

          <button class="${ganador === 'V' ? 'activo' : ''}" onclick="setGanadorEliminatoria('${p.idDoc}', 'V')">
            Gana ${p.visita}
          </button>
        </div>

        <button class="btn-guardar-elim" onclick="guardarResultadoEliminatoria('${p.idDoc}')">
          Guardar resultado
        </button>

        <div class="dieciseisavos-info">
          ${p.fecha}
          <span>·</span>
          ${p.estadio} (${p.ciudad})
        </div>
      </div>
    </div>
  `;
}

window.setGanadorEliminatoria = function(idDoc, ganador) {
  document
    .querySelectorAll(`[onclick*="setGanadorEliminatoria('${idDoc}'"]`)
    .forEach(btn => btn.classList.remove('activo'));

  const btn = document.querySelector(`[onclick="setGanadorEliminatoria('${idDoc}', '${ganador}')"]`);
  if (btn) btn.classList.add('activo');

  window[`_ganador_${idDoc}`] = ganador;
};

window.guardarResultadoEliminatoria = async function(idDoc) {
  const inputLocal = document.getElementById(`elim-local-${idDoc}`);
  const inputVisita = document.getElementById(`elim-visita-${idDoc}`);

  const marcadorLocal = Math.max(0, parseInt(inputLocal?.value) || 0);
  const marcadorVisita = Math.max(0, parseInt(inputVisita?.value) || 0);

  let ganador = window[`_ganador_${idDoc}`];

  const btnActivo = document.querySelector(`[onclick*="setGanadorEliminatoria('${idDoc}'"].activo`);
  if (!ganador && btnActivo) {
    ganador = btnActivo.textContent.includes('Gana') ? null : null;
  }

  if (!ganador) {
    alert('⚠️ Selecciona quién ganó el partido.');
    return;
  }

  try {
    await setDoc(doc(db, 'eliminatorias', idDoc), {
      marcadorLocal,
      marcadorVisita,
      ganador,
      actualizadoEn: new Date()
    }, { merge: true });

    alert('✅ Resultado guardado correctamente.');

    if (FASES_ELIMINATORIAS[faseActiva]) {
      await cargarEliminatoria(faseActiva);
    }

  } catch(e) {
    console.error(e);
    alert('❌ Error al guardar resultado.');
  }
};

window.resultadosAleatoriosEliminatoria = function() {
  document.querySelectorAll('.dieciseisavos-card').forEach(card => {
    const btnGuardar = card.querySelector('.btn-guardar-elim');

    if (!btnGuardar) return;

    const onclick = btnGuardar.getAttribute('onclick') || '';
    const idDoc = onclick.match(/'([^']+)'/)?.[1];

    if (!idDoc) return;

    let gl = Math.floor(Math.random() * 6);
    let gv = Math.floor(Math.random() * 6);

    // En eliminatorias no puede quedar empate
    if (gl === gv) {
      Math.random() > 0.5 ? gl++ : gv++;
    }

    const inputLocal = document.getElementById(`elim-local-${idDoc}`);
    const inputVisita = document.getElementById(`elim-visita-${idDoc}`);

    if (inputLocal) inputLocal.value = gl;
    if (inputVisita) inputVisita.value = gv;

    const ganador = gl > gv ? 'L' : 'V';

    window.setGanadorEliminatoria(idDoc, ganador);
  });
};

window.guardarTodoEliminatoria = async function() {
  const btn = document.querySelector('.btn-guardar-todo');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const cards = Array.from(document.querySelectorAll('.dieciseisavos-card'));
    let guardados = 0;

    for (const card of cards) {
      const btnGuardar = card.querySelector('.btn-guardar-elim');

      if (!btnGuardar) continue;

      const onclick = btnGuardar.getAttribute('onclick') || '';
      const idDoc = onclick.match(/'([^']+)'/)?.[1];

      if (!idDoc) continue;

      const inputLocal = document.getElementById(`elim-local-${idDoc}`);
      const inputVisita = document.getElementById(`elim-visita-${idDoc}`);

      const marcadorLocal = Math.max(0, parseInt(inputLocal?.value) || 0);
      const marcadorVisita = Math.max(0, parseInt(inputVisita?.value) || 0);

      const ganador = window[`_ganador_${idDoc}`];

      if (!ganador) continue;

      await setDoc(doc(db, 'eliminatorias', idDoc), {
        marcadorLocal,
        marcadorVisita,
        ganador,
        actualizadoEn: new Date()
      }, { merge: true });

      guardados++;
    }

    if (btn) {
      btn.textContent = `✅ Guardado (${guardados})`;

      setTimeout(() => {
        btn.textContent = 'Guardar todo';
        btn.disabled = false;
      }, 2200);
    }

    if (FASES_ELIMINATORIAS[faseActiva]) {
      await cargarEliminatoria(faseActiva);
    }

  } catch(e) {
    console.error(e);

    if (btn) {
      btn.textContent = '❌ Error';
      btn.disabled = false;
    }

    alert('❌ Error al guardar eliminatorias.');
  }
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
    const [resSnap, elimSnap] = await Promise.all([
      getDocs(collection(db, 'resultados')),
      getDocs(collection(db, 'eliminatorias'))
    ]);

    const resultados = resSnap.docs.map(d => d.data());
    const eliminatorias = elimSnap.docs.map(d => ({
      idDoc: d.id,
      ...d.data()
    }));

    contenedor.innerHTML = `
      ${renderGruposHtml(resultados)}
      ${renderClasificadosYDieciseisavosHtml(resultados, eliminatorias)}
    `;
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
  const ordenEquipos = {};
  let orden = 1;

  const iniciar = (equipo, grupo) => {
    if (!ordenEquipos[equipo]) {
      ordenEquipos[equipo] = orden++;
    }

    if (!stats[equipo]) {
      stats[equipo] = {
        grupo,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        orden: ordenEquipos[equipo]
      };
    }
  };

  // Primero cargamos equipos en el orden real del calendario
  ['jornada1', 'jornada2', 'jornada3'].forEach(jornada => {
    (PARTIDOS_MUNDIAL[jornada] || []).forEach(p => {
      iniciar(p.local, p.grupo);
      iniciar(p.visitante, p.grupo);
    });
  });

  // Luego aplicamos resultados
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
      a.orden - b.orden
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
// CLASIFICADOS + DIECISEISAVOS
// ══════════════════════════════
function getPtsGrupo(e) {
  return e.pg * 3 + e.pe;
}

function getDgGrupo(e) {
  return e.gf - e.gc;
}

function ordenarClasificacion(a, b) {
  return getPtsGrupo(b) - getPtsGrupo(a) ||
         getDgGrupo(b) - getDgGrupo(a) ||
         b.gf - a.gf ||
         a.orden - b.orden;
}

function calcularClasificados(resultados) {
  const grupos = calcularGrupos(resultados);

  const primeros = [];
  const segundos = [];
  const terceros = [];

  Object.keys(grupos).sort().forEach(grupo => {
    const equipos = [...grupos[grupo]].sort(ordenarClasificacion);

    if (equipos[0]) primeros.push({ ...equipos[0], grupo, posicion: 1 });
    if (equipos[1]) segundos.push({ ...equipos[1], grupo, posicion: 2 });
    if (equipos[2]) terceros.push({ ...equipos[2], grupo, posicion: 3 });
  });

  const mejoresTerceros = [...terceros]
    .sort(ordenarClasificacion)
    .slice(0, 8)
    .map(e => ({ ...e, clasificado: true }));

  const keySet = new Set(mejoresTerceros.map(e => `${e.grupo}-${e.equipo}`));

  const tercerosConEstado = terceros
    .sort(ordenarClasificacion)
    .map(e => ({
      ...e,
      clasificado: keySet.has(`${e.grupo}-${e.equipo}`)
    }));

  return {
    primeros,
    segundos,
    terceros: tercerosConEstado,
    mejoresTerceros
  };
}

function renderClasificadosYDieciseisavosHtml(resultados, eliminatorias = []) {
  const clasificados = calcularClasificados(resultados);

  const totalPartidosGrupo = ['jornada1', 'jornada2', 'jornada3']
    .reduce((acc, j) => acc + (PARTIDOS_MUNDIAL[j]?.length || 0), 0);

  const resultadosGrupo = resultados.filter(r =>
    ['jornada1', 'jornada2', 'jornada3'].includes(r.jornada)
  ).length;

  return `
    <div class="clasificados-section mt-4">

      <div class="clasificados-header">
        <div>
          <h3>Clasificados a Dieciseisavos</h3>
          <p>${resultadosGrupo}/${totalPartidosGrupo} resultados de fase de grupos capturados</p>
        </div>

        <span class="clasificados-badge">
          ${resultadosGrupo >= totalPartidosGrupo ? 'Fase completa' : 'Proyección en vivo'}
        </span>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-4">
          ${renderBloqueClasificados('1° lugar de grupo', clasificados.primeros, 'oro')}
        </div>

        <div class="col-12 col-lg-4">
          ${renderBloqueClasificados('2° lugar de grupo', clasificados.segundos, 'plata')}
        </div>

        <div class="col-12 col-lg-4">
          ${renderBloqueTerceros(clasificados.terceros)}
        </div>
      </div>

      ${renderPreviewDieciseisavos(clasificados)}
      ${renderPreviewOctavos(eliminatorias)}
      ${renderPreviewCuartos(eliminatorias)}
      ${renderPreviewSemifinales(eliminatorias)}
      ${renderPreviewTercerLugar(eliminatorias)}
      ${renderPreviewFinal(eliminatorias)}
    </div>
  `;
}

function renderBloqueClasificados(titulo, equipos, tipo) {
  return `
    <div class="clasificados-card">
      <div class="clasificados-card-title ${tipo}">
        ${titulo}
      </div>

      <div class="clasificados-list">
        ${equipos.map(e => renderClasificadoRow(e, true)).join('')}
      </div>
    </div>
  `;
}

function renderBloqueTerceros(terceros) {
  return `
    <div class="clasificados-card">
      <div class="clasificados-card-title bronce">
        8 mejores 3° lugares
      </div>

      <div class="clasificados-list">
        ${terceros.map(e => renderClasificadoRow(e, e.clasificado)).join('')}
      </div>
    </div>
  `;
}

function renderClasificadoRow(e, clasificado) {
  const flag = BANDERAS[e.equipo] || 'mx';
  const pts = getPtsGrupo(e);
  const dg  = getDgGrupo(e);

  return `
    <div class="clasificado-row ${clasificado ? 'clasifica' : 'no-clasifica'}">
      <div class="clasificado-equipo">
        <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
        <span>${e.equipo}</span>
        <small>Grupo ${e.grupo}</small>
      </div>

      <div class="clasificado-stats">
        <span>${pts} pts</span>
        <small>DG ${dg > 0 ? '+' + dg : dg}</small>
      </div>
    </div>
  `;
}

function buscarPorGrupo(lista, grupo) {
  return lista.find(e => e.grupo === grupo) || null;
}

function getDieciseisavosOficiales() {
  return [
    { id: 73, local: '2A', visita: '2B', hora: '13:00', fecha: '28 Jun 2026', estadio: 'SoFi Stadium, Inglewood, California, EUA', ciudad: 'Los Ángeles' },
    { id: 76, local: '1C', visita: '2F', hora: '11:00', fecha: '29 Jun 2026', estadio: 'NRG Stadium, Houston, Texas, EUA', ciudad: 'Houston' },
    { id: 74, local: '1E', visita: '3ABCDF', hora: '14:30', fecha: '29 Jun 2026', estadio: 'Gillette Stadium, Foxborough, Massachusetts, EUA', ciudad: 'Boston' },
    { id: 75, local: '1F', visita: '2C', hora: '19:00', fecha: '29 Jun 2026', estadio: 'Estadio BBVA, Guadalupe, México', ciudad: 'Monterrey' },
    { id: 78, local: '2E', visita: '2I', hora: '11:00', fecha: '30 Jun 2026', estadio: 'AT&T Stadium, Arlington, Texas, EUA', ciudad: 'Dallas' },
    { id: 77, local: '1I', visita: '3CDFGH', hora: '15:00', fecha: '30 Jun 2026', estadio: 'MetLife Stadium, East Rutherford, New Jersey, EUA', ciudad: 'Nueva York/Nueva Jersey' },
    { id: 79, local: '1A', visita: '3CEFHI', hora: '19:00', fecha: '30 Jun 2026', estadio: 'Estadio Banorte, Mexico City, México', ciudad: 'Ciudad de México' },
    { id: 80, local: '1L', visita: '3EHIJK', hora: '10:00', fecha: '01 Jul 2026', estadio: 'Mercedes-Benz Stadium, Atlanta, Georgia, EUA', ciudad: 'Atlanta' },
    { id: 82, local: '1G', visita: '3AEHIJ', hora: '14:00', fecha: '01 Jul 2026', estadio: 'Lumen Field, Seattle, Washington, EUA', ciudad: 'Seattle' },
    { id: 81, local: '1D', visita: '3BEFIJ', hora: '18:00', fecha: '01 Jul 2026', estadio: "Levi's Stadium, Santa Clara, California, EUA", ciudad: 'Área de la Bahía' },
    { id: 84, local: '1H', visita: '2J', hora: '13:00', fecha: '02 Jul 2026', estadio: 'SoFi Stadium, Inglewood, California, EUA', ciudad: 'Los Ángeles' },
    { id: 83, local: '2K', visita: '2L', hora: '17:00', fecha: '02 Jul 2026', estadio: 'BMO Field, Toronto, Canadá', ciudad: 'Toronto' },
    { id: 85, local: '1B', visita: '3EFGIJ', hora: '21:00', fecha: '02 Jul 2026', estadio: 'BC Place, Vancouver, Canadá', ciudad: 'Vancouver' },
    { id: 88, local: '2D', visita: '2G', hora: '12:00', fecha: '03 Jul 2026', estadio: 'AT&T Stadium, Arlington, Texas, EUA', ciudad: 'Dallas' },
    { id: 86, local: '1J', visita: '2H', hora: '16:00', fecha: '03 Jul 2026', estadio: 'Hard Rock Stadium, Miami Gardens, Florida, EUA', ciudad: 'Miami' },
    { id: 87, local: '1K', visita: '3DEIJL', hora: '19:30', fecha: '03 Jul 2026', estadio: 'GEHA Field at Arrowhead Stadium, Kansas City, Missouri, EUA', ciudad: 'Kansas City' }
  ];
}

function asignarMejoresTerceros(partidos, clasificados) {
  const terceros = clasificados.mejoresTerceros || [];

  const slots = partidos
    .flatMap(p => [p.local, p.visita])
    .filter(slot => slot.startsWith('3'));

  const asignaciones = {};
  const usados = new Set();

  function backtrack(index) {
    if (index >= slots.length) return true;

    const slot = slots[index];
    const permitidos = slot.replace('3', '').split('');

    for (const tercero of terceros) {
      if (usados.has(tercero.grupo)) continue;
      if (!permitidos.includes(tercero.grupo)) continue;

      asignaciones[slot] = tercero;
      usados.add(tercero.grupo);

      if (backtrack(index + 1)) return true;

      usados.delete(tercero.grupo);
      delete asignaciones[slot];
    }

    return false;
  }

  backtrack(0);

  return asignaciones;
}

function resolverSlotDieciseisavos(slot, clasificados, tercerosAsignados) {
  if (slot.startsWith('1')) {
    return buscarPorGrupo(clasificados.primeros, slot.replace('1', ''));
  }

  if (slot.startsWith('2')) {
    return buscarPorGrupo(clasificados.segundos, slot.replace('2', ''));
  }

  if (slot.startsWith('3')) {
    return tercerosAsignados[slot] || {
      equipo: `Mejor 3° ${slot.replace('3', '').split('').join('/')}`,
      grupo: slot.replace('3', ''),
      posicion: 3,
      placeholder: true
    };
  }

  return null;
}

function renderPreviewDieciseisavos(clasificados) {
  const partidosBase = getDieciseisavosOficiales();
  const tercerosAsignados = asignarMejoresTerceros(partidosBase, clasificados);

  const partidos = partidosBase.map(p => ({
    ...p,
    equipoLocal: resolverSlotDieciseisavos(p.local, clasificados, tercerosAsignados),
    equipoVisita: resolverSlotDieciseisavos(p.visita, clasificados, tercerosAsignados)
  }));

  return `
    <div class="dieciseisavos-preview mt-4">
      <div class="dieciseisavos-header">
        <div>
          <h3>Vista previa — Dieciseisavos</h3>
          <p>Cruces proyectados con los clasificados actuales</p>
          <button class="btn-generar-dieciseisavos"
                  onclick="window.generarDieciseisavos()">
            Generar dieciseisavos
          </button>
        </div>

        <span class="clasificados-badge">Proyección automática</span>
      </div>

      <div class="row g-3 dieciseisavos-grid">
        ${partidos.map(p => renderPartidoDieciseisavos(p)).join('')}
      </div>
    </div>
  `;
}

function renderPartidoDieciseisavos(p) {
  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="dieciseisavos-card">
        <div class="dieciseisavos-card-top">
          <span>Partido n.º ${p.id}</span>
          <strong>${p.hora}</strong>
        </div>

        <div class="dieciseisavos-teams">
          ${renderSlotDieciseisavos(p.local, p.equipoLocal)}

          <div class="dieciseisavos-vs">VS</div>

          ${renderSlotDieciseisavos(p.visita, p.equipoVisita)}
        </div>

        <div class="dieciseisavos-info">
          ${p.fecha}
          <span>·</span>
          ${p.estadio} (${p.ciudad})
        </div>
      </div>
    </div>
  `;
}

function renderSlotDieciseisavos(slot, equipo) {
  if (!equipo) {
    return `
      <div class="dieciseisavos-team pendiente">
        <span class="slot-label">${slot}</span>
        <div class="dieciseisavos-team-main">
          <span class="shield-icon">♢</span>
          <strong>Por definir</strong>
        </div>
        <small>Sin clasificado todavía</small>
      </div>
    `;
  }

  if (equipo.placeholder) {
    return `
      <div class="dieciseisavos-team pendiente">
        <span class="slot-label">${slot}</span>
        <div class="dieciseisavos-team-main">
          <span class="shield-icon">♢</span>
          <strong>${equipo.equipo}</strong>
        </div>
        <small>Asignación pendiente</small>
      </div>
    `;
  }

  const flag = BANDERAS[equipo.equipo] || 'mx';

  return `
    <div class="dieciseisavos-team">
      <span class="slot-label">${slot}</span>

      <div class="dieciseisavos-team-main">
        <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
        <strong>${equipo.equipo}</strong>
      </div>

      <small>${equipo.posicion}° Grupo ${equipo.grupo}</small>
    </div>
  `;
}

// ══════════════════════════════
// PREVIEW OCTAVOS FIFA
// ══════════════════════════════
function getOctavosOficialesPreview() {
  return [
    { numero: 90, local: 'W73', visita: 'W75', hora: '11:00', fecha: '04 Jul 2026', estadio: 'NRG Stadium, Houston, Texas, EUA', ciudad: 'Houston' },
    { numero: 89, local: 'W74', visita: 'W77', hora: '15:00', fecha: '04 Jul 2026', estadio: 'Lincoln Financial Field, Philadelphia, Pennsylvania, EUA', ciudad: 'Filadelfia' },
    { numero: 91, local: 'W76', visita: 'W78', hora: '14:00', fecha: '05 Jul 2026', estadio: 'MetLife Stadium, East Rutherford, New Jersey, EUA', ciudad: 'Nueva York/Nueva Jersey' },
    { numero: 92, local: 'W79', visita: 'W80', hora: '18:00', fecha: '05 Jul 2026', estadio: 'Estadio Banorte, Mexico City, México', ciudad: 'Ciudad de México' },
    { numero: 93, local: 'W83', visita: 'W84', hora: '13:00', fecha: '06 Jul 2026', estadio: 'AT&T Stadium, Arlington, Texas, EUA', ciudad: 'Dallas' },
    { numero: 94, local: 'W81', visita: 'W82', hora: '18:00', fecha: '06 Jul 2026', estadio: 'Lumen Field, Seattle, Washington, EUA', ciudad: 'Seattle' },
    { numero: 95, local: 'W86', visita: 'W88', hora: '10:00', fecha: '07 Jul 2026', estadio: 'Mercedes-Benz Stadium, Atlanta, Georgia, EUA', ciudad: 'Atlanta' },
    { numero: 96, local: 'W85', visita: 'W87', hora: '14:00', fecha: '07 Jul 2026', estadio: 'BC Place, Vancouver, Canadá', ciudad: 'Vancouver' }
  ];
}

function getGanadorDieciseisavos(eliminatorias, numero) {
  const partido = eliminatorias.find(p =>
    p.fase === 'dieciseisavos' && Number(p.numero) === Number(numero)
  );

  if (!partido || !partido.ganador) return null;

  const equipo = partido.ganador === 'L'
    ? partido.local
    : partido.visita;

  return equipo || null;
}

function renderPreviewOctavos(eliminatorias = []) {
  const partidos = getOctavosOficialesPreview().map(p => {
    const numLocal = Number(p.local.replace('W', ''));
    const numVisita = Number(p.visita.replace('W', ''));

    return {
      ...p,
      equipoLocal: getGanadorDieciseisavos(eliminatorias, numLocal),
      equipoVisita: getGanadorDieciseisavos(eliminatorias, numVisita)
    };
  });

  return `
    <div class="dieciseisavos-preview mt-4">
      <div class="dieciseisavos-header">
        <div>
          <h3>Vista previa — Octavos</h3>
          <p>Cruces oficiales FIFA según ganadores de dieciseisavos</p>

          <button class="btn-generar-octavos"
                  onclick="window.generarOctavos()">
            Generar octavos
          </button>
        </div>

        <span class="clasificados-badge">Después de dieciseisavos</span>
      </div>

      <div class="row g-3 dieciseisavos-grid">
        ${partidos.map(p => renderPartidoOctavosPreview(p)).join('')}
      </div>
    </div>
  `;
}

function renderPartidoOctavosPreview(p) {
  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="dieciseisavos-card">
        <div class="dieciseisavos-card-top">
          <span>Partido n.º ${p.numero}</span>
          <strong>${p.hora}</strong>
        </div>

        <div class="dieciseisavos-teams">
          ${renderSlotOctavosPreview(p.local, p.equipoLocal)}

          <div class="dieciseisavos-vs">VS</div>

          ${renderSlotOctavosPreview(p.visita, p.equipoVisita)}
        </div>

        <div class="dieciseisavos-info">
          ${p.fecha}
          <span>·</span>
          ${p.estadio} (${p.ciudad})
        </div>
      </div>
    </div>
  `;
}

function renderSlotOctavosPreview(slot, equipo) {
  if (!equipo) {
    return `
      <div class="dieciseisavos-team pendiente">
        <span class="slot-label">${slot}</span>

        <div class="dieciseisavos-team-main">
          <span class="shield-icon">♢</span>
          <strong>Ganador ${slot.replace('W', 'P.')}</strong>
        </div>

        <small>Se define en dieciseisavos</small>
      </div>
    `;
  }

  const flag = BANDERAS[equipo] || 'mx';

  return `
    <div class="dieciseisavos-team">
      <span class="slot-label">${slot}</span>

      <div class="dieciseisavos-team-main">
        <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
        <strong>${equipo}</strong>
      </div>

      <small>Ganador ${slot.replace('W', 'P.')}</small>
    </div>
  `;
}

function getGanadorOctavos(eliminatorias, numero) {
  const partido = eliminatorias.find(p =>
    p.fase === 'octavos' && Number(p.numero) === Number(numero)
  );

  if (!partido || !partido.ganador) return null;

  return partido.ganador === 'L'
    ? partido.local
    : partido.visita;
}

// ══════════════════════════════
// PREVIEW CUARTOS FIFA
// ══════════════════════════════
function getCuartosPreview() {
  return [
    {
      numero: 97,
      local: 'W89',
      visita: 'W90',
      hora: '14:00',
      estadio: 'Gillette Stadium',
      ciudad: 'Boston'
    },

    {
      numero: 98,
      local: 'W93',
      visita: 'W94',
      hora: '13:00',
      estadio: 'SoFi Stadium',
      ciudad: 'Los Ángeles'
    },

    {
      numero: 99,
      local: 'W91',
      visita: 'W92',
      hora: '15:00',
      estadio: 'Hard Rock Stadium',
      ciudad: 'Miami'
    },

    {
      numero: 100,
      local: 'W95',
      visita: 'W96',
      hora: '19:00',
      estadio: 'Arrowhead Stadium',
      ciudad: 'Kansas City'
    }
  ];
}

function renderPreviewCuartos(eliminatorias = []) {
  const partidos = getCuartosPreview().map(p => {
    const numLocal = Number(p.local.replace('W', ''));
    const numVisita = Number(p.visita.replace('W', ''));

    return {
      ...p,
      equipoLocal: getGanadorOctavos(eliminatorias, numLocal),
      equipoVisita: getGanadorOctavos(eliminatorias, numVisita)
    };
  });

  return `
    <div class="dieciseisavos-preview mt-4">

      <div class="dieciseisavos-header">

        <div>
          <h3>Vista previa — Cuartos</h3>

          <p>
            Cruces oficiales FIFA según ganadores de octavos
          </p>

          <button class="btn-generar-cuartos"
                  onclick="window.generarCuartos()">
            Generar cuartos
          </button>
        </div>

        <span class="clasificados-badge">
          Después de octavos
        </span>

      </div>

      <div class="row g-3 dieciseisavos-grid">

        ${partidos.map(p => `
          <div class="col-12 col-md-6 col-xl-3">
            <div class="dieciseisavos-card">

              <div class="dieciseisavos-card-top">
                <span>Partido n.º ${p.numero}</span>
                <strong>${p.hora}</strong>
              </div>

              <div class="dieciseisavos-teams">
                ${renderSlotCuartosPreview(p.local, p.equipoLocal)}

                <div class="dieciseisavos-vs">VS</div>

                ${renderSlotCuartosPreview(p.visita, p.equipoVisita)}
              </div>

              <div class="dieciseisavos-info">
                Cuartos de final
                <span>·</span>
                ${p.estadio} (${p.ciudad})
              </div>

            </div>
          </div>
        `).join('')}

      </div>

    </div>
  `;
}

function renderSlotCuartosPreview(slot, equipo) {
  if (!equipo) {
    return `
      <div class="dieciseisavos-team pendiente">
        <span class="slot-label">${slot}</span>

        <div class="dieciseisavos-team-main">
          <span class="shield-icon">♢</span>
          <strong>Ganador ${slot.replace('W', 'P.')}</strong>
        </div>

        <small>Se define en octavos</small>
      </div>
    `;
  }

  const flag = BANDERAS[equipo] || 'mx';

  return `
    <div class="dieciseisavos-team">
      <span class="slot-label">${slot}</span>

      <div class="dieciseisavos-team-main">
        <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
        <strong>${equipo}</strong>
      </div>

      <small>Ganador ${slot.replace('W', 'P.')}</small>
    </div>
  `;
}

function getSemifinalesPreview() {
  return [
    {
      numero: 101,
      local: 'W97',
      visita: 'W98',
      hora: '18:00',
      fecha: '14 Jul 2026',
      estadio: 'AT&T Stadium, Arlington, Texas, EUA',
      ciudad: 'Dallas'
    },
    {
      numero: 102,
      local: 'W99',
      visita: 'W100',
      hora: '18:00',
      fecha: '15 Jul 2026',
      estadio: 'Mercedes-Benz Stadium, Atlanta, Georgia, EUA',
      ciudad: 'Atlanta'
    }
  ];
}

function getGanadorCuartos(eliminatorias, numero) {
  const partido = eliminatorias.find(p =>
    p.fase === 'cuartos' && Number(p.numero) === Number(numero)
  );

  if (!partido || !partido.ganador) return null;

  return partido.ganador === 'L'
    ? partido.local
    : partido.visita;
}

function renderPreviewSemifinales(eliminatorias = []) {
  const partidos = getSemifinalesPreview().map(p => {
    const numLocal = Number(p.local.replace('W', ''));
    const numVisita = Number(p.visita.replace('W', ''));

    return {
      ...p,
      equipoLocal: getGanadorCuartos(eliminatorias, numLocal),
      equipoVisita: getGanadorCuartos(eliminatorias, numVisita)
    };
  });

  return `
    <div class="dieciseisavos-preview mt-4">
      <div class="dieciseisavos-header">
        <div>
          <h3>Vista previa — Semifinales</h3>
          <p>Cruces oficiales FIFA según ganadores de cuartos</p>

          <button class="btn-generar-semifinales"
                  onclick="window.generarSemifinales()">
            Generar semifinales
          </button>
        </div>

        <span class="clasificados-badge">Después de cuartos</span>
      </div>

      <div class="row g-3 dieciseisavos-grid">
        ${partidos.map(p => `
          <div class="col-12 col-md-6">
            <div class="dieciseisavos-card">
              <div class="dieciseisavos-card-top">
                <span>Partido n.º ${p.numero}</span>
                <strong>${p.hora}</strong>
              </div>

              <div class="dieciseisavos-teams">
                ${renderSlotSemifinalPreview(p.local, p.equipoLocal)}

                <div class="dieciseisavos-vs">VS</div>

                ${renderSlotSemifinalPreview(p.visita, p.equipoVisita)}
              </div>

              <div class="dieciseisavos-info">
                ${p.fecha}
                <span>·</span>
                ${p.estadio} (${p.ciudad})
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSlotSemifinalPreview(slot, equipo) {
  if (!equipo) {
    return `
      <div class="dieciseisavos-team pendiente">
        <span class="slot-label">${slot}</span>
        <div class="dieciseisavos-team-main">
          <span class="shield-icon">♢</span>
          <strong>Ganador ${slot.replace('W', 'P.')}</strong>
        </div>
        <small>Se define en cuartos</small>
      </div>
    `;
  }

  const flag = BANDERAS[equipo] || 'mx';

  return `
    <div class="dieciseisavos-team">
      <span class="slot-label">${slot}</span>
      <div class="dieciseisavos-team-main">
        <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
        <strong>${equipo}</strong>
      </div>
      <small>Ganador ${slot.replace('W', 'P.')}</small>
    </div>
  `;
}

function getEquipoSemifinal(eliminatorias, numero, tipo) {
  const partido = eliminatorias.find(p =>
    p.fase === 'semifinal' && Number(p.numero) === Number(numero)
  );

  if (!partido || !partido.ganador) return null;

  if (tipo === 'ganador') {
    return partido.ganador === 'L' ? partido.local : partido.visita;
  }

  return partido.ganador === 'L' ? partido.visita : partido.local;
}

function renderPreviewTercerLugar(eliminatorias = []) {
  const local = getEquipoSemifinal(eliminatorias, 101, 'perdedor');
  const visita = getEquipoSemifinal(eliminatorias, 102, 'perdedor');

  return renderPreviewPartidoUnico({
    titulo: 'Vista previa — 3er Lugar',
    subtitulo: 'Perdedores de semifinales',
    badge: 'Después de semifinales',
    boton: 'Generar 3er lugar',
    accion: 'window.generarTercerLugar()',
    numero: 103,
    slotLocal: 'RU101',
    slotVisita: 'RU102',
    local,
    visita,
    fecha: '18 Jul 2026',
    hora: '15:00',
    estadio: 'Hard Rock Stadium, Miami Gardens, Florida, EUA',
    ciudad: 'Miami'
  });
}

function renderPreviewFinal(eliminatorias = []) {
  const local = getEquipoSemifinal(eliminatorias, 101, 'ganador');
  const visita = getEquipoSemifinal(eliminatorias, 102, 'ganador');

  return renderPreviewPartidoUnico({
    titulo: 'Vista previa — Final',
    subtitulo: 'Ganadores de semifinales',
    badge: 'Después de semifinales',
    boton: 'Generar final',
    accion: 'window.generarFinal()',
    numero: 104,
    slotLocal: 'W101',
    slotVisita: 'W102',
    local,
    visita,
    fecha: '19 Jul 2026',
    hora: '13:00',
    estadio: 'MetLife Stadium, East Rutherford, New Jersey, EUA',
    ciudad: 'Nueva York/Nueva Jersey'
  });
}

function renderPreviewPartidoUnico(p) {
  return `
    <div class="dieciseisavos-preview mt-4">
      <div class="dieciseisavos-header">
        <div>
          <h3>${p.titulo}</h3>
          <p>${p.subtitulo}</p>

          <button class="btn-generar-finales"
                  onclick="${p.accion}">
            ${p.boton}
          </button>
        </div>

        <span class="clasificados-badge">${p.badge}</span>
      </div>

      <div class="row g-3 dieciseisavos-grid">
        <div class="col-12 col-lg-6 mx-auto">
          <div class="dieciseisavos-card">
            <div class="dieciseisavos-card-top">
              <span>Partido n.º ${p.numero}</span>
              <strong>${p.hora}</strong>
            </div>

            <div class="dieciseisavos-teams">
              ${renderSlotFinalPreview(p.slotLocal, p.local)}

              <div class="dieciseisavos-vs">VS</div>

              ${renderSlotFinalPreview(p.slotVisita, p.visita)}
            </div>

            <div class="dieciseisavos-info">
              ${p.fecha}
              <span>·</span>
              ${p.estadio} (${p.ciudad})
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSlotFinalPreview(slot, equipo) {
  if (!equipo) {
    return `
      <div class="dieciseisavos-team pendiente">
        <span class="slot-label">${slot}</span>
        <div class="dieciseisavos-team-main">
          <span class="shield-icon">♢</span>
          <strong>${slot.startsWith('RU') ? 'Perdedor' : 'Ganador'} ${slot.replace('RU', 'P.').replace('W', 'P.')}</strong>
        </div>
        <small>Se define en semifinales</small>
      </div>
    `;
  }

  const flag = BANDERAS[equipo] || 'mx';

  return `
    <div class="dieciseisavos-team">
      <span class="slot-label">${slot}</span>
      <div class="dieciseisavos-team-main">
        <img src="https://flagcdn.com/24x18/${flag}.png" class="bandera-sm">
        <strong>${equipo}</strong>
      </div>
      <small>Desde semifinales</small>
    </div>
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

  unsubscribePosicionesAdmin.push(
    onSnapshot(collection(db, 'eliminatorias'), programarRenderPosicionesAdmin)
  );

  renderPosicionesAdminRealtime();
};

async function renderPosicionesAdminRealtime() {
  const tbody = document.getElementById('posiciones-tbody');

  if (!tbody) return;

  try {
    const [jugSnap, predSnap, resSnap, elimSnap] = await Promise.all([
      getDocs(collection(db, 'jugadores')),
      getDocs(collection(db, 'predicciones')),
      getDocs(collection(db, 'resultados')),
      getDocs(collection(db, 'eliminatorias'))
    ]);

    const resMap = {};
    resSnap.docs.forEach(d => {
      const data = d.data();
      resMap[(data.partidoId || '').toLowerCase()] = data.lev;
    });

    const elimMap = {};
    elimSnap.docs.forEach(d => {
      const data = d.data();
      if (data.ganador) {
        elimMap[d.id] = data.ganador;
      }
    });

    const totalResultados = resSnap.size + Object.keys(elimMap).length;

    const aciertosMap = {};
    const aciertosGrupoMap = {};
    const aciertosElimMap = {};

    predSnap.docs.forEach(d => {
      const data = d.data();
      const partidoId = data.partidoId || '';
      const resultadoGrupos = resMap[partidoId.toLowerCase()];
      const resultadoElim = elimMap[partidoId];

      const resultadoReal = resultadoGrupos || resultadoElim;

      if (resultadoReal && resultadoReal === data.pick) {
        aciertosMap[data.jugadorId] = (aciertosMap[data.jugadorId] || 0) + 1;

        if (resultadoGrupos) {
          aciertosGrupoMap[data.jugadorId] = (aciertosGrupoMap[data.jugadorId] || 0) + 1;
        }

        if (resultadoElim) {
          aciertosElimMap[data.jugadorId] = (aciertosElimMap[data.jugadorId] || 0) + 1;
        }
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
      aciertos: aciertosMap[d.id] || 0,
      aciertosGrupo: aciertosGrupoMap[d.id] || 0,
      aciertosElim: aciertosElimMap[d.id] || 0
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
              G:${j.aciertosGrupo} · E:${j.aciertosElim} · T:${j.aciertos}/${totalResultados}
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
function getConfigSuffix(fase) {
  if (fase === 'jornada1') return 'j1';
  if (fase === 'jornada2') return 'j2';
  if (fase === 'jornada3') return 'j3';
  if (fase === 'dieciseisavos') return 'd16';
  if (fase === 'octavos') return 'oct';
  if (fase === 'cuartos') return 'cua';
  if (fase === 'semifinal') return 'sf';
  if (fase === 'tercer') return 'ter';
  if (fase === 'final') return 'fin';
  return fase;
}

function getConfigLabel(fase) {
  if (fase === 'jornada1') return 'Jornada 1';
  if (fase === 'jornada2') return 'Jornada 2';
  if (fase === 'jornada3') return 'Jornada 3';
  if (fase === 'dieciseisavos') return 'Dieciseisavos';
  if (fase === 'octavos') return 'Octavos';
  if (fase === 'cuartos') return 'Cuartos';
  if (fase === 'semifinal') return 'Semifinales';
  if (fase === 'tercer') return '3er Lugar';
  if (fase === 'final') return 'Final';
  return fase;
}

window.guardarFechaLimite = async function(fase) {
  const sufijo = getConfigSuffix(fase);
  const fecha = document.getElementById(`cfg-fecha-${sufijo}`).value;
  const hora  = document.getElementById(`cfg-hora-${sufijo}`).value;
  const msg   = document.getElementById(`cfg-fecha-msg-${sufijo}`);

  if (!fecha || !hora) {
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Por favor selecciona fecha y hora.';
    return;
  }

  try {
    await setDoc(doc(db, 'config', `fechaLimite_${fase}`), {
      fase,
      jornada: fase,
      fecha,
      hora,
      timestamp: new Date(`${fecha}T${hora}:00`),
      actualizadoEn: new Date()
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
    const fasesLimite = [
      ['j1', 'jornada1'],
      ['j2', 'jornada2'],
      ['j3', 'jornada3'],
      ['d16', 'dieciseisavos'],
      ['oct', 'octavos'],
      ['cua', 'cuartos'],
      ['sf', 'semifinal'],
      ['ter', 'tercer'],
      ['fin', 'final']
    ];

    const fasesAparicion = [
      ['j2', 'jornada2'],
      ['j3', 'jornada3'],
      ['d16', 'dieciseisavos'],
      ['oct', 'octavos'],
      ['cua', 'cuartos'],
      ['sf', 'semifinal'],
      ['ter', 'tercer'],
      ['fin', 'final']
    ];

    const snapsLimite = await Promise.all(
      fasesLimite.map(([_, fase]) =>
        getDoc(doc(db, 'config', `fechaLimite_${fase}`))
      )
    );

    const snapsAparicion = await Promise.all(
      fasesAparicion.map(([_, fase]) =>
        getDoc(doc(db, 'config', `aparicion_${fase}`))
      )
    );

    fasesLimite.forEach(([sufijo], i) => {
      const snap = snapsLimite[i];

      if (snap.exists()) {
        const data = snap.data();

        document.getElementById(`cfg-fecha-${sufijo}`).value = data.fecha;
        document.getElementById(`cfg-hora-${sufijo}`).value  = data.hora;

        mostrarFechaActual(sufijo, data.fecha, data.hora);
      }
    });

    fasesAparicion.forEach(([sufijo], i) => {
      const snap = snapsAparicion[i];

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

window.guardarAparicion = async function(fase) {
  const sufijo = getConfigSuffix(fase);
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
    await setDoc(doc(db, 'config', `aparicion_${fase}`), {
      fase,
      jornada: fase,
      fecha,
      hora,
      timestamp: new Date(`${fecha}T${hora}:00`),
      actualizadoEn: new Date()
    });

    msg.style.display = 'block';
    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Fecha de publicación guardada.';

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

window.resetAparicion = async function(fase) {
  const sufijo = getConfigSuffix(fase);
  const msg    = document.getElementById(`cfg-aparicion-msg-${sufijo}`);
  const label  = getConfigLabel(fase);

  if (!confirm(`¿Borrar la fecha de publicación de ${label}?`)) return;

  try {
    await deleteDoc(doc(db, 'config', `aparicion_${fase}`));

    document.getElementById(`cfg-aparicion-fecha-${sufijo}`).value = '';
    document.getElementById(`cfg-aparicion-hora-${sufijo}`).value  = '';
    document.getElementById(`cfg-aparicion-actual-${sufijo}`).textContent = '';

    msg.style.display = 'block';
    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Fecha de publicación eliminada.';

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Error al borrar.';
  }
};

window.resetFechaLimite = async function(fase) {
  const sufijo = getConfigSuffix(fase);
  const msg    = document.getElementById(`cfg-fecha-msg-${sufijo}`);
  const label  = getConfigLabel(fase);

  if (!confirm(`¿Borrar la fecha límite de ${label}?`)) return;

  try {
    await deleteDoc(doc(db, 'config', `fechaLimite_${fase}`));

    document.getElementById(`cfg-fecha-${sufijo}`).value = '';
    document.getElementById(`cfg-hora-${sufijo}`).value  = '';
    document.getElementById(`cfg-fecha-actual-${sufijo}`).textContent = '';

    msg.style.display = 'block';
    msg.className = 'reset-msg exito';
    msg.textContent = '✅ Fecha límite eliminada.';

    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error(e);
    msg.style.display = 'block';
    msg.className = 'reset-msg error';
    msg.textContent = '❌ Error al borrar.';
  }
};

async function borrarEliminatoriasTodas() {
  let total = 0;
  const snap = await getDocs(collection(db, 'eliminatorias'));

  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'eliminatorias', d.id));
    total++;
  }

  return total;
}

async function borrarEliminatoriaPorFase(fase) {
  let total = 0;

  // Borrar partidos generados de eliminatorias
  const elimSnap = await getDocs(
    query(collection(db, 'eliminatorias'), where('fase', '==', fase))
  );

  for (const d of elimSnap.docs) {
    await deleteDoc(doc(db, 'eliminatorias', d.id));
    total++;
  }

  // Borrar predicciones de jugadores de esa eliminatoria
  const predSnap = await getDocs(
    query(collection(db, 'predicciones'), where('jornada', '==', fase))
  );

  for (const d of predSnap.docs) {
    await deleteDoc(doc(db, 'predicciones', d.id));
    total++;
  }

  return total;
}

async function borrarFasesEliminatoria(fases) {
  let total = 0;

  for (const fase of fases) {
    total += await borrarEliminatoriaPorFase(fase);
  }

  return total;
}

async function borrarDieciseisavosOctavosYCuartos() {
  let total = 0;

  for (const fase of ['dieciseisavos', 'octavos', 'cuartos']) {
    total += await borrarEliminatoriaPorFase(fase);
  }

  return total;
}

window.resetSoloDieciseisavos = async function() {
  if (!confirm('¿Borrar dieciseisavos, octavos, cuartos, semifinales, 3er lugar y final?')) return;
  await ejecutarResetFases(['dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'tercer', 'final'], 'dieciseisavos en adelante');
};

window.resetSoloOctavos = async function() {
  if (!confirm('¿Borrar octavos, cuartos, semifinales, 3er lugar y final?')) return;
  await ejecutarResetFases(['octavos', 'cuartos', 'semifinal', 'tercer', 'final'], 'octavos en adelante');
};

window.resetSoloCuartos = async function() {
  if (!confirm('¿Borrar cuartos, semifinales, 3er lugar y final?')) return;
  await ejecutarResetFases(['cuartos', 'semifinal', 'tercer', 'final'], 'cuartos en adelante');
};

window.resetSoloSemifinal = async function() {
  if (!confirm('¿Borrar semifinales, 3er lugar y final?')) return;
  await ejecutarResetFases(['semifinal', 'tercer', 'final'], 'semifinales en adelante');
};

window.resetSoloTercer = async function() {
  if (!confirm('¿Borrar 3er lugar y final?')) return;
  await ejecutarResetFases(['tercer', 'final'], '3er lugar y final');
};

window.resetSoloFinal = async function() {
  if (!confirm('¿Borrar solo la final?')) return;
  await ejecutarResetFases(['final'], 'final');
};

async function ejecutarResetFases(fases, texto) {

  const msg = document.getElementById('reset-msg');

  msg.style.display = 'block';

  msg.className = 'reset-msg cargando';

  msg.textContent = `Borrando ${texto}...`;

  try {

    const total = await borrarFasesEliminatoria(fases);

    msg.className = 'reset-msg exito';

    msg.textContent = `✅ Se borraron ${total} partidos de ${texto}.`;

    if (FASES_ELIMINATORIAS[faseActiva]) {
      await cargarFase('jornada1');
    }

    setTimeout(() => {
      msg.style.display = 'none';
    }, 3000);

  } catch(e) {

    console.error(e);

    msg.className = 'reset-msg error';

    msg.textContent = '❌ Error al borrar eliminatorias.';
  }
}

window.resetJornada = async function(jornada) {
  const labels = {
    jornada1: 'Jornada 1, Jornada 2, Jornada 3 y todas las eliminatorias',
    jornada2: 'Jornada 2, Jornada 3 y todas las eliminatorias',
    jornada3: 'Jornada 3 y todas las eliminatorias'
  };

  const confirmado = confirm(`¿Seguro que quieres borrar ${labels[jornada]}?`);
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

    totalBorrados += await borrarFasesEliminatoria([
      'dieciseisavos',
      'octavos',
      'cuartos',
      'semifinal',
      'tercer',
      'final'
    ]);

    msg.className   = 'reset-msg exito';
    msg.textContent = `✅ Se borraron ${totalBorrados} registros correctamente.`;

    setTimeout(() => { msg.style.display = 'none'; }, 3000);

    if (document.getElementById('sec-dashboard').classList.contains('active')) {
      cargarDashboard();
    }

    if (FASES_ELIMINATORIAS[faseActiva]) {
      await cargarFase('jornada1');
    }

  } catch(e) {
    console.error(e);
    msg.className   = 'reset-msg error';
    msg.textContent = '❌ Error al borrar. Intenta de nuevo.';
  }
};

window.addEventListener('load', async () => {
  iniciarEliminatoriasListenerAdmin();

  await cargarFase('jornada1');
  await cargarDashboard();
});

// ══════════════════════════════
// GENERAR DIECISEISAVOS
// ══════════════════════════════
window.generarDieciseisavos = async function() {

  const confirmado = confirm(
    '¿Generar los partidos oficiales de dieciseisavos?'
  );

  if (!confirmado) return;

  try {

    const resultadosSnap = await getDocs(
      collection(db, 'resultados')
    );

    const resultados = resultadosSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const clasificados = calcularClasificados(resultados);

    const partidosBase = getDieciseisavosOficiales();

    const tercerosAsignados = asignarMejoresTerceros(
      partidosBase,
      clasificados
    );

    const partidos = partidosBase.map(p => ({
      ...p,
      equipoLocal: resolverSlotDieciseisavos(
        p.local,
        clasificados,
        tercerosAsignados
      ),

      equipoVisita: resolverSlotDieciseisavos(
        p.visita,
        clasificados,
        tercerosAsignados
      )
    }));

    for (const p of partidos) {

      const ref = doc(
        db,
        'eliminatorias',
        `dieciseisavos-${p.id}`
      );

      await setDoc(ref, {

        fase: 'dieciseisavos',

        numero: p.id,

        local: p.equipoLocal?.equipo || null,
        visita: p.equipoVisita?.equipo || null,

        slotLocal: p.local,
        slotVisita: p.visita,

        fecha: p.fecha,
        hora: p.hora,

        estadio: p.estadio,
        ciudad: p.ciudad,

        marcadorLocal: null,
        marcadorVisita: null,

        ganador: null,

        creadoEn: serverTimestamp()

      });

    }

    alert('✅ Dieciseisavos generados correctamente.');

  } catch(e) {

    console.error(e);

    alert('❌ Error al generar dieciseisavos.');

  }

};

// ══════════════════════════════
// GENERAR OCTAVOS — FIFA
// ══════════════════════════════
window.generarOctavos = async function() {
  const confirmado = confirm('¿Generar octavos con la lógica oficial FIFA?');
  if (!confirmado) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'eliminatorias'), where('fase', '==', 'dieciseisavos'))
    );

    const partidos16 = snap.docs.map(d => ({ idDoc: d.id, ...d.data() }));

    const getPartido = numero => partidos16.find(p => Number(p.numero) === numero);

    const getGanador = numero => {
      const p = getPartido(numero);
      if (!p) return null;
      if (p.ganador === 'L') return p.local;
      if (p.ganador === 'V') return p.visita;
      return null;
    };

    const faltantes = [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88]
      .filter(n => !getGanador(n));

    if (faltantes.length > 0) {
      alert(`⚠️ Faltan ganadores en dieciseisavos: ${faltantes.join(', ')}`);
      return;
    }

    const octavos = [
      { numero: 90, local: getGanador(73), visita: getGanador(75), slotLocal: 'W73', slotVisita: 'W75', hora: '11:00', fecha: '04 Jul 2026', estadio: 'NRG Stadium, Houston, Texas, EUA', ciudad: 'Houston' },
      { numero: 89, local: getGanador(74), visita: getGanador(77), slotLocal: 'W74', slotVisita: 'W77', hora: '15:00', fecha: '04 Jul 2026', estadio: 'Lincoln Financial Field, Philadelphia, Pennsylvania, EUA', ciudad: 'Filadelfia' },
      { numero: 91, local: getGanador(76), visita: getGanador(78), slotLocal: 'W76', slotVisita: 'W78', hora: '14:00', fecha: '05 Jul 2026', estadio: 'MetLife Stadium, East Rutherford, New Jersey, EUA', ciudad: 'Nueva York/Nueva Jersey' },
      { numero: 92, local: getGanador(79), visita: getGanador(80), slotLocal: 'W79', slotVisita: 'W80', hora: '18:00', fecha: '05 Jul 2026', estadio: 'Estadio Banorte, Mexico City, México', ciudad: 'Ciudad de México' },
      { numero: 93, local: getGanador(83), visita: getGanador(84), slotLocal: 'W83', slotVisita: 'W84', hora: '13:00', fecha: '06 Jul 2026', estadio: 'AT&T Stadium, Arlington, Texas, EUA', ciudad: 'Dallas' },
      { numero: 94, local: getGanador(81), visita: getGanador(82), slotLocal: 'W81', slotVisita: 'W82', hora: '18:00', fecha: '06 Jul 2026', estadio: 'Lumen Field, Seattle, Washington, EUA', ciudad: 'Seattle' },
      { numero: 95, local: getGanador(86), visita: getGanador(88), slotLocal: 'W86', slotVisita: 'W88', hora: '10:00', fecha: '07 Jul 2026', estadio: 'Mercedes-Benz Stadium, Atlanta, Georgia, EUA', ciudad: 'Atlanta' },
      { numero: 96, local: getGanador(85), visita: getGanador(87), slotLocal: 'W85', slotVisita: 'W87', hora: '14:00', fecha: '07 Jul 2026', estadio: 'BC Place, Vancouver, Canadá', ciudad: 'Vancouver' }
    ];

    for (const p of octavos) {
      await setDoc(doc(db, 'eliminatorias', `octavos-${p.numero}`), {
        fase: 'octavos',
        numero: p.numero,
        local: p.local,
        visita: p.visita,
        slotLocal: p.slotLocal,
        slotVisita: p.slotVisita,
        fecha: p.fecha,
        hora: p.hora,
        estadio: p.estadio,
        ciudad: p.ciudad,
        marcadorLocal: null,
        marcadorVisita: null,
        ganador: null,
        creadoEn: serverTimestamp()
      });
    }

    alert('✅ Octavos generados correctamente con lógica FIFA.');

  } catch(e) {
    console.error(e);
    alert('❌ Error al generar octavos.');
  }
};

// ══════════════════════════════
// GENERAR CUARTOS
// ══════════════════════════════
window.generarCuartos = async function() {

  const confirmado = confirm(
    '¿Generar cuartos con los ganadores actuales?'
  );

  if (!confirmado) return;

  try {

    const snap = await getDocs(
      query(
        collection(db, 'eliminatorias'),
        where('fase', '==', 'octavos')
      )
    );

    const partidosOct = snap.docs
      .map(d => ({
        idDoc: d.id,
        ...d.data()
      }));

    const getPartido = numero =>
      partidosOct.find(p => Number(p.numero) === numero);

    const getGanador = numero => {

      const p = getPartido(numero);

      if (!p) return null;

      if (p.ganador === 'L') return p.local;
      if (p.ganador === 'V') return p.visita;

      return null;
    };

    const faltantes = [89,90,91,92,93,94,95,96]
      .filter(n => !getGanador(n));

    if (faltantes.length > 0) {

      alert(
        `⚠️ Faltan ganadores: ${faltantes.join(', ')}`
      );

      return;
    }

    const cuartos = [

      {
        numero: 97,
        local: getGanador(89),
        visita: getGanador(90),

        slotLocal: 'W89',
        slotVisita: 'W90',

        hora: '14:00',

        estadio: 'Gillette Stadium',
        ciudad: 'Boston'
      },

      {
        numero: 98,
        local: getGanador(93),
        visita: getGanador(94),

        slotLocal: 'W93',
        slotVisita: 'W94',

        hora: '13:00',

        estadio: 'SoFi Stadium',
        ciudad: 'Los Ángeles'
      },

      {
        numero: 99,
        local: getGanador(91),
        visita: getGanador(92),

        slotLocal: 'W91',
        slotVisita: 'W92',

        hora: '15:00',

        estadio: 'Hard Rock Stadium',
        ciudad: 'Miami'
      },

      {
        numero: 100,
        local: getGanador(95),
        visita: getGanador(96),

        slotLocal: 'W95',
        slotVisita: 'W96',

        hora: '19:00',

        estadio: 'Arrowhead Stadium',
        ciudad: 'Kansas City'
      }

    ];

    for (const p of cuartos) {

      await setDoc(
        doc(db, 'eliminatorias', `cuartos-${p.numero}`),
        {

          fase: 'cuartos',

          numero: p.numero,

          local: p.local,
          visita: p.visita,

          slotLocal: p.slotLocal,
          slotVisita: p.slotVisita,

          marcadorLocal: null,
          marcadorVisita: null,

          ganador: null,

          fecha: 'Cuartos de final',

          hora: p.hora,

          estadio: p.estadio,
          ciudad: p.ciudad,

          creadoEn: serverTimestamp()

        }
      );

    }

    alert('✅ Cuartos generados.');

  } catch(e) {

    console.error(e);

    alert('❌ Error al generar cuartos.');

  }

};

window.generarSemifinales = async function() {
  const confirmado = confirm('¿Generar semifinales con los ganadores actuales?');
  if (!confirmado) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'eliminatorias'), where('fase', '==', 'cuartos'))
    );

    const partidosCua = snap.docs.map(d => ({
      idDoc: d.id,
      ...d.data()
    }));

    const getPartido = numero =>
      partidosCua.find(p => Number(p.numero) === numero);

    const getGanador = numero => {
      const p = getPartido(numero);
      if (!p) return null;

      if (p.ganador === 'L') return p.local;
      if (p.ganador === 'V') return p.visita;

      return null;
    };

    const faltantes = [97,98,99,100].filter(n => !getGanador(n));

    if (faltantes.length > 0) {
      alert(`⚠️ Faltan ganadores en cuartos: ${faltantes.join(', ')}`);
      return;
    }

    const semifinales = [
      {
        numero: 101,
        local: getGanador(97),
        visita: getGanador(98),
        slotLocal: 'W97',
        slotVisita: 'W98',
        fecha: '14 Jul 2026',
        hora: '18:00',
        estadio: 'AT&T Stadium, Arlington, Texas, EUA',
        ciudad: 'Dallas'
      },
      {
        numero: 102,
        local: getGanador(99),
        visita: getGanador(100),
        slotLocal: 'W99',
        slotVisita: 'W100',
        fecha: '15 Jul 2026',
        hora: '18:00',
        estadio: 'Mercedes-Benz Stadium, Atlanta, Georgia, EUA',
        ciudad: 'Atlanta'
      }
    ];

    for (const p of semifinales) {
      await setDoc(doc(db, 'eliminatorias', `semifinal-${p.numero}`), {
        fase: 'semifinal',
        numero: p.numero,

        local: p.local,
        visita: p.visita,

        slotLocal: p.slotLocal,
        slotVisita: p.slotVisita,

        fecha: p.fecha,
        hora: p.hora,

        estadio: p.estadio,
        ciudad: p.ciudad,

        marcadorLocal: null,
        marcadorVisita: null,
        ganador: null,

        creadoEn: serverTimestamp()
      });
    }

    alert('✅ Semifinales generadas correctamente.');

  } catch(e) {
    console.error(e);
    alert('❌ Error al generar semifinales.');
  }
};

window.generarTercerLugar = async function() {
  const confirmado = confirm('¿Generar partido por el 3er lugar?');
  if (!confirmado) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'eliminatorias'), where('fase', '==', 'semifinal'))
    );

    const semis = snap.docs.map(d => ({ idDoc: d.id, ...d.data() }));

    const perdedor = numero => {
      const p = semis.find(x => Number(x.numero) === numero);
      if (!p || !p.ganador) return null;
      return p.ganador === 'L' ? p.visita : p.local;
    };

    const local = perdedor(101);
    const visita = perdedor(102);

    if (!local || !visita) {
      alert('⚠️ Debes definir ganadores en semifinales.');
      return;
    }

    await setDoc(doc(db, 'eliminatorias', 'tercer-103'), {
      fase: 'tercer',
      numero: 103,
      local,
      visita,
      slotLocal: 'RU101',
      slotVisita: 'RU102',
      fecha: '18 Jul 2026',
      hora: '15:00',
      estadio: 'Hard Rock Stadium, Miami Gardens, Florida, EUA',
      ciudad: 'Miami',
      marcadorLocal: null,
      marcadorVisita: null,
      ganador: null,
      creadoEn: serverTimestamp()
    });

    alert('✅ Partido por el 3er lugar generado.');

  } catch(e) {
    console.error(e);
    alert('❌ Error al generar 3er lugar.');
  }
};

window.generarFinal = async function() {
  const confirmado = confirm('¿Generar final?');
  if (!confirmado) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'eliminatorias'), where('fase', '==', 'semifinal'))
    );

    const semis = snap.docs.map(d => ({ idDoc: d.id, ...d.data() }));

    const ganador = numero => {
      const p = semis.find(x => Number(x.numero) === numero);
      if (!p || !p.ganador) return null;
      return p.ganador === 'L' ? p.local : p.visita;
    };

    const local = ganador(101);
    const visita = ganador(102);

    if (!local || !visita) {
      alert('⚠️ Debes definir ganadores en semifinales.');
      return;
    }

    await setDoc(doc(db, 'eliminatorias', 'final-104'), {
      fase: 'final',
      numero: 104,
      local,
      visita,
      slotLocal: 'W101',
      slotVisita: 'W102',
      fecha: '19 Jul 2026',
      hora: '13:00',
      estadio: 'MetLife Stadium, East Rutherford, New Jersey, EUA',
      ciudad: 'Nueva York/Nueva Jersey',
      marcadorLocal: null,
      marcadorVisita: null,
      ganador: null,
      creadoEn: serverTimestamp()
    });

    alert('✅ Final generada.');

  } catch(e) {
    console.error(e);
    alert('❌ Error al generar final.');
  }
};