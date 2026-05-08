import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

import { auth } from "./firebase/config.js";

// Admin creado en Firebase Authentication
const ADMIN_EMAIL = "admin@quiniela.com";

// ── HELPERS ──
function showAlert(msg, tipo) {
  const el = document.getElementById('alertMsg');
  el.textContent = msg;
  el.className = `alert-custom ${tipo} show`;
}

function hideAlert() {
  document.getElementById('alertMsg').className = 'alert-custom';
}

function setLoading(loading) {
  const btn = document.getElementById('btn-entrar');
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Verificando...`
    : 'Entrar al panel';
}

// ── LOGIN ADMIN CON FIREBASE AUTH ──
window.entrarPanel = async function() {
  const pass = document.getElementById('admin-pass').value;

  if (!pass) {
    return showAlert('Por favor ingresa la contraseña.', 'error');
  }

  setLoading(true);
  hideAlert();

  try {
    await setPersistence(auth, browserSessionPersistence);

    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pass);

    showAlert('¡Acceso concedido! Redirigiendo...', 'success');

    setTimeout(() => {
      window.location.href = 'panel.html';
    }, 1200);

  } catch (error) {
    console.error(error);

    showAlert('Correo o contraseña incorrectos.', 'error');
    setLoading(false);
  }
};

// ── ENTER para enviar ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.entrarPanel();
});