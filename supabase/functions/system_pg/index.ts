import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";

// Import system routes and middleware
import systemRouter from "../server/routes/system_pg.ts";
import { softAuth, rateLimiter } from "../server/authMiddleware.ts";

const app = new Hono();

// Global Middleware
app.use("*", cors());
app.use("/make-server-5cdc87b7/*", softAuth());
app.use("/make-server-5cdc87b7/*", rateLimiter(60));

// Base Path for Legacy Compatibility
const base = "/make-server-5cdc87b7";

// Mount System Routes
app.route(`${base}/system`, systemRouter);

// Health Check
app.get("/", (c) => c.text("System Service - Emerald Tech Partner"));
app.get(`${base}/health`, (c) => c.json({
  status: "ok",
  service: "system",
  timestamp: new Date().toISOString()
}));

// Supabase Function Entry Point
Deno.serve(app.fetch);
