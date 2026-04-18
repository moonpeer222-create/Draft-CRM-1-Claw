#!/bin/bash
# Remove console.logs from frontend source

echo "Removing console.log statements from React source..."

# Count before
BEFORE=$(grep -r "console.log\|console.warn\|console.error" --include="*.tsx" --include="*.ts" /tmp/Draft-CRM-1-Claw/src/ 2>/dev/null | wc -l)
echo "Found: $BEFORE console statements"

# Remove from frontend source files
find /tmp/Draft-CRM-1-Claw/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*console\.log(/d' {} \;
find /tmp/Draft-CRM-1-Claw/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*console\.warn(/d' {} \;
find /tmp/Draft-CRM-1-Claw/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*console\.error(/d' {} \;

# Count after
AFTER=$(grep -r "console.log\|console.warn\|console.error" --include="*.tsx" --include="*.ts" /tmp/Draft-CRM-1-Claw/src/ 2>/dev/null | wc -l)
echo "Remaining: $AFTER console statements"
echo "Removed: $((BEFORE - AFTER)) statements"

echo "Done!"
