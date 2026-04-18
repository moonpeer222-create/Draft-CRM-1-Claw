#!/bin/bash
# Deploy PostgreSQL Edge Functions to Supabase
# Usage: ./deploy-edge-functions.sh [project-ref]

set -e

PROJECT_REF="${1:-}"

echo "=========================================="
echo "  Draft CRM - Supabase Edge Functions"
echo "=========================================="
echo ""

# Check for Supabase CLI
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Check for access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚠️  SUPABASE_ACCESS_TOKEN not set"
    echo ""
    echo "To get your access token:"
    echo "  1. Go to https://app.supabase.com/account/tokens"
    echo "  2. Create a new token"
    echo "  3. Run: export SUPABASE_ACCESS_TOKEN=your_token_here"
    echo ""
    echo "Or login interactively:"
    echo "  npx supabase login"
    echo ""
    exit 1
fi

# Check project ref
if [ -z "$PROJECT_REF" ]; then
    if [ -f "supabase/.temp/project-ref" ]; then
        PROJECT_REF=$(cat supabase/.temp/project-ref)
        echo "📋 Using linked project: $PROJECT_REF"
    else
        echo "⚠️  No project reference found"
        echo ""
        echo "Usage: $0 <project-ref>"
        echo "Example: $0 abcdefghijklmnopqrst"
        echo ""
        read -p "Enter your Supabase project ref: " PROJECT_REF
        if [ -z "$PROJECT_REF" ]; then
            echo "❌ Project ref is required"
            exit 1
        fi
    fi
fi

# Link project if not already linked
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "🔗 Linking to project: $PROJECT_REF"
    npx supabase link --project-ref "$PROJECT_REF"
fi

echo ""
echo "🚀 Deploying edge functions..."
echo ""

FUNCTIONS=(
    "auth_pg:Authentication"
    "cases:Case Management"
    "sync_pg:Data Sync"
    "system_pg:System Management"
    "admin_pg:Admin Functions"
    "ai_pg:AI Chat & Actions"
)

deployed=()
failed=()

total=${#FUNCTIONS[@]}
current=0

for func_info in "${FUNCTIONS[@]}"; do
    IFS=':' read -r func_name func_desc <<< "$func_info"
    ((current++))
    
    echo "[$current/$total] Deploying $func_name ($func_desc)..."
    
    if npx supabase functions deploy "$func_name" 2>&1; then
        echo "   ✅ $func_name deployed successfully"
        deployed+=("$func_name")
    else
        echo "   ❌ $func_name deployment failed"
        failed+=("$func_name")
    fi
    echo ""
done

echo "=========================================="
echo "  Deployment Summary"
echo "=========================================="
echo ""
echo "✅ Successfully deployed (${#deployed[@]}):"
for func in "${deployed[@]}"; do
    echo "   • $func"
done

if [ ${#failed[@]} -gt 0 ]; then
    echo ""
    echo "❌ Failed to deploy (${#failed[@]}):"
    for func in "${failed[@]}"; do
        echo "   • $func"
    done
fi

echo ""
echo "🔗 Function URLs:"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/auth_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/cases"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/sync_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/system_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/admin_pg"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/ai_pg"
echo ""
echo "📝 Next steps:"
echo "   1. Set environment variables in Supabase Dashboard:"
echo "      - SUPABASE_URL"
echo "      - SUPABASE_SERVICE_ROLE_KEY"
echo "      - BREVO_API_KEY (optional, for email)"
echo "      - OPENROUTER_API_KEY (optional, for AI)"
echo "   2. Run database migrations"
echo "   3. Test the functions with your frontend"
echo ""
