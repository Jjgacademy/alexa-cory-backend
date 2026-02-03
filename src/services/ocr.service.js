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
  // PDF → leer texto directo
  if (filePath.toLowerCase().endsWith(".pdf")) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    const textoPdf = data.text || "";
    console.log("========== OCR TEXTO ==========");
    console.log(textoPdf);
    console.log("================================");
    return textoPdf;
  }

  // Imagen → Google Vision
  const [result] = await client.textDetection(filePath);
  const detections = result.textAnnotations;

  const texto = detections?.[0]?.description || "";

  console.log("========== OCR TEXTO ==========");
  console.log(texto);
  console.log("================================");

  return texto;
};

// ===========================
// HELPERS SEGUROS
// ===========================
const safeTrim = (v) => (typeof v === "string" ? v.trim() : "");
const limpiarEspacios = (t) => safeTrim((t || "").replace(/\s+/g, " "));

/**
 * buscarMatch:
 * - Acepta regex con o sin grupos
 * - Si hay grupo 1, devuelve grupo 1
 * - Si NO hay grupo 1, devuelve el match completo
 * - Si no match, null
 */
const buscarMatch = (texto, regex) => {
  const m = (texto || "").match(regex);
  if (!m) return null;

  // Si hay grupo capturado
  if (m[1] !== undefined && m[1] !== null && `${m[1]}` !== "") {
    return limpiarEspacios(String(m[1]));
  }

  // Si no hay grupo, devuelve el match completo
  return limpiarEspacios(String(m[0]));
};

const soloDigitos = (s) => (s || "").replace(/[^\d]/g, "");

/**
 * Convierte fechas OCR a YYYY-MM-DD.
 * Soporta:
 *  - 16-01-2026
 *  - 16/01/2026
 *  - 20/10/2025
 *  - "30/ABRIL/2025" (meses en español)
 */
const parseFechaOCR = (raw) => {
  if (!raw) return null;

  const txt = limpiarEspacios(raw).toUpperCase();

  // 1) dd-mm-yyyy / dd/mm/yyyy / dd.mm.yyyy
  let m = txt.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // 2) dd/MES/yyyy (MES en español)
  m = txt.match(/(\d{1,2})[\/\-.]([A-ZÁÉÍÓÚÑ]+)[\/\-.](\d{4})/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mes = m[2]
      .replace("Á", "A")
      .replace("É", "E")
      .replace("Í", "I")
      .replace("Ó", "O")
      .replace("Ú", "U");

    const map = {
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

    const mm = map[mes] || null;
    if (mm) return `${m[3]}-${mm}-${dd}`;
  }

  // 3) Si viene algo raro tipo "14.0, 2026." → no inventar
  return null;
};

// ===========================
// PARSER NOTA DE VENTA
// ===========================
export const analizarTextoFactura = (texto) => {

  const limpio = texto.replace(/\r/g, "");
  const lineas = limpio.split("\n").map(l => l.trim()).filter(Boolean);
  const todo = lineas.join(" ");

  /* ======================
     PROVEEDOR
  ====================== */

  const nombre = lineas[0] || "";

  const direccion = (todo.match(/Direcci[oó]n[:\s]*(.+?)(Cel|RUC|CONTRIBUYENTE)/i)?.[1] || "").trim();

  const celular = (todo.match(/Cel[:.\s]*([0-9\s]+)/i)?.[1] || "").replace(/\s/g, "");

  const ciudad = (todo.match(/Quito.*Ecuador/i)?.[0] || "");

  const ruc = (todo.match(/R\.?U\.?C\.?\s*([0-9]{10,13})/i)?.[1] || "");

  const contribuyente = (todo.match(/CONTRIBUYENTE.*RIMPE/i)?.[0] || "");

  /* ======================
     FECHA EMISIÓN
  ====================== */

  let fecha = "";
  const fechaMatch = todo.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);

  if (fechaMatch) {
    fecha = `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
  }

  /* ======================
     NOTA / FACTURA
  ====================== */

  const notaVenta = (todo.match(/(\d{3}-\d{3}-\d{2})/)?.[1] || "");
  const factura = (todo.match(/\b\d{5,9}\b/)?.[0] || "");

  const autorizacion = (todo.match(/Autorizaci[oó]n.*?([0-9]{6,})/i)?.[1] || "");

  /* ======================
     DETALLE AUTOMÁTICO
  ====================== */

  const items = [];

  for (const l of lineas) {

    if (/^\d+\s+/.test(l)) {
      const m = l.match(/^(\d+)\s+(.+)/);

      if (m) {
        items.push({
          cantidad: m[1],
          descripcion: m[2],
          unitario: "",
          total: "",
        });
      }
    }
  }

  /* ======================
     TOTAL
  ====================== */

  const totalMatch = todo.match(/TOTAL\s*\$?\s*([0-9.,]+)/i);
  const total = totalMatch ? totalMatch[1].replace(",", ".") : "0.00";

  /* ======================
     FORMA DE PAGO
  ====================== */

  const formaPago = {
    efectivo: /efectivo/i.test(todo),
    tarjeta: /tarjeta/i.test(todo),
    electronico: /electr[oó]nico/i.test(todo),
    otros: /otros/i.test(todo),
  };

  return {
    proveedor: {
      nombre,
      direccion,
      celular,
      ciudad,
      ruc,
      contribuyente,
      notaVenta,
      factura,
      autorizacion,
      fecha,
    },
    items,
    total,
    formaPago,
  };
};
