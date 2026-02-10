import fs from "fs";
import xml2js from "xml2js";
import pool from "../config/db.js";
import { leerFactura, analizarTextoFactura } from "../services/ocr.service.js";

/* =========================
   UTILIDADES
========================= */
const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const parseNumber = (v) => {
  if (v === undefined || v === null || v === "") return 0;

  // limpia OCR: quita letras y símbolos raros
  const s = String(v)
    .replace(/\s+/g, "")
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".")
    .trim();

  const n = Number(s);
  if (!Number.isFinite(n)) return 0;

  // evita overflow en NUMERIC(14,2) (aprox < 10^12)
  if (Math.abs(n) >= 1_000_000_000_000) return 0;

  // 2 decimales
  return Math.round(n * 100) / 100;
};

const parseDate = (v) => {
  // Devuelve string YYYY-MM-DD o null
  if (!v) return null;

  // si viene Date
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().split("T")[0];
  }

  const s = String(v).trim();

  // ISO con T
  if (s.includes("T")) return s.split("T")[0];

  // dd/mm/yyyy
  if (s.includes("/")) {
    const [d, m, y] = s.split("/");
    if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // dd-mm-yyyy
  if (s.includes("-")) {
    // ya puede venir yyyy-mm-dd o dd-mm-yyyy
    const parts = s.split("-");
    if (parts.length === 3) {
      const [a, b, c] = parts;
      // yyyy-mm-dd
      if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
      // dd-mm-yyyy
      if (c.length === 4) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }
  }

  // intentarlo como Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
};


export const procesarNotaVenta = async (req, res) => {
  try {
    const texto = await leerFactura(req.file.path);
    const parsed = analizarTextoFactura(texto);

    console.log("========== PARSED ==========");
    console.log(parsed);

    // 🔥 ESTA LINEA ES LA IMPORTANTE
    res.json(parsed);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error OCR" });
  }
};

