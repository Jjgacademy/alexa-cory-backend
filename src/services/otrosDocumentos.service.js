import pdf from 'pdf-parse/lib/pdf-parse.js';

export const leerOtrosDocumento = async (buffer) => {
    try {
        const data = await pdf(buffer);
        const textoCompleto = data.text;
        const lineas = textoCompleto.split('\n');

        // Tu lógica de tabla que ya funciona
        const tablaProcesada = lineas
            .map(l => l.trim())
            .filter(l => /\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}/.test(l))
            .map(linea => {
                const limpia = linea.replace(/\s+/g, ' ');
                const matchFecha = limpia.match(/(\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4})/);
                if (matchFecha) {
                    const fecha = matchFecha[0];
                    const partes = limpia.split(fecha);
                    const cuota = partes[0].trim() || "1";
                    const resto = partes[1].trim();
                    const montos = resto.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2})|\d+(?:\.\d{2})/g) || [];
                    return [cuota, fecha, ...montos];
                }
                return null;
            })
            .filter(fila => fila !== null && fila.length >= 3);

        return {
            textoDelPdf: textoCompleto,
            tablaCruda: tablaProcesada,
            encabezados: extraerEncabezadoHarcoded(textoCompleto)
        };
    } catch (error) {
        console.error("Error procesando PDF:", error);
        throw error;
    }
};

export const extraerEncabezadoHarcoded = (texto) => {
    const encabezados = [];
    const clienteMatch = texto.match(/Cliente:\s*([\w\s,.-]+)/i);
    if (clienteMatch) encabezados.push({ label: "Cliente", value: clienteMatch[1].trim() });
    
    const operacionMatch = texto.match(/Nº operación:\s*(\d+)/i);
    if (operacionMatch) encabezados.push({ label: "N° Operación", value: operacionMatch[1] });

    return encabezados.length > 0 ? encabezados : [{ label: "Estado", value: "Lectura Exitosa" }];
};
