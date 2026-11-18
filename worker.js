const encoder = new TextEncoder();

const ADMIN_EMAIL = "noormsajid.ch@gmail.com";
const SESSION_COOKIE = "nx_session";
const STATE_COOKIE = "nx_oauth_state";
const SESSION_SECONDS = 8 * 60 * 60;

function reply(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function getCookie(request, name) {
  const entry = (request.headers.get("Cookie") || "")
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith(name + "="));

  return entry ? entry.slice(name.length + 1) : null;
}

function makeCookie(name, value, age) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}

function redirect(location, cookieValues = []) {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store"
  });

  for (const value of cookieValues) {
    headers.append("Set-Cookie", value);
  }

  return new Response(null, {
    status: 302,
    headers
  });
}

function base64url(bytes) {
  let text = "";

  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }

  return btoa(text)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decode64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");

  return Uint8Array.from(
    atob(normalized),
    x => x.charCodeAt(0)
  );
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign", "verify"]
  );
}

async function createSession(user, secret) {
  const payload = {
    id: user.id,
    sub: user.google_sub,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  };

  const body = base64url(
    encoder.encode(JSON.stringify(payload))
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(body)
  );

  return `${body}.${base64url(new Uint8Array(signature))}`;
}

async function readSession(request, secret) {
  const token = getCookie(request, SESSION_COOKIE);

  if (!token || !secret) return null;

  try {
    const parts = token.split(".");

    if (parts.length !== 2) return null;

    const [body, signature] = parts;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      decode64(signature),
      encoder.encode(body)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(decode64(body))
    );

    if (
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function authConfigured(env) {
  return Boolean(
    env.DB &&
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.SESSION_SECRET
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Existing health check
    if (path === "/api/health") {
      return reply({
        app: "NEXURA",
        status: "ok",
        backend: "active"
      });
    }

    // Existing D1 database check
    if (path === "/api/db-check") {
      if (!env.DB) {
        return reply({
          status: "error",
          message: "D1 binding missing"
        }, 503);
      }

      try {
        await env.DB.prepare("SELECT 1 AS test").first();

        return reply({
          status: "ok",
          database: "connected"
        });
      } catch {
        return reply({
          status: "error",
          message: "Database check failed"
        }, 500);
      }
    }

    // Start Google OAuth
    if (path === "/api/auth/google/start") {
      if (request.method !== "GET") {
        return reply({
          error: "Method not allowed"
        }, 405);
      }

      if (!authConfigured(env)) {
        return reply({
          error: "Authentication not configured"
        }, 503);
      }

      const state = base64url(
        crypto.getRandomValues(new Uint8Array(32))
      );

      const google = new URL(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );

      google.searchParams.set(
        "client_id",
        env.GOOGLE_CLIENT_ID
      );

      google.searchParams.set(
        "redirect_uri",
        `${url.origin}/api/auth/google/callback`
      );

      google.searchParams.set("response_type", "code");
      google.searchParams.set("scope", "openid email profile");
      google.searchParams.set("state", state);
      google.searchParams.set("prompt", "select_account");

      return redirect(google.toString(), [
        makeCookie(STATE_COOKIE, state, 600)
      ]);
    }

    // Google OAuth callback
    if (path === "/api/auth/google/callback") {
      if (request.method !== "GET") {
        return reply({
          error: "Method not allowed"
        }, 405);
      }

      if (!authConfigured(env)) {
        return reply({
          error: "Authentication not configured"
        }, 503);
      }

      const clearState = makeCookie(STATE_COOKIE, "", 0);

      const savedState = getCookie(request, STATE_COOKIE);
      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");

      if (
        !savedState ||
        savedState !== returnedState ||
        !code
      ) {
        return redirect("/?auth_error=invalid_state", [
          clearState
        ]);
      }

      try {
        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              code,
              client_id: env.GOOGLE_CLIENT_ID,
              client_secret: env.GOOGLE_CLIENT_SECRET,
              redirect_uri: `${url.origin}/api/auth/google/callback`,
              grant_type: "authorization_code"
            })
          }
        );

        if (!tokenResponse.ok) {
          return redirect("/?auth_error=token", [
            clearState
          ]);
        }

        const tokens = await tokenResponse.json();

        if (!tokens.id_token) {
          return redirect("/?auth_error=identity", [
            clearState
          ]);
        }

        // Verify Google ID token with Google's validation endpoint.
        const verifyResponse = await fetch(
          "https://oauth2.googleapis.com/tokeninfo?id_token=" +
          encodeURIComponent(tokens.id_token)
        );

        if (!verifyResponse.ok) {
          return redirect("/?auth_error=identity", [
            clearState
          ]);
        }

        const identity = await verifyResponse.json();

        if (
          ![
            "accounts.google.com",
            "https://accounts.google.com"
          ].includes(identity.iss) ||
          identity.aud !== env.GOOGLE_CLIENT_ID ||
          identity.email_verified !== "true" ||
          !identity.sub ||
          !identity.email
        ) {
          return redirect("/?auth_error=identity", [
            clearState
          ]);
        }

        const email = identity.email.toLowerCase();

        let user = await env.DB.prepare(
          `SELECT id, google_sub, email, name, role, status
           FROM users
           WHERE email = ? COLLATE NOCASE`
        ).bind(email).first();

        if (!user) {
          return redirect("/?auth_error=not_invited", [
            clearState
          ]);
        }

        if (
          user.google_sub &&
          user.google_sub !== identity.sub
        ) {
          return redirect("/?auth_error=account_mismatch", [
            clearState
          ]);
        }

        // First verified login activates the pre-created super admin.
        if (
          user.status === "pending" &&
          user.role === "super_admin" &&
          email === ADMIN_EMAIL
        ) {
          await env.DB.prepare(
            `UPDATE users
             SET google_sub = ?,
                 name = ?,
                 status = 'active',
                 last_login_at = datetime('now')
             WHERE id = ?
               AND role = 'super_admin'
               AND status = 'pending'
               AND (google_sub IS NULL OR google_sub = ?)`
          ).bind(
            identity.sub,
            identity.name || email,
            user.id,
            identity.sub
          ).run();
        } else if (user.status === "active") {
          await env.DB.prepare(
            `UPDATE users
             SET google_sub = COALESCE(google_sub, ?),
                 last_login_at = datetime('now')
             WHERE id = ?
               AND (google_sub IS NULL OR google_sub = ?)`
          ).bind(
            identity.sub,
            user.id,
            identity.sub
          ).run();
        }

        user = await env.DB.prepare(
          `SELECT id, google_sub, email, name, role, status
           FROM users
           WHERE id = ?`
        ).bind(user.id).first();

        if (
          !user ||
          user.status !== "active" ||
          user.google_sub !== identity.sub
        ) {
          return redirect("/?auth_error=approval_required", [
            clearState
          ]);
        }

        const session = await createSession(
          user,
          env.SESSION_SECRET
        );

        return redirect("/", [
          clearState,
          makeCookie(
            SESSION_COOKIE,
            session,
            SESSION_SECONDS
          )
        ]);
      } catch {
        return redirect("/?auth_error=server", [
          clearState
        ]);
      }
    }

    // Check authenticated user
    if (path === "/api/auth/me") {
      if (request.method !== "GET") {
        return reply({
          error: "Method not allowed"
        }, 405);
      }

      if (!authConfigured(env)) {
        return reply({
          error: "Authentication not configured"
        }, 503);
      }

      try {
        const session = await readSession(
          request,
          env.SESSION_SECRET
        );

        if (!session) {
          return reply({
            authenticated: false
          }, 401);
        }

        const user = await env.DB.prepare(
          `SELECT id, google_sub, email, name, role, status
           FROM users
           WHERE id = ?`
        ).bind(session.id).first();

        if (
          !user ||
          user.status !== "active" ||
          user.google_sub !== session.sub
        ) {
          return reply({
            authenticated: false
          }, 401);
        }

        return reply({
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        });
      } catch {
        return reply({
          error: "Authentication check failed"
        }, 500);
      }
    }

    // Logout
    if (path === "/api/auth/logout") {
      if (request.method !== "POST") {
        return reply({
          error: "Method not allowed"
        }, 405);
      }

      return reply(
        { ok: true },
        200,
        {
          "Set-Cookie": makeCookie(
            SESSION_COOKIE,
            "",
            0
          )
        }
      );
    }
