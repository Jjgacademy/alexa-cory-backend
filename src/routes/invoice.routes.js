import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  listarFacturas,
  verFactura,
  clasificarDetalle,
} from "../controllers/invoice.controller.js";

const router = Router();

// LISTAR
router.get("/", authMiddleware, listarFacturas);

// VER FACTURA
router.get("/:id", authMiddleware, verFactura);

// CLASIFICAR DETALLE
router.put(
  "/detalle/:detalleId/clasificar",
  authMiddleware,
  clasificarDetalle
);

export default router;
