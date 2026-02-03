import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { procesarFactura } from "../controllers/upload.controller.js";

const router = Router();

// ✅ RUTA CORRECTA (REQUIERE TOKEN)
router.post(
  "/",
  authMiddleware,
  upload.single("file"),
  procesarFactura
);

export default router;
