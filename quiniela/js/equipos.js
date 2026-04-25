// 48 equipos clasificados Copa Mundial FIFA 2026
// Banderas via flagcdn.com (código ISO 3166-1 alpha-2)
const EQUIPOS = [
  // ── EUROPA (16) ──
  { nombre: "Inglaterra",         codigo: "gb-eng", bandera: "https://flagcdn.com/gb-eng.svg" },
  { nombre: "Francia",            codigo: "fr",     bandera: "https://flagcdn.com/fr.svg" },
  { nombre: "Alemania",           codigo: "de",     bandera: "https://flagcdn.com/de.svg" },
  { nombre: "España",             codigo: "es",     bandera: "https://flagcdn.com/es.svg" },
  { nombre: "Portugal",           codigo: "pt",     bandera: "https://flagcdn.com/pt.svg" },
  { nombre: "Países Bajos",       codigo: "nl",     bandera: "https://flagcdn.com/nl.svg" },
  { nombre: "Bélgica",            codigo: "be",     bandera: "https://flagcdn.com/be.svg" },
  { nombre: "Croacia",            codigo: "hr",     bandera: "https://flagcdn.com/hr.svg" },
  { nombre: "Suiza",              codigo: "ch",     bandera: "https://flagcdn.com/ch.svg" },
  { nombre: "Austria",            codigo: "at",     bandera: "https://flagcdn.com/at.svg" },
  { nombre: "Noruega",            codigo: "no",     bandera: "https://flagcdn.com/no.svg" },
  { nombre: "Escocia",            codigo: "gb-sct", bandera: "https://flagcdn.com/gb-sct.svg" },
  { nombre: "Suecia",             codigo: "se",     bandera: "https://flagcdn.com/se.svg" },
  { nombre: "Turquía",            codigo: "tr",     bandera: "https://flagcdn.com/tr.svg" },
  { nombre: "Bosnia y Herzegovina", codigo: "ba",   bandera: "https://flagcdn.com/ba.svg" },
  { nombre: "Rep. Checa",         codigo: "cz",     bandera: "https://flagcdn.com/cz.svg" },
  // ── CONMEBOL (6) ──
  { nombre: "Argentina",          codigo: "ar",     bandera: "https://flagcdn.com/ar.svg" },
  { nombre: "Brasil",             codigo: "br",     bandera: "https://flagcdn.com/br.svg" },
  { nombre: "Colombia",           codigo: "co",     bandera: "https://flagcdn.com/co.svg" },
  { nombre: "Uruguay",            codigo: "uy",     bandera: "https://flagcdn.com/uy.svg" },
  { nombre: "Ecuador",            codigo: "ec",     bandera: "https://flagcdn.com/ec.svg" },
  { nombre: "Paraguay",           codigo: "py",     bandera: "https://flagcdn.com/py.svg" },
  // ── CONCACAF (6) ──
  { nombre: "Estados Unidos",     codigo: "us",     bandera: "https://flagcdn.com/us.svg" },
  { nombre: "México",             codigo: "mx",     bandera: "https://flagcdn.com/mx.svg" },
  { nombre: "Canadá",             codigo: "ca",     bandera: "https://flagcdn.com/ca.svg" },
  { nombre: "Panamá",             codigo: "pa",     bandera: "https://flagcdn.com/pa.svg" },
  { nombre: "Haití",              codigo: "ht",     bandera: "https://flagcdn.com/ht.svg" },
  { nombre: "Curazao",            codigo: "cw",     bandera: "https://flagcdn.com/cw.svg" },
  // ── AFRICA (9) ──
  { nombre: "Marruecos",          codigo: "ma",     bandera: "https://flagcdn.com/ma.svg" },
  { nombre: "Senegal",            codigo: "sn",     bandera: "https://flagcdn.com/sn.svg" },
  { nombre: "Nigeria",            codigo: "ng",     bandera: "https://flagcdn.com/ng.svg" },
  { nombre: "Egipto",             codigo: "eg",     bandera: "https://flagcdn.com/eg.svg" },
  { nombre: "Camerún",            codigo: "cm",     bandera: "https://flagcdn.com/cm.svg" },
  { nombre: "Sudáfrica",          codigo: "za",     bandera: "https://flagcdn.com/za.svg" },
  { nombre: "Mali",               codigo: "ml",     bandera: "https://flagcdn.com/ml.svg" },
  { nombre: "Cabo Verde",         codigo: "cv",     bandera: "https://flagcdn.com/cv.svg" },
  { nombre: "RD Congo",           codigo: "cd",     bandera: "https://flagcdn.com/cd.svg" },
  // ── ASIA (8) ──
  { nombre: "Japón",              codigo: "jp",     bandera: "https://flagcdn.com/jp.svg" },
  { nombre: "Corea del Sur",      codigo: "kr",     bandera: "https://flagcdn.com/kr.svg" },
  { nombre: "Arabia Saudita",     codigo: "sa",     bandera: "https://flagcdn.com/sa.svg" },
  { nombre: "Australia",          codigo: "au",     bandera: "https://flagcdn.com/au.svg" },
  { nombre: "Irán",               codigo: "ir",     bandera: "https://flagcdn.com/ir.svg" },
  { nombre: "Uzbekistán",         codigo: "uz",     bandera: "https://flagcdn.com/uz.svg" },
  { nombre: "Jordania",           codigo: "jo",     bandera: "https://flagcdn.com/jo.svg" },
  { nombre: "Irak",               codigo: "iq",     bandera: "https://flagcdn.com/iq.svg" },
  // ── OCEANÍA (1) ──
  { nombre: "Nueva Zelanda",      codigo: "nz",     bandera: "https://flagcdn.com/nz.svg" },
  // ── GRUPOS DEFINIDOS (rellena los 3 faltantes) ──
  { nombre: "Indonesia",          codigo: "id",     bandera: "https://flagcdn.com/id.svg" },
  { nombre: "Qatar",              codigo: "qa",     bandera: "https://flagcdn.com/qa.svg" },
  { nombre: "Venezuela",          codigo: "ve",     bandera: "https://flagcdn.com/ve.svg" },
  { nombre: "Costa de Marfil",    codigo: "ci",     bandera: "https://flagcdn.com/ci.svg" },
  { nombre: "Argelia",            codigo: "dz",     bandera: "https://flagcdn.com/dz.svg" },
  { nombre: "Ghana",              codigo: "gh",     bandera: "https://flagcdn.com/gh.svg" },
  { nombre: "Túnez",              codigo: "tn",     bandera: "https://flagcdn.com/tn.svg" },
];

export default EQUIPOS;
