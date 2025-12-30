import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  crearRecordatorio,
  listarRecordatorios,
  marcarComoEnviado
} from "../controllers/reminder.controller.js";

const router = Router();

router.post("/", authMiddleware, crearRecordatorio);
router.get("/", authMiddleware, listarRecordatorios);
router.put("/:id/enviado", authMiddleware, marcarComoEnviado);

export default router;
