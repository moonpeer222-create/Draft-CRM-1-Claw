#!/bin/bash
# Deploy PostgreSQL Edge Functions to Supabase
# Run this script after setting your Supabase token

set -e

echo "=== Emerald CRM Edge Functions Deployment ==="
echo ""

# Check for Supabase token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Error: SUPABASE_ACCESS_TOKEN not set"
    echo ""
    echo "Get your token from: https://app.supabase.com/account/tokens"
    echo "Then run: export SUPABASE_ACCESS_TOKEN=your_token_here"
    echo "Or login with: npx supabase login"
    exit 1
fi

# Check project ref
if [ ! -f "supabase/config.toml" ]; then
    echo "⚠️  No Supabase config found. You'll need to link to your project:"
    echo "   npx supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    read -p "Enter your Supabase project ref (e.g., abcdefghijklmnopqrst): " PROJECT_REF
    npx supabase link --project-ref "$PROJECT_REF"
fi

echo "🚀 Deploying edge functions..."
echo ""

# Deploy each function
echo "1/6 - auth_pg (Authentication)"
npx supabase functions deploy auth_pg --legacy-peer-deps

echo "2/6 - cases (Case Management)"
npx supabase functions deploy cases --legacy-peer-deps

echo "3/6 - sync_pg (Data Sync)"
npx supabase functions deploy sync_pg --legacy-peer-deps

echo "4/6 - system_pg (System Management)"
npx supabase functions deploy system_pg --legacy-peer-deps

echo "5/6 - admin_pg (Admin Functions)"
npx supabase functions deploy admin_pg --legacy-peer-deps

echo "6/6 - ai_pg (AI Chat & Actions)"
npx supabase functions deploy ai_pg --legacy-peer-deps

echo ""
echo "✅ All edge functions deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Run SQL migrations in Supabase Dashboard"
echo "   2. Set environment variables in Supabase"
echo "   3. Test the functions with the frontend"
echo ""
echo "🔗 Function URLs:"
PROJECT_REF=$(grep "project_id" supabase/config.toml 2>/dev/null | head -1 | cut -d'"' -f2 || echo "YOUR_PROJECT_REF")
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/auth_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/cases"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/sync_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/system_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/admin_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/ai_pg"