// NEXURA Tasks API - authenticated D1 storage.
    if (path === "/api/tasks") {
      if (!["GET", "POST", "PUT"].includes(request.method))
         {
        return reply({ error: "Method not allowed" }, 405);
      }

      if (!env.DB || !env.SESSION_SECRET) {
        return reply({ error: "Service unavailable" }, 503);
      }

      const session = await readSession(
        request,
        env.SESSION_SECRET
      );

      if (!session?.id || !session?.sub) {
        return reply({ error: "Unauthorized" }, 401);
      }

      const user = await env.DB.prepare(
        `SELECT id, role, status
         FROM users
         WHERE id = ? AND google_sub = ?`
      ).bind(session.id, session.sub).first();

      if (
        !user ||
        user.status !== "active" ||
        !["super_admin", "admin", "manager", "staff", "viewer"]
          .includes(user.role)
      ) {
        return reply({ error: "Access denied" }, 403);
      }

      // Read tasks belonging to the authenticated user.
      if (request.method === "GET") {
        const result = await env.DB.prepare(
          `SELECT id, title, description, status,
           due_date, created_at, updated_at, task_data
           FROM tasks
           WHERE owner_id = ?
           ORDER BY created_at DESC
           LIMIT 500`
        ).bind(user.id).all();

        return reply({
          ok: true,
          tasks: result.results
        });
      }

      // Viewers cannot create tasks.
      if (user.role === "viewer") {
        return reply({ error: "Read-only access" }, 403);
      }

      // Only accept requests from the same website.
      if (request.headers.get("Origin") !== url.origin) {
        return reply({ error: "Invalid origin" }, 403);
      }

      let data;

      try {
        if (
          Number(request.headers.get("Content-Length") || 0) >
          16384
        ) {
          return reply({ error: "Request too large" }, 413);
        }

        const raw = await request.text();

        if (raw.length > 16384) {
          return reply({ error: "Request too large" }, 413);
        }

        data = JSON.parse(raw);
      } catch {
        return reply({ error: "Invalid JSON" }, 400);
      }

      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
      ) {
        return reply({ error: "Invalid task" }, 400);
      }

      const title =
        typeof data.title === "string" ? data.title.trim() : "";

      if (!title || title.length > 200) {
        return reply({ error: "Invalid title" }, 400);
      }

      const description =
        typeof data.description === "string"
          ? data.description.trim()
          : "";

      if (description.length > 5000) {
        return reply({ error: "Description too long" }, 400);
      }

      const id =
        typeof data.id === "string" &&
        /^[a-zA-Z0-9_-]{8,100}$/.test(data.id)
          ? data.id
          : crypto.randomUUID();

      const dueDate =
        typeof data.due_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.due_date)
          ? data.due_date
          : null;

        const status = [
        "Planned",
        "In process",
        "Completed",
        "open",
        "completed"
      ].includes(data.status)
        ? data.status
        : "Planned";
        // Preserve the complete NEXURA task record.
      const taskData = data.task_data;

      if (
        !taskData ||
        typeof taskData !== "object" ||
         Array.isArray(taskData) ||
        taskData.id !== id
        ) {
           return reply({ error: "Invalid task data" }, 400);
          }

      const taskJson = JSON.stringify(taskData);

        if (taskJson.length > 12000) {
        return reply({ error: "Task data too large" }, 413);
          }
      if (request.method === "PUT") {
        const result = await env.DB.prepare(
          `UPDATE tasks
          SET title = ?,
              description = ?,
              status = ?,
              due_date = ?,
              task_data = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND owner_id = ?`
        ).bind(
          title,
          description,
          status,
          dueDate,
          taskJson,
          id,
          user.id
        ).run();

        if (result.meta.changes === 0) {
          return reply({ error: "Task not found" }, 404);
        }

        return reply({ ok: true, id: id });
      }
      await env.DB.prepare(
        `INSERT INTO tasks
        (id, owner_id, title, description, status, due_date, task_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING`
        ).bind(
          id,
          user.id,
          title,
          description,
          status,
          dueDate,
          taskJson
        ).run();
        return reply({
        ok: true,
        id: id
      });
    }
    // Reject unknown API routes.
    if (path.startsWith("/api/")) {
      return reply({
        error: "Not found"
      }, 404);
    }

    // Serve the existing NEXURA website.
    // Protect the NEXURA website with a verified session.
