// Almacén en memoria: ip -> { count, start }
const requests = new Map();

const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 100;    // 100 requests por minuto por IP

export const rateLimiter = async (request, reply) => {
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    request.ip ||
    "unknown";

  const now = Date.now();

  if (!requests.has(ip)) {
    requests.set(ip, { count: 1, start: now });
    return;
  }

  const data = requests.get(ip);

  // Ventana expirada — reiniciar contador
  if (now - data.start > WINDOW_MS) {
    requests.set(ip, { count: 1, start: now });
    return;
  }

  data.count++;

  if (data.count > MAX_REQUESTS) {
    return reply.code(429).send({
      statusCode: 429,
      intOpCode: "SxGW429",
      data: { message: "Too many requests. Intenta de nuevo en un minuto." }
    });
  }
};