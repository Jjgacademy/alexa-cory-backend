import pool from "../config/db.js";

export const crearRecordatorio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { titulo, descripcion, fecha_vencimiento } = req.body;

    const query = `
      INSERT INTO reminders (user_id, titulo, descripcion, fecha_vencimiento)
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;

    const values = [userId, titulo, descripcion, fecha_vencimiento];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al crear recordatorio" });
  }
};

export const listarRecordatorios = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT * FROM reminders WHERE user_id = $1 ORDER BY fecha_vencimiento ASC",
      [userId]
    );

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({ message: "Error al listar recordatorios" });
  }
};

export const marcarComoEnviado = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE reminders SET enviado = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ message: "Error al actualizar recordatorio" });
  }
};
