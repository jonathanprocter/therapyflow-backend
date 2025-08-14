#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}========================================${NC}"
echo -e "${CYAN}${BOLD}   Project Dependency Analyzer${NC}"
echo -e "${CYAN}${BOLD}========================================${NC}\n"

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
        return 0
    else
        echo -e "${RED}✗${NC} Not found: $1"
        return 1
    fi
}

# Function to extract version from package.json
get_version() {
    local pkg=$1
    local file=$2
    if [ -f "$file" ]; then
        version=$(node -pe "
            try {
                const pkg = require('$file');
                const dep = (pkg.dependencies && pkg.dependencies['$pkg']) || 
                           (pkg.devDependencies && pkg.devDependencies['$pkg']) || 
                           (pkg.peerDependencies && pkg.peerDependencies['$pkg']);
                dep || 'not found';
            } catch(e) { 'error'; }
        " 2>/dev/null)
        echo "$version"
    else
        echo "file not found"
    fi
}

# Check installed version
get_installed_version() {
    local pkg=$1
    local dir=$2
    if [ -d "$dir/node_modules/$pkg" ] && [ -f "$dir/node_modules/$pkg/package.json" ]; then
        version=$(node -pe "require('$dir/node_modules/$pkg/package.json').version" 2>/dev/null)
        echo "$version"
    else
        echo "not installed"
    fi
}

echo -e "${BLUE}${BOLD}1. Project Structure Analysis${NC}"
echo "----------------------------------------"

# Check for key files
check_file "package.json"
check_file "client/package.json"
check_file "server/package.json"
check_file "vite.config.js"
check_file "vite.config.ts"
check_file "client/vite.config.js"
check_file "client/vite.config.ts"
check_file "postcss.config.js"
check_file "client/postcss.config.js"
check_file "tailwind.config.js"
check_file "client/tailwind.config.js"

echo -e "\n${BLUE}${BOLD}2. Dependency Versions${NC}"
echo "----------------------------------------"

# Check root dependencies
echo -e "${YELLOW}Root package.json:${NC}"
echo "  Vite: $(get_version 'vite' './package.json') (installed: $(get_installed_version 'vite' '.'))"
echo "  @tailwindcss/vite: $(get_version '@tailwindcss/vite' './package.json') (installed: $(get_installed_version '@tailwindcss/vite' '.'))"
echo "  tailwindcss: $(get_version 'tailwindcss' './package.json') (installed: $(get_installed_version 'tailwindcss' '.'))"
echo "  pdf-parse: $(get_version 'pdf-parse' './package.json') (installed: $(get_installed_version 'pdf-parse' '.'))"
echo "  postcss: $(get_version 'postcss' './package.json') (installed: $(get_installed_version 'postcss' '.'))"

# Check client dependencies
if [ -f "client/package.json" ]; then
    echo -e "\n${YELLOW}Client package.json:${NC}"
    echo "  Vite: $(get_version 'vite' './client/package.json') (installed: $(get_installed_version 'vite' './client'))"
    echo "  @tailwindcss/vite: $(get_version '@tailwindcss/vite' './client/package.json') (installed: $(get_installed_version '@tailwindcss/vite' './client'))"
    echo "  tailwindcss: $(get_version 'tailwindcss' './client/package.json') (installed: $(get_installed_version 'tailwindcss' './client'))"
    echo "  postcss: $(get_version 'postcss' './client/package.json') (installed: $(get_installed_version 'postcss' './client'))"
fi

echo -e "\n${BLUE}${BOLD}3. Tailwind Usage Analysis${NC}"
echo "----------------------------------------"

# Check for Tailwind imports in CSS files
echo -e "${YELLOW}Checking for Tailwind directives in CSS files:${NC}"
tailwind_in_css=false
for css_file in $(find . -name "*.css" -not -path "./node_modules/*" 2>/dev/null | head -10); do
    if grep -q "@tailwind\|@apply\|@layer" "$css_file" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Found Tailwind in: $css_file"
        tailwind_in_css=true
    fi
done

if [ "$tailwind_in_css" = false ]; then
    echo -e "  ${RED}✗${NC} No Tailwind directives found in CSS files"
fi

# Check for Tailwind classes in JSX/TSX files
echo -e "\n${YELLOW}Checking for Tailwind classes in React components:${NC}"
tailwind_classes_found=false
sample_count=0
for jsx_file in $(find . -name "*.jsx" -o -name "*.tsx" -not -path "./node_modules/*" 2>/dev/null | head -20); do
    if grep -qE "className=[\"'][^\"']*\b(flex|grid|p-|m-|bg-|text-|border-|rounded|shadow|hover:|focus:)" "$jsx_file" 2>/dev/null; then
        if [ $sample_count -lt 3 ]; then
            echo -e "  ${GREEN}✓${NC} Found Tailwind classes in: $jsx_file"
            sample_count=$((sample_count + 1))
        fi
        tailwind_classes_found=true
    fi
done

if [ "$tailwind_classes_found" = true ] && [ $sample_count -eq 3 ]; then
    echo -e "  ${CYAN}... and more files${NC}"
elif [ "$tailwind_classes_found" = false ]; then
    echo -e "  ${RED}✗${NC} No Tailwind classes found in React components"
fi

echo -e "\n${BLUE}${BOLD}4. Vite Configuration Analysis${NC}"
echo "----------------------------------------"

# Check Vite config for Tailwind plugin
check_vite_config() {
    local config_file=$1
    if [ -f "$config_file" ]; then
        echo -e "${YELLOW}Analyzing $config_file:${NC}"
        if grep -q "@tailwindcss/vite" "$config_file" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Uses @tailwindcss/vite plugin"
            return 0
        else
            echo -e "  ${CYAN}ℹ${NC} Does not use @tailwindcss/vite plugin"
            return 1
        fi
    fi
    return 1
}

vite_plugin_used=false
check_vite_config "vite.config.js" && vite_plugin_used=true
check_vite_config "vite.config.ts" && vite_plugin_used=true
check_vite_config "client/vite.config.js" && vite_plugin_used=true
check_vite_config "client/vite.config.ts" && vite_plugin_used=true

echo -e "\n${BLUE}${BOLD}5. PDF-Parse Usage Analysis${NC}"
echo "----------------------------------------"

pdf_parse_needed=false
echo -e "${YELLOW}Checking for pdf-parse usage in code:${NC}"
for js_file in $(find . -name "*.js" -o -name "*.ts" -not -path "./node_modules/*" 2>/dev/null); do
    if grep -q "pdf-parse\|pdfParse" "$js_file" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} pdf-parse used in: $js_file"
        pdf_parse_needed=true
        break
    fi
