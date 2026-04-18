import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";

// Import auth routes and middleware from relative paths
import authRouter from "../server/routes/auth_pg.ts";
import { softAuth, rateLimiter } from "../server/authMiddleware.ts";

const app = new Hono();

// Global Middleware
app.use("*", cors());
app.use("/make-server-5cdc87b7/*", softAuth());
app.use("/make-server-5cdc87b7/*", rateLimiter(60));

// Base Path for Legacy Compatibility
const base = "/make-server-5cdc87b7";

// Mount Auth Routes
app.route(`${base}/auth`, authRouter);

// Health Check
app.get("/", (c) => c.text("Auth Service - Emerald Tech Partner"));
app.get(`${base}/health`, (c) => c.json({
  status: "ok",
  service: "auth",
  timestamp: new Date().toISOString()
}));

// Supabase Function Entry Point
Deno.serve(app.fetch);
