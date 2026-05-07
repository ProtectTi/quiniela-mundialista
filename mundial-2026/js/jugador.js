import { initializeApp }                    from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getFirestore, collection, addDoc,
         query, where, getDocs }            from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

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

  if (!nombre)         return showAlert('Por favor ingresa tu nombre.', 'error');
  if (pass.length < 4) return showAlert('La contraseña debe tener al menos 4 caracteres.', 'error');
  if (pass !== pass2)  return showAlert('Las contraseñas no coinciden.', 'error');

  setLoading('btn-register', true);
  hideAlert();

  try {
    // Verificar si el nombre ya existe
    const q    = query(collection(db, 'jugadores'), where('nombreKey', '==', nombre.toLowerCase()));
    const snap = await getDocs(q);

    if (!snap.empty) {
      showAlert('Ese nombre ya está registrado. Elige otro.', 'error');
      setLoading('btn-register', false);
      return;
    }

    // Guardar jugador en Firestore
    await addDoc(collection(db, 'jugadores'), {
      nombre:    nombre,
      nombreKey: nombre.toLowerCase(),
      password:  pass,
      creadoEn:  new Date()
    });

    // Guardar sesión local
    localStorage.setItem('jugador', JSON.stringify({ nombre }));

    showAlert(`¡Bienvenido, ${nombre}! Redirigiendo...`, 'success');
    setTimeout(() => window.location.href = 'predicciones.html', 1500);

  } catch (e) {
    console.error(e);
    showAlert('Error al registrar. Intenta de nuevo.', 'error');
    setLoading('btn-register', false);
  }
};

// ── INICIAR SESIÓN ──
window.iniciarSesion = async function() {
  const nombre = document.getElementById('login-nombre').value.trim();
  const pass   = document.getElementById('login-pass').value;

  if (!nombre) return showAlert('Por favor ingresa tu nombre.', 'error');
  if (!pass)   return showAlert('Por favor ingresa tu contraseña.', 'error');

  setLoading('btn-login', true);
  hideAlert();

  try {
    const q = query(
      collection(db, 'jugadores'),
      where('nombreKey', '==', nombre.toLowerCase()),
      where('password',  '==', pass)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      showAlert('Nombre o contraseña incorrectos.', 'error');
      setLoading('btn-login', false);
      return;
    }

    const jugador = snap.docs[0].data();
    localStorage.setItem('jugador', JSON.stringify({ nombre: jugador.nombre, id: snap.docs[0].id }));

    showAlert(`¡Hola de nuevo, ${jugador.nombre}! Redirigiendo...`, 'success');
    setTimeout(() => window.location.href = 'predicciones.html', 1500);

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
  loginVisible ? window.iniciarSesion() : window.registrar();
});

// ── Labels originales de botones ──
document.getElementById('btn-register').dataset.label = 'Crear cuenta';
document.getElementById('btn-login').dataset.label    = 'Entrar';