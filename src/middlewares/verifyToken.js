import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const sendResponse = (reply, { statusCode = 200, intOpCode, data = null }) => {
  return reply.code(statusCode).send({ statusCode, intOpCode, data });
};

// ── Rutas de AUTOSERVICIO: solo requieren token válido, NO permisos ──────────
// Estas son operaciones básicas que todo usuario autenticado necesita
const TOKEN_ONLY_PATTERNS = [
  { method: "GET",  pattern: "/groups/miembros/usuario" },   // ver MIS grupos
  { method: "GET",  pattern: "/groups/permisos-usuario" },   // ver MIS permisos
  { method: "GET",  pattern: "/groups/permisos/usuario" },   // ver permisos por usuario en grupo
  { method: "GET",  pattern: "/users/profile" },             // ver MI perfil
  { method: "GET",  pattern: "/users/login" },               // login
  { method: "POST", pattern: "/users/login" },               // login
  { method: "POST", pattern: "/users/register" },            // registro
];

const isTokenOnlyRoute = (method, path) => {
  return TOKEN_ONLY_PATTERNS.some(r => r.method === method && path.includes(r.pattern));
};

// ── Mapa de rutas → permisos requeridos ──────────────────────────────────────
const routePermissions = [
  // Tickets
  { method: "PATCH",  match: "/tickets/move",         permission: "ticket:mover"     },
  { method: "PATCH",  match: "/tickets/state",        permission: "ticket:editar"    },
  { method: "POST",   match: "/tickets",              permission: "ticket:agregar"   },
  { method: "PUT",    match: "/tickets",              permission: "ticket:editar"    },
  { method: "DELETE", match: "/tickets",              permission: "ticket:eliminar"  },
  { method: "GET",    match: "/tickets",              permission: "ticket:ver"       },
  // Groups — acciones administrativas
  { method: "DELETE", match: "/groups/miembros",      permission: "grupo:admin"      },
  { method: "POST",   match: "/groups/miembros",      permission: "grupo:admin"      },
  { method: "DELETE", match: "/groups",               permission: "grupo:eliminar"   },
  { method: "PUT",    match: "/groups",               permission: "grupo:editar"     },
  { method: "POST",   match: "/groups",               permission: "grupo:agregar"    },
  // Users — acciones administrativas
  { method: "DELETE", match: "/users/admin",          permission: "usuario:eliminar" },
  { method: "PUT",    match: "/users/admin",          permission: "usuario:editar"   },
  { method: "POST",   match: "/users/admin",          permission: "usuario:agregar"  },
  { method: "POST",   match: "/users/invitar",        permission: "usuario:invitar"  },
  // Permisos de grupo — administración
  { method: "POST",   match: "/groups/permisos",      permission: "grupo:admin"      },
  { method: "DELETE", match: "/groups/permisos",      permission: "grupo:admin"      },
];

const getRequiredPermission = (method, path) => {
  for (const rule of routePermissions) {
    if (rule.method === method && path.includes(rule.match)) {
      return rule.permission;
    }
  }
  return null;
};

const permissionAliases = {
  // ── Tickets ────────────────────────────────────────────────────────────────
  "ticket:ver":      ["ticket:view",  "ticket:manage", "admin"],
  "ticket:agregar":  ["ticket:add",   "ticket:manage", "admin"],
  "ticket:editar":   ["ticket:edit",  "ticket:edit:state", "ticket:edit:comment", "ticket:manage", "admin"],
  "ticket:eliminar": ["ticket:delete","ticket:manage", "admin"],
  "ticket:mover":    ["ticket:move",  "tickets:move",  "ticket:manage", "admin"],
  // ── Grupos ─────────────────────────────────────────────────────────────────
  "grupo:ver":       ["group:view",   "group:manage",  "admin"],
  "grupo:agregar":   ["group:add",    "group:manage",  "admin"],
  "grupo:editar":    ["group:edit",   "group:manage",  "admin"],
  "grupo:eliminar":  ["group:delete", "group:manage",  "admin"],
  "grupo:admin":     ["group:manage", "admin"],
  // ── Usuarios ───────────────────────────────────────────────────────────────
  "usuario:ver":      ["user:view",   "user:manage",   "admin"],
  "usuario:agregar":  ["user:add",    "user:manage",   "admin"],
  "usuario:editar":   ["user:edit",   "user:edit:profile", "user:manage", "admin"],
  "usuario:eliminar": ["user:delete", "user:manage",   "admin"],
  "usuario:invitar":  ["user:invite", "user:manage",   "admin"],
};

