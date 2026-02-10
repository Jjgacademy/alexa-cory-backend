import vision from "@google-cloud/vision";
import fs from "fs";
import { createRequire } from "module";

console.log("Google key:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

// Cliente Google Vision
const client = new vision.ImageAnnotatorClient();

// ===========================
// LECTURA OCR (VISION API)
// ===========================
export const leerFactura = async (filePath) => {
  if (filePath.toLowerCase().endsWith(".pdf")) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    const textoPdf = data.text || "";
    console.log("========== OCR TEXTO ==========");
    console.log(textoPdf);
    console.log("================================");
    return textoPdf;
  }

  const [result] = await client.textDetection(filePath);
  const texto = result.textAnnotations?.[0]?.description || "";

  console.log("========== OCR TEXTO ==========");
  console.log(texto);
  console.log("================================");

  return texto;
};

// ===========================
// HELPERS
// ===========================
const limpiar = (t) => (t || "").replace(/\s+/g, " ").trim();
const soloDigitos = (s) => (s || "").replace(/[^\d]/g, "");

const normalizarMayus = (s) =>
  (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes

// busca match por regex y retorna grupo 1 si existe, sino match completo
const match1 = (txt, re) => {
  const m = (txt || "").match(re);
  if (!m) return "";
  return limpiar(m[1] ?? m[0] ?? "");
};

/**
 * Convierte fechas OCR a YYYY-MM-DD
 * Soporta:
 * - 20/10/2025
 * - 20-10-2025
 * - 30/ABRIL/2025
 * - 30-ABRIL-2025
 */
const parseFecha = (txt) => {
  if (!txt) return "";

  const t = normalizarMayus(txt);

  // dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy
  let m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }

  // dd/MES/yyyy
  m = t.match(/(\d{1,2})[\/\-.]([A-ZÑ]+)[\/\-.](\d{4})/);
  if (!m) return "";

  const meses = {
    ENERO: "01",
    FEBRERO: "02",
    MARZO: "03",
    ABRIL: "04",
    MAYO: "05",
    JUNIO: "06",
    JULIO: "07",
    AGOSTO: "08",
    SEPTIEMBRE: "09",
    SETIEMBRE: "09",
    OCTUBRE: "10",
    NOVIEMBRE: "11",
    DICIEMBRE: "12",
  };

  const mes = meses[m[2]];
  if (!mes) return "";

  const dd = String(m[1]).padStart(2, "0");
  return `${m[3]}-${mes}-${dd}`;
};

