import jwt from "jsonwebtoken";

const sendResponse = (reply, { statusCode = 200, intOpCode, data = null }) => {
  return reply.code(statusCode).send({ statusCode, intOpCode, data });
   console.log("Permiso requerido:", requiredPermission);
  console.log("Permisos del usuario:", userPermissions);

};

// Ordenadas de más específica a más general para evitar falsos match
const routePermissions = [
  // Tickets
  { method: "PATCH",  match: "/tickets/move",    permission: "ticket:move"       },
  { method: "PATCH",  match: "/tickets/state",   permission: "ticket:edit:state" },
  { method: "POST",   match: "/tickets",         permission: "ticket:add"        },
  { method: "PUT",    match: "/tickets",         permission: "ticket:edit"       },
  { method: "DELETE", match: "/tickets",         permission: "ticket:delete"     },
  { method: "GET",    match: "/tickets",         permission: "ticket:view"       },
  // Groups
  { method: "POST",   match: "/groups/miembros", permission: "group:manage"      },
  { method: "DELETE", match: "/groups",          permission: "group:manage"      },
  { method: "PUT",    match: "/groups",          permission: "group:manage"      },
  { method: "POST",   match: "/groups",          permission: "group:add"         },
  // ← GET /groups ya no requiere permiso especial, solo token
  // Groups usuarios
  { method: "DELETE", match: "/users/admin",     permission: "user:delete"       },
  { method: "PUT",    match: "/users/admin",     permission: "user:edit"         },
  { method: "POST",   match: "/users/admin",     permission: "user:add"          },
  { method: "GET",    match: "/users",           permission: "user:view"         },
];

const getRequiredPermission = (method, path) => {
  for (const rule of routePermissions) {
    if (rule.method === method && path.includes(rule.match)) {
      return rule.permission;
    }
  }
  return null;
};

export const verifyToken = async (request, reply) => {
  try {
    const SECRET = process.env.JWT_SECRET;

    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      return sendResponse(reply, {
        statusCode: 403,
        intOpCode: "SxGW403",
        data: { message: "Token requerido" }
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return sendResponse(reply, {
        statusCode: 403,
        intOpCode: "SxGW403",
        data: { message: "Token requerido" }
      });
    }

    const decoded = jwt.verify(token, SECRET);
    request.user = decoded;

    request.headers["x-user-id"]       = String(decoded.id);
    request.headers["x-user-email"]    = decoded.email;
    request.headers["x-user-username"] = decoded.username;

    // ── Verificación de permisos por endpoint ──────────────────────
    const path   = request.raw.url.split("?")[0];
    const method = request.method;

    const requiredPermission = getRequiredPermission(method, path);

    if (requiredPermission) {
      const userPermissions = decoded.permissions ?? [];

      if (!userPermissions.includes(requiredPermission)) {
        return sendResponse(reply, {
          statusCode: 403,
          intOpCode: "SxGW403P",
          data: { message: `Sin permiso: ${requiredPermission}` }
        });
      }
    }
    // ───────────────────────────────────────────────────────────────

  } catch (err) {
    console.error("Error verificando token:", err.message);
    return sendResponse(reply, {
      statusCode: 403,
      intOpCode: "SxGW403",
      data: { message: "Token inválido" }
    });
  }
};