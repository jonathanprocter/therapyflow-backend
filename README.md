# CareNotes AI - Enhanced Design System

## 🌿 Sage Theme Implementation

A modern, calming interface designed for mental health professionals.

### Quick Start
```bash
# Install dependencies
npm install

# Run development server
./start-carenotes.sh

# Or manually
npm run dev
npm run dev &
DEV_PID=$!
sleep 5

# Check if dev server started
if ps -p $DEV_PID > /dev/null; then
    log_success "Development server running (PID: $DEV_PID)"
    kill $DEV_PID
else
    log_warning "Development server test failed"
fi

# ============================================
# GENERATE README
# ============================================

log_section "GENERATING README"

cat > README.md << 'READMEEOF'
# 🌿 CareNotes AI - Sage Theme Edition

A beautiful, sage-themed mental health documentation assistant with glass morphism design.

## Quick Start

\`\`\`bash
./start-carenotes.sh
\`\`\`

### Design System Components

#### UI Components
- **GlassCard** - Glass morphism cards with blur effects
- **FloatingOrb** - Animated background orbs for depth
- **SkeletonLoader** - Elegant loading states

#### Layout Components
- **PageWrapper** - Consistent page layout with animations
- **Grid** - Responsive grid system with stagger animations

#### Dashboard Components
- **StatsCard** - Animated statistics displays

### Color Palette
- Primary: Sage (#8B9F87)
- Accent Blue: #7A95B0
- Accent Amber: #C4A464
- Accent Rose: #B08585

### View Demo
Navigate to \`/design-demo\` to see all components in action.

### Scripts
- \`enhanced-preflight.sh\` - System setup and optimization
- \`audit-color-scheme.sh\` - Apply sage color scheme
- \`start-carenotes.sh\` - Quick start development

### File Structure
\`\`\`
client/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   └── animations/
│   ├── hooks/
│   ├── lib/
│   │   └── utils/
│   └── styles/
\`\`\`

Built with ❤️ for mental health professionals
