import { Router } from "express";
import {
  getProfile,
  updateProfile,
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// Obtener perfil
router.get("/profile", authMiddleware, getProfile);

// Actualizar perfil (nombre / contraseña)
router.put("/profile", authMiddleware, updateProfile);

export default router;
