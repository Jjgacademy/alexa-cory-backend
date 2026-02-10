import { leerOtrosDocumento, extraerEncabezadoHarcoded } from '../services/otrosDocumentos.service.js';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const procesarOtrosDocumento = async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: "Archivo no encontrado" });
        }

        const buffer = req.files.file.data;
        
        // Obtenemos el texto crudo para el encabezado
        const rawData = await pdf(buffer);
        const encabezado = extraerEncabezadoHarcoded(rawData.text);
        
        // Procesamos la tabla
        const tabla = await leerOtrosDocumento(buffer);

        console.log("✅ Datos procesados con éxito");

        res.json({
            success: true,
            encabezado: encabezado,
            tablaCruda: tabla
        });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: error.message });
    }
};
