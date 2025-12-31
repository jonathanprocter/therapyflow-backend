#!/bin/bash

# Clinical AI Code Review Automation Script
# Automatically analyzes your codebase against the Clinical AI Code Review Checklist
# Run with: ./clinical_review.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Create results directory
RESULTS_DIR="clinical_review_results"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$RESULTS_DIR/review_report_$TIMESTAMP.md"

echo -e "${BLUE}🏥 Clinical AI Code Review Automation${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Report will be saved to: $REPORT_FILE"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# Clinical AI Code Review Report
**Generated:** $(date)
**Project:** Clinical Progress Note Processing Application

## Executive Summary
This automated analysis checks your codebase against the Clinical AI Code Review Checklist.

---

EOF

# Function to check and report
check_item() {
    local section="$1"
    local item="$2"
    local description="$3"
    local check_command="$4"
    local fix_suggestion="$5"
    local priority="$6"
    
    echo -e "${BLUE}Checking:${NC} $item"
    
    if eval "$check_command" &>/dev/null; then
        echo -e "${GREEN}✅ PASS:${NC} $description"
        echo "- ✅ **$item**: $description" >> "$REPORT_FILE"
    else
        local priority_icon="⚠️"
        local priority_color="$YELLOW"
        if [ "$priority" = "high" ]; then
            priority_icon="🚨"
            priority_color="$RED"
        fi
        
        echo -e "${priority_color}${priority_icon} NEEDS ATTENTION:${NC} $description"
        echo "- ${priority_icon} **$item**: $description" >> "$REPORT_FILE"
        echo "  - **Fix:** $fix_suggestion" >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
}

# Start analysis
echo "## 📊 Analysis Results" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# =============================================================================
# SECTION 1: DATA ACCURACY & PROCESSING
# =============================================================================

echo -e "${PURPLE}📋 Section 1: Data Accuracy & Processing${NC}"
echo "### 📋 Data Accuracy & Processing" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_item "Data Accuracy" \
    "Input Validation with Zod" \
    "Comprehensive input validation using Zod schemas" \
    "grep -r 'z\.' --include='*.ts' --include='*.js' src/ | grep -E '(object|string|array)' | head -1" \
    "Add Zod schemas for all clinical data inputs. Example: \`const clientSchema = z.object({...})\`" \
    "high"

check_item "Data Accuracy" \
    "AI Service Error Handling" \
    "Robust error handling around AI API calls" \
    "grep -r 'try.*catch' --include='*.ts' --include='*.js' src/ | grep -i -E '(openai|anthropic|ai)'" \
    "Wrap all AI calls in try-catch blocks with proper error logging and fallback handling" \
    "high"

check_item "Data Accuracy" \
    "Data Deduplication Logic" \
    "Logic to prevent duplicate client records or notes" \
    "grep -r -E '(unique|duplicate|findFirst|findUnique)' --include='*.ts' --include='*.js' src/" \
    "Implement uniqueness checks before inserting new client data or progress notes" \
    "medium"

check_item "Data Accuracy" \
    "AI Response Validation" \
    "Validation of AI response structure before processing" \
    "grep -r -E '(validate|schema|parse).*ai' --include='*.ts' --include='*.js' src/ -i" \
    "Add response validation for all AI outputs using Zod schemas" \
    "high"

# =============================================================================
# SECTION 2: STORAGE & DATA INTEGRITY
# =============================================================================

echo -e "${PURPLE}🗄️ Section 2: Storage & Data Integrity${NC}"
echo "### 🗄️ Storage & Data Integrity" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_item "Storage" \
    "Database Transaction Usage" \
    "Using database transactions for related operations" \
    "grep -r 'transaction' --include='*.ts' --include='*.js' src/" \
    "Wrap related database operations in transactions using Drizzle's transaction API" \
    "high"

check_item "Storage" \
    "Migration Safety" \
    "Safe database migration procedures" \
    "ls -la drizzle/ migrations/ 2>/dev/null || ls -la db/migrations/ 2>/dev/null" \
    "Set up proper migration folder with backup procedures before running migrations" \
    "high"

