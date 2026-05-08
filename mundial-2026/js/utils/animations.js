// ══════════════════════════════
// ANIMAR NÚMEROS
// ══════════════════════════════
export function animarNumero(
  elemento,
  destino,
  duracion = 700
) {

  if (!elemento) return;

  const inicio =
    parseInt(elemento.textContent) || 0;

  const startTime = performance.now();

  function actualizar(currentTime) {

    const progreso = Math.min(
      (currentTime - startTime) / duracion,
      1
    );

    const ease =
      1 - Math.pow(1 - progreso, 3);

    const valor = Math.floor(
      inicio + (destino - inicio) * ease
    );

    elemento.textContent = valor;

    if (progreso < 1) {
      requestAnimationFrame(actualizar);
    } else {
      elemento.textContent = destino;
    }

  }

  requestAnimationFrame(actualizar);

}