import { supabaseFetch } from "../config/supabase.js";

export const requestLogger = (fastify) => {
  fastify.addHook("onResponse", async (request, reply) => {
    try {
      await supabaseFetch("logs", {
        endpoint:    request.raw?.url?.split("?")[0] || "",
        method:      request.method,
        usuario_id:  request.headers?.["x-user-id"]
                       ? Number(request.headers["x-user-id"])
                       : null,
        ip:          request.headers["x-forwarded-for"]?.split(",")[0].trim()
                       || request.ip
                       || "unknown",
        status_http: reply.statusCode,
        duracion_ms: Math.round(reply.elapsedTime),
        creado_en:   new Date()
      });
    } catch (err) {
      console.error("Error guardando log:", err.message);
    }
  });
};