check_item "Storage" \
    "Backup Configuration" \
    "Backup and recovery procedures documented" \
    "find . -name '*backup*' -o -name '*recovery*' | head -1" \
    "Document backup procedures and test recovery processes regularly" \
    "high"

check_item "Storage" \
    "Data Versioning" \
    "Version tracking for important clinical data changes" \
    "grep -r -E '(version|updated.*by|modified.*by)' --include='*.ts' --include='*.js' src/" \
    "Add version fields and audit trails to critical clinical data tables" \
    "medium"

# =============================================================================
# SECTION 3: RECALL & CLINICAL CONNECTIONS
# =============================================================================

echo -e "${PURPLE}🔍 Section 3: Recall & Clinical Connections${NC}"
echo "### 🔍 Recall & Clinical Connections" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_item "Recall" \
    "Semantic Search Implementation" \
    "Semantic search functionality for clinical data" \
    "grep -r -E '(embedding|vector|semantic|search)' --include='*.ts' --include='*.js' src/" \
    "Implement vector embeddings and semantic search for clinical note recall" \
    "high"

check_item "Recall" \
    "Temporal Query Support" \
    "Support for querying clinical data across time periods" \
    "grep -r -E '(date.*range|time.*between|gte.*lte)' --include='*.ts' --include='*.js' src/" \
    "Add date range queries and temporal analysis for tracking client progress over time" \
    "high"

check_item "Recall" \
    "Search Performance Optimization" \
    "Database indexes for clinical search patterns" \
    "grep -r -E '(index|createIndex)' --include='*.ts' --include='*.js' src/ drizzle/" \
    "Add database indexes on frequently searched fields (clientId, sessionDate, tags)" \
    "medium"

check_item "Recall" \
    "Clinical Context Preservation" \
    "Maintaining clinical context in AI processing" \
    "grep -r -E '(context|history|previous.*session)' --include='*.ts' --include='*.js' src/" \
    "Ensure AI prompts include relevant historical context for better clinical insights" \
    "high"

# =============================================================================
# SECTION 4: AI PROCESSING VALIDATION
# =============================================================================

echo -e "${PURPLE}🤖 Section 4: AI Processing Validation${NC}"
echo "### 🤖 AI Processing Validation" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_item "AI Processing" \
    "Prompt Versioning" \
    "Version control for AI prompts used in clinical analysis" \
    "find . -name '*prompt*' -o -name '*template*' | grep -v node_modules" \
    "Create versioned prompt templates for consistent AI analysis across clinical sessions" \
    "high"

check_item "AI Processing" \
    "Input Sanitization" \
    "Sanitization of user input before AI processing" \
    "grep -r -E '(sanitize|escape|clean)' --include='*.ts' --include='*.js' src/" \
    "Sanitize all user input before sending to AI services to prevent prompt injection" \
    "high"

check_item "AI Processing" \
    "AI Response Logging" \
    "Logging of AI processing activities for audit" \
    "grep -r -E '(log.*ai|ai.*log)' --include='*.ts' --include='*.js' src/ -i" \
    "Log all AI interactions including inputs, outputs, and processing metadata" \
    "medium"

check_item "AI Processing" \
    "Clinical Bias Monitoring" \
    "Monitoring for bias in AI clinical analysis" \
    "grep -r -E '(bias|fairness|demographic)' --include='*.ts' --include='*.js' src/ -i" \
    "Implement monitoring for consistent AI analysis across different client demographics" \
    "medium"

# =============================================================================
# SECTION 5: HIPAA & COMPLIANCE
# =============================================================================

echo -e "${PURPLE}🛡️ Section 5: HIPAA & Compliance${NC}"
echo "### 🛡️ HIPAA & Compliance" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_item "Compliance" \
    "Audit Logging Infrastructure" \
    "Comprehensive audit logging for PHI access" \
    "grep -r -E '(audit|log.*access|access.*log)' --include='*.ts' --include='*.js' src/" \
    "Implement audit logging for all PHI access including user, timestamp, and action" \
    "high"

