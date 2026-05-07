// ── CONTRASEÑA ADMIN ──
const ADMIN_PASSWORD = 'admin123';

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

// ── LOGIN ADMIN ──
window.entrarPanel = function() {
  const pass = document.getElementById('admin-pass').value;

  if (!pass) return showAlert('Por favor ingresa la contraseña.', 'error');

  setLoading(true);
  hideAlert();

  setTimeout(() => {
    if (pass === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      showAlert('¡Acceso concedido! Redirigiendo...', 'success');
      setTimeout(() => window.location.href = 'panel.html', 1500);
    } else {
      showAlert('Contraseña incorrecta.', 'error');
      setLoading(false);
    }
  }, 800);
};

// ── ENTER para enviar ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.entrarPanel();
});