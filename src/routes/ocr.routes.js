import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { leerFactura, analizarTextoFactura } from "../services/ocr.service.js";

const router = Router();

// carpeta temporal uploads
const upload = multer({ dest: "uploads/" });

router.post("/nota-venta", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Archivo no enviado" });
    }

    const filePath = req.file.path;

    // OCR
    const texto = await leerFactura(filePath);
    const data = analizarTextoFactura(texto);

    // borrar archivo temporal
    fs.unlinkSync(filePath);

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error("❌ Error OCR:", error);
    res.status(500).json({
      error: "Error procesando OCR",
    });
  }
});

export default router;