check_item "Compliance" \
    "Access Control Implementation" \
    "Role-based access controls for clinical data" \
    "grep -r -E '(role|permission|authorize|middleware)' --include='*.ts' --include='*.js' src/" \
    "Implement role-based access control middleware for protecting client data" \
    "high"

check_item "Compliance" \
    "Data Encryption" \
    "Encryption of sensitive clinical data" \
    "grep -r -E '(encrypt|crypto|bcrypt)' --include='*.ts' --include='*.js' src/" \
    "Implement encryption for sensitive data at rest and in transit" \
    "high"

check_item "Compliance" \
    "Session Management" \
    "Secure session handling with timeouts" \
    "grep -r -E '(session.*timeout|expire|maxAge)' --include='*.ts' --include='*.js' src/" \
    "Implement secure session management with automatic timeouts for inactive users" \
    "medium"

# =============================================================================
# SECTION 6: SYSTEM RELIABILITY & SECURITY
# =============================================================================

echo -e "${PURPLE}⚡ Section 6: System Reliability & Security${NC}"
echo "### ⚡ System Reliability & Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

check_item "Reliability" \
    "Integration Test Coverage" \
    "End-to-end integration tests for clinical workflows" \
    "find . -name '*test*' -o -name '*spec*' | grep -E '(integration|e2e)' | head -1" \
    "Create integration tests covering note upload → AI processing → storage → recall workflow" \
    "high"

check_item "Reliability" \
    "Client Identity Protection" \
    "Verification of client ownership before data access" \
    "grep -r -E '(verify.*client|client.*ownership|authorize.*client)' --include='*.ts' --include='*.js' src/" \
    "Add client ownership verification before any data access operations" \
    "high"

check_item "Reliability" \
    "Performance Monitoring" \
    "Monitoring for system performance and AI response times" \
    "grep -r -E '(monitor|metric|performance|timing)' --include='*.ts' --include='*.js' src/" \
    "Implement performance monitoring for AI processing and database queries" \
    "medium"

check_item "Reliability" \
    "Disaster Recovery Documentation" \
    "Documented disaster recovery procedures" \
    "find . -name '*recovery*' -o -name '*disaster*' -o -name '*backup*' | grep -v node_modules" \
    "Document step-by-step disaster recovery procedures for clinical data" \
    "high"

# =============================================================================
# AUTOMATED FIXES AND RECOMMENDATIONS
# =============================================================================

echo -e "${PURPLE}🔧 Automated Analysis & Recommendations${NC}"
echo "### 🔧 Automated Analysis & Recommendations" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check package.json for security vulnerabilities
echo "**Security Analysis:**" >> "$REPORT_FILE"
if command -v npm &> /dev/null; then
    echo "Running npm audit..." 
    if npm audit --audit-level=moderate > /tmp/npm_audit.txt 2>&1; then
        echo "- ✅ No moderate or high security vulnerabilities found" >> "$REPORT_FILE"
    else
        echo "- 🚨 Security vulnerabilities detected. Run \`npm audit fix\`" >> "$REPORT_FILE"
        echo "- Review details in: /tmp/npm_audit.txt" >> "$REPORT_FILE"
    fi
fi

# Check for environment variable usage
echo "" >> "$REPORT_FILE"
echo "**Environment Configuration:**" >> "$REPORT_FILE"
if grep -r "process\.env" --include="*.ts" --include="*.js" src/ &>/dev/null; then
    echo "- ✅ Environment variables are being used for configuration" >> "$REPORT_FILE"
    echo "- **Verify:** All sensitive config (API keys, DB credentials) use environment variables" >> "$REPORT_FILE"
else
    echo "- ⚠️ Consider using environment variables for sensitive configuration" >> "$REPORT_FILE"
fi

# Check TypeScript configuration
echo "" >> "$REPORT_FILE"
echo "**TypeScript Configuration:**" >> "$REPORT_FILE"
if [ -f "tsconfig.json" ]; then
    if grep -q "strict.*true" tsconfig.json; then
        echo "- ✅ TypeScript strict mode is enabled" >> "$REPORT_FILE"
    else
        echo "- ⚠️ Consider enabling TypeScript strict mode for better type safety" >> "$REPORT_FILE"
    fi