done

if [ "$pdf_parse_needed" = false ]; then
    echo -e "  ${CYAN}ℹ${NC} No direct pdf-parse usage found (may be optional dependency)"
fi

echo -e "\n${BLUE}${BOLD}6. Recommendations${NC}"
echo "----------------------------------------"

# Determine the best option
root_vite=$(get_installed_version 'vite' '.')
client_vite=$(get_installed_version 'vite' './client')
has_tailwind_plugin=$(get_installed_version '@tailwindcss/vite' '.')
has_postcss=$(get_installed_version 'postcss' '.')

echo -e "${GREEN}${BOLD}Analysis Summary:${NC}"
echo "  • Tailwind CSS in use: $([ "$tailwind_in_css" = true ] || [ "$tailwind_classes_found" = true ] && echo "Yes" || echo "No")"
echo "  • Vite plugin actively used: $([ "$vite_plugin_used" = true ] && echo "Yes" || echo "No")"
echo "  • PostCSS available: $([ "$has_postcss" != "not installed" ] && echo "Yes" || echo "No")"
echo "  • PDF-parse needed: $([ "$pdf_parse_needed" = true ] && echo "Yes" || echo "Probably")"

echo -e "\n${GREEN}${BOLD}🎯 Recommended Solution:${NC}"

if [ "$vite_plugin_used" = false ]; then
    echo -e "${CYAN}${BOLD}Option 2 or 3: Remove @tailwindcss/vite${NC}"
    echo "  The @tailwindcss/vite plugin is not being used in your Vite config."
    echo ""
    echo "  ${BOLD}Run these commands:${NC}"
    echo "    npm uninstall @tailwindcss/vite"
    if [ "$has_postcss" = "not installed" ] || [ "$tailwind_in_css" = true ] || [ "$tailwind_classes_found" = true ]; then
        echo "    npm install -D tailwindcss postcss autoprefixer"
        echo "    npx tailwindcss init -p  # Creates postcss.config.js"
    fi
    echo "    npm install pdf-parse"
    echo "    npx update-browserslist-db@latest"
elif [[ "$root_vite" == 7.* ]] || [[ "$client_vite" == 7.* ]]; then
    echo -e "${CYAN}${BOLD}Option 1: Downgrade Vite to v6${NC}"
    echo "  You're using Vite 7 with @tailwindcss/vite which only supports Vite 5-6."
    echo ""
    echo "  ${BOLD}Run these commands:${NC}"
    echo "    npm install vite@^6.5.0 --save-dev"
    if [ -f "client/package.json" ]; then
        echo "    cd client && npm install vite@^6.5.0 --save-dev && cd .."
    fi
    echo "    npm install pdf-parse"
    echo "    npx update-browserslist-db@latest"
else
    echo -e "${CYAN}${BOLD}Direct fix: Install missing dependencies${NC}"
    echo ""
    echo "  ${BOLD}Run these commands:${NC}"
    echo "    npm install pdf-parse --legacy-peer-deps"
    echo "    npx update-browserslist-db@latest"
fi

echo -e "\n${YELLOW}${BOLD}Additional Notes:${NC}"
echo "  • The client dev server switched to port 3001 (port 3000 in use)"
echo "  • After fixing, restart with: npm run dev"
echo ""