import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";

import {
  crearFactura,
  listarFacturas,
  resumenImpuestos,
  dashboardFacturas
} from "../controllers/invoice.controller.js";

const router = Router();

router.post("/", authMiddleware, crearFactura);
router.get("/", authMiddleware, listarFacturas);
router.get("/resumen", authMiddleware, resumenImpuestos);
router.get("/dashboard", authMiddleware, dashboardFacturas);

export default router;
