import { parseStringPromise } from "xml2js";

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const txt = (v) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function parseXmlInvoice(xmlContent) {
  const parsed = await parseStringPromise(xmlContent, { explicitArray: false });
  const f = parsed.factura;

  return {
    proveedor: {
      ruc: txt(f.infoTributaria.ruc),
      razon_social: txt(f.infoTributaria.razonSocial),
      direccion_matriz: txt(f.infoTributaria.dirMatriz),
      ambiente: txt(f.infoTributaria.ambiente),
    },
    factura: {
      estab: txt(f.infoTributaria.estab),
      pto_emi: txt(f.infoTributaria.ptoEmi),
      secuencial: txt(f.infoTributaria.secuencial),
      fecha_emision: txt(f.infoFactura.fechaEmision),
      obligado_contabilidad: txt(f.infoFactura.obligadoContabilidad),
      contribuyente_especial: txt(f.infoFactura.contribuyenteEspecial),
      total: txt(f.infoFactura.importeTotal),
    },
    cliente: {
      nombre: txt(f.infoFactura.razonSocialComprador),
      identificacion: txt(f.infoFactura.identificacionComprador),
      direccion: txt(f.infoFactura.direccionComprador),
    },
    detalles: arr(f.detalles.detalle).map((d) => ({
      codigo_principal: txt(d.codPrincipal),
      codigo_auxiliar: txt(d.codAuxiliar),
      cantidad: txt(d.cantidad),
      descripcion: txt(d.descripcion),
      precio_unitario: txt(d.precioUnitario),
      descuento: txt(d.descuento),
      precio_total_sin_impuesto: txt(d.precioTotalSinImpuesto),
    })),
    info_adicional: arr(f.infoAdicional?.campo).map((c) => ({
      nombre: c.$.nombre,
      valor: c._,
    })),
  };
}
