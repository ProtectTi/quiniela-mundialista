import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import { db } from "./firebase/config.js";

// Verificar que hay migración pendiente
const migracionData = localStorage.getItem('migracion_pendiente');
if (!migracionData) {
  window.location.href = 'jugador.html';
}

let pendiente = null;
try {
  pendiente = JSON.parse(migracionData);
  const sub = document.getElementById('migracion-sub');
  if (sub && pendiente.nombre) {
    sub.textContent = `Hola ${pendiente.nombre}, elige un usuario para iniciar sesión en el futuro`;
  }
} catch(e) {
  window.location.href = 'jugador.html';
}

function showAlert(msg, tipo) {
  const el = document.getElementById('alertMsg');
  el.textContent = msg;
  el.className = `alert-custom ${tipo} show`;
}

window.guardarUsuario = async function() {
  const usuario = document.getElementById('nuevo-usuario').value.trim().toLowerCase();

  if (!usuario)
    return showAlert('Por favor ingresa un usuario.', 'error');
  if (!/^[a-z0-9_]+$/.test(usuario))
    return showAlert('Solo letras, números y guión bajo. Sin espacios.', 'error');
  if (usuario.length < 3)
    return showAlert('El usuario debe tener al menos 3 caracteres.', 'error');

  const btn = document.getElementById('btn-guardar');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Guardando...`;

  try {
    // Verificar que el usuario no esté tomado
    const q = query(collection(db, 'jugadores'), where('usuario', '==', usuario));
    const snap = await getDocs(q);
    if (!snap.empty) {
      showAlert('Ese usuario ya está en uso. Elige otro.', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Guardar y entrar';
      return;
    }

    // Guardar usuario en Firestore
    await updateDoc(doc(db, 'jugadores', pendiente.id), { usuario });

    // Limpiar migración y guardar sesión
    localStorage.removeItem('migracion_pendiente');
    localStorage.setItem('jugador', JSON.stringify({ id: pendiente.id, nombre: pendiente.nombre }));

    showAlert('¡Usuario guardado! Entrando...', 'success');
    setTimeout(() => { window.location.href = 'predicciones.html'; }, 1500);

  } catch(e) {
    console.error(e);
    showAlert('Error al guardar el usuario. Intenta de nuevo.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Guardar y entrar';
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.guardarUsuario();
});

document.getElementById('btn-guardar').dataset = { label: 'Guardar y entrar' };
