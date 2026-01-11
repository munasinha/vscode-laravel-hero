# Contributing to Laravel Hero

Thank you for your interest in contributing to Laravel Hero! We welcome contributions from everyone. This document provides guidelines and instructions for contributing.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Submitting Changes](#submitting-changes)
7. [Pull Request Process](#pull-request-process)
8. [Reporting Issues](#reporting-issues)

---

### Our Pledge
- Be respectful and inclusive
- Welcome people from all backgrounds
- Focus on constructive feedback
- Respect differing opinions

---

## Getting Started

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Visual Studio Code**: 1.107.0 or higher
- **Git**: Latest version
- **PHP**: 8.0+ (for testing Laravel commands)
- **Laravel**: 8.0+ project (for testing features)

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/munasinha/vscode-laravel-hero.git
cd laravel-hero

# Install dependencies
npm install

# Open in VS Code
code .

# Start development mode (watch & compile)
npm run watch
```

### Running the Extension in Development

1. Press **F5** in VS Code to open Extension Development Host
2. A new VS Code window will open with the extension loaded
3. Open a Laravel project folder in the development window
4. Click the Laravel Hero icon in Activity Bar to test

---

## Development Workflow

### Project Structure

```
src/
├── extension.ts              # Extension entry point
├── commands/                 # Command implementations
│   └── registerCommands.ts   # Command registration
├── providers/                # Data providers
│   └── LaravelHeroSidebar.ts # Sidebar menu provider
├── webviews/                 # Webview panels
│   ├── overview-panel/       # Project overview UI
│   ├── migration-panel/      # Migrations UI
│   ├── routes-panel/         # Routes UI
│   ├── packages-panel/       # Packages UI
│   └── model-graph-panel/    # Model relationship UI
│   └── lib/
│       └── webviewUtils.ts   # Shared utilities
├── services/                 # Business logic
│   ├── ArtisanService.ts     # Artisan command execution (migrations/routes)
│   ├── ComposerService.ts    # Composer data (packages/outdated)
│   ├── OverviewService.ts    # Project health + maintenance shortcuts
│   ├── WorkspaceService.ts   # Workspace management
│   ├── ModelGraphService.ts  # Eloquent model discovery and relationships
│   └── LoggerService.ts      # Unified logging
└── utils/                    # Utilities
    └── getNonce.ts           # Security utilities
```

### Adding a New Feature

#### Example: Adding a Routes Panel (Phase 2)

1. **Create the service** (`src/services/RoutesService.ts`):
```typescript
import { ArtisanService } from './ArtisanService';
import { LoggerService } from './LoggerService';

export interface RouteInfo {
  method: string;
  path: string;
  name: string;
  action: string;
}

export class RoutesService {
  async getRoutes(): Promise<RouteInfo[]> {
    LoggerService.info('Fetching routes...');
    // Implementation here
  }
}
```

2. **Create the webview** (`src/webviews/RoutesPanel.ts`):
```typescript
import * as vscode from 'vscode';
import { RoutesService } from '../services/RoutesService';
import { WebviewUtils } from './lib/webviewUtils';

export class RoutesPanel {
  public static currentPanel: RoutesPanel | undefined;
  // Implementation following MigrationPanel pattern
}
```

3. **Register the command** (update `src/commands/registerCommands.ts`):
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('laravel-hero.open-routes', () => {
    LoggerService.info('open-routes command triggered');
    RoutesPanel.createOrShow(context.extensionUri);
  })
);
```

4. **The sidebar item already exists** in `LaravelHeroSidebar.ts` - it will automatically work!

### Key Architecture Patterns

#### Service Layer Pattern
- All external command execution goes through services
- Services handle errors and logging
- Webviews never directly execute artisan commands

#### Provider Pattern
- `TreeDataProvider` for sidebar menu
- Easy to extend with new menu items

#### Message Passing Pattern
- Webviews communicate via `postMessage`
- Extension handles confirmations and modals
- Type-safe message handling with switch statements

#### Search & Sort Pattern
- Client-side filtering for performance
- Preserve original data, work with copies
- Use visual indicators for state (↑↓ arrows)

#### Modal Dialog Pattern
- Show/hide modals via CSS class toggle
- Always provide cancel/escape option
- Handle focus management for accessibility

---

## Current Architecture - Advanced Features

### Project Structure (simplified)

```
src/
├── extension.ts
├── commands/registerCommands.ts
├── providers/LaravelHeroSidebar.ts
├── webviews/
│   ├── overview-panel/  # HTML/CSS/JS + TS controller
│   ├── migration-panel/   # HTML/CSS/JS + TS controller
│   ├── routes-panel/      # HTML/CSS/JS + TS controller
│   ├── packages-panel/    # HTML/CSS/JS + TS controller
│   └── model-graph-panel/ # HTML/CSS/JS + TS controller
├── services/
│   ├── ArtisanService.ts  # migrations + routes (route:list) helpers
│   ├── ComposerService.ts # composer.lock + composer outdated helpers
│   ├── ModelGraphService.ts # model discovery and relationships
│   ├── OverviewService.ts # environment snapshot + maintenance commands
│   ├── WorkspaceService.ts
│   └── LoggerService.ts
└── utils/getNonce.ts
```

### Migration Panel Structure (v0.1.1+)

Foldered webview with `index.ts`, `template.html`, `styles.css`, `script.js` mirroring the separation of concerns pattern also used by routes.

### Routes Panel Structure (v0.2.0+)

Mirrors the migration panel:
```
src/webviews/routes-panel/
├── index.ts      # Loads routes, handles clipboard
├── template.html # Header + responsive table
├── styles.css    # VS Code-themed, responsive wrapping
└── script.js     # Search, sort, middleware toggle, copy URL
```

### Overview Dashboard (v0.6.0)

- Dashboard-style webview showing project name, environment, Laravel + PHP versions
- Database and cache connection checks performed via safe PHP snippets (bootstrap + DB/cache ping)
- Curated maintenance commands (config cache/clear, optimize, cache/route/view clear) with disabled buttons + spinner while running
- Reuses shared alert banners for warnings/errors and mirrors the card/button styling of other panels

**Routes behaviors**
- Loads routes via `ArtisanService.getRoutes()` (JSON first, table fallback)
- Normalizes methods (splits GET|HEAD and concatenated tokens)
- Middleware chips show class name; click to expand full namespace
- Copy URL posts `copy-text` to the extension clipboard handler
- Export CSV posts `export-csv` to the extension for saving the current list
- Responsive table with horizontal scroll on narrow widths, sticky headers, and wrapping for middleware/URLs

### Recent Features (v0.2.0)

#### Routes Viewer
- Full routes table with method, URI, name, permissions, middleware, full URL
- Client-side search and sort across all columns
- Copy full URL from the table
- Middleware chips toggle between short class and full namespace
- Responsive table for long strings

### Recent Features (v0.2.1)

#### Packages Viewer
- Reads installed packages from `composer.lock` (prod + dev)
- Attempts `composer outdated --direct --format=json` to flag updates (warns gracefully if it fails)
- Flags deprecated/abandoned packages and shows replacements when provided
- Client-side search/sort across name, version, latest, type, status, description
- One-click Packagist link for each package
- Responsive table tuned for long descriptions and small screens

### Recent Features (v0.4.0)

#### Model Relationship Graph
- Scans for classes extending `Illuminate\Database\Eloquent\Model` or `Authenticatable`
- Detects relationships (one-to-one, one-to-many, many-to-many, through, polymorphic) and labels edges
- Webview supports drag, pan, zoom (wheel + floating buttons), center/reset, and optional overlap toggle
- Layout centers high-degree nodes and separates isolates; positions persist across sessions
- Double-click nodes to open files; search by model name/namespace/relation type

### Recent Features (v0.5.0)

#### Model Relationship Graph Polish
- Single label per relationship line with inline cardinality badges (`1` / `∞`) indicating direction
- Collision avoidance always on; overlap toggle removed
- Large-graph grid sizing with pan/zoom controls living on the canvas
- Search keeps matched models as primary (not referenced) and shows only first-degree neighbors/edges

### Recent Features (v0.1.1)

#### Search Implementation
```javascript
// In script.js
searchMigrations(query: string): void
  ├─ Filter migrations array
  ├─ Show/hide rows in DOM
  └─ Update result counter
```

Features:
- Real-time filtering as user types
- Case-insensitive matching
- Searches: name, status, batch number
- Visual feedback with result count

#### Sorting Implementation
```javascript
// In script.js
sortMigrations(column: string): void
  ├─ Clone migrations array
  ├─ Sort by column value
  ├─ Reverse if clicking same column
  └─ Re-render with visual indicator
```

Key Points:
- Original index persists (doesn't change with sort)
- Visual indicators (↑↓) show sort state
- Supports: Index, Name, Status, Batch
- Click column to sort, click again to reverse

#### File Navigation
```typescript
// In index.ts
_openMigrationFile(migrationName: string): Promise<void>
  ├─ Validate workspace exists
  ├─ Construct file path
  ├─ Check file exists
  ├─ Open in editor
  └─ Log operation
```

#### Rollback Feature
```typescript
// In index.ts - Two modes:

1. Rollback All (with modal):
   _rollbackAllMigrations(steps: number | null): Promise<void>
     ├─ Show confirmation dialog
     ├─ Execute php artisan migrate:rollback [--step=N]
     └─ Refresh list

2. Rollback Individual:
   _rollbackMigration(name: string): Promise<void>
     ├─ Show confirmation dialog
     ├─ Execute php artisan migrate:rollback --path=...
     └─ Refresh list
```

---

## Coding Standards

### TypeScript

- Use **strict mode** (tsconfig.json enforces this)
- Always specify types explicitly
- Avoid `any` type unless absolutely necessary

```typescript
// ✅ Good
async function getMigrations(): Promise<MigrationStatus[]> {
  const result: MigrationStatus[] = [];
  return result;
}

// ❌ Bad
async function getMigrations(): Promise<any> {
  const result: any = [];
  return result;
}
```

### Naming Conventions

- **Classes**: PascalCase (`MigrationPanel`, `ArtisanService`)
- **Methods/Functions**: camelCase (`getMigrations()`, `runMigration()`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT = 5000`)
- **Private members**: Prefix with underscore (`_panel`, `_disposables`)
- **Interfaces**: Prefix with I or suffix with type (`MigrationStatus`, `RouteInfo`)

### Comments & Documentation

```typescript
/**
 * Run a specific migration.
 * @param migrationName - The name of the migration to run
 * @param force - Whether to force run an already-executed migration
 * @throws Error if migration file not found
 */
public async runMigration(migrationName: string, force: boolean = false): Promise<void> {
  // Implementation
}
```

### Error Handling

```typescript
// ✅ Good - Provide context
try {
  await this.runMigration(name, force);
  vscode.window.showInformationMessage(`✓ Migration '${name}' completed`);
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  LoggerService.error(`Failed to run migration: ${name}`, err);
  vscode.window.showErrorMessage(`Migration failed: ${errorMsg}`);
}

// ❌ Bad - Silent failure
try {
  await this.runMigration(name, force);
} catch (err) {
  // Do nothing
}
```

### Code Formatting

- Use **2 spaces** for indentation
- ESLint config enforces this automatically
- Run `npm run lint` before committing

```bash
npm run lint              # Check for issues
npm run lint -- --fix     # Auto-fix issues
```

---

## Testing

### Manual Testing Checklist

Before submitting any changes, test:

```
Sidebar & Commands
☐ Sidebar loads without errors
☐ Migrations button shows in sidebar
☐ Routes button shows
☐ Packages button shows
☐ Click each button opens the right panel

Migrations Panel
☐ Panel opens when clicking Migrations
☐ Table displays all migrations
☐ Status shows correctly (✓ Migrated / ○ Pending)
☐ Batch numbers display correctly

Migration Actions
☐ Run button works on pending migration
☐ Shows confirmation dialog
☐ Migration executes on confirmation
☐ Table refreshes after run
☐ Force Run button works
☐ Run All button works
☐ Force Run All works

Create Migration
☐ Create button shows input dialog
☐ Name validation works
☐ Migration file created successfully
☐ New migration appears in table
☐ Marked as Pending

Error Handling
☐ Shows error if no workspace open
☐ Shows error if Laravel not found
☐ Shows error if composer install needed
☐ Shows error if PHP not found
☐ Check Output channel for logs

Settings
☐ Custom PHP path setting works
☐ Commands execute with custom PHP
☐ Settings persist across sessions

Routes Panel
☐ Routes load (or warning shown) with methods, URI, name, middleware, permissions, full URL
☐ Search and sort work across all columns
☐ Middleware chips toggle between short and full namespaces
☐ Copy URL posts to clipboard
☐ Export CSV saves the current filtered list

Packages Panel
☐ Packages load from composer.lock (prod + dev)
☐ Warning shows if composer outdated cannot run; data still displays
☐ Status chips show Update available / Deprecated / Up to date / dev
☐ Search and sort work across columns
☐ Packagist link opens in browser
☐ Long descriptions don’t break row alignment on small screens
```

### Automated Testing (Future)

We plan to add Jest/Mocha tests. For now:

```bash
npm run lint      # Lint check
npm run compile   # TypeScript compilation
```

---

## Submitting Changes

### Before You Start

1. **Check existing issues** - Avoid duplicate work
2. **Create an issue first** for large features
3. **Discuss design** in the issue before coding
4. **Get feedback** from maintainers

### Branching Strategy

```bash
# For features
git checkout -b feature/your-feature-name
git checkout -b feature/routes-viewer

# For bug fixes
git checkout -b bugfix/issue-description
git checkout -b bugfix/csp-modal-blocking

# For documentation
git checkout -b docs/update-readme
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

Body explaining the change...

Closes #123
```

Examples:
```
feat(migrations): add force run all button
fix(artisan): handle missing migrations directory gracefully
docs(readme): update installation instructions
refactor(services): extract common error handling
test(integration): add migration panel tests
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

---

## Pull Request Process

### Before Opening a PR

1. **Update your branch** with latest main:
```bash
git fetch origin
git rebase origin/main
```

2. **Run tests** and linting:
```bash
npm run lint
npm run compile
```

3. **Test manually** using the checklist above

4. **Update documentation** if needed:
   - README.md for user-facing changes
   - ARCHITECTURE.md for structural changes
   - CHANGELOG.md (maintainers will do this)

### Opening the PR

1. **Clear title**: Describe what the PR does
   ```
   ✅ Good: "Add routes viewer panel with filtering"
   ❌ Bad: "Update code" or "Fix stuff"
   ```

2. **Description should include**:
   - What problem does it solve?
   - How does it solve it?
   - Any breaking changes?
   - Screenshots (if UI changes)
   - Testing steps

3. **Example PR description**:
```markdown
## Description
Adds a new Routes panel to view and filter Laravel routes.

## Problem
Users had no way to see routes without leaving VS Code.

## Solution
- Created RoutesService to fetch routes via artisan
- Built RoutesPanel webview with filtering UI
- Integrated into sidebar menu

## Testing
1. Click "Routes" in sidebar
2. See all app routes in table
3. Filter by method/path
4. Click route to see details

## Checklist
- [x] Tests pass
- [x] Linting passes
- [x] Documentation updated
- [x] No breaking changes
```

### PR Review Process

- **At least 1 approval** required before merge
- **All checks must pass**:
  - Linting
  - Compilation
  - Code review
- **Feedback will be constructive** and collaborative
- **May request changes** - this is normal!

---

## Reporting Issues

### Before Reporting

1. **Check existing issues** - Your issue might already be reported
2. **Try the latest version** - It might be fixed
3. **Gather information**:
   - VS Code version
   - Laravel version
   - PHP version
   - Extension version
   - Exact steps to reproduce

### Creating an Issue

Use the issue template. Include:

```markdown
## Description
Brief description of the issue.

## Expected Behavior
What should happen?

## Actual Behavior
What actually happens?

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Environment
- VS Code: 1.107.0
- Laravel: 10.0
- PHP: 8.2
- Extension: 0.1.0

## Logs
Share output from "Laravel Hero" output channel (View → Output).

## Screenshots
If applicable, add screenshots showing the issue.
```

### Issue Types

- **Bug**: Something is broken
- **Feature Request**: New functionality
- **Enhancement**: Improve existing feature
- **Documentation**: Docs need updating
- **Question**: Need help or clarification

---

## Resources

### Learning Resources
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Laravel Artisan Documentation](https://laravel.com/docs/artisan)

### Communication
- **GitHub Discussions**: Ask questions
- **GitHub Issues**: Report bugs
- **Pull Requests**: Discuss implementations

### Getting Help
1. Check documentation first
2. Search existing issues
3. Ask in GitHub Discussions
4. Open an issue with your question

---

## Maintainers

- **Primary**: [Navod Rashmika](@munasinha)
- **Contributors**: All amazing people in CONTRIBUTORS.md

Thank you for contributing to Laravel Hero! 🚀
