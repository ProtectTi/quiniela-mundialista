// ══════════════════════════════════════
// PARTIDOS MUNDIAL 2026 — HORARIOS CDMX
// Fuente: Google / FIFA oficial
// ══════════════════════════════════════

const BANDERAS = {
  'México':               'mx',
  'Sudáfrica':            'za',
  'Corea del Sur':        'kr',
  'República Checa':      'cz',
  'Canadá':               'ca',
  'Bosnia y Herzegovina': 'ba',
  'Qatar':                'qa',
  'Suiza':                'ch',
  'Brasil':               'br',
  'Marruecos':            'ma',
  'Haití':                'ht',
  'Escocia':              'gb-sct',
  'Estados Unidos':       'us',
  'Paraguay':             'py',
  'Australia':            'au',
  'Turquía':              'tr',
  'Alemania':             'de',
  'Curazao':              'cw',
  'Costa de Marfil':      'ci',
  'Ecuador':              'ec',
  'Países Bajos':         'nl',
  'Japón':                'jp',
  'Suecia':               'se',
  'Túnez':                'tn',
  'Bélgica':              'be',
  'Egipto':               'eg',
  'Irán':                 'ir',
  'Nueva Zelanda':        'nz',
  'España':               'es',
  'Cabo Verde':           'cv',
  'Arabia Saudita':       'sa',
  'Uruguay':              'uy',
  'Francia':              'fr',
  'Irak':                 'iq',
  'Senegal':              'sn',
  'Noruega':              'no',
  'Argentina':            'ar',
  'Argelia':              'dz',
  'Austria':              'at',
  'Jordania':             'jo',
  'Portugal':             'pt',
  'RD Congo':             'cd',
  'Uzbekistán':           'uz',
  'Colombia':             'co',
  'Inglaterra':           'gb-eng',
  'Croacia':              'hr',
  'Ghana':                'gh',
  'Panamá':               'pa',
};

