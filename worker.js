export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Public health check: no sensitive information.
    if (url.pathname === "/api/health") {
      return Response.json({
        app: "NEXURA",
        status: "ok",
        backend: "active"
      });
    }

    // Temporary database connectivity test.
    if (url.pathname === "/api/db-check") {
      if (!env.DB) {
        return Response.json(
          { status: "error", message: "D1 binding missing" },
          { status: 503 }
        );
      }

      try {
        await env.DB.prepare("SELECT 1 AS test").first();

        return Response.json({
          status: "ok",
          database: "connected"
        });
      } catch {
        return Response.json(
          { status: "error", message: "Database check failed" },
          { status: 500 }
        );
      }
    }

    // Serve the existing NEXURA website.
    return env.ASSETS.fetch(request);
  }
};
