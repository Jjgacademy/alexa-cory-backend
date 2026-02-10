import { Router } from "express";
import { procesarOtrosDocumento } from "../controllers/otrosDocumentos.controller.js";

const router = Router();

// Definimos la ruta POST para procesar el documento
router.post("/", procesarOtrosDocumento);

export default router;
