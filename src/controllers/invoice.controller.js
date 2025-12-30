import pool from "../config/db.js";

// ===========================
// CREAR FACTURA MANUAL
// ===========================
export const crearFactura = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      tipo_comprobante = "FACTURA",
      numero,
      ruc_proveedor,
      nombre_proveedor,
      fecha_emision,
      base_iva = 0,
      base_cero = 0,
      retencion_iva = 0,
      retencion_renta = 0,
      categoria = "SIN CLASIFICAR",
    } = req.body;

    const IVA_RATE = 0.12;
    const iva = Number(base_iva) * IVA_RATE;

    const total =
      Number(base_iva) +
      Number(base_cero) +
      iva -
      Number(retencion_iva) -
      Number(retencion_renta);

    const query = `
      INSERT INTO invoices (
        user_id, tipo_comprobante, numero, ruc_proveedor, nombre_proveedor,
        fecha_emision, base_iva, base_cero, iva, retencion_iva, retencion_renta,
        total, moneda, categoria
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'USD',$13)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      userId,
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
      categoria
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al crear factura" });
  }
};

// ===========================
// LISTAR FACTURAS + FILTROS
// ===========================
export const listarFacturas = async (req, res) => {
  try {
    const userId = req.user.id;

    const { estado, desde, hasta, ruc, categoria } = req.query;

    let filtros = [`user_id = $1`];
    let valores = [userId];
    let idx = 2;

    if (estado) {
      filtros.push(`estado_ocr = $${idx++}`);
      valores.push(estado);
    }

    if (desde) {
      filtros.push(`fecha_emision >= $${idx++}`);
      valores.push(desde);
    }

    if (hasta) {
      filtros.push(`fecha_emision <= $${idx++}`);
      valores.push(hasta);
    }

    if (ruc) {
      filtros.push(`ruc_proveedor = $${idx++}`);
      valores.push(ruc);
    }

    if (categoria) {
      filtros.push(`categoria ILIKE $${idx++}`);
      valores.push(`%${categoria}%`);
    }

    const query = `
      SELECT 
        id,
        tipo_comprobante,
        numero,
        ruc_proveedor,
        nombre_proveedor,
        fecha_emision,
        base_iva,
        base_cero,
        iva,
        total,
        categoria,
        estado_ocr,
        confianza_ocr,
        creado_en
      FROM invoices
      WHERE ${filtros.join(" AND ")}
      ORDER BY fecha_emision DESC
    `;

    const result = await pool.query(query, valores);

    res.json(result.rows);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al listar facturas" });
  }
};

// ===========================
// RESUMEN MENSUAL
// ===========================
export const resumenImpuestos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { anio, mes } = req.query;

    const result = await pool.query(
      `
      SELECT
        SUM(base_iva) AS base_iva,
        SUM(base_cero) AS base_cero,
        SUM(iva) AS iva,
        SUM(retencion_iva) AS retencion_iva,
        SUM(retencion_renta) AS retencion_renta,
        SUM(total) AS total
      FROM invoices
      WHERE user_id = $1
      AND EXTRACT(YEAR FROM fecha_emision) = $2
      AND EXTRACT(MONTH FROM fecha_emision) = $3
      `,
      [userId, anio, mes]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error en resumen" });
  }
};

// ===========================
// DASHBOARD GENERAL
// ===========================
export const dashboardFacturas = async (req, res) => {
  try {
    const userId = req.user.id;

    const resumen = await pool.query(
      `
      SELECT
        COALESCE(SUM(base_iva),0)  AS total_base_iva,
        COALESCE(SUM(base_cero),0) AS total_base_cero,
        COALESCE(SUM(iva),0)       AS total_iva,
        COALESCE(SUM(total),0)     AS total_gastos,
        COUNT(*)                   AS total_facturas,

        COUNT(*) FILTER (WHERE estado_ocr = 'OK')        AS facturas_ok,
        COUNT(*) FILTER (WHERE estado_ocr = 'REVISAR')   AS facturas_revisar,
        COUNT(*) FILTER (WHERE estado_ocr = 'PENDIENTE') AS facturas_pendientes
      FROM invoices
      WHERE user_id = $1
      `,
      [userId]
    );

    const categorias = await pool.query(
      `
      SELECT 
        categoria,
        SUM(total) AS total
      FROM invoices
      WHERE user_id = $1
      GROUP BY categoria
      ORDER BY total DESC
      `,
      [userId]
    );

    const mensual = await pool.query(
      `
      SELECT 
        TO_CHAR(fecha_emision, 'YYYY-MM') AS mes,
        SUM(total) AS total_mes
      FROM invoices
      WHERE user_id = $1
      GROUP BY mes
      ORDER BY mes
      `,
      [userId]
    );

    res.json({
      resumen: resumen.rows[0],
      categorias: categorias.rows,
      mensual: mensual.rows
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al generar dashboard" });
  }
};
