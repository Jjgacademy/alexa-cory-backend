import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { leerFactura, analizarTextoFactura } from "../services/ocr.service.js";
import pool from "../config/db.js";
import fs from "fs";
import xml2js from "xml2js";

const router = Router();

/* =========================
   UTILIDADES DEFINITIVAS
   ========================= */

// Números: acepta 1.234,56 | 1,234.56 | 425,50 | 425.50
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const clean = value.toString().replace(/\s/g, "");

  if (clean.includes(",") && clean.includes(".")) {
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    } else {
      return parseFloat(clean.replace(/,/g, ""));
    }
  }

  if (clean.includes(",")) return parseFloat(clean.replace(",", "."));

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Fechas: DD/MM/YYYY | YYYY-MM-DD | ISO
const parseDate = (value) => {
  if (!value) return null;

  if (value.includes("/")) {
    const [d, m, y] = value.split("/");
    return `${y}-${m}-${d}`;
  }

  if (value.includes("T")) return value.split("T")[0];

  if (value.includes("-")) return value;

  return null;
};

// Obtiene valor por múltiples rutas posibles
const getValue = (obj, paths = []) => {
  for (const path of paths) {
    const parts = path.split(".");
    let current = obj;

    for (const part of parts) {
      if (!current || current[part] === undefined || current[part] === null) {
        current = null;
        break;
      }
      current = current[part];
    }

    if (current !== null && current !== undefined) return current;
  }
  return null;
};

/* =========================
   RUTA PRINCIPAL
   ========================= */