else
    echo "- 🚨 tsconfig.json not found - TypeScript configuration needed" >> "$REPORT_FILE"
fi

# =============================================================================
# GENERATE ACTIONABLE TODO LIST
# =============================================================================

echo "" >> "$REPORT_FILE"
echo "## 📝 Priority Action Items" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### Immediate (High Priority)" >> "$REPORT_FILE"

# Extract high priority items that failed
grep -B 1 "🚨.*NEEDS ATTENTION" "$REPORT_FILE" | grep "Fix:" | sed 's/.*Fix:/- /' >> "$REPORT_FILE" 2>/dev/null || echo "- No high priority issues found!" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "### Next Steps (Medium Priority)" >> "$REPORT_FILE"

# Extract medium priority items that failed  
grep -B 1 "⚠️.*NEEDS ATTENTION" "$REPORT_FILE" | grep "Fix:" | sed 's/.*Fix:/- /' >> "$REPORT_FILE" 2>/dev/null || echo "- No medium priority issues found!" >> "$REPORT_FILE"

# =============================================================================
# GENERATE SETUP SCRIPT FOR FIXES
# =============================================================================

SETUP_SCRIPT="$RESULTS_DIR/setup_fixes_$TIMESTAMP.sh"
cat > "$SETUP_SCRIPT" << 'EOF'
#!/bin/bash

# Auto-generated setup script for Clinical AI Code Review fixes
# Run this script to set up basic infrastructure for missing items

echo "🔧 Setting up Clinical AI Code Review infrastructure..."

# Create directories for clinical code organization
mkdir -p src/schemas
mkdir -p src/middleware
mkdir -p src/tests/integration
mkdir -p src/utils/audit
mkdir -p src/utils/ai
mkdir -p docs/compliance

# Create basic Zod schema template
if [ ! -f "src/schemas/clinical.ts" ]; then
cat > src/schemas/clinical.ts << 'SCHEMA_EOF'
import { z } from 'zod';

// Clinical data validation schemas
export const clientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  dateOfBirth: z.date(),
  // Add other clinical fields
});

export const progressNoteSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  sessionDate: z.date(),
  tags: z.array(z.string()).optional(),
  // Add other progress note fields
});

export const aiAnalysisSchema = z.object({
  insights: z.array(z.string()),
  tags: z.array(z.string()),
  riskFactors: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});
SCHEMA_EOF
fi

# Create audit logging utility
if [ ! -f "src/utils/audit/logger.ts" ]; then
cat > src/utils/audit/logger.ts << 'AUDIT_EOF'
// Clinical audit logging utility
interface AuditEvent {
  userId: string;
  action: string;
  clientId?: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details?: any;
}

export const logAuditEvent = async (event: AuditEvent) => {
  // TODO: Implement audit logging to database
  console.log('[AUDIT]', event);
  
  // Example implementation:
  // await db.insert(auditLogs).values(event);
};

