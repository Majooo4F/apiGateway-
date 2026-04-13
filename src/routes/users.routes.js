import fp from "fastify-plugin";
import proxy from "@fastify/http-proxy";
import { verifyToken } from "../middlewares/verifyToken.js";

export default fp(async (fastify) => {

  fastify.register(proxy, {
    upstream: "http://localhost:3001",
    prefix: "/users",
    http2: false,
    rewritePrefix: "/users",
    preHandler: async (request, reply) => {
      const path = request.raw.url.split("?")[0];
      const method = request.method;

      console.log("Gateway procesando ruta:", method, path);

      // Rutas públicas — sin token
      if (
        method === "POST" &&
        (path.endsWith("/register") || path.endsWith("/login"))
      ) {
        return;
      }

      // Todo lo demás requiere token
      await verifyToken(request, reply);
    },
  });

});