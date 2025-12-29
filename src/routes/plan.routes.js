import { Router } from "express";
import { actualizarPlan, actualizarMetodoPago } from "../controllers/plan.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// 👉 /api/plan   (PUT)
router.put("/", authMiddleware, actualizarPlan);

// 👉 /api/plan/metodo   (PUT)
router.put("/metodo", authMiddleware, actualizarMetodoPago);

export default router;
