import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { leerFactura, analizarTextoFactura } from "../services/ocr.service.js";
import pool from "../config/db.js";

const router = Router();

// Convierte "425,50" -> 425.50 (número real)
const toNumber = (str) => {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, "").replace(",", "."));
};

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

      // 1️⃣ OCR
      const texto = await leerFactura(req.file.path);

      // 2️⃣ ANALIZAR FACTURA
      const analisis = analizarTextoFactura(texto);

      // ============================
      // 3️⃣ SI ES CONFIABLE → CHECAR DUPLICADOS
      // ============================
      if (
        analisis.estado_ocr === "OK" &&
        analisis.numero_factura &&
        analisis.ruc &&
        analisis.total !== "0.00"
      ) {
        const existe = await pool.query(
          `SELECT id FROM invoices 
           WHERE ruc_proveedor = $1 
           AND numero = $2 
           AND total = $3`,
          [analisis.ruc, analisis.numero_factura, toNumber(analisis.total)]
        );

        if (existe.rows.length > 0) {
          return res.status(200).json({
            message: "Esta factura ya fue registrada anteriormente",
            factura_existente_id: existe.rows[0].id,
            detectado: analisis,
            estado_ocr: analisis.estado_ocr
          });
        }
      }

      // ============================
      // 4️⃣ CÁLCULOS BASE IVA / BASE 0
      // ============================
      const baseIVA =
        parseFloat(analisis.iva) > 0
          ? toNumber(analisis.subtotal)
          : 0;

      const baseCero =
        parseFloat(analisis.iva) > 0
          ? 0
          : toNumber(analisis.subtotal);

      // ============================
      // 5️⃣ GUARDAR SIEMPRE (RECOMENDADO)
      // ============================
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
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18
        )
        RETURNING *`,
        [
          userId,
          "FACTURA",
          analisis.numero_factura,
          analisis.ruc,
          analisis.proveedor || null,
          analisis.fechaEmision,              // YYYY-MM-DD
          baseIVA,
          baseCero,
          toNumber(analisis.iva),
          0.0,
          0.0,
          toNumber(analisis.total),
          "USD",
          analisis.categoria,
          analisis.claveAcceso,
          texto,
          analisis.confianza,
          analisis.estado_ocr
        ]
      );

      return res.status(201).json({
        message: "Factura procesada y guardada correctamente",
        detectado: analisis,
        guardado_en_bd: result.rows[0]
      });

    } catch (error) {
      console.log("❌ ERROR OCR/FACTURA:", error);
      return res.status(500).json({
        message: "Error al procesar OCR o guardar factura",
        error: error.message
      });
    }
  }
);

export default router;
