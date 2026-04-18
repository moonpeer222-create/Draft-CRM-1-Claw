import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { softAuth, rateLimiter } from "./authMiddleware.ts";

// Modular Routers - PostgreSQL Version
import authRouter from "./routes/auth_pg.ts";
import casesRouter from "./routes/cases.ts";
import syncRouter from "./routes/sync_pg.ts";
import systemRouter from "./routes/system_pg.ts";
import aiRouter from "./routes/ai.ts";
import adminRouter from "./routes/admin_pg.ts";

const app = new Hono();

// Global Middleware
app.use("*", cors());
app.use("/make-server-5cdc87b7/*", softAuth());
app.use("/make-server-5cdc87b7/*", rateLimiter(60));

// Base Path for Legacy Compatibility
const base = "/make-server-5cdc87b7";

// Mount Modular Routes
app.route(`${base}/auth`, authRouter);
app.route(`${base}/cases`, casesRouter);
app.route(`${base}/sync`, syncRouter);
app.route(`${base}/system`, systemRouter);
app.route(`${base}/ai`, aiRouter);
app.route(`${base}/admin`, adminRouter);

// Health Check / Root
app.get("/", (c) => c.text("Emerald Tech Partner — PostgreSQL Backend API v3.0"));
app.get(`${base}/health`, (c) => c.json({ 
  status: "ok", 
  version: "3.0-postgresql",
  timestamp: new Date().toISOString() 
}));

// Supabase Function Entry Point
Deno.serve(app.fetch);
