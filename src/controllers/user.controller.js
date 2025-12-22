import pool from "../config/db.js";
import bcrypt from "bcrypt";

/**
 * GET /api/users/profile
 * Obtener perfil del usuario autenticado
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [userId]
    );

    res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR GET PROFILE:", error);
    res.status(500).json({
      ok: false,
      message: "Error del servidor",
    });
  }
};

/**
 * PUT /api/users/profile
 * Actualizar nombre y/o contraseña
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, password } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "El nombre es obligatorio",
      });
    }

    // 👉 SI NO CAMBIA CONTRASEÑA
    if (!password) {
      const result = await pool.query(
        `UPDATE users
         SET name = $1
         WHERE id = $2
         RETURNING id, name, email`,
        [name, userId]
      );

      return res.json({
        ok: true,
        user: result.rows[0],
      });
    }

    // 👉 VALIDAR CONTRASEÑA
    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    // 👉 HASH DE CONTRASEÑA
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `UPDATE users
       SET name = $1, password = $2
       WHERE id = $3
       RETURNING id, name, email`,
      [name, hashedPassword, userId]
    );

    res.json({
      ok: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("ERROR UPDATE PROFILE:", error);
    res.status(500).json({
      ok: false,
      message: "Error del servidor",
    });
  }
};
