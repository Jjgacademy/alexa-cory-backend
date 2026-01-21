import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { verFactura } from "../controllers/invoice.controller.js";

import {
  crearFactura,
  listarFacturas,
  resumenImpuestos,
  dashboardFacturas,
  clasificarFactura // <--- Agregamos esta
} from "../controllers/invoice.controller.js";

const router = Router();

// Rutas actuales
router.post("/", authMiddleware, crearFactura);
router.get("/", authMiddleware, listarFacturas);
router.get("/resumen", authMiddleware, resumenImpuestos);
router.get("/dashboard", authMiddleware, dashboardFacturas);
router.get("/:id", verFactura);

// NUEVA RUTA: Para el checklist de Gastos Personales / Actividad
// Se llamará como: PUT /api/invoices/:id/clasificar
router.put("/:id/clasificar", authMiddleware, clasificarFactura);

export default router;
