import { Router } from "express";
import pool from "../config/db.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * GET /api/ruc/:ruc
 * Devuelve la razón social asociada a un RUC
 */
router.get("/:ruc", authMiddleware, async (req, res) => {
  try {
    const { ruc } = req.params;

    if (!ruc || ruc.length < 10) {
      return res.status(400).json({
        message: "RUC inválido",
      });
    }

    const result = await pool.query(
      `SELECT ruc, razon_social
       FROM ruc_razon_social
       WHERE ruc = $1`,
      [ruc]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "RUC no encontrado",
      });
    }

    return res.json(result.rows[0]);

  } catch (error) {
    console.error("❌ ERROR RUC:", error);
    return res.status(500).json({
      message: "Error al consultar RUC",
    });
  }
});

export default router;
