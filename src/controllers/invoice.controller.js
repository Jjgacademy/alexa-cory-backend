import pool from "../config/db.js";

/* =========================
   LISTAR FACTURAS
   ========================= */
export const listarFacturas = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.numero,
        i.nombre_proveedor,
        i.ruc_proveedor,
        i.fecha_emision,
        i.total AS total_factura,
        i.estado_ocr,
        i.creado_en,

        COALESCE(SUM(
          CASE WHEN d.es_gasto_personal
          THEN d.precio_total_sin_impuesto
          ELSE 0 END
        ), 0) AS total_gastos_personales,

        COALESCE(SUM(
          CASE WHEN d.es_gasto_actividad
          THEN d.precio_total_sin_impuesto
          ELSE 0 END
        ), 0) AS total_gastos_actividad

      FROM invoices i
      LEFT JOIN invoice_details d ON d.invoice_id = i.id
      WHERE i.user_id = $1
      GROUP BY i.id
      ORDER BY i.id DESC
      `,
      [userId]
    );

    res.json({
      ok: true,
      facturas: result.rows,
    });
  } catch (error) {
    console.error("❌ Error listarFacturas:", error);
    res.status(500).json({
      ok: false,
      message: "Error al listar facturas",
    });
  }
};

/* =========================
   VER FACTURA (RIDE COMPLETO)
   ========================= */
export const verFactura = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    /* ================= FACTURA ================= */
    const facturaRes = await pool.query(
      `
      SELECT *
      FROM invoices
      WHERE id = $1 AND user_id = $2
      `,
      [id, userId]
    );

    if (facturaRes.rows.length === 0) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const factura = facturaRes.rows[0];

    /* ================= DETALLES ================= */
    const detallesRes = await pool.query(
      `
      SELECT
        id,
        codigo_principal,
        cantidad,
        descripcion,
        precio_unitario,
        subsidio,
        precio_sin_subsidio,
        descuento,
        precio_total_sin_impuesto,
        es_gasto_personal,
        es_gasto_actividad,
        tipo_gasto_personal
      FROM invoice_details
      WHERE invoice_id = $1
      ORDER BY id
      `,
      [id]
    );

    /* ================= IMPUESTOS ================= */
    const impuestosRes = await pool.query(
      `
      SELECT
        codigo,
        codigo_porcentaje,
        tarifa,
        base_imponible,
        valor
      FROM invoice_impuestos
      WHERE invoice_id = $1
      ORDER BY id
      `,
      [id]
    );

    /* ================= PAGOS ================= */
    const pagosRes = await pool.query(
      `
      SELECT
        forma_pago,
        total
      FROM invoice_pagos
      WHERE invoice_id = $1
      ORDER BY id
      `,
      [id]
    );

    /* ================= INFO ADICIONAL ================= */
    const infoAdicionalRes = await pool.query(
      `
      SELECT
        nombre,
        valor
      FROM invoice_info_adicional
      WHERE invoice_id = $1
      ORDER BY id
      `,
      [id]
    );

    /* ================= RESPUESTA ================= */
    res.json({
      factura: {
        numero: factura.numero,
        ruc_proveedor: factura.ruc_proveedor,
        nombre_proveedor: factura.nombre_proveedor,
        nombre_comercial: factura.nombre_comercial,
        dir_matriz: factura.dir_matriz,
        obligado_contabilidad: factura.obligado_contabilidad,
        ambiente: factura.ambiente,
        clave_acceso: factura.clave_acceso,

        cliente_nombre: factura.cliente_nombre,
        cliente_identificacion: factura.cliente_identificacion,
        direccion_cliente: factura.direccion_cliente,
        fecha_emision: factura.fecha_emision,

        sri_estado: factura.sri_estado,
        sri_numero_autorizacion: factura.sri_numero_autorizacion,
        sri_fecha_autorizacion: factura.sri_fecha_autorizacion,
        sri_ambiente: factura.sri_ambiente,

        total_sin_impuestos: factura.total_sin_impuestos,
        total_descuento: factura.total_descuento,
        propina: factura.propina,
        total: factura.total,
        moneda: factura.moneda,
      },

      detalles: detallesRes.rows,
      impuestos: impuestosRes.rows,
      pagos: pagosRes.rows,
      informacion_adicional: infoAdicionalRes.rows,
    });
  } catch (error) {
    console.error("❌ Error verFactura:", error);
    res.status(500).json({
      message: "Error al obtener factura",
    });
  }
};

/* =========================
   CLASIFICAR DETALLE
   ========================= */
export const clasificarDetalle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { detalleId } = req.params;
    const { tipo, subtipo } = req.body;

    const check = await pool.query(
      `
      SELECT d.id
      FROM invoice_details d
      JOIN invoices i ON i.id = d.invoice_id
      WHERE d.id = $1 AND i.user_id = $2
      `,
      [detalleId, userId]
    );

    if (!check.rows.length) {
      return res.status(404).json({ message: "Detalle no encontrado" });
    }

    await pool.query(
      `
      UPDATE invoice_details
      SET
        es_gasto_personal = $1,
        es_gasto_actividad = $2,
        tipo_gasto_personal = $3
      WHERE id = $4
      `,
      [
        tipo === "PERSONAL",
        tipo === "ACTIVIDAD",
        subtipo || null,
        detalleId
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Error clasificarDetalle:", error);
    res.status(500).json({ message: "Error al clasificar detalle" });
  }
};

