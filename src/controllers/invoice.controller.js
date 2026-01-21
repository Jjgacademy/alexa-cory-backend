import pool from "../config/db.js";
import xml2js from "xml2js";

/* =====================================================
   LISTAR FACTURAS
   ===================================================== */
export const listarFacturas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM invoices
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR listarFacturas:", error);
    res.status(500).json({
      message: "Error al obtener facturas",
      error: error.message,
    });
  }
};

/* =====================================================
   VER FACTURA POR ID (PARSEO XML)
   ===================================================== */
export const verFactura = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const facturaRes = await pool.query(
      "SELECT * FROM invoices WHERE id = $1",
      [id]
    );

    if (facturaRes.rows.length === 0) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const factura = facturaRes.rows[0];

    // Si no es XML
    if (!factura.texto_ocr || !factura.texto_ocr.trim().startsWith("<?xml")) {
      return res.json({
        factura,
        proveedor: null,
        cliente: null,
        detalles: [],
        totales: null,
        informacion_adicional: [],
      });
    }

    const parser = new xml2js.Parser({ explicitArray: false });
    const xml = await parser.parseStringPromise(factura.texto_ocr);

    const infoTributaria = xml.factura?.infoTributaria || {};
    const infoFactura = xml.factura?.infoFactura || {};
    const detallesXML = xml.factura?.detalles?.detalle || [];

    const proveedor = {
      razon_social: infoTributaria.razonSocial || "",
      nombre_comercial: infoTributaria.nombreComercial || "",
      ruc: infoTributaria.ruc || "",
      direccion_matriz: infoTributaria.dirMatriz || "",
      ambiente: infoTributaria.ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS",
      clave_acceso: infoTributaria.claveAcceso || "",
    };

    const cliente = {
      razon_social: infoFactura.razonSocialComprador || "",
      identificacion: infoFactura.identificacionComprador || "",
      direccion: infoFactura.direccionComprador || "",
      fecha_emision: infoFactura.fechaEmision || "",
      contribuyente_especial: infoFactura.contribuyenteEspecial || "",
      obligado_contabilidad: infoFactura.obligadoContabilidad || "",
      placa_matricula: infoFactura.placa || "",
    };

    const detalles = Array.isArray(detallesXML)
      ? detallesXML.map(d => ({
          codigo_principal: d.codigoPrincipal || "",
          codigo_auxiliar: d.codigoAuxiliar || "",
          cantidad: d.cantidad || "0",
          descripcion: d.descripcion || "",
          precio_unitario: d.precioUnitario || "0",
          precio_sin_subsidio: d.precioSinSubsidio || "0",
          descuento: d.descuento || "0",
          precio_total: d.precioTotalSinImpuesto || "0",
        }))
      : [];

    const totales = {
      subtotal_sin_impuestos: infoFactura.totalSinImpuestos || "0",
      total_descuento: infoFactura.totalDescuento || "0",
      total_subsidio: infoFactura.totalSubsidio || "0",
      propina: infoFactura.propina || "0",
      importe_total: infoFactura.importeTotal || "0",
      moneda: infoFactura.moneda || "USD",
    };

    return res.json({
      factura,
      proveedor,
      cliente,
      detalles,
      totales,
      informacion_adicional: [],
    });

  } catch (error) {
    console.error("ERROR verFactura:", error);
    res.status(500).json({
      message: "Error al obtener la factura",
      error: error.message,
    });
  }
};

/* =====================================================
   CREAR FACTURA (MANUAL)
   ===================================================== */
export const crearFactura = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      numero,
      ruc_proveedor,
      nombre_proveedor,
      fecha_emision,
      total,
      categoria,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO invoices (
        user_id, numero, ruc_proveedor, nombre_proveedor,
        fecha_emision, total, categoria
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        userId,
        numero,
        ruc_proveedor,
        nombre_proveedor,
        fecha_emision,
        total,
        categoria || "SIN CLASIFICAR",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("ERROR crearFactura:", error);
    res.status(500).json({
      message: "Error al crear factura",
      error: error.message,
    });
  }
};

/* =====================================================
   RESUMEN IMPUESTOS
   ===================================================== */
export const resumenImpuestos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT SUM(total) AS total_facturado
      FROM invoices
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error("ERROR resumenImpuestos:", error);
    res.status(500).json({
      message: "Error en resumen",
      error: error.message,
    });
  }
};

/* =====================================================
   DASHBOARD
   ===================================================== */
export const dashboardFacturas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) AS total_facturas
      FROM invoices
    `);

    res.json({ resumen: result.rows[0] });
  } catch (error) {
    console.error("ERROR dashboardFacturas:", error);
    res.status(500).json({
      message: "Error en dashboard",
      error: error.message,
    });
  }
};

/* =====================================================
   CLASIFICAR FACTURA
   ===================================================== */
export const clasificarFactura = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoria } = req.body;

    await pool.query(
      "UPDATE invoices SET categoria = $1 WHERE id = $2",
      [categoria, id]
    );

    res.json({ message: "Categoría actualizada" });
  } catch (error) {
    console.error("ERROR clasificarFactura:", error);
    res.status(500).json({
      message: "Error al clasificar",
      error: error.message,
    });
  }
};
