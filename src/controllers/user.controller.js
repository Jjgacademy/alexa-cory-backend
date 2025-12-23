import pool from "../config/db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";

/**
 * =========================
 * PERFIL
 * =========================
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [userId]
    );

    res.json({ ok: true, user: result.rows[0] });
  } catch {
    res.status(500).json({ ok: false, message: "Error del servidor" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, password } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ ok: false, message: "El nombre es obligatorio" });
    }

    // Solo actualizar nombre
    if (!password) {
      const result = await pool.query(
        `UPDATE users
         SET name = $1
         WHERE id = $2
         RETURNING id, name, email`,
        [name, userId]
      );
      return res.json({ ok: true, user: result.rows[0] });
    }

    // Actualizar nombre + contraseña
    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `UPDATE users
       SET name = $1,
           password = $2
       WHERE id = $3
       RETURNING id, name, email`,
      [name, hashedPassword, userId]
    );

    res.json({ ok: true, user: result.rows[0] });
  } catch {
    res.status(500).json({ ok: false, message: "Error del servidor" });
  }
};

/**
 * =========================
 * RECUPERACIÓN POR CORREO (NO SE TOCA)
 * =========================
 */
export const recoverPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({
        ok: true,
        message: "Si el correo existe, recibirás instrucciones",
      });
    }

    const userId = result.rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `UPDATE users
       SET reset_token = $1,
           reset_token_expires = $2
       WHERE id = $3`,
      [token, expires, userId]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"Alexa & Cory" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Recuperar contraseña",
      html: `<a href="${resetLink}">Recuperar contraseña</a>`,
    });

    res.json({ ok: true, message: "Correo enviado" });
  } catch {
    res.status(500).json({ ok: false, message: "Error del servidor" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const result = await pool.query(
      `SELECT id FROM users
       WHERE reset_token = $1
       AND reset_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Token inválido o expirado",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password = $1,
           reset_token = NULL,
           reset_token_expires = NULL
       WHERE id = $2`,
      [hashedPassword, result.rows[0].id]
    );

    res.json({ ok: true, message: "Contraseña actualizada" });
  } catch {
    res.status(500).json({ ok: false, message: "Error del servidor" });
  }
};

/**
 * =========================
 * RECUPERACIÓN POR USUARIO (DEV)
 * 👉 AQUÍ ESTABA EL ERROR
 * =========================
 */
export const recoverByUsername = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res
        .status(400)
        .json({ ok: false, message: "El usuario es obligatorio" });
    }

    const result = await pool.query(
      "SELECT id FROM users WHERE name = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ ok: false, message: "Usuario no encontrado" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users
       SET reset_code = $1,
           reset_code_expires = $2
       WHERE id = $3`,
      [code, expires, result.rows[0].id]
    );

    console.log("🔐 Código recuperación:", code);

    // ✅ CLAVE: SE ENVÍA EL CÓDIGO
    res.json({
      ok: true,
      message: "Código generado",
      code: code,
    });
  } catch {
    res.status(500).json({ ok: false, message: "Error del servidor" });
  }
};

/**
 * =========================
 * RESET POR USUARIO
 * =========================
 */
export const resetByUsername = async (req, res) => {
  try {
    const { username, code, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const result = await pool.query(
      `SELECT id FROM users
       WHERE name = $1
       AND reset_code = $2
       AND reset_code_expires > NOW()`,
      [username, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Código inválido o expirado",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password = $1,
           reset_code = NULL,
           reset_code_expires = NULL
       WHERE id = $2`,
      [hashedPassword, result.rows[0].id]
    );

    res.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch {
    res.status(500).json({ ok: false, message: "Error del servidor" });
  }
};
