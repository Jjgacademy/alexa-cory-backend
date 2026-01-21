import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { leerFactura, analizarTextoFactura } from "../services/ocr.service.js";
import pool from "../config/db.js";
import fs from "fs";
import xml2js from "xml2js";

const router = Router();

/* =========================
   UTILIDADES
   ========================= */
const parseNumber = (v) => {
  if (!v) return 0;
  return Number(v.toString().replace(",", ".")) || 0;
};

const parseDate = (v) => {
  if (!v) return null;
  if (v.includes("/")) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }
  return v.split("T")[0];
};

/* =========================
   FUNCIÓN PRINCIPAL
   ========================= */
const procesarFactura = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se envió archivo" });
    }

    const userId = req.user?.id || 1;
    const { mimetype, path: filePath } = req.file;

    /* =====================================================
        🧾 XML
       ===================================================== */
    if (mimetype.includes("xml")) {
      const xmlContent = fs.readFileSync(filePath, "utf8");
      const parser = new xml2js.Parser({ explicitArray: false });

      const root = await parser.parseStringPromise(xmlContent);
      const comprobante =
        root?.autorizacion?.comprobante ||
        root?.autorizaciones?.autorizacion?.comprobante;

      if (!comprobante) {
        return res.status(400).json({ message: "XML inválido" });
      }

      const facturaXML = await parser.parseStringPromise(comprobante);
      const infoT = facturaXML.factura.infoTributaria;
      const infoF = facturaXML.factura.infoFactura;
      const detallesXML = facturaXML.factura.detalles?.detalle || [];

      const numero = `${infoT.estab}-${infoT.ptoEmi}-${infoT.secuencial}`;
      const clave = infoT.claveAcceso;

      // Duplicados
      const dup = await pool.query(
        "SELECT id FROM invoices WHERE clave_acceso = $1",
        [clave]
      );
      if (dup.rows.length) {
        return res.json({
          estado: "DUPLICADA",
          invoice_id: dup.rows[0].id,
        });
      }

      // Insert factura
      const facturaRes = await pool.query(
        `INSERT INTO invoices
         (user_id, numero, ruc_proveedor, nombre_proveedor,
          fecha_emision, total, clave_acceso, texto_ocr, estado_ocr)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'XML_OK')
         RETURNING id`,
        [
          userId,
          numero,
          infoT.ruc,
          infoT.razonSocial,
          parseDate(infoF.fechaEmision),
          parseNumber(infoF.importeTotal),
          clave,
          comprobante,
        ]
      );

      const invoiceId = facturaRes.rows[0].id;

      /* =========================
         GUARDAR DETALLES
         ========================= */
      const detalles = Array.isArray(detallesXML)
        ? detallesXML
        : [detallesXML];

      for (const d of detalles) {
        await pool.query(
          `INSERT INTO invoice_details
           (invoice_id, codigo, descripcion, cantidad, precio_unitario, total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            invoiceId,
            d.codigoPrincipal || null,
            d.descripcion || null,
            parseNumber(d.cantidad),
            parseNumber(d.precioUnitario),
            parseNumber(d.precioTotalSinImpuesto),
          ]
        );
      }

      return res.json({
        estado: "COMPLETA_AUTOMATICA",
        invoice_id: invoiceId,
      });
    }

    /* =====================================================
        📸 PDF / IMAGEN
       ===================================================== */
    const texto = await leerFactura(filePath);
    const analisis = analizarTextoFactura(texto);

    const resFactura = await pool.query(
      `INSERT INTO invoices
       (user_id, numero, ruc_proveedor, nombre_proveedor,
        fecha_emision, total, texto_ocr, estado_ocr)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDIENTE')
       RETURNING id`,
      [
        userId,
        analisis.numero_factura,
        analisis.ruc,
        analisis.proveedor,
        parseDate(analisis.fechaEmision),
        parseNumber(analisis.total),
        texto,
      ]
    );

    return res.json({
      estado: "MANUAL",
      invoice_id: resFactura.rows[0].id,
    });

  } catch (err) {
    console.error("❌ ERROR FACTURA:", err);
    res.status(500).json({ message: "Error al procesar la factura" });
  }
};

/* =========================
   RUTAS
   ========================= */
router.post("/factura", authMiddleware, upload.single("file"), procesarFactura);
router.post("/", upload.single("file"), procesarFactura); // dev

export default router;
