import { Router } from "express";
import { requirePlan } from "../middlewares/plan.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// Solo EMPRENDEDOR
router.get(
  "/solo-emprendedor",
  authMiddleware,
  requirePlan(["emprendedor", "pro"]),
  (req, res) => {
    res.json({ ok: true, message: "Acceso permitido Plan Emprendedor y Pro" });
  }
);

// Solo PRO
router.get(
  "/solo-pro",
  authMiddleware,
  requirePlan(["pro"]),
  (req, res) => {
    res.json({ ok: true, message: "Acceso permitido solo Plan PRO" });
  }
);

export default router;