router.post(
  "/factura",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se envió archivo" });
      }

      const userId = req.user.id;
      const { mimetype, path: filePath } = req.file;

      /* =====================================================
         🧾 XML → PARSEO REAL SRI + VALIDACIÓN DUPLICADOS
         ===================================================== */
      if (mimetype === "application/xml" || mimetype === "text/xml") {
        const xmlContent = fs.readFileSync(filePath, "utf8");
        const parser = new xml2js.Parser({ explicitArray: false });

        // 1) Parse del XML raíz (wrapper con autorizacion)
        const xmlRoot = await parser.parseStringPromise(xmlContent);

        // 2) Extraer el XML interno real dentro de <comprobante>
        //    Puede venir como:
        //    - xmlRoot.autorizacion.comprobante
        //    - xmlRoot.autorizaciones.autorizacion.comprobante
        const comprobanteXML =
          xmlRoot?.autorizacion?.comprobante ||
          xmlRoot?.autorizaciones?.autorizacion?.comprobante;

        if (!comprobanteXML) {
          return res.status(400).json({
            message: "XML inválido: no se encontró el nodo <comprobante> dentro de <autorizacion>",
          });
        }

        // 3) Parse del XML interno (la factura real)
        //    Nota: comprobanteXML ya suele venir como string XML.
        const facturaParsed = await parser.parseStringPromise(comprobanteXML);

        // 4) Tomar nodos reales de SRI
        const infoTributaria = facturaParsed?.factura?.infoTributaria;
        const infoFactura = facturaParsed?.factura?.infoFactura;

        if (!infoTributaria || !infoFactura) {
          return res.status(400).json({
            message: "XML inválido: no se encontró infoTributaria/infoFactura dentro de <factura>",
          });
        }

        // 5) Extraer campos reales
        const estab = infoTributaria?.estab || "";
        const ptoEmi = infoTributaria?.ptoEmi || "";
        const secuencial = infoTributaria?.secuencial || "";

        const numeroFactura =
          estab && ptoEmi && secuencial
            ? `${estab}-${ptoEmi}-${secuencial}`
            : (secuencial || "SIN_NUMERO");

        const rucProveedor = infoTributaria?.ruc || "0000000000000";
        const proveedor = infoTributaria?.razonSocial || "XML SIN PROVEEDOR";
        const claveAcceso = infoTributaria?.claveAcceso || null;

        // Fecha emisión
        let fechaEmision = parseDate(infoFactura?.fechaEmision);
        if (!fechaEmision) {
          fechaEmision = new Date().toISOString().slice(0, 10);
        }

        // Total
        const total = parseNumber(infoFactura?.importeTotal);

        // Estado
        const estadoXML =
          claveAcceso && rucProveedor && numeroFactura && total >= 0
            ? "XML_OK"
            : "XML_INCOMPLETO";

        // 6) Validación de duplicados (SRI): claveAcceso
        if (claveAcceso) {
          const existe = await pool.query(
            `SELECT id FROM invoices WHERE clave_acceso = $1`,
            [claveAcceso]
          );

          if (existe.rows.length > 0) {
            return res.status(200).json({
              message: "Esta factura XML ya fue registrada anteriormente",
              factura_existente_id: existe.rows[0].id,
              estado: "DUPLICADO_XML",
            });
          }
        } else {
          // Si por algún motivo no hay claveAcceso, intentamos fallback:
          const existeFallback = await pool.query(
            `SELECT id FROM invoices
             WHERE ruc_proveedor = $1 AND numero = $2 AND fecha_emision = $3 AND total = $4`,
            [rucProveedor, numeroFactura, fechaEmision, total]
          );

          if (existeFallback.rows.length > 0) {
            return res.status(200).json({
              message: "Esta factura XML ya fue registrada anteriormente (fallback)",
              factura_existente_id: existeFallback.rows[0].id,
              estado: "DUPLICADO_XML",
            });
          }
        }

        // 7) Guardar
        const result = await pool.query(
          `INSERT INTO invoices (
            user_id,
            tipo_comprobante,
            numero,
            ruc_proveedor,
            nombre_proveedor,
            fecha_emision,
            base_iva,
            base_cero,
            iva,
            retencion_iva,
            retencion_renta,
            total,
            moneda,
            categoria,
            clave_acceso,
            texto_ocr,
            confianza_ocr,
            estado_ocr
          )
          VALUES (
            $1,'FACTURA',$2,$3,$4,$5,
            0,0,0,0,0,$6,
            'USD','XML',$7,$8,1,$9
          )
          RETURNING *`,
          [
            userId,
            numeroFactura,
            rucProveedor,
            proveedor,
            fechaEmision,
            total,
            claveAcceso,
            comprobanteXML, // guardamos el XML REAL de la factura
            estadoXML,
          ]
        );

        return res.status(201).json({
          message: "XML procesado y guardado correctamente",
          estado: estadoXML,
          guardado_en_bd: result.rows[0],
        });
      }

      /* =====================================================
         📸 PDF / IMAGEN → OCR (SIN CAMBIOS)
         ===================================================== */
      const texto = await leerFactura(filePath);
      const analisis = analizarTextoFactura(texto);

      const result = await pool.query(
        `INSERT INTO invoices (
          user_id, tipo_comprobante, numero, ruc_proveedor,
          nombre_proveedor, fecha_emision, base_iva, base_cero,
          iva, retencion_iva, retencion_renta, total, moneda,
          categoria, clave_acceso, texto_ocr, confianza_ocr, estado_ocr
        )
        VALUES (
          $1,'FACTURA',$2,$3,$4,$5,
          0,0,0,0,0,$6,
          'USD','OCR',$7,$8,$9
        )
        RETURNING *`,
        [
          userId,
          analisis.numero_factura,
          analisis.ruc,
          analisis.proveedor,
          analisis.fechaEmision,
          parseNumber(analisis.total),
          analisis.claveAcceso,
          texto,
          analisis.estado_ocr,
        ]
      );

      return res.status(201).json({
        message: "Factura OCR guardada correctamente",
        guardado_en_bd: result.rows[0],
      });

    } catch (error) {
      console.error("❌ ERROR FACTURA COMPLETO:", error);
      console.error("❌ STACK:", error.stack);

      return res.status(500).json({
        message: "Error al procesar la factura",
        error: error.message,
      });
    }
  }
);

export default router;