const session = await readSession(request, env.SESSION_SECRET);

if (!session || !session.id || !session.sub) {
  // Allow only the login page and its required assets.
  const publicFiles = new Set([
    "/local-login-trial.js"
  ]);

  if (publicFiles.has(path)) {
    return env.ASSETS.fetch(request);
  }

  // Display a standalone Google Login page.
  if (path === "/" || path === "/index.html") {
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1">
        <title>NEXURA — Secure Login</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0b1220;
            font-family: Arial, sans-serif;
          }
          .card {
            background: white;
            border-radius: 18px;
            padding: 36px 30px;
            max-width: 400px;
            width: 85%;
            text-align: center;
            box-shadow: 0 15px 45px rgba(0,0,0,.25);
          }
          h1 { color: #111827; }
          p { color: #64748b; }
          a {
            display: block;
            padding: 14px;
            margin-top: 25px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
          }
          .error { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>NEXURA</h1>
          <p>Secure Workspace Login</p>
          <p>Sign in with your authorized Google Account.</p>
          <p class="error" id="error" hidden>
            Login failed or access is not approved.
          </p>
          <a href="/api/auth/google/start">
            Continue with Google
          </a>
        </div>
        <script>
          if (new URLSearchParams(location.search).has("auth_error")) {
            document.getElementById("error").hidden = false;
          }
        </script>
      </body>
      </html>
    `, {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-store"
      }
    });
  }

  return new Response("Authentication required", {
    status: 401
  });
}

// Verify the user against the live D1 database.
if (!env.DB) {
  return new Response("Database unavailable", { status: 503 });
}

let verifiedUser;

try {
  verifiedUser = await env.DB.prepare(
    `SELECT id, google_sub, role, status
     FROM users
     WHERE id = ? AND google_sub = ?
     LIMIT 1`
  )
    .bind(session.id, session.sub)
    .first();
} catch {
  return new Response("Database verification failed", { status: 503 });
}

// Only active users with approved roles may access NEXURA.
if (
  !verifiedUser ||
  verifiedUser.status !== "active" ||
  !["super_admin", "admin", "manager", "staff", "viewer"].includes(
    verifiedUser.role
  )
) {
  return new Response("Access denied", { status: 403 });
}

// Serve the existing NEXURA website.
return env.ASSETS.fetch(request);
}
};