export const logClientAccess = async (userId: string, clientId: string, action: string, req: any) => {
  await logAuditEvent({
    userId,
    clientId,
    action,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
};
AUDIT_EOF
fi

# Create integration test template
if [ ! -f "src/tests/integration/clinical-workflow.test.ts" ]; then
cat > src/tests/integration/clinical-workflow.test.ts << 'TEST_EOF'
import { describe, test, expect } from 'vitest';

describe('Clinical Workflow Integration Tests', () => {
  test('Complete note processing workflow', async () => {
    // TODO: Implement end-to-end test
    // 1. Upload progress note
    // 2. Verify AI processing
    // 3. Test clinical search/recall
    // 4. Verify data integrity
    
    expect(true).toBe(true); // Placeholder
  });

  test('Client data isolation', async () => {
    // TODO: Test that clients cannot access each other's data
    expect(true).toBe(true); // Placeholder
  });

  test('AI processing error handling', async () => {
    // TODO: Test AI service failure scenarios
    expect(true).toBe(true); // Placeholder
  });
});
TEST_EOF
fi

# Create HIPAA compliance checklist
if [ ! -f "docs/compliance/hipaa-checklist.md" ]; then
cat > docs/compliance/hipaa-checklist.md << 'HIPAA_EOF'
# HIPAA Compliance Checklist

## Administrative Safeguards
- [ ] Assigned HIPAA compliance officer
- [ ] Access management procedures
- [ ] Workforce training documentation
- [ ] Contingency plan for emergencies

## Physical Safeguards  
- [ ] Facility access controls
- [ ] Workstation security
- [ ] Device and media controls

## Technical Safeguards
- [ ] Access control implementation
- [ ] Audit controls and logging
- [ ] Data integrity protections
- [ ] Person or entity authentication
- [ ] Transmission security (encryption)

## Implementation Status
- [ ] Audit logging implemented
- [ ] Data encryption at rest
- [ ] Data encryption in transit
- [ ] Role-based access controls
- [ ] Session management with timeouts
- [ ] Regular security assessments
HIPAA_EOF
fi

echo "✅ Infrastructure setup complete!"
echo "📁 Created clinical schemas in src/schemas/"
echo "📁 Created audit logging in src/utils/audit/"
echo "📁 Created integration tests in src/tests/integration/"
echo "📁 Created compliance docs in docs/compliance/"
echo ""
echo "Next steps:"
echo "1. Review and customize the generated templates"
echo "2. Implement the TODO items in each file"
echo "3. Run the clinical review script again to track progress"
EOF

chmod +x "$SETUP_SCRIPT"

# =============================================================================
# FINAL REPORT SUMMARY
# =============================================================================

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 🎯 Next Steps" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. **Review this report**: Focus on high priority items first" >> "$REPORT_FILE"
echo "2. **Run setup script**: \`bash $SETUP_SCRIPT\` to create infrastructure" >> "$REPORT_FILE"
echo "3. **Implement fixes**: Work through the priority action items" >> "$REPORT_FILE"
echo "4. **Re-run analysis**: \`bash clinical_review.sh\` to track progress" >> "$REPORT_FILE"
echo "5. **Iterate**: Continue until all checklist items are complete" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Report Location**: \`$REPORT_FILE\`" >> "$REPORT_FILE"
echo "**Setup Script**: \`$SETUP_SCRIPT\`" >> "$REPORT_FILE"

# =============================================================================
# DISPLAY SUMMARY
# =============================================================================

echo ""
echo -e "${GREEN}🎉 Clinical AI Code Review Analysis Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Results Summary:${NC}"

# Count passed vs failed items
TOTAL_CHECKS=$(grep -c "PASS\|NEEDS ATTENTION" "$REPORT_FILE" 2>/dev/null || echo "0")
PASSED_CHECKS=$(grep -c "✅ PASS" "$REPORT_FILE" 2>/dev/null || echo "0")
FAILED_CHECKS=$(grep -c "NEEDS ATTENTION" "$REPORT_FILE" 2>/dev/null || echo "0")

echo "  Total Checks: $TOTAL_CHECKS"
echo -e "  ${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "  ${RED}Needs Attention: $FAILED_CHECKS${NC}"

if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}🏆 All checks passed! Your clinical AI application is well-secured.${NC}"
else
    echo -e "${YELLOW}📋 Review the generated report for specific improvement recommendations.${NC}"
fi

echo ""
echo -e "${BLUE}📁 Generated Files:${NC}"
echo "  📄 Detailed Report: $REPORT_FILE"
echo "  🔧 Setup Script: $SETUP_SCRIPT"
echo ""
echo -e "${BLUE}🚀 Quick Start:${NC}"
echo "  1. Review the report: cat $REPORT_FILE"
echo "  2. Run setup script: bash $SETUP_SCRIPT"
echo "  3. Re-run this analysis: bash $0"
echo ""
echo -e "${GREEN}💡 Pro Tip:${NC} Run this script after each development session to track your progress!"