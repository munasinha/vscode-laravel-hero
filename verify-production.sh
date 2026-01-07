#!/bin/bash

# Laravel Hero - Pre-Publication Verification Script
# Run this before publishing to ensure everything is ready

echo ""
echo "🔍 Laravel Hero - Production Readiness Verification"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0
CHECKS_PASSED=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 1. Check Node.js and npm
echo "📦 Checking Node.js Environment..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not installed"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not installed"
fi

echo ""

# 2. Check project structure
echo "📁 Checking Project Structure..."

files=(
    "package.json"
    "tsconfig.json"
    "webpack.config.js"
    "src/extension.ts"
    "README.md"
    "CHANGELOG.md"
    "CONTRIBUTING.md"
    "LICENSE"
    ".vscodeignore"
    ".gitignore"
    "media/icon.svg"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file exists"
    else
        check_fail "$file missing"
    fi
done

echo ""

# 3. Check build dependencies
echo "🔧 Checking Dependencies..."
if [ -d "node_modules" ]; then
    check_pass "node_modules exists"
else
    check_warn "node_modules not installed - run 'npm install'"
fi

echo ""

# 4. Check TypeScript compilation
echo "🔨 Checking TypeScript Compilation..."
if npm run compile > /tmp/compile.log 2>&1; then
    check_pass "TypeScript compiles successfully"
else
    check_fail "TypeScript compilation failed"
    echo "Error details:"
    tail -20 /tmp/compile.log
fi

echo ""

# 5. Check source files
echo "📝 Checking Source Files..."

src_files=(
    "src/extension.ts"
    "src/commands/registerCommands.ts"
    "src/providers/LaravelHeroSidebar.ts"
    "src/services/ArtisanService.ts"
    "src/services/LoggerService.ts"
    "src/services/WorkspaceService.ts"
    "src/webviews/MigrationPanel.ts"
    "src/webviews/lib/webviewUtils.ts"
    "src/utils/getNonce.ts"
)

for file in "${src_files[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file"
    else
        check_fail "$file missing"
    fi
done

echo ""

# 6. Check for legacy files
echo "🧹 Checking for Legacy Code..."

legacy_files=(
    "src/MigrationPanel.ts"
    "src/MainPanel.ts"
)

legacy_found=false
for file in "${legacy_files[@]}"; do
    if [ -f "$file" ]; then
        check_warn "Legacy file found: $file (should be deleted)"
        legacy_found=true
    fi
done

if [ "$legacy_found" = false ]; then
    check_pass "No legacy code found"
fi

echo ""

# 7. Check documentation
echo "📚 Checking Documentation..."

doc_checks=(
    "README.md"
    "CHANGELOG.md"
    "CONTRIBUTING.md"
)

for doc in "${doc_checks[@]}"; do
    if [ -f "$doc" ]; then
        lines=$(wc -l < "$doc")
        if [ "$lines" -gt 20 ]; then
            check_pass "$doc has content ($lines lines)"
        else
            check_warn "$doc exists but is very short"
        fi
    else
        check_fail "$doc missing"
    fi
done

echo ""

# 8. Check package.json
echo "📦 Checking package.json Configuration..."

# Check for required fields
if grep -q '"name"' package.json; then
    NAME=$(grep '"name"' package.json | head -1 | cut -d'"' -f4)
    check_pass "name field: $NAME"
fi

if grep -q '"publisher"' package.json; then
    PUBLISHER=$(grep '"publisher"' package.json | head -1 | cut -d'"' -f4)
    check_pass "publisher field: $PUBLISHER"
fi

if grep -q '"version"' package.json; then
    VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
    check_pass "version field: $VERSION"
fi

if grep -q '"license"' package.json; then
    LICENSE=$(grep '"license"' package.json | head -1 | cut -d'"' -f4)
    check_pass "license field: $LICENSE"
fi

echo ""

# 9. Check build output
echo "🎁 Checking Build Output..."

if [ -f "dist/extension.js" ]; then
    size=$(du -h "dist/extension.js" | cut -f1)
    check_pass "dist/extension.js exists ($size)"
else
    check_warn "dist/extension.js not found - run 'npm run compile'"
fi

echo ""

# 10. Check icon
echo "🎨 Checking Assets..."

if [ -f "media/icon.svg" ]; then
    check_pass "Icon exists: media/icon.svg"
    # Try to get dimensions if imagemagick is installed
    if command -v identify &> /dev/null; then
        dims=$(identify -verbose "media/icon.svg" 2>/dev/null | grep -i geometry | head -1)
        if [ -n "$dims" ]; then
            check_info "Icon dimensions: $dims"
        fi
    fi
else
    check_fail "Icon missing: media/icon.svg"
fi

if [ -f "media/logo.png" ]; then
    check_pass "Logo exists: media/logo.png"
else
    check_warn "Logo missing: media/logo.png (recommended for marketplace)"
fi

echo ""

# 11. Summary
echo "=================================================="
echo "📊 Verification Summary"
echo "=================================================="
echo -e "✓ Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "⚠ Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "✗ Errors: ${RED}$ERRORS${NC}"

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    echo ""
    echo "Your extension is ready to:"
    echo "  1. Package: npm run package"
    echo "  2. Test locally: code --extensionDevelopmentPath=. /path/to/laravel/project"
    echo "  3. Publish: vsce publish"
    exit 0
else
    echo -e "${RED}❌ Please fix the errors above before publishing.${NC}"
    exit 1
fi