// ===========================
// PARSER NOTA DE VENTA
// ===========================
export const analizarTextoFactura = (texto) => {
  const lineasRaw = (texto || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // línea limpia (colapsa espacios)
  const lineas = lineasRaw.map(limpiar);

  // texto completo
  const todo = limpiar(lineas.join(" "));

  // ======================
  // EXTRAER RUC PROVEEDOR (robusto)
  // ======================
  // Prioridad: "R.U.C." / "RUC" / "R. U. C." + 13 dígitos (Ecuador)
  const rucProveedor =
    match1(todo, /\bR\.?\s*U\.?\s*C\.?\s*[:#]?\s*([0-9]{10,13})\b/i) ||
    match1(todo, /\bRUC\s*[:#]?\s*([0-9]{10,13})\b/i);

  // ======================
  // NOMBRE PROVEEDOR (no mezclar con RUC)
  // ======================
  // Caso típico: "MARIANA ... R.U.C. 170..."
  // Si la primera línea trae "RUC" o "R.U.C", se corta antes de eso.
  // ======================
// NOMBRE + ACTIVIDAD ECONÓMICA
// ======================

// Primera línea = nombre proveedor
let nombre = lineas[0] || "";

// limpia RUC pegado al nombre
if (/R\.?\s*U\.?\s*C\.?/i.test(nombre) || /\bRUC\b/i.test(nombre)) {
  nombre = limpiar(
    nombre
      .replace(/\bR\.?\s*U\.?\s*C\.?.*$/i, "")
      .replace(/\bRUC\b.*$/i, "")
  );
}

// si nombre trae ruc pegado sin texto "RUC"
if (rucProveedor && nombre.includes(rucProveedor)) {
  nombre = limpiar(nombre.replace(rucProveedor, ""));
}

// fallback por si el OCR dañó la primera línea
if (!nombre) {
  nombre =
    limpiar(match1(todo, /^(.+?)\b(NOTA\s+DE\s+VENTA|FACTURA|VENTA\s+DE)\b/i)) ||
    (lineas[0] || "");
}

// ======================
// ACTIVIDAD ECONÓMICA
// ======================

let actividad = "";

// Buscar la línea válida debajo del nombre
for (let i = 1; i < Math.min(6, lineas.length); i++) {
  const l = lineas[i];

  if (
    !/Direcci[oó]n/i.test(l) &&
    !/Cel/i.test(l) &&
    !/R\.?U\.?C/i.test(l) &&
    !/CONTRIBUYENTE/i.test(l) &&
    !/NOTA/i.test(l)
  ) {
    actividad = limpiar(l);
    break;
  }
}

  // ======================
  // DIRECCION / CEL / CIUDAD
  // ======================
  const direccion = limpiar(
    match1(todo, /Direcci[oó]n\s*:?\s*(.+?)(\bCel\b|TELF|TEL|R\.?\s*U\.?\s*C|RUC|NOTA\s+DE\s+VENTA)/i)
  );

  let celular = "";

  // busca línea que tenga Cel / Tel
  const lineaCel = lineas.find((l) =>
    /(Cel\.?|Celular|Telefono|Tel\.?|TELF)/i.test(l)
  );

  if (lineaCel) {
    const m = lineaCel.match(/(09\d{8})/);
    if (m) celular = m[1];
  }

  // fallback: busca cualquier celular ecuatoriano
  if (!celular) {
    const m = todo.match(/\b(09\d{8})\b/);
    if (m) celular = m[1];
  }

  // ciudad: intenta "Quito - Ecuador" o "Quito Ecuador" o "... - Ecuador"
  let ciudad = "";

if (lineaCel) {
  // quitar el número antes de extraer ciudad
  const sinNumero = lineaCel.replace(/09\d{8}/, "");
  const m = sinNumero.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]+Ecuador)/i);
  if (m) ciudad = limpiar(m[1]);
}

if (!ciudad) {
  ciudad =
    limpiar(match1(todo, /([A-Za-zÁÉÍÓÚÑáéíóúñ\s\-]+Ecuador)/i)) || "";
}

  const contribuyente = lineas.find((l) => /CONTRIBUYENTE/i.test(l)) || "";

 // ======================
// NOTA DE VENTA / NUMERO (seguro)
// ======================

// serie: 001-001-00
const serie = match1(
  todo,
  /\b(\d{3}\s*-\s*\d{3}\s*-\s*\d{2})\b/
).replace(/\s+/g, "");

// número grande rojo: 0002974
const secuencial = match1(
  todo,
  /NOTA\s+DE\s+VENTA[^\d]{0,15}(\d{4,9})/i
);

// combinar ambos
let notaVenta = match1(
  todo,
  /\b(\d{3}-\d{3}-\d{2}\s*\d{4,9})\b/
).replace(/\s+/g, "");

// 2️⃣ si viene separado en dos líneas (serie arriba, número abajo)
if (!notaVenta) {
  const serie = match1(todo, /\b(\d{3}-\d{3}-\d{2})\b/);
  const numeroGrande = match1(todo, /\b(0{2,}\d{3,9})\b/);

  if (serie && numeroGrande) {
    notaVenta = `${serie}${numeroGrande}`;
  }
}

// 3️⃣ fallback: serie completa ya unida
if (!notaVenta) {
  notaVenta = match1(todo, /\b(\d{3}-\d{3}-\d{6,9})\b/);
}
// este campo lo dejamos porque el sistema lo espera
const factura = "";

  // ======================
  // AUTORIZACION SRI (número)
  // ======================
  const autorizacion =
    match1(todo, /Autorizaci[oó]n\s*(?:S\.?R\.?I\.?)?\s*[:#Nº°]*\s*([0-9]{6,})/i) ||
    match1(todo, /\bAUT\.\s*SRI\s*N[º°]?\s*([0-9]{6,})/i);

  // ======================
  // FECHA (la correcta: FECHA AUTORIZACIÓN / Fecha Aut. S.R.I.)
  // ======================
  // Prioridad: fecha de autorización SRI
  const fechaAutRaw =
    match1(todo, /FECHA\s+AUT(?:ORIZACI[OÓ]N)?\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9A-ZÁÉÍÓÚÑ]{1,10}[\/\-.][0-9]{4})/i) ||
    match1(todo, /Fecha\s+Aut\.?\s*S\.?R\.?I\.?\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9A-ZÁÉÍÓÚÑ]{1,10}[\/\-.][0-9]{4})/i);

  const fecha = parseFecha(fechaAutRaw); // <- esta es la que debe ir al input date

  // ======================
  // DETALLE (mejorado)
  // ======================
  // Estrategia:
  // 1) detecta la sección desde "CANT" hasta antes de "TOTAL" o "FORMA"
  // 2) parsea líneas que comiencen con cantidad
  // 3) si viene todo en una sola línea, intenta extraer patrones qty + desc

  const items = [];

  const idxCant = lineas.findIndex((l) => /\bCANT\b/i.test(l));
  const idxDesc = lineas.findIndex((l) => /DESCRIPC/i.test(l));
  const idxInicio = idxCant >= 0 ? idxCant : idxDesc;

  let idxFin = -1;
  if (idxInicio >= 0) {
    idxFin = lineas.findIndex((l, i) => i > idxInicio && /(TOTAL\s*\$?|FORMA\s+Y\s+VALOR|EFECTIVO:|TARJETA|OTROS:)/i.test(l));
    if (idxFin < 0) idxFin = lineas.length;
  }

  const bloqueDetalle =
    idxInicio >= 0 ? lineas.slice(idxInicio, idxFin).filter(Boolean) : [];

  // quitar encabezados típicos
  const bloqueFiltrado = bloqueDetalle.filter(
    (l) =>
      !/\bCANT\b/i.test(l) &&
      !/DESCRIPC/i.test(l) &&
      !/V\.\s*UNIT/i.test(l) &&
      !/V\.\s*TOTAL/i.test(l)
  );

  // Caso A: líneas tipo "1 Dispensador de 5 Galones"
  for (const l of bloqueFiltrado) {
    const m = l.match(/^(\d{1,3})\s+(.+)$/);
    if (m) {
      const cantidad = m[1];
      let descripcion = limpiar(m[2]);

      // si descripción es muy corta o basura OCR, ignora
      if (descripcion.length < 2) continue;

      items.push({
        cantidad,
        descripcion,
        unitario: "",
        total: "",
      });
    }
  }

  // Caso B: si no detectó nada, intenta extraer por patrón en TODO el texto:
  // "1/2 Galón" no sirve como cantidad (por eso solo cantidades enteras al inicio)
  if (items.length === 0) {
    // intenta recuperar por líneas que contengan productos comunes (heurística)
    // y números de cantidad en otra línea cercana (muy variable). Aquí solo lo básico:
    for (const l of bloqueFiltrado) {
      // desc sin cantidad, pero parece item
      if (l.length > 4 && !/\b(TELF|RUC|AUT|SRI|CLIENTE|DIRECCION|ECUADOR)\b/i.test(l)) {
        // si contiene palabras y no es encabezado, lo toma como ítem sin cantidad
        // (para que al menos aparezca)
        items.push({
          cantidad: "",
          descripcion: l,
          unitario: "",
          total: "",
        });
      }
    }

    // si metió demasiada basura, limpia: deja solo descripciones razonables
    const depurado = items.filter((it) => limpiar(it.descripcion).length >= 5);
    items.length = 0;
    items.push(...depurado.slice(0, 30));
  }

  // ======================
  // TOTAL
  // ======================
  const total =
    match1(todo, /TOTAL\s*\$?\s*([0-9][0-9.,]*)/i).replace(",", ".") || "0.00";

  // ======================
  // FORMA DE PAGO
  // ======================
  const formaPago = {
    efectivo: /EFECTIVO/i.test(todo),
    tarjeta: /TARJETA/i.test(todo),
    electronico: /ELECTR[oó]NICO/i.test(todo),
    otros: /\bOTROS\b/i.test(todo),
  };

  const parsed = {
    proveedor: {
      nombre,
      actividad,
      direccion,
      celular,
      ciudad,
      ruc: rucProveedor,
      contribuyente,
      notaVenta,
      factura,
      autorizacion,
      fecha, // <- fecha autorización SRI en YYYY-MM-DD
    },
    items,
    total,
    formaPago,
  };

  console.log("========== PARSED ==========");
  console.log(parsed);
  console.log("============================");

  return parsed;
};
