// ══════════════════════════════
// TOASTS GLOBALES
// ══════════════════════════════
export function showToast(
  mensaje,
  tipo = 'info'
) {

  let contenedor =
    document.getElementById('toast-container');

  if (!contenedor) {

    contenedor =
      document.createElement('div');

    contenedor.id = 'toast-container';
    contenedor.className =
      'toast-container-custom';

    document.body.appendChild(contenedor);

  }

  const toast =
    document.createElement('div');

  toast.className =
    `toast-custom ${tipo}`;

  toast.textContent = mensaje;

  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 20);

  setTimeout(() => {

    toast.classList.remove('show');

    setTimeout(() => {
      toast.remove();
    }, 250);

  }, 3200);

}