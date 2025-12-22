import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chatTributario = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        reply: "El mensaje es obligatorio",
      });
    }

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Eres un asistente tributario profesional en Ecuador. Responde de forma clara, formal y sencilla para usuarios no técnicos.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply =
      response.output_text ||
      "No pude generar una respuesta en este momento.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ ERROR CHAT:", error);
    res.status(500).json({
      reply:
        "Ocurrió un error al procesar tu consulta. Intenta nuevamente.",
    });
  }
};
