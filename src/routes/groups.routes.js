import fp from "fastify-plugin";
import proxy from "@fastify/http-proxy";
import { verifyToken } from "../middlewares/verifyToken.js";

export default fp(async (fastify) => {

  fastify.register(proxy, {
    upstream: "http://localhost:3002",
    prefix: "/groups",
    http2: false,
    rewritePrefix: "/groups",
    preHandler: async (request, reply) => {
      await verifyToken(request, reply);
    },
  });
  

});