/* =========================
   CONTROLLER
========================= */
export const procesarFactura = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se envió archivo" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Token inválido" });
    }

    const { mimetype, path: filePath } = req.file;

    /* =====================================================
       XML (FACTURA ELECTRÓNICA)
    ===================================================== */
    if (mimetype?.includes("xml")) {
      const xmlContent = fs.readFileSync(filePath, "utf8");
      const parser = new xml2js.Parser({ explicitArray: false, trim: true });

      const root = await parser.parseStringPromise(xmlContent);

      const autorizacion =
        root?.autorizacion ||
        root?.autorizaciones?.autorizacion;

      if (!autorizacion) {
        return res.status(400).json({ message: "XML sin autorización SRI" });
      }

      const comprobanteXML = autorizacion.comprobante;
      if (!comprobanteXML) {
        return res.status(400).json({ message: "XML inválido" });
      }

      const facturaParsed = await parser.parseStringPromise(comprobanteXML);
      const factura = facturaParsed?.factura;

      if (!factura) {
        return res.status(400).json({ message: "XML sin nodo <factura>" });
      }

      const infoT = factura.infoTributaria || {};
      const infoF = factura.infoFactura || {};

      /* ================= AUTORIZACIÓN SRI ================= */
      const sri_estado = autorizacion.estado || null;
      const sri_numero_autorizacion = autorizacion.numeroAutorizacion || null;
      const sri_fecha_autorizacion = autorizacion.fechaAutorizacion
        ? new Date(autorizacion.fechaAutorizacion)
        : null;
      const sri_ambiente = autorizacion.ambiente || null;

      const clave_acceso = infoT.claveAcceso || null;
      const numero = `${infoT.estab || ""}-${infoT.ptoEmi || ""}-${infoT.secuencial || ""}`.replace(/^--/, "");

      /* ================= DUPLICADOS ================= */
      if (clave_acceso) {
        const dup = await client.query(
          "SELECT id FROM invoices WHERE clave_acceso = $1",
          [clave_acceso]
        );
        if (dup.rows.length) {
          return res.json({
            estado: "DUPLICADA",
            invoice_id: dup.rows[0].id,
          });
        }
      }

      await client.query("BEGIN");

      /* ================= FECHA EMISIÓN (XML REAL) =================
         AQUÍ ESTABA TU ERROR: antes ponías analisis.proveedor?.fecha (no existe en XML)
      */
      const fecha_emision = parseDate(infoF.fechaEmision);

      // si tu DB NO permite null, hacemos fallback seguro
      const fechaEmisionFinal = fecha_emision || new Date().toISOString().split("T")[0];

      /* ================= INSERT FACTURA ================= */
      const facturaRes = await client.query(
        `
        INSERT INTO invoices (
          user_id,
          numero,
          ruc_proveedor,
          nombre_proveedor,
          nombre_comercial,
          dir_matriz,
          ambiente,
          clave_acceso,
          sri_estado,
          sri_numero_autorizacion,
          sri_fecha_autorizacion,
          sri_ambiente,
          fecha_emision,
          obligado_contabilidad,
          tipo_identificacion_comprador,
          cliente_nombre,
          cliente_identificacion,
          direccion_cliente,
          total_sin_impuestos,
          total_descuento,
          propina,
          total,
          moneda,
          texto_ocr,
          estado_ocr
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,'XML_OK'
        )
        RETURNING id
        `,
        [
          userId,
          numero || "SIN_NUMERO",
          infoT.ruc || null,
          infoT.razonSocial || null,
          infoT.nombreComercial || null,
          infoT.dirMatriz || null,
          sri_ambiente,
          clave_acceso,
          sri_estado,
          sri_numero_autorizacion,
          sri_fecha_autorizacion,
          sri_ambiente,
          fechaEmisionFinal,
          infoF.obligadoContabilidad || null,
          infoF.tipoIdentificacionComprador || null,
          infoF.razonSocialComprador || null,
          infoF.identificacionComprador || null,
          infoF.direccionComprador || "",
          parseNumber(infoF.totalSinImpuestos),
          parseNumber(infoF.totalDescuento),
          parseNumber(infoF.propina),
          parseNumber(infoF.importeTotal),
          infoF.moneda || "USD",
          comprobanteXML
        ]
      );

      const invoiceId = facturaRes.rows[0].id;

      /* ================= DETALLES ================= */
      for (const d of toArray(factura.detalles?.detalle)) {
        await client.query(
          `
          INSERT INTO invoice_details (
            invoice_id,
            codigo_principal,
            cantidad,
            descripcion,
            precio_unitario,
            subsidio,
            precio_sin_subsidio,
            descuento,
            precio_total_sin_impuesto
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `,
          [
            invoiceId,
            d.codigoPrincipal || null,
            parseNumber(d.cantidad),
            d.descripcion || "",
            parseNumber(d.precioUnitario),
            0.00, // subsidio
            0.00, // precio_sin_subsidio
            parseNumber(d.descuento),
            parseNumber(d.precioTotalSinImpuesto),
          ]
        );

        /* ===== IMPUESTOS POR DETALLE ===== */
        for (const imp of toArray(d.impuestos?.impuesto)) {
          await client.query(
            `
            INSERT INTO invoice_impuestos
            (invoice_id, codigo, codigo_porcentaje, tarifa, base_imponible, valor)
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [
              invoiceId,
              imp.codigo || null,
              imp.codigoPorcentaje || null,
              parseNumber(imp.tarifa),
              parseNumber(imp.baseImponible),
              parseNumber(imp.valor),
            ]
          );
        }
      }

      /* ================= PAGOS ================= */
      for (const p of toArray(infoF.pagos?.pago)) {
        await client.query(
          `
          INSERT INTO invoice_pagos (invoice_id, forma_pago, total)
          VALUES ($1,$2,$3)
          `,
          [invoiceId, p.formaPago || null, parseNumber(p.total)]
        );
      }

      /* ================= INFO ADICIONAL ================= */
      for (const c of toArray(factura.infoAdicional?.campoAdicional)) {
        await client.query(
          `
          INSERT INTO invoice_info_adicional (invoice_id, nombre, valor)
          VALUES ($1,$2,$3)
          `,
          [invoiceId, c?.$?.nombre || null, c?._ || ""]
        );
      }

      await client.query("COMMIT");

      return res.json({
        estado: "COMPLETA_AUTOMATICA",
        invoice_id: invoiceId,
      });
    }

    /* =====================================================
       OCR (NOTA DE VENTA / IMAGEN / PDF NO XML)
    ===================================================== */
    let texto = "";

      let analisis = {
        proveedor: {},
        items: [],
        total: "0.00",
        formaPago: {}
      };

      if (!mimetype?.includes("xml")) {
        texto = await leerFactura(filePath);
        analisis = analizarTextoFactura(texto);
      }

    if (!analisis || !analisis.proveedor) {
      throw new Error("OCR no devolvió datos válidos");
    }

    // fecha_emision nunca null (tu tabla lo exige)
    const fechaEmisionOCR = analisis?.proveedor?.fecha
      ? parseDate(analisis.proveedor.fecha)
      : null;

    const fechaEmisionFinal = fechaEmisionOCR || new Date().toISOString().split("T")[0];

    // total seguro para evitar overflow
    const totalSeguro = parseNumber(
      analisis?.items?.[0]?.total || analisis?.total || "0.00"
    );

    const numeroDoc =
      analisis?.proveedor?.notaVenta ||
      analisis?.proveedor?.factura ||
      analisis?.numero_factura ||
      "SIN_NUMERO";

    await client.query("BEGIN");

    const r = await client.query(
      `
      INSERT INTO invoices
      (user_id, numero, ruc_proveedor, nombre_proveedor,
       fecha_emision, total, texto_ocr, estado_ocr)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDIENTE')
      RETURNING id
      `,
      [
        userId,
        numeroDoc,
        analisis?.proveedor?.ruc || analisis?.ruc || null,
        analisis?.proveedor?.nombre || analisis?.proveedor || null,
        fechaEmisionFinal,
        totalSeguro,
        texto,
      ]
    );

    await client.query("COMMIT");

    // ✅ UN SOLO RETURN (esto es lo que tu front necesita)
    return res.json({
      estado: "OCR_OK",
      invoice_id: r.rows[0].id,
      proveedor: analisis?.proveedor || {},
      items: Array.isArray(analisis?.items) ? analisis.items : [],
      formaPago: analisis?.formaPago || {},
    });

  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("ERROR FACTURA:", err);
    return res.status(500).json({ message: "Error al procesar factura" });
  } finally {
    client.release();
  }
};
