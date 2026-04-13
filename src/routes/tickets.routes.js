import fp from "fastify-plugin";
import proxy from "@fastify/http-proxy";
import { verifyToken } from "../middlewares/verifyToken.js";

export default fp(async (fastify) => {

  fastify.register(proxy, {
    upstream: "http://localhost:3003",
    prefix: "/tickets",
    http2: false,
    rewritePrefix: "/tickets",
    preHandler: async (request, reply) => {
      await verifyToken(request, reply);
    },
  });

});