import fs from "fs";
import pool from "../config/db.js";
import { parseXmlInvoice } from "../services/xmlInvoiceParser.js";

export const uploadFactura = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return res.status(400).json({ message: "No se envió ningún archivo" });
    }

    /* =========================
       CASO 1: XML (AUTOMÁTICO)
       ========================= */
    if (
      file.mimetype === "application/xml" ||
      file.mimetype === "text/xml" ||
      file.originalname.endsWith(".xml")
    ) {
      const xmlContent = fs.readFileSync(file.path, "utf8");

      // 1️⃣ Parsear XML
      const data = await parseXmlInvoice(xmlContent);

      // 2️⃣ Buscar razón social por RUC (si existe en tu tabla)
      const rs = await pool.query(
        "SELECT razon_social FROM ruc_razon_social WHERE ruc = $1",
        [data.proveedor.ruc]
      );

      const razonSocialFinal =
        rs.rows[0]?.razon_social || data.proveedor.razon_social;

      // 3️⃣ Insertar factura
      const invoiceResult = await pool.query(
        `INSERT INTO invoices
        (user_id, numero, ruc_proveedor, nombre_proveedor, fecha_emision, total)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id`,
        [
          userId,
          `${data.factura.estab}-${data.factura.pto_emi}-${data.factura.secuencial}`,
          data.proveedor.ruc,
          razonSocialFinal,
          data.factura.fecha_emision,
          data.factura.total,
        ]
      );

      const invoiceId = invoiceResult.rows[0].id;

      // 4️⃣ Insertar detalles
      for (const d of data.detalles) {
        await pool.query(
          `INSERT INTO invoice_details
          (invoice_id, codigo_principal, codigo_auxiliar, cantidad, descripcion, precio_unitario, descuento, precio_total_sin_impuesto)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            invoiceId,
            d.codigo_principal,
            d.codigo_auxiliar,
            d.cantidad,
            d.descripcion,
            d.precio_unitario,
            d.descuento,
            d.precio_total_sin_impuesto,
          ]
        );
      }

      // 5️⃣ Información adicional (si existe)
      if (data.info_adicional?.length) {
        for (const info of data.info_adicional) {
          await pool.query(
            `INSERT INTO invoice_additional_fields
             (invoice_id, field_name, field_value)
             VALUES ($1,$2,$3)`,
            [invoiceId, info.nombre, info.valor]
          );
        }
      }

      return res.json({
        estado: "COMPLETA_AUTOMATICA",
        invoice_id: invoiceId,
        mensaje: "Factura XML procesada correctamente",
      });
    }

    /* =========================
       CASO 2: PDF / IMAGEN
       ========================= */
    return res.json({
      estado: "MANUAL",
      mensaje:
        "Archivo recibido sin XML. Factura guardada como manual (sin procesamiento automático).",
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return res.status(500).json({
      message: "Error procesando la factura",
      error: error.message,
    });
  }
};
