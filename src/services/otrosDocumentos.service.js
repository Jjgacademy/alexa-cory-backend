import pdf from 'pdf-parse/lib/pdf-parse.js';

export const leerOtrosDocumento = async (buffer) => {
    try {
        const data = await pdf(buffer);
        const lineas = data.text.split('\n');

        const tablaProcesada = lineas
            .map(l => l.trim().replace(/"/g, '')) // Quitamos comillas
            .filter(l => /\d{2}\s*[\/-]\s*\d{2,4}/.test(l)) // Detectar fecha
            .map(linea => {
                const limpia = linea.replace(/\s+/g, ' ');
                
                // 1. Buscamos la fecha (07-2025, etc.)
                const matchFecha = limpia.match(/(\d{2}\s*[\/-]\s*\d{2,4})/);
                
                if (matchFecha) {
                    const fecha = matchFecha[0];
                    
                    // 2. Extraemos todos los montos de la línea completa
                    // Esta Regex busca números que empiezan con $ o que tienen formato decimal
                    let montos = limpia.match(/(?:\$?\s*(?:\d{1,3}(?:[.\s]\d{3})*|\d+)?[.,]\d{2})/g) || [];

                    // Normaliza: quita "$", espacios, y convierte ",00" -> "0,00"
                    montos = montos.map(m => {
                    let s = m.replace(/\$/g, "").replace(/\s+/g, "").trim();
                    if (s.startsWith(",") || s.startsWith(".")) s = "0" + s;   // ",00" -> "0,00"
                    return s;
                    });
                    
                    // 3. El primer número antes de los montos suele ser el índice de cuota
                    const cuotaMatch = limpia.match(/^\d+/);
                    const cuota = cuotaMatch ? cuotaMatch[0] : "1";

                    // Limpiamos los símbolos de dólar para el totalizador del frontend
                    const montosLimpios = montos.map(m => m.replace('$', '').trim());

                    // Retornamos: [Cuota, Fecha, Monto1, Monto2, Monto3...]
                    return [cuota, fecha, ...montosLimpios];
                }
                return null;
            })
            .filter(fila => fila !== null && fila.length >= 3);

        return tablaProcesada;
    } catch (error) {
        console.error("Error en extracción:", error);
        throw error;
    }
};

// Extractor de encabezados inteligente basado en tu log
export const extraerEncabezadoHarcoded = (texto) => {
    const encabezados = [];
    
    const clienteMatch = texto.match(/Cliente:\s*([\w\s]+)/i);
    if (clienteMatch) encabezados.push({ label: "Cliente", value: clienteMatch[1].trim() });

    const operacionMatch = texto.match(/Nº operación:\s*(\d+)/i);
    if (operacionMatch) encabezados.push({ label: "N° Operación", value: operacionMatch[1] });

    const prestamoMatch = texto.match(/No\. Préstamo:\s*(\d+)/i);
    if (prestamoMatch) encabezados.push({ label: "Préstamo", value: prestamoMatch[1] });

    return encabezados.length > 0 ? encabezados : [{ label: "Documento", value: "Detectado" }];
};

