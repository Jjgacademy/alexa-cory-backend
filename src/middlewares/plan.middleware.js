import pool from "../config/db.js";

export const requirePlan = (planesPermitidos = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        "SELECT plan FROM users WHERE id = $1",
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const userPlan = result.rows[0].plan;

      console.log("🔐 Verificando plan:", userPlan);

      if (!planesPermitidos.includes(userPlan)) {
        return res.status(403).json({
          message: "No tienes acceso a esta función con tu plan actual",
          tu_plan: userPlan
        });
      }

      next();

    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error validando plan" });
    }
  };
};
