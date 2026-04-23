# Backend Fix Summary — Users Table → Profiles Migration

## What Was Broken

Your edge functions (backend) were querying a `users` table that **does not exist anymore**.

- Migration `000006_database_cleanup.sql` **dropped `users`** and repointed FKs to `profiles`
- But the Deno/Hono edge functions still had **~50 references** to `.from('users')` and `password_hash`
- This would cause **500 errors** on login, user management, sync, health checks, and stats

## Files I Fixed (Code Changes)

| File | What Changed |
|------|-------------|
| `supabase/functions/server/lib/db.ts` | `users` object now queries `profiles`. Removed dead `exec_sql` helper. Removed `query` export. |
| `supabase/functions/server/routes/auth_pg.ts` | Legacy `/login` returns `501 USE_SUPABASE_AUTH`. `/reset-password` now uses Supabase Auth admin API. |
| `supabase/functions/server/routes/auth.ts` | Same as auth_pg.ts. Also fixed `/change-password` and `/me` endpoints. |
| `supabase/functions/server/routes/admin_pg.ts` | Creating users now uses `auth.admin.createUser()` then updates profile. Password updates use `auth.admin.updateUserById()`. |
| `supabase/functions/server/routes/admin.ts` | Same fixes as admin_pg.ts. |
| `supabase/functions/server/routes/system_pg.ts` | Health check and stats now query `profiles`. Backup table list uses `profiles`. |
| `supabase/functions/server/routes/sync_pg.ts` | Health check queries `profiles`. Conflict resolution strips `password` (not `password_hash`). |
| `supabase/functions/server/routes/sync.ts` | User sync strips `password` only. Sanitized user data uses explicit field list. |
| `src/app/lib/auth.ts` | Fixed deprecated frontend auth file to query `profiles` instead of `users` (6 replacements). |

## New File Created

| File | Purpose |
|------|---------|
| `supabase/migrations/000007_fix_profiles_columns.sql` | Adds missing columns (`status`, `phone`, `department`, `employee_id`, `tenant_id`, `last_login`, `updated_at`) to `profiles`. Fixes any dangling FKs to old `users` table. |

---

## What YOU Need to Do (Deploy Steps)

### Step 1: Run the SQL Migration

1. Open your **Supabase Dashboard** → SQL Editor
2. Copy the contents of:
   ```
   supabase/migrations/000007_fix_profiles_columns.sql
   ```
3. Paste and **Run**
4. You should see green checkmarks. Yellow `NOTICE` messages are normal (they mean some defensive fixes were skipped because they weren't needed).

### Step 2: Deploy Edge Functions

Open a terminal in your project folder and run:

```bash
# If you have the Supabase CLI installed:
supabase functions deploy

# Or deploy individually if needed:
supabase functions deploy auth_pg
supabase functions deploy admin_pg
supabase functions deploy system_pg
supabase functions deploy sync_pg
supabase functions deploy cases
supabase functions deploy ai_pg
```

### Step 3: Verify

1. Open your app and try to **log in** (it uses Supabase Auth directly, so this should always work)
2. Go to **Admin → User Management** and verify you can see the user list
3. Try **creating a new user** from the admin panel
4. Check the **health endpoint**:
   ```
   https://<your-project>.supabase.co/functions/v1/system_pg/health
   ```
   It should return `"status": "healthy"`

---

## Important Notes

### Passwords are now managed by Supabase Auth
- The edge functions **no longer store or verify `password_hash`** in the `profiles` table
- When an admin creates a user, the edge function:
  1. Calls `supabase.auth.admin.createUser()` (creates auth user)
  2. The `handle_new_user` trigger auto-creates a `profiles` row
  3. The edge function updates that profile with CRM fields (`role`, `status`, `tenant_id`, etc.)
- When updating a password, the edge function calls `supabase.auth.admin.updateUserById()`

### The legacy `/auth/login` endpoint is disabled
- Your frontend already uses `supabase.auth.signInWithPassword()` directly
- The edge function `/auth/login` now returns `501` with code `USE_SUPABASE_AUTH`
- This is intentional — all auth should go through Supabase Auth, not a parallel custom system

### If something breaks
- The `profiles` table **must** have the columns added by `000007_fix_profiles_columns.sql`
- If `tenant_id` is missing on `profiles`, tenant-isolation queries will fail
- If `status` is missing, user listing will fail

---

## Rollback Plan

If you need to rollback the edge function changes:

```bash
# Re-deploy from git (if you committed before these changes)
git checkout -- supabase/functions/server/

# Or manually revert the files from git history
```

The SQL migration (`000007`) is safe to leave in place — it only adds `IF NOT EXISTS` columns.
