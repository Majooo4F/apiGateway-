// helpers/response.js — API Gateway (Fastify)
export const sendResponse = (reply, { statusCode = 200, intOpCode, data = null }) => {
  return reply.code(statusCode).send({
    statusCode,
    intOpCode,
    data
  })
}