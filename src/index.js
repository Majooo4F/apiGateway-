import dotenv from "dotenv";
dotenv.config();

console.log("=== ENV CHECK ===");
console.log("JWT_SECRET:", process.env.JWT_SECRET);
console.log("PORT:", process.env.PORT);
console.log("=================");

import Fastify from "fastify";
import cors from "@fastify/cors";

import usersRoutes from "./routes/users.routes.js";
import groupsRoutes from "./routes/groups.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";
import { rateLimiter } from "./middlewares/rate-limit.js";
import { requestLogger } from "./middlewares/logger.js";

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: "http://localhost:4200",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-email", "x-user-username"],
  credentials: true
});

// 1️⃣ Rate limiting — primero, antes de todo
fastify.addHook("onRequest", rateLimiter);

// 2️⃣ Logger — se registra como plugin con acceso a fastify
requestLogger(fastify);

await fastify.register(usersRoutes);
await fastify.register(groupsRoutes);
await fastify.register(ticketsRoutes);

fastify.get("/", async () => {
  return { message: "API Gateway funcionando 🚀" };
});

const PORT = process.env.PORT || 3000;
fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`API Gateway corriendo en ${address}`);
});