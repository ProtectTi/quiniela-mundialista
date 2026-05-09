import {
  collection,
  doc,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import { db } from "./firebase/config.js";

// ── PROTECCIÓN ANTI-BRUTE FORCE ──
const MAX_INTENTOS   = 5;
const BLOQUEO_MS     = 5 * 60 * 1000; // 5 minutos

function getIntentosData() {
  try {
    return JSON.parse(localStorage.getItem('login_intentos') || '{"count":0,"hasta":0}');
  } catch { return { count: 0, hasta: 0 }; }
}

function registrarIntentoFallido() {
  const data = getIntentosData();
  data.count++;
  if (data.count >= MAX_INTENTOS) {
    data.hasta = Date.now() + BLOQUEO_MS;
  }
  localStorage.setItem('login_intentos', JSON.stringify(data));
}

function limpiarIntentos() {
  localStorage.removeItem('login_intentos');
}

function verificarBloqueo() {
  const data = getIntentosData();
  if (data.count >= MAX_INTENTOS) {
    const restante = data.hasta - Date.now();
    if (restante > 0) {
      const mins = Math.ceil(restante / 60000);
      return `Demasiados intentos fallidos. Espera ${mins} minuto${mins > 1 ? 's' : ''} e intenta de nuevo.`;
    } else {
      // Tiempo de bloqueo cumplido, resetear
      limpiarIntentos();
    }
  }
  return null;
}



// ── HASH CONTRASEÑA (SHA-256) ──
async function hashPassword(pass) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}



// ── HELPERS ──
function showAlert(msg, tipo) {
  const el = document.getElementById('alertMsg');
  el.textContent = msg;
  el.className = `alert-custom ${tipo} show`;
}

function hideAlert() {
  document.getElementById('alertMsg').className = 'alert-custom';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Cargando...`
    : btn.dataset.label;
}

// ── SWITCH TAB ──
window.switchTab = function(tab) {
  hideAlert();

  const isRegister = tab === 'register';

  document.getElementById('form-register').style.display = isRegister ? 'block' : 'none';
  document.getElementById('form-login').style.display    = isRegister ? 'none'  : 'block';

  document.getElementById('tab-register').classList.toggle('active', isRegister);
  document.getElementById('tab-login').classList.toggle('active', !isRegister);
};

// ── REGISTRAR ──
window.registrar = async function() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  const pass2  = document.getElementById('reg-pass2').value;

  if (!nombre)
    return showAlert('Por favor ingresa tu nombre.', 'error');

  if (!/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-\.]+$/.test(nombre))
    return showAlert('El nombre solo puede contener letras, espacios, guiones y puntos.', 'error');

  if (nombre.length < 2)
    return showAlert('El nombre debe tener al menos 2 caracteres.', 'error');

  if (pass.length < 4)
    return showAlert('La contraseña debe tener al menos 4 caracteres.', 'error');

  if (pass !== pass2)
    return showAlert('Las contraseñas no coinciden.', 'error');

  setLoading('btn-register', true);
  hideAlert();

  try {
    // ── REGISTRAR CON TRANSACCIÓN (evita duplicados por race condition) ──
    const passHash  = await hashPassword(pass);
    const nombreKey = nombre.toLowerCase();
    const nuevoDoc  = doc(collection(db, 'jugadores'));

    await runTransaction(db, async (tx) => {
      const q    = query(collection(db, 'jugadores'), where('nombreKey', '==', nombreKey));
      const snap = await getDocs(q);

      if (!snap.empty) throw { code: 'nombre_tomado' };

      tx.set(nuevoDoc, {
        nombre,
        nombreKey,
        password: passHash,
        creadoEn: serverTimestamp()
      });
    });

    // ── GUARDAR SESIÓN ──
    localStorage.setItem(
      'jugador',
      JSON.stringify({
        id: nuevoDoc.id,
        nombre: nombre
      })
    );

    showAlert(`¡Bienvenido, ${nombre}! Redirigiendo...`, 'success');

    setTimeout(() => {
      window.location.href = 'predicciones.html';
    }, 1500);

  } catch (e) {
    console.error(e);
    if (e?.code === 'nombre_tomado') {
      showAlert('Ese nombre ya está registrado. Elige otro.', 'error');
    } else {
      showAlert('Error al registrar. Intenta de nuevo.', 'error');
    }
    setLoading('btn-register', false);
  }
};

// ── INICIAR SESIÓN ──
window.iniciarSesion = async function() {
  const nombre = document.getElementById('login-nombre').value.trim();
  const pass   = document.getElementById('login-pass').value;

  const mensajeBloqueo = verificarBloqueo();
  if (mensajeBloqueo) return showAlert(mensajeBloqueo, 'error');

  if (!nombre)
    return showAlert('Por favor ingresa tu nombre.', 'error');

  if (!/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-\.]+$/.test(nombre))
    return showAlert('Nombre inválido. Revisa que no tenga caracteres especiales.', 'error');

  if (!pass)
    return showAlert('Por favor ingresa tu contraseña.', 'error');

  setLoading('btn-login', true);
  hideAlert();

  try {
    const passHash = await hashPassword(pass);

    const q = query(
      collection(db, 'jugadores'),
      where('nombreKey', '==', nombre.toLowerCase())
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      registrarIntentoFallido();
      const data = getIntentosData();
      const restantes = Math.max(0, MAX_INTENTOS - data.count);
      const msgExtra = restantes > 0
        ? ` (${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''})`
        : ' — Bloqueado por 5 min';

      showAlert('Nombre o contraseña incorrectos.' + msgExtra, 'error');
      setLoading('btn-login', false);
      return;
    }

    const docJugador = snap.docs[0];
    const jugador = docJugador.data();

    const passwordCorrecta =
      jugador.password === passHash || jugador.password === pass;

    if (!passwordCorrecta) {
      registrarIntentoFallido();
      const data = getIntentosData();
      const restantes = Math.max(0, MAX_INTENTOS - data.count);
      const msgExtra = restantes > 0
        ? ` (${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''})`
        : ' — Bloqueado por 5 min';

      showAlert('Nombre o contraseña incorrectos.' + msgExtra, 'error');
      setLoading('btn-login', false);
      return;
    }

    localStorage.setItem(
      'jugador',
      JSON.stringify({
        id: docJugador.id,
        nombre: jugador.nombre
      })
    );

    limpiarIntentos();

    showAlert(`¡Hola de nuevo, ${jugador.nombre}! Redirigiendo...`, 'success');

    setTimeout(() => {
      window.location.href = 'predicciones.html';
    }, 1500);

  } catch (e) {
    console.error(e);
    showAlert('Error al iniciar sesión. Intenta de nuevo.', 'error');
    setLoading('btn-login', false);
  }
};

// ── ENTER para enviar ──
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;

  const loginVisible = document.getElementById('form-login').style.display !== 'none';

  loginVisible
    ? window.iniciarSesion()
    : window.registrar();
});

// ── Labels originales de botones ──
document.getElementById('btn-register').dataset.label = 'Crear cuenta';
document.getElementById('btn-login').dataset.label    = 'Entrar';