const getPermissionAlternatives = (requiredPermission) => {
  return new Set([requiredPermission, ...(permissionAliases[requiredPermission] ?? [])]);
};

export const verifyToken = async (request, reply) => {
  try {
    const SECRET = process.env.JWT_SECRET;

    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      return sendResponse(reply, {
        statusCode: 403, intOpCode: "SxGW403",
        data: { message: "Token requerido" }
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return sendResponse(reply, {
        statusCode: 403, intOpCode: "SxGW403",
        data: { message: "Token requerido" }
      });
    }

    const decoded = jwt.verify(token, SECRET);
    request.user = decoded;

    // Inyectar info de usuario en headers para los microservicios
    request.headers["x-user-id"]       = String(decoded.id);
    request.headers["x-user-email"]    = decoded.email;
    request.headers["x-user-username"] = decoded.username;

    // ── Paso 1: ¿Es ruta de autoservicio? Solo necesita token ────────────────
    const path   = request.raw.url.split("?")[0];
    const method = request.method;

    if (isTokenOnlyRoute(method, path)) {
      return; // ✅ Token válido = acceso permitido, sin chequear permisos
    }

    // ── Paso 2: ¿GET /groups o GET /users sin acción admin? = solo token ─────
    // Listar grupos y usuarios es operación básica para cualquier usuario
    if (method === "GET" && (path === "/groups" || path.startsWith("/groups/"))) {
      // Permitir GETs de lectura general sobre grupos con solo token
      return;
    }
    if (method === "GET" && (path === "/users" || path.startsWith("/users/"))) {
      return;
    }

    // ── Paso 3: ¿Necesita un permiso específico? ─────────────────────────────
    const requiredPermission = getRequiredPermission(method, path);

    if (!requiredPermission) return; // Ruta no mapeada = solo token

    const acceptablePermissions = getPermissionAlternatives(requiredPermission);

    // ── Paso 4: Validación contextual con groupId ────────────────────────────
    const groupId = request.headers["x-group-id"]
                  ?? request.body?.grupo_id
                  ?? request.params?.grupoId
                  ?? null;

    if (groupId) {
      // Consultar si el usuario tiene este permiso ACTIVO en ESTE grupo
      const { data: rows, error } = await supabase
        .from("grupo_usuario_permisos")
        .select("permiso_id, permisos!inner(nombre)")
        .eq("grupo_id",  Number(groupId))
        .eq("usuario_id", decoded.id)
        .eq("activo", true);

      if (error) {
        console.error("Error Supabase (contextual):", error.message);
        return sendResponse(reply, {
          statusCode: 500, intOpCode: "SxGW500",
          data: { message: "Error verificando permisos de grupo" }
        });
      }

      const tienePermiso = rows?.some(r => acceptablePermissions.has(r.permisos?.nombre));
      if (!tienePermiso) {
        return sendResponse(reply, {
          statusCode: 403, intOpCode: "SxGW403P",
          data: { message: `Sin permiso '${requiredPermission}' en el grupo ${groupId}` }
        });
      }
    } else {
      // Sin groupId: verificar si tiene el permiso en AL MENOS un grupo
      const { data: rows, error } = await supabase
        .from("grupo_usuario_permisos")
        .select("permiso_id, permisos!inner(nombre)")
        .eq("usuario_id", decoded.id)
        .eq("activo", true);

      if (error) {
        console.error("Error Supabase (global):", error.message);
        return sendResponse(reply, {
          statusCode: 500, intOpCode: "SxGW500",
          data: { message: "Error verificando permisos globales" }
        });
      }

      const tienePermiso = rows?.some(r => acceptablePermissions.has(r.permisos?.nombre));
      if (!tienePermiso) {
        return sendResponse(reply, {
          statusCode: 403, intOpCode: "SxGW403P",
          data: { message: `Sin permiso global: ${requiredPermission}` }
        });
      }
    }

  } catch (err) {
    console.error("Error verificando token:", err.message);
    return sendResponse(reply, {
      statusCode: 403, intOpCode: "SxGW403",
      data: { message: "Token inválido" }
    });
  }
};

