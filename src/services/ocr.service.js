import Tesseract from "tesseract.js";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

// ===========================
// 1️⃣ LECTURA DEL ARCHIVO
// ===========================
export const leerFactura = async (filePath) => {
  // Si es PDF
  if (filePath.toLowerCase().endsWith(".pdf")) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    return data.text || "";
  }

  // Si es imagen (PNG, JPG, etc.)
  const resultado = await Tesseract.recognize(filePath, "spa");
  return resultado.data.text || "";
};

// ===========================
// Helpers
// ===========================
const normalizarNumero = (valorTexto) => {
  if (!valorTexto) return "0.00";
  const limpio = valorTexto.replace(/\./g, "").replace(",", ".");
  const numero = parseFloat(limpio);
  if (isNaN(numero)) return "0.00";
  return numero.toFixed(2);
};

const extraerClaveAcceso = (texto) => {
  const clean = texto.replace(/\s+/g, "");
  const match = clean.match(/\b\d{44,50}\b/);
  return match ? match[0] : null;
};

// ===========================
// 2️⃣ ANALIZAR FACTURA
// ===========================
export const analizarTextoFactura = (texto) => {
  // Número tipo 001-100-000005584
  const numero_factura =
    texto.match(/\b\d{3}[-\s]\d{3}[-\s]?\d+\b/)?.[0] || null;

  // RUC 13 dígitos
  const ruc = texto.match(/\b\d{13}\b/)?.[0] || null;

  // Proveedor – intenta leer línea después de Nombres:
  let proveedor = null;
  const provMatch = texto.match(/Nombres?:\s*([\s\S]*?)\n/);
  if (provMatch) proveedor = provMatch[1].trim();

  // SUBTOTAL
  const matchSubNeto = texto.match(/Subtotal\s*(Neto)?:?\s*\$?\s*([0-9.,]+)/i);
  const matchSubSimple = texto.match(/Subtotal\s*[:\-]?\s*\$?\s*([0-9.,]+)/i);
  let subtotalTxt = matchSubNeto?.[2] || matchSubSimple?.[1] || null;
  const subtotal = normalizarNumero(subtotalTxt);

  // IVA
  const matchIvaPor = texto.match(/IVA\s*\d{1,2}\s*%?\s*\$?\s*([0-9.,]+)/i);
  const matchIvaSimple = texto.match(/IVA\s*[:\-]?\s*\$?\s*([0-9.,]+)/i);
  let ivaTxt = matchIvaPor?.[1] || matchIvaSimple?.[1] || null;
  const iva = normalizarNumero(ivaTxt);

  // TOTAL
  const matchValorTotal = texto.match(/VALOR\s*TOTAL\s*\$?\s*([0-9.,]+)/i);
  const matchTotalSimple = texto.match(/TOTAL\s*\$?\s*([0-9.,]+)/i);
  let totalTxt = matchValorTotal?.[1] || matchTotalSimple?.[1] || null;
  const total = normalizarNumero(totalTxt);

  // Fecha dd/mm/yyyy
  let fechaEmision = null;
  const matchFecha = texto.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (matchFecha) {
    const [_, dd, mm, yyyy] = matchFecha;
    fechaEmision = `${yyyy}-${mm}-${dd}`;
  }

  // Clave de acceso
  const claveAcceso = extraerClaveAcceso(texto);

  // Clasificación simple
  let categoria = "SIN CLASIFICAR";
  const up = texto.toUpperCase();

  if (up.includes("SERVICIOS LEGALES")) categoria = "SERVICIOS PROFESIONALES";
  else if (up.includes("SUPERMAXI") || up.includes("COMISARIATO"))
    categoria = "SUPERMERCADO";
  else if (up.includes("HOTEL") || up.includes("HOSPEDAJE"))
    categoria = "ALOJAMIENTO";

  // ===========================
  // Score de confianza
  // ===========================
  let score = 0;
  if (numero_factura) score += 25;
  if (ruc) score += 25;
  if (total !== "0.00") score += 25;
  if (fechaEmision) score += 25;

  let estado_ocr = "PENDIENTE";
  if (score >= 75) estado_ocr = "OK";
  else if (score >= 50) estado_ocr = "REVISAR";

  return {
    numero_factura,
    ruc,
    proveedor,
    subtotal,
    iva,
    total,
    fechaEmision,
    categoria,
    claveAcceso,
    confianza: score,
    estado_ocr,
  };
};
