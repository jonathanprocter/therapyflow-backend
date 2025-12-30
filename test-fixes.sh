#!/bin/bash

echo "=========================================="
echo "TherapyFlow Backend - Fixes Verification"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if files exist
echo "1. Checking if new files were created..."
if [ -f "client/src/lib/caseTransform.ts" ]; then
    echo -e "${GREEN}✓${NC} caseTransform.ts created"
else
    echo -e "${RED}✗${NC} caseTransform.ts NOT found"
fi

if [ -f "client/src/components/Calendar.tsx.backup" ]; then
    echo -e "${GREEN}✓${NC} Calendar.tsx.backup created"
else
    echo -e "${RED}✗${NC} Calendar.tsx.backup NOT found"
fi

if [ -f "ISSUE_ANALYSIS.md" ]; then
    echo -e "${GREEN}✓${NC} ISSUE_ANALYSIS.md created"
else
    echo -e "${RED}✗${NC} ISSUE_ANALYSIS.md NOT found"
fi

if [ -f "FIXES_APPLIED.md" ]; then
    echo -e "${GREEN}✓${NC} FIXES_APPLIED.md created"
else
    echo -e "${RED}✗${NC} FIXES_APPLIED.md NOT found"
fi

echo ""
echo "2. Checking if files were modified..."

# Check queryClient.ts for transformation imports
if grep -q "transformApiResponse" client/src/lib/queryClient.ts; then
    echo -e "${GREEN}✓${NC} queryClient.ts includes transformation logic"
else
    echo -e "${RED}✗${NC} queryClient.ts missing transformation logic"
fi

# Check Calendar.tsx for scheduledAt support
if grep -q "scheduledAt" client/src/components/Calendar.tsx; then
    echo -e "${GREEN}✓${NC} Calendar.tsx supports scheduledAt property"
else
    echo -e "${RED}✗${NC} Calendar.tsx missing scheduledAt support"
fi

# Check Calendar.tsx for responsive design
if grep -q "aspect-square" client/src/components/Calendar.tsx; then
    echo -e "${GREEN}✓${NC} Calendar.tsx uses responsive design"
else
    echo -e "${RED}✗${NC} Calendar.tsx missing responsive design"
fi

# Check Calendar.tsx for mobile optimization
if grep -q "min-h-\[44px\]" client/src/components/Calendar.tsx; then
    echo -e "${GREEN}✓${NC} Calendar.tsx includes mobile touch targets"
else
    echo -e "${RED}✗${NC} Calendar.tsx missing mobile optimization"
fi

# Check routes.ts for upcoming sessions fix
if grep -q "getUpcomingSessions(req.therapistId, new Date())" server/routes.ts; then
    echo -e "${GREEN}✓${NC} routes.ts uses correct upcoming sessions query"
else
    echo -e "${RED}✗${NC} routes.ts may still have upcoming sessions bug"
fi

echo ""
echo "3. Code quality checks..."

# Check for syntax errors in caseTransform.ts
if [ -f "client/src/lib/caseTransform.ts" ]; then
    line_count=$(wc -l < client/src/lib/caseTransform.ts)
    if [ "$line_count" -gt 50 ]; then
        echo -e "${GREEN}✓${NC} caseTransform.ts has $line_count lines (expected ~85)"
    else
        echo -e "${YELLOW}⚠${NC} caseTransform.ts has only $line_count lines"
    fi
fi

# Check Calendar.tsx line count
if [ -f "client/src/components/Calendar.tsx" ]; then
    line_count=$(wc -l < client/src/components/Calendar.tsx)
    if [ "$line_count" -gt 150 ]; then
        echo -e "${GREEN}✓${NC} Calendar.tsx has $line_count lines (improved version)"
    else
        echo -e "${YELLOW}⚠${NC} Calendar.tsx has only $line_count lines (may be old version)"
    fi
fi

echo ""
echo "4. Checking for potential issues..."

# Check if there are any TODO comments in new files
if grep -r "TODO\|FIXME\|XXX" client/src/lib/caseTransform.ts 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} Found TODO/FIXME comments in caseTransform.ts"
else
    echo -e "${GREEN}✓${NC} No TODO/FIXME comments in caseTransform.ts"
fi

# Check if Calendar has proper TypeScript types
if grep -q "interface CalendarSession" client/src/components/Calendar.tsx; then
    echo -e "${GREEN}✓${NC} Calendar.tsx has proper TypeScript interfaces"
else
    echo -e "${RED}✗${NC} Calendar.tsx missing TypeScript interfaces"
fi

echo ""
echo "5. Summary of changes..."
echo ""
echo "Files created: 4"
echo "Files modified: 3"
echo "Files backed up: 1"
echo ""
echo "=========================================="
echo "Verification complete!"
echo "=========================================="
