import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { cors } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { softAuth, rateLimiter } from "./authMiddleware.ts";

// PostgreSQL Routes (Migrated from KV)
import authRouter from "./routes/auth_pg.ts";
import casesRouter from "./routes/cases.ts";
import syncRouter from "./routes/sync.ts";
import systemRouter from "./routes/system.ts";
import aiRouter from "./routes/ai.ts";
import adminRouter from "./routes/admin.ts";

const app = new Hono();

// Global Middleware
app.use("*", cors());
app.use("/make-server-5cdc87b7/*", softAuth());
app.use("/make-server-5cdc87b7/*", rateLimiter(60));

// Base Path
const base = "/make-server-5cdc87b7";

// Mount Routes
app.route(`${base}/auth`, authRouter);
app.route(`${base}/cases`, casesRouter);
app.route(`${base}/sync`, syncRouter);
app.route(`${base}/system`, systemRouter);
app.route(`${base}/ai`, aiRouter);
app.route(`${base}/admin`, adminRouter);

// Health Check
app.get("/", (c) => c.text("Emerald CRM — PostgreSQL Backend v3.0"));
app.get(`${base}/health`, (c) => c.json({ 
  status: "ok", 
  version: "3.0-postgresql",
  timestamp: new Date().toISOString() 
}));

Deno.serve(app.fetch);
