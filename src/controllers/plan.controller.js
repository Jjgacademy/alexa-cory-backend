import pool from "../config/db.js";

export const actualizarPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ message: "Plan es requerido" });
    }

    await pool.query(
      "UPDATE users SET plan = $1 WHERE id = $2",
      [plan, userId]
    );

    res.json({ message: "Plan actualizado correctamente" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al actualizar plan" });
  }
};


export const actualizarMetodoPago = async (req, res) => {
  try {
    const userId = req.user.id;
    const { metodo_pago } = req.body;

    await pool.query(
      "UPDATE users SET metodo_pago = $1 WHERE id = $2",
      [metodo_pago || null, userId]
    );

    res.json({ message: "Método de pago guardado correctamente" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al guardar método de pago" });
  }
};
