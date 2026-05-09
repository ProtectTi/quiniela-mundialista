// ══════════════════════════════
// HELPERS GENERALES
// ══════════════════════════════

export function getFlag(equipo, banderas) {
  const mapa = banderas || window.BANDERAS || {};
  return mapa[equipo] || 'mx';
}

export function getNumeroJornada(jornada) {
  return Number(
    jornada.replace('jornada', '')
  );
}

export function getLabelJornada(jornada) {
  return `Jornada ${getNumeroJornada(jornada)}`;
}

export function getModoKey(jornada) {
  return `_modoEdicion${
    jornada.charAt(0).toUpperCase()
  }${jornada.slice(1)}`;
}

export function getFechaConfig(data) {
  return new Date(
    data.fecha + 'T' + data.hora + ':00'
  );
}

export function formatearFechaLimite(limite) {

  if (!limite) {
    return '⏰ Sin fecha límite definida';
  }

  return `⏰ Cierra: ${
    limite.toLocaleDateString('es-MX')
  } ${
    limite.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }`;

}
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
