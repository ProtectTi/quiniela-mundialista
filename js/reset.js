import {
  collection,
  query,
  where,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import { db } from "./firebase/config.js";

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
  const btn = document.getElementById('btn-reset');
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Actualizando...`
    : 'Cambiar contraseña';
}

// ── HASH SHA-256 ──
async function hashPassword(pass) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pass);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── RESTABLECER CONTRASEÑA ──
window.solicitarReset = async function() {
  const usuario = document.getElementById('reset-usuario').value.trim().toLowerCase();
  const pass1  = document.getElementById('reset-pass1').value;
  const pass2  = document.getElementById('reset-pass2').value;

  hideAlert();

  if (!usuario)
    return showAlert('Por favor ingresa tu usuario.', 'error');

  if (pass1.length < 4)
    return showAlert('La nueva contraseña debe tener al menos 4 caracteres.', 'error');

  if (pass1 !== pass2)
    return showAlert('Las contraseñas no coinciden.', 'error');

  setLoading(true);

  try {
    const q    = query(collection(db, 'jugadores'), where('usuario', '==', usuario));
    const snap = await getDocs(q);

    if (snap.empty) {
      showAlert('No se encontró una cuenta con ese usuario.', 'error');
      setLoading(false);
      return;
    }

    const jugadorDoc = snap.docs[0];
    const passHash   = await hashPassword(pass1);

    await updateDoc(jugadorDoc.ref, { password: passHash });

    showAlert('✅ Contraseña actualizada. Redirigiendo...', 'success');

    document.getElementById('reset-usuario').value = '';
    document.getElementById('reset-pass1').value  = '';
    document.getElementById('reset-pass2').value  = '';

    setTimeout(() => {
      window.location.href = 'jugador.html';
    }, 2000);

  } catch(e) {
    console.error(e);
    showAlert('Error al actualizar la contraseña. Intenta de nuevo.', 'error');
    setLoading(false);
  }
};

// ── ENTER para enviar ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.solicitarReset();
});
