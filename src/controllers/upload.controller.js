import fs from "fs";
import Tesseract from "tesseract.js";
import xml2js from "xml2js";

export const uploadFactura = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No se envió ningún archivo" });
    }

    /* =========================
       XML → PARSEAR (NO OCR)
       ========================= */
    if (
      file.mimetype === "application/xml" ||
      file.mimetype === "text/xml"
    ) {
      const xmlContent = fs.readFileSync(file.path, "utf8");

      const parser = new xml2js.Parser({ explicitArray: false });
      const xmlData = await parser.parseStringPromise(xmlContent);

      return res.json({
        message: "XML procesado correctamente",
        data: xmlData,
      });
    }

    /* =========================
       PDF / IMAGEN → OCR
       ========================= */
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      const worker = await Tesseract.createWorker("spa");

      const {
        data: { text },
      } = await worker.recognize(file.path);

      await worker.terminate();

      return res.json({
        message: "Archivo procesado con OCR",
        text,
      });
    }

    return res.status(400).json({
      message: "Formato de archivo no soportado",
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return res.status(500).json({
      message: "Error procesando el archivo",
      error: error.message,
    });
  }
};