const PARTIDOS_MUNDIAL = {

  // ══════════════════════════════
  // JORNADA 1
  // ══════════════════════════════
  jornada1: [
    // Jueves 11 Jun
    { id: 'j1-01', grupo: 'A', local: 'México',          visitante: 'Sudáfrica',           fecha: '11 Jun', hora: '13:00', estadio: 'Estadio Banorte, Ciudad de México' },
    { id: 'j1-02', grupo: 'A', local: 'Corea del Sur',   visitante: 'República Checa',     fecha: '11 Jun', hora: '20:00', estadio: 'Estadio Akron, Guadalajara' },
    // Viernes 12 Jun
    { id: 'j1-03', grupo: 'B', local: 'Canadá',          visitante: 'Bosnia y Herzegovina',fecha: '12 Jun', hora: '13:00', estadio: 'BMO Field, Toronto' },
    { id: 'j1-04', grupo: 'D', local: 'Estados Unidos',  visitante: 'Paraguay',            fecha: '12 Jun', hora: '19:00', estadio: 'SoFi Stadium, Inglewood' },
    // Sábado 13 Jun
    { id: 'j1-05', grupo: 'B', local: 'Qatar',           visitante: 'Suiza',               fecha: '13 Jun', hora: '13:00', estadio: "Levi's Stadium, Santa Clara" },
    { id: 'j1-06', grupo: 'C', local: 'Brasil',          visitante: 'Marruecos',           fecha: '13 Jun', hora: '16:00', estadio: 'MetLife Stadium, Nueva Jersey' },
    { id: 'j1-07', grupo: 'C', local: 'Haití',           visitante: 'Escocia',             fecha: '13 Jun', hora: '19:00', estadio: 'Gillette Stadium, Boston' },
    { id: 'j1-08', grupo: 'D', local: 'Australia',       visitante: 'Turquía',             fecha: '13 Jun', hora: '22:00', estadio: 'BC Place, Vancouver' },
    // Domingo 14 Jun
    { id: 'j1-09', grupo: 'E', local: 'Alemania',        visitante: 'Curazao',             fecha: '14 Jun', hora: '11:00', estadio: 'NRG Stadium, Houston' },
    { id: 'j1-10', grupo: 'F', local: 'Países Bajos',    visitante: 'Japón',               fecha: '14 Jun', hora: '14:00', estadio: 'AT&T Stadium, Arlington' },
    { id: 'j1-11', grupo: 'E', local: 'Costa de Marfil', visitante: 'Ecuador',             fecha: '14 Jun', hora: '17:00', estadio: 'Lincoln Financial Field, Filadelfia' },
    { id: 'j1-12', grupo: 'F', local: 'Suecia',          visitante: 'Túnez',               fecha: '14 Jun', hora: '20:00', estadio: 'Estadio BBVA, Guadalupe' },
    // Lunes 15 Jun
    { id: 'j1-13', grupo: 'H', local: 'España',          visitante: 'Cabo Verde',          fecha: '15 Jun', hora: '10:00', estadio: 'Mercedes-Benz Stadium, Atlanta' },
    { id: 'j1-14', grupo: 'G', local: 'Bélgica',         visitante: 'Egipto',              fecha: '15 Jun', hora: '13:00', estadio: 'Lumen Field, Seattle' },
    { id: 'j1-15', grupo: 'H', local: 'Arabia Saudita',  visitante: 'Uruguay',             fecha: '15 Jun', hora: '16:00', estadio: 'Hard Rock Stadium, Miami' },
    { id: 'j1-16', grupo: 'G', local: 'Irán',            visitante: 'Nueva Zelanda',       fecha: '15 Jun', hora: '19:00', estadio: 'SoFi Stadium, Inglewood' },
    // Martes 16 Jun
    { id: 'j1-17', grupo: 'I', local: 'Francia',         visitante: 'Senegal',             fecha: '16 Jun', hora: '13:00', estadio: 'MetLife Stadium, Nueva Jersey' },
    { id: 'j1-18', grupo: 'I', local: 'Irak',            visitante: 'Noruega',             fecha: '16 Jun', hora: '16:00', estadio: 'Gillette Stadium, Boston' },
    { id: 'j1-19', grupo: 'J', local: 'Argentina',       visitante: 'Argelia',             fecha: '16 Jun', hora: '19:00', estadio: 'GEHA Field, Kansas City' },
    { id: 'j1-20', grupo: 'J', local: 'Austria',         visitante: 'Jordania',            fecha: '16 Jun', hora: '22:00', estadio: "Levi's Stadium, Santa Clara" },
    // Miércoles 17 Jun
    { id: 'j1-21', grupo: 'K', local: 'Portugal',        visitante: 'RD Congo',            fecha: '17 Jun', hora: '11:00', estadio: 'NRG Stadium, Houston' },
    { id: 'j1-22', grupo: 'L', local: 'Inglaterra',      visitante: 'Croacia',             fecha: '17 Jun', hora: '14:00', estadio: 'AT&T Stadium, Arlington' },
    { id: 'j1-23', grupo: 'L', local: 'Ghana',           visitante: 'Panamá',              fecha: '17 Jun', hora: '17:00', estadio: 'BMO Field, Toronto' },
    { id: 'j1-24', grupo: 'K', local: 'Uzbekistán',      visitante: 'Colombia',            fecha: '17 Jun', hora: '20:00', estadio: 'Estadio Banorte, Ciudad de México' },
  ],

  // ══════════════════════════════
  // JORNADA 2
  // ══════════════════════════════
  jornada2: [
    // Jueves 18 Jun
    { id: 'j2-01', grupo: 'A', local: 'República Checa', visitante: 'Sudáfrica',           fecha: '18 Jun', hora: '10:00', estadio: 'Mercedes-Benz Stadium, Atlanta' },
    { id: 'j2-02', grupo: 'B', local: 'Suiza',           visitante: 'Bosnia y Herzegovina',fecha: '18 Jun', hora: '13:00', estadio: 'SoFi Stadium, Inglewood' },
    { id: 'j2-03', grupo: 'B', local: 'Canadá',          visitante: 'Qatar',               fecha: '18 Jun', hora: '16:00', estadio: 'BC Place, Vancouver' },
    { id: 'j2-04', grupo: 'A', local: 'México',          visitante: 'Corea del Sur',       fecha: '18 Jun', hora: '19:00', estadio: 'Estadio Akron, Guadalajara' },
    // Viernes 19 Jun
    { id: 'j2-05', grupo: 'D', local: 'Estados Unidos',  visitante: 'Australia',           fecha: '19 Jun', hora: '13:00', estadio: 'Lumen Field, Seattle' },
    { id: 'j2-06', grupo: 'C', local: 'Escocia',         visitante: 'Marruecos',           fecha: '19 Jun', hora: '16:00', estadio: 'Gillette Stadium, Boston' },
    { id: 'j2-07', grupo: 'C', local: 'Brasil',          visitante: 'Haití',               fecha: '19 Jun', hora: '18:30', estadio: 'Lincoln Financial Field, Filadelfia' },
    { id: 'j2-08', grupo: 'D', local: 'Turquía',         visitante: 'Paraguay',            fecha: '19 Jun', hora: '21:00', estadio: "Levi's Stadium, Santa Clara" },
    // Sábado 20 Jun
    { id: 'j2-09', grupo: 'F', local: 'Países Bajos',    visitante: 'Suecia',              fecha: '20 Jun', hora: '11:00', estadio: 'NRG Stadium, Houston' },
    { id: 'j2-10', grupo: 'E', local: 'Alemania',        visitante: 'Costa de Marfil',     fecha: '20 Jun', hora: '14:00', estadio: 'BMO Field, Toronto' },
    { id: 'j2-11', grupo: 'E', local: 'Ecuador',         visitante: 'Curazao',             fecha: '20 Jun', hora: '18:00', estadio: 'GEHA Field, Kansas City' },
    { id: 'j2-12', grupo: 'F', local: 'Túnez',           visitante: 'Japón',               fecha: '20 Jun', hora: '22:00', estadio: 'Estadio BBVA, Guadalupe' },
    // Domingo 21 Jun
    { id: 'j2-13', grupo: 'H', local: 'España',          visitante: 'Arabia Saudita',      fecha: '21 Jun', hora: '10:00', estadio: 'Mercedes-Benz Stadium, Atlanta' },
    { id: 'j2-14', grupo: 'G', local: 'Bélgica',         visitante: 'Irán',                fecha: '21 Jun', hora: '13:00', estadio: 'SoFi Stadium, Inglewood' },
    { id: 'j2-15', grupo: 'H', local: 'Uruguay',         visitante: 'Cabo Verde',          fecha: '21 Jun', hora: '16:00', estadio: 'Hard Rock Stadium, Miami' },
    { id: 'j2-16', grupo: 'G', local: 'Nueva Zelanda',   visitante: 'Egipto',              fecha: '21 Jun', hora: '19:00', estadio: 'BC Place, Vancouver' },
    // Lunes 22 Jun
    { id: 'j2-17', grupo: 'J', local: 'Argentina',       visitante: 'Austria',             fecha: '22 Jun', hora: '11:00', estadio: 'AT&T Stadium, Arlington' },
    { id: 'j2-18', grupo: 'I', local: 'Francia',         visitante: 'Irak',                fecha: '22 Jun', hora: '15:00', estadio: 'Lincoln Financial Field, Filadelfia' },
    { id: 'j2-19', grupo: 'I', local: 'Noruega',         visitante: 'Senegal',             fecha: '22 Jun', hora: '18:00', estadio: 'MetLife Stadium, Nueva Jersey' },
    { id: 'j2-20', grupo: 'J', local: 'Jordania',        visitante: 'Argelia',             fecha: '22 Jun', hora: '21:00', estadio: "Levi's Stadium, Santa Clara" },
    // Martes 23 Jun
    { id: 'j2-21', grupo: 'K', local: 'Portugal',        visitante: 'Uzbekistán',          fecha: '23 Jun', hora: '11:00', estadio: 'NRG Stadium, Houston' },
    { id: 'j2-22', grupo: 'L', local: 'Inglaterra',      visitante: 'Ghana',               fecha: '23 Jun', hora: '14:00', estadio: 'Gillette Stadium, Boston' },
    { id: 'j2-23', grupo: 'L', local: 'Panamá',          visitante: 'Croacia',             fecha: '23 Jun', hora: '17:00', estadio: 'BMO Field, Toronto' },
    { id: 'j2-24', grupo: 'K', local: 'Colombia',        visitante: 'RD Congo',            fecha: '23 Jun', hora: '20:00', estadio: 'Estadio Akron, Guadalajara' },
  ],

  // ══════════════════════════════
  // JORNADA 3
  // ══════════════════════════════
  jornada3: [
    // Miércoles 24 Jun
    { id: 'j3-01', grupo: 'B', local: 'Bosnia y Herzegovina', visitante: 'Qatar',          fecha: '24 Jun', hora: '13:00', estadio: 'Lumen Field, Seattle' },
    { id: 'j3-02', grupo: 'B', local: 'Suiza',           visitante: 'Canadá',              fecha: '24 Jun', hora: '13:00', estadio: 'BC Place, Vancouver' },
    { id: 'j3-03', grupo: 'C', local: 'Marruecos',       visitante: 'Haití',               fecha: '24 Jun', hora: '16:00', estadio: 'Mercedes-Benz Stadium, Atlanta' },
    { id: 'j3-04', grupo: 'C', local: 'Escocia',         visitante: 'Brasil',              fecha: '24 Jun', hora: '16:00', estadio: 'Hard Rock Stadium, Miami' },
    { id: 'j3-05', grupo: 'A', local: 'República Checa', visitante: 'México',              fecha: '24 Jun', hora: '19:00', estadio: 'Estadio Banorte, Ciudad de México' },
    { id: 'j3-06', grupo: 'A', local: 'Sudáfrica',       visitante: 'Corea del Sur',       fecha: '24 Jun', hora: '19:00', estadio: 'Estadio BBVA, Guadalupe' },
    // Jueves 25 Jun
    { id: 'j3-07', grupo: 'E', local: 'Curazao',         visitante: 'Costa de Marfil',     fecha: '25 Jun', hora: '14:00', estadio: 'Lincoln Financial Field, Filadelfia' },
    { id: 'j3-08', grupo: 'E', local: 'Ecuador',         visitante: 'Alemania',            fecha: '25 Jun', hora: '14:00', estadio: 'MetLife Stadium, Nueva Jersey' },
    { id: 'j3-09', grupo: 'F', local: 'Japón',           visitante: 'Suecia',              fecha: '25 Jun', hora: '17:00', estadio: 'AT&T Stadium, Arlington' },
    { id: 'j3-10', grupo: 'F', local: 'Túnez',           visitante: 'Países Bajos',        fecha: '25 Jun', hora: '17:00', estadio: 'GEHA Field, Kansas City' },
    { id: 'j3-11', grupo: 'D', local: 'Paraguay',        visitante: 'Australia',           fecha: '25 Jun', hora: '20:00', estadio: "Levi's Stadium, Santa Clara" },
    { id: 'j3-12', grupo: 'D', local: 'Turquía',         visitante: 'Estados Unidos',      fecha: '25 Jun', hora: '20:00', estadio: 'SoFi Stadium, Inglewood' },
    // Viernes 26 Jun
    { id: 'j3-13', grupo: 'I', local: 'Noruega',         visitante: 'Francia',             fecha: '26 Jun', hora: '13:00', estadio: 'Gillette Stadium, Boston' },
    { id: 'j3-14', grupo: 'I', local: 'Senegal',         visitante: 'Irak',                fecha: '26 Jun', hora: '13:00', estadio: 'BMO Field, Toronto' },
    { id: 'j3-15', grupo: 'H', local: 'Cabo Verde',      visitante: 'Arabia Saudita',      fecha: '26 Jun', hora: '18:00', estadio: 'NRG Stadium, Houston' },
    { id: 'j3-16', grupo: 'H', local: 'Uruguay',         visitante: 'España',              fecha: '26 Jun', hora: '18:00', estadio: 'Estadio Akron, Guadalajara' },
    { id: 'j3-17', grupo: 'G', local: 'Egipto',          visitante: 'Irán',                fecha: '26 Jun', hora: '21:00', estadio: 'Lumen Field, Seattle' },
    { id: 'j3-18', grupo: 'G', local: 'Nueva Zelanda',   visitante: 'Bélgica',             fecha: '26 Jun', hora: '21:00', estadio: 'BC Place, Vancouver' },
    // Sábado 27 Jun
    { id: 'j3-19', grupo: 'L', local: 'Croacia',         visitante: 'Ghana',               fecha: '27 Jun', hora: '15:00', estadio: 'Lincoln Financial Field, Filadelfia' },
    { id: 'j3-20', grupo: 'L', local: 'Panamá',          visitante: 'Inglaterra',          fecha: '27 Jun', hora: '15:00', estadio: 'MetLife Stadium, Nueva Jersey' },
    { id: 'j3-21', grupo: 'K', local: 'Colombia',        visitante: 'Portugal',            fecha: '27 Jun', hora: '17:30', estadio: 'Hard Rock Stadium, Miami' },
    { id: 'j3-22', grupo: 'K', local: 'RD Congo',        visitante: 'Uzbekistán',          fecha: '27 Jun', hora: '17:30', estadio: 'Mercedes-Benz Stadium, Atlanta' },
    { id: 'j3-23', grupo: 'J', local: 'Argelia',         visitante: 'Austria',             fecha: '27 Jun', hora: '20:00', estadio: 'GEHA Field, Kansas City' },
    { id: 'j3-24', grupo: 'J', local: 'Jordania',        visitante: 'Argentina',           fecha: '27 Jun', hora: '20:00', estadio: 'AT&T Stadium, Arlington' },
  ]
};