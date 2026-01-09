# Laravel Hero Architecture

This document describes the technical architecture, design patterns, and implementation details of the Laravel Hero extension.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Design Patterns](#design-patterns)
5. [Data Flow](#data-flow)
6. [Security Considerations](#security-considerations)
7. [Extension Points](#extension-points)
8. [Performance Considerations](#performance-considerations)

---

## Overview

Laravel Hero is a VS Code extension that provides Laravel developers with an integrated IDE interface for managing migrations, routes, and packages.

### Key Design Principles

- **Separation of Concerns**: UI logic separated from business logic
- **Extensibility**: Easy to add new features (Routes, Packages, etc.)
- **User Experience**: Native VS Code look and feel
- **Error Handling**: Graceful degradation with helpful error messages
- **Logging**: Comprehensive logging for debugging
- **Security**: Safe CSP policies and no inline code execution

---

## Project Structure

```
src/
├── extension.ts                          # Extension activation entry point
│
├── commands/
│   └── registerCommands.ts               # All extension commands registration
│       ├── laravel-hero.openView
│       ├── laravel-hero.open-migrations
│       ├── laravel-hero.open-routes
│       ├── laravel-hero.open-packages
│       ├── laravel-hero.open-model-graph
│       └── laravel-hero.showOutput
│
├── providers/
│   └── LaravelHeroSidebar.ts             # TreeDataProvider for sidebar menu
│       ├── SidebarItem (extends TreeItem)
│       ├── getChildren()        → Migrations, Routes, Packages, Model Graph
│       ├── getTreeItem()        → Render item with icon
│       └── refresh()            → Refresh tree
│
├── webviews/
│   ├── migration-panel/                  # Migrations UI webview (folder structure)
│   │   ├── index.ts                      # Webview controller and message handler
│   │   ├── template.html                 # Webview UI structure (HTML)
│   │   ├── styles.css                    # Webview styling (CSS)
│   │   └── script.js                     # Client-side logic (JS)
│   ├── routes-panel/                     # Routes UI webview
│   │   ├── index.ts                      # Webview controller and message handler
│   │   ├── template.html                 # Webview UI structure (HTML)
│   │   ├── styles.css                    # Webview styling (CSS)
│   │   └── script.js                     # Client-side logic (JS)
│   ├── packages-panel/                   # Packages UI webview
│   │   ├── index.ts                      # Webview controller and message handler
│   │   ├── template.html                 # Webview UI structure (HTML)
│   │   ├── styles.css                    # Webview styling (CSS)
│   │   └── script.js                     # Client-side logic (JS)
│   ├── model-graph-panel/                # Model Relationship Graph webview
│   │   ├── index.ts                      # Webview controller and message handler
│   │   ├── template.html                 # Webview UI structure (HTML)
│   │   ├── styles.css                    # Webview styling (CSS)
│   │   └── script.js                     # Client-side logic (JS)
│   └── lib/
│       └── webviewUtils.ts               # Shared webview utilities
│           ├── WebviewUtils.generateHtmlTemplate()
│           ├── CSP configuration
│           ├── Nonce generation
│           └── Message type definitions
│
├── services/
│   ├── ArtisanService.ts                 # Laravel artisan command execution
│   │   ├── execSync()                    → Execute command and capture output
│   │   ├── getOrCreateTerminal()         → Terminal lifecycle management
│   │   ├── getMigrations()               → Get list with status (files + artisan)
│   │   ├── getRoutes()                   → List and normalize routes (JSON or table)
│   │   ├── parseMigrationTable()         → Parse artisan status output
│   │   ├── parseRouteTable()             → Parse artisan route:list output
│   │   ├── runMigration()                → Execute: php artisan migrate --path=...
│   │   ├── runAllMigrations()            → Execute: php artisan migrate [--force]
│   │   ├── rollbackMigration()           → Execute: php artisan migrate:rollback --path=...
│   │   ├── rollbackAllMigrations()       → Execute: php artisan migrate:rollback [--step=N]
│   │   ├── createMigration()             → Execute: php artisan make:migration {name}
│   │   └── dispose()                     → Cleanup resources and terminals
│   │
│   ├── WorkspaceService.ts               # Workspace context management
│   │   ├── getWorkspaceRoot()   → Get current workspace path
│   │   ├── isLaravelProject()   → Validate Laravel project
│   │   ├── getPhpCommand()      → Get configured PHP path
│   │   ├── isPhpAvailable()     → Verify PHP exists
│   │   ├── getMigrationsDir()   → Get migrations folder path
│   │   └── hasMigrationsDir()   → Check if migrations exist
│   │
│   ├── ComposerService.ts                # Composer data (packages/outdated)
│   │   ├── getPackages()         → Merge composer.lock with `composer outdated`
│   │   ├── getInstalledPackages()→ Read composer.lock (prod + dev)
│   │   ├── getOutdatedPackages() → Run composer outdated --direct --format=json
│   │   └── parseOutdatedJson()   → Normalize upgrade info
│   ├── ModelGraphService.ts              # Model and relationship discovery
│   │   ├── getModelGraph()       → Scan PHP files for models/relationships
│   │   ├── collectPhpFiles()     → Workspace traversal with skips
│   │   ├── extractModel()        → Detect classes extending Model/Authenticatable
│   │   ├── extractRelationships()→ Map relationships to labeled edges
│   │   └── mapRelationLabel()    → Normalize relation labels for UI
│   │
│   └── LoggerService.ts                  # Unified logging
│       ├── initialize()         → Create output channel
│       ├── info()               → Log info level
│       ├── warn()               → Log warning level
│       ├── error()              → Log error level
│       ├── debug()              → Log debug level
│       └── show()               → Show output channel
│
└── utils/
    └── getNonce.ts                       # Security utilities
        └── getNonce()           → Generate random nonce for CSP
```

---

## Core Components

### 1. Extension Entry Point (`extension.ts`)

**Responsibilities:**
- Initialize services
- Register providers and commands
- Validate workspace on activation
- Handle extension lifecycle

**Flow:**
```
activate()
  ├─ LoggerService.initialize()
  ├─ Register TreeDataProvider (Sidebar)
  ├─ registerCommands()
  ├─ Validate Laravel project
  └─ Show activation message
```

### 2. Commands Layer (`commands/registerCommands.ts`)

**Pattern:** Command Registry Pattern

**All commands:**
```
laravel-hero.openView
  → Execute: vscode.commands.executeCommand('workbench.view.extension.laravelHeroContainer')
  → Effect: Focus sidebar panel

laravel-hero.open-migrations
  → Execute: MigrationPanel.createOrShow()
  → Effect: Open webview panel for migrations

laravel-hero.open-routes
  → Execute: RoutesPanel.createOrShow()
  → Effect: Open webview panel for routes

laravel-hero.open-packages
  → Execute: PackagesPanel.createOrShow()
  → Effect: Open webview panel for packages

laravel-hero.open-model-graph
  → Execute: ModelGraphPanel.createOrShow()
  → Effect: Open webview panel for model relationship graph

laravel-hero.showOutput
  → Execute: LoggerService.show()
  → Effect: Display Laravel Hero output channel
```

**Benefits:**
- Centralized command management
- Easy to add/remove commands
- Consistent error handling

### 3. Sidebar Provider (`providers/LaravelHeroSidebar.ts`)

**Pattern:** TreeDataProvider Pattern

**Implements:**
- `vscode.TreeDataProvider<SidebarItem>`
- `getChildren()` - Returns feature items
- `getTreeItem()` - Renders each item
- `onDidChangeTreeData` - Notifies VS Code of changes

**Current Items:**
```
Migrations (icon: database) → open-migrations command
  ├─ Description: Manage database migrations
  └─ Handler: MigrationPanel.createOrShow()

Routes (icon: git-branch) → open-routes command
  ├─ Description: View and test API routes
  └─ Handler: RoutesPanel.createOrShow()

Packages (icon: package) → open-packages command
  ├─ Description: Manage Laravel packages
  └─ Handler: PackagesPanel.createOrShow()

Model Graph (icon: graph) → open-model-graph command
  ├─ Description: Visualize model relationships
  └─ Handler: ModelGraphPanel.createOrShow()
```

**Extension Point:**
To add a new menu item, just add it to the array in `getChildren()`:
```typescript
const items = [
  new SidebarItem('Migrations', 'laravel-hero.open-migrations'),
  new SidebarItem('Routes', 'laravel-hero.open-routes'),
  new SidebarItem('Packages', 'laravel-hero.open-packages'),
  new SidebarItem('Seeders', 'laravel-hero.open-seeders'), // Add here
];
```

### 4. Webview Panels (`webviews/MigrationPanel.ts`)

**Pattern:** WebviewPanel Pattern with Message Passing

**Lifecycle:**
```
createOrShow()
  ├─ Check if panel already exists
  ├─ If yes: reveal() and return
  └─ If no:
      ├─ Create new WebviewPanel
      ├─ Set HTML content
      ├─ Register message handler
      └─ Load initial data

dispose()
  ├─ Dispose panel
  ├─ Dispose ArtisanService
  └─ Dispose all subscriptions
```

**Message Protocol:**

From Webview:
```javascript
vscode.postMessage({
  command: 'ready' | 'refresh' | 'request-confirm' | 'show-create-dialog' | 'create-migration',
  action?: string,      // For request-confirm
  migration?: string,   // Migration name
  message?: string      // Confirmation message
})
```

From Extension:
```typescript
webview.postMessage({
  command: 'migrations-loaded' | 'error' | 'migration-running',
  data?: MigrationStatus[],
  error?: string
})
```

### 5. Services Layer

#### ArtisanService
**Responsibilities:**
- Execute artisan commands
- Parse command output
- Handle errors
- Provide offline fallback

**Key Methods:**
```typescript
getMigrations()           → Combined disk + artisan data
getMigrationFiles()       → Direct disk read
parseMigrationTable()     → Convert text output to objects
getRoutes()               → Load routes via route:list (JSON first, text fallback)
parseRouteTable()         → Parse artisan route:list table output
runMigration(name, force) → Execute single migration
runAllMigrations(force)   → Batch execution
createMigration(name)     → Generate new migration
```

**Error Handling Strategy:**
```
Try JSON artisan output
  ↓ Fail
Try text artisan output
  ↓ Fail
Show disk files with warning
  ↓
User sees helpful error message
```

#### WorkspaceService
**Responsibilities:**
- Validate workspace
- Get workspace context
- Configuration management

**Validation Chain:**
```
Open workspace folder?
  ├─ No → "No workspace open"
  └─ Yes
    ├─ composer.json exists?
    │   └─ No → "Not a Laravel project"
    ├─ artisan file exists?
    │   └─ No → "Not a Laravel project"
    └─ Yes → "Valid Laravel project"
```

#### LoggerService
**Responsibilities:**
- Centralized logging
- Output channel management
- Debug information

---

## Advanced Features Architecture

### Routes Viewer

**Flow:**
```
RoutesPanel.createOrShow()
  ├─ Loads HTML/CSS/JS from dist/webviews/routes-panel
  ├─ Sends 'ready' message from webview
  └─ _loadRoutes() → ArtisanService.getRoutes()
       ├─ Tries `php artisan route:list --json`
       ├─ Falls back to text parsing if JSON fails
       ├─ Normalizes methods (handles GET|HEAD and concatenated tokens)
       ├─ Derives permissions from middleware (can:, permission:, etc.)
       └─ Builds full URL using APP_URL/.env or domain
  └─ _exportCsv() → prompts for save location, writes routes list as CSV
```

**UI Behaviors:**
- Client-side search and sort across all route fields
- Methods rendered as `GET | HEAD` when multiple tokens exist
- Middleware chips show class name by default; click to toggle full namespace
- Copy URL action posts `copy-text` to extension (clipboard)
- Export CSV button posts `export-csv` for the current list
- Responsive table wraps long middleware/URLs, sticky headers, always-visible scroll

### Packages Viewer

**Flow:**
```
PackagesPanel.createOrShow()
  ├─ Loads HTML/CSS/JS from dist/webviews/packages-panel
  ├─ Sends 'ready' message from webview
  └─ _loadPackages() → ComposerService.getPackages()
       ├─ Reads composer.lock (prod + dev)
       ├─ Attempts `composer outdated --direct --format=json`
       ├─ Merges latest/deprecation info into package list
       └─ Returns warnings instead of failing when composer/Internet unavailable
```

**UI Behaviors:**
- Client-side search/sort by name, installed version, latest version, status, type, and description
- Status chips for **Update available**, **Deprecated** (with replacement), **Up to date**, and **dev**
- Packagist action posts `open-packagist` to open the package in browser
- Responsive table that wraps long descriptions; sticky headers; consistent row heights on small screens

### 1. Search & Filter System (Client-side)

**Implementation:**
```javascript
searchMigrations(query: string): void
  ├─ Loop through all migrations
  ├─ Check if query matches: name | status | batch
  ├─ Case-insensitive comparison
  ├─ Show/hide rows based on match
  └─ Update result counter
```

**Performance Optimization:**
- Filters happen on existing DOM (no re-render)
- O(n) complexity (fast even with 100+ migrations)
- Shows/hides rows instead of removing them
- Result counter provides feedback

### 2. Column Sorting System (Client-side)

**Implementation:**
```javascript
sortMigrations(column: string): void
  ├─ Get current sort state (direction, column)
  ├─ Extract sort value from each migration
  │  ├─ Index:  original position (preserved during sort)
  │  ├─ Name:   string value
  │  ├─ Status: convert to boolean (Ran=true, Pending=false)
  │  └─ Batch:  numeric value
  ├─ Sort array based on column and direction
  ├─ Reverse direction if clicking same column
  ├─ Re-render table with sorted data
  └─ Update visual indicator (↑ ↓)
```

**Key Design Decisions:**
- Preserve original index: Use `_originalIndex` property set during load
- Doesn't modify original data: Creates new sorted array
- Visual indicator: Unicode arrows (↑ ↓) show sort state
- Toggle direction: Click same column to reverse

### 3. Migration Rollback System (Two-tier)

#### Modal Dialog Flow
```
User clicks "Rollback All"
  ↓ JavaScript
showRollbackModal()
  ├─ Remove 'hidden' class from modal
  └─ Focus input field
  
User enters steps (or leaves empty)
  ↓ User clicks "Rollback" button
Modal confirm handler
  ├─ Get input value
  ├─ Parse steps (null if empty/0)
  ├─ Close modal
  └─ Send 'rollback-all' command to extension

Extension Handler (_handleConfirmRequest)
  ├─ Show confirmation dialog (if not already shown)
  ├─ If confirmed:
  │  └─ Call _rollbackAllMigrations(steps)
  └─ Refresh migrations list
```

#### Rollback Methods

**_rollbackAllMigrations(steps: number | null)**
```typescript
├─ Send 'all-migrations-rolling-back' message
├─ Call artisan.rollbackAllMigrations(steps)
│  ├─ If steps === null
│  │  └─ Execute: php artisan migrate:rollback
│  └─ If steps > 0
│     └─ Execute: php artisan migrate:rollback --step={steps}
├─ Show success message
├─ Load fresh migration list
└─ Send 'rollback-error' if failure
```

**_rollbackMigration(name: string)**
```typescript
├─ Send 'migration-rolling-back' message
├─ Call artisan.rollbackMigration(name)
│  └─ Execute: php artisan migrate:rollback --path=database/migrations/{name}.php
├─ Show success message
├─ Load fresh migration list
└─ Send 'rollback-error' if failure
```

### 4. File Navigation System

**Flow:**
```
User clicks 📄 Open button
  ↓
JavaScript sends 'request-confirm' with action: 'open-file'
  ↓
Extension _handleConfirmRequest()
  ├─ Call _openMigrationFile(migrationName)
  │  ├─ Get workspace root
  │  ├─ Construct path: database/migrations/{name}.php
  │  ├─ Verify file exists
  │  ├─ Open with vscode.workspace.openTextDocument()
  │  └─ Show in active editor
  └─ Log operation
```

**Error Handling:**
- No workspace open → Show error message
- File not found → Show helpful path message
- File open failure → Show error details

---

## Webview Asset Architecture

### HTML Structure (template.html)
```
Header Container
  ├─ Title (h1: Laravel Migrations)
  └─ Action Buttons
      ├─ Create Migration
      ├─ Refresh
      ├─ Run All
      ├─ Force Run All
      └─ Rollback All

Rollback Modal (hidden by default)
  ├─ Modal Header (with close button)
  ├─ Modal Body
  │  ├─ Label & Input field
  │  └─ Helper text
  └─ Modal Footer (Cancel & Rollback buttons)

Error Container (empty until error)

Search Container
  ├─ Search input (🔍 icon)
  └─ Result counter

Data Table
  ├─ Headers (sortable: #, Name, Status, Batch, File, Actions)
  └─ Body (populated by JavaScript)
```

### CSS Organization (styles.css)
```
Base Styles
  ├─ Reset & typography
  ├─ Color variables (from VS Code theme)
  └─ Layout grid

Component Styles
  ├─ Button variations (primary, secondary, danger)
  ├─ Modal dialog styles
  ├─ Table structure & cells
  ├─ Search input field
  └─ Loading spinner animation

Interactive States
  ├─ Hover effects
  ├─ Focus states
  ├─ Disabled buttons
  └─ Hidden class

Theme Integration
  ├─ var(--vscode-foreground)
  ├─ var(--vscode-errorForeground)
  ├─ var(--vscode-editor-background)
  └─ Other VS Code variables
```

### JavaScript Organization (script.js)
```
DOM References (cached at top)
  ├─ All button elements
  ├─ Table & search elements
  ├─ Modal elements
  └─ Container elements

Initialization
  ├─ Event listeners (buttons, input)
  ├─ Modal controls
  └─ Initial table render

Search Logic
  ├─ searchMigrations()
  ├─ Input keyup listener
  └─ Result count update

Sort Logic
  ├─ sortMigrations()
  ├─ Column header listeners
  └─ Visual indicators

Rollback Logic
  ├─ Modal show/hide
  ├─ Rollback button handlers
  └─ Individual row rollback

Table Rendering
  ├─ renderTable()
  ├─ Row generation
  ├─ Button generation (with conditional disabled states)
  └─ Event attachers

Message Posting
  └─ vscode.postMessage() calls for all user actions
```

**Output:**
- **VS Code Output Channel**: User-facing messages
- **Browser Console**: Webview debugging
- **Extension Log**: Timestamp + level + context

### 6. Webview HTML/CSS/JS

**Security Model:**
```
Content-Security-Policy:
  ├─ default-src 'none'          ← Block everything by default
  ├─ style-src ${cspSource} 'unsafe-inline'  ← Styles from VS Code
  └─ script-src 'nonce-${nonce}' ← Only scripts with matching nonce

No inline handlers:
  ├─ ❌ onclick="doSomething()"   ← Blocked by CSP
  └─ ✅ addEventListener()         ← Uses nonce in script tag
```

**Message-Based Events:**
```
Button click
  ├─ addEventListener('click', () => {
  │   vscode.postMessage({ command: 'run-migration', name: 'xxx' })
  │ })
  ↓
Extension receives message
  ├─ _handleWebviewMessage()
  ├─ _handleConfirmRequest()
  ├─ vscode.window.showInformationMessage() ← Native modal
  ├─ User clicks Yes/No
  ↓
Execute action or cancel
  ├─ Refresh migrations list
  └─ Send success/error message back
```

---

## Design Patterns

### 1. Service Layer Pattern

**Purpose:** Separate business logic from UI

**Structure:**
```
UI Layer (Webview)
    ↓ postMessage
Extension Host (MigrationPanel)
    ↓ uses
Service Layer (ArtisanService, WorkspaceService)
    ↓ executes
Child Process (artisan command)
```

**Benefits:**
- Easy to test (mock services)
- Reusable across multiple webviews
- Clear error handling boundaries
- Logging at service level

### 2. Factory Method Pattern

**MigrationPanel.createOrShow()**
```typescript
public static createOrShow(extensionUri: vscode.Uri): void {
  if (MigrationPanel.currentPanel) {
    MigrationPanel.currentPanel._panel.reveal();
    return;
  }
  
  const panel = vscode.window.createWebviewPanel(...);
  MigrationPanel.currentPanel = new MigrationPanel(panel, extensionUri);
}
```

**Benefits:**
- Single instance per panel type
- Clean creation interface
- Handles reveal vs. create

### 3. Message-Based Communication Pattern

**Why not direct function calls?**
- Webviews run in isolated context
- Can't directly call extension methods
- Messages provide type-safe interface
- Easy to debug and trace

**Pattern:**
```
Webview Request
  ↓
Extension Handler
  ↓
Extension Operation (may involve modals, promises)
  ↓
Response Message
  ↓
Webview Update
```

### 4. Graceful Degradation Pattern

**Behavior:**
```
Try best method
  ↓ Fail gracefully
Try fallback method
  ↓ Fail gracefully
Show offline data
  ↓
Display warning to user
```

**Example:**
```
Try: php artisan migrate:status --json
  ↓ Fail
Try: php artisan migrate:status (text parsing)
  ↓ Fail
Show: Files from disk with warning
  ↓
User sees: "Could not connect to artisan, showing files from disk"
```

### 5. Resource Cleanup Pattern

**Disposal:**
```typescript
public dispose() {
  MigrationPanel.currentPanel = undefined;
  this._panel.dispose();           // Dispose webview
  this._artisan.dispose();         // Dispose service
  while (this._disposables.length) { // Dispose all subscriptions
    this._disposables.pop()?.dispose();
  }
}
```

**Why Important:**
- Prevent memory leaks
- Release event listeners
- Terminal cleanup
- Prevents duplicate panels

---

## Data Flow

### Migrations Load Flow

```
User clicks "Migrations" button
  ↓
LaravelHeroSidebar.getChildren() runs
  → Returns SidebarItem with 'open-migrations' command
  ↓
User clicks item
  ↓
Command 'laravel-hero.open-migrations' executes
  ↓
MigrationPanel.createOrShow() runs
  ├─ Create WebviewPanel
  ├─ Set HTML content
  ├─ Register message handler
  ↓
Webview sends 'ready' message
  ↓
Extension._loadMigrations() runs
  ├─ ArtisanService.getMigrations()
  │ ├─ Try: php artisan migrate:status --json
  │ ├─ Parse JSON
  │ └─ Try: php artisan migrate:status (text)
  ├─ Try: Read database/migrations/*.php
  ├─ Merge: Disk files + artisan status
  └─ Return: { migrations, error }
  ↓
postMessage({ command: 'migrations-loaded', data, error })
  ↓
Webview receives message
  ├─ Display migrations in table
  ├─ Show error banner if needed
  └─ Render with status icons
```

### Run Migration Flow

```
User clicks "Run" on pending migration
  ↓
Webview button event listener fires
  ├─ postMessage({ command: 'request-confirm', ... })
  ↓
Extension._handleConfirmRequest() runs
  ├─ vscode.window.showInformationMessage("Run migration X?", "Yes")
  ├─ User clicks Yes/No
  ├─ If No: return
  └─ If Yes: continue
  ↓
Extension._runMigration(name, force) runs
  ├─ postMessage({ command: 'migration-running', name })
  ├─ ArtisanService.runMigration(name, force)
  │ ├─ Find migration file
  │ ├─ Execute: php artisan migrate --path=...
  │ └─ Capture output/errors
  ├─ Show success message
  ├─ Call _loadMigrations() to refresh
  └─ postMessage new migration list
  ↓
Webview receives 'migrations-loaded' message
  ├─ Clear previous table
  ├─ Render updated list
  └─ Migration shows as "✓ Migrated"
```

### Error Handling Flow

```
Operation fails somewhere
  ↓
Catch in try/catch block
  ├─ Check error type
  ├─ Provide helpful message
  ├─ Log to LoggerService
  └─ Create user-facing error
  ↓
Show error in multiple places:
  ├─ Webview: Error banner below title
  ├─ VS Code: Toast notification
  ├─ Output Channel: Full error details
  └─ Browser Console: Stack trace
  ↓
User can:
  ├─ Click "Show Output" in error message
  ├─ Check error banner in webview
  └─ See detailed logs in Output → Laravel Hero
```

---

## Security Considerations

### Content Security Policy (CSP)

**Current Policy:**
```
default-src 'none'
  → Denies everything by default

style-src ${webview.cspSource} 'unsafe-inline'
  → Allows styles from VS Code and inline styles

script-src 'nonce-${nonce}'
  → Only allows scripts with matching nonce token
```

**Why This Matters:**
- Prevents XSS attacks
- Prevents unsafe inline code execution
- Forces explicit resource loading
- Security best practice for webviews

### Nonce Generation

```typescript
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

**Generated nonce:**
- Random 32-character string
- Unique per webview render
- Must match in CSP meta tag
- Script tags include: `<script nonce="${nonce}">`

### No Inline Handlers

**❌ Not Allowed:**
```html
<button onclick="runMigration('xxx')">Run</button>
```

**✅ Correct Pattern:**
```html
<button data-action="run" data-migration="xxx">Run</button>

<script nonce="${nonce}">
  const btn = document.querySelector('[data-action="run"]');
  btn.addEventListener('click', (e) => {
    const migration = e.target.getAttribute('data-migration');
    vscode.postMessage({ command: 'run-migration', name: migration });
  });
</script>
```

### Command Injection Prevention

**Safe Execution:**
```typescript
const migrationDir = WorkspaceService.getMigrationsDir();
const files = fs.readdirSync(migrationDir);
const found = files.find(f => f === migrationName + '.php');

if (!found) {
  throw new Error(`Migration not found: ${migrationName}`);
}

// Use safe path joining
const path = pathModule.join('database', 'migrations', migrationName + '.php');
const cmd = `php artisan migrate --path=${path}`;

// Execute with cwd restriction
cp.exec(cmd, { cwd: workspaceRoot }, callback);
```

**Benefits:**
- Validates file exists before execution
- Uses path module (not string concatenation)
- Restricted cwd (can't escape workspace)
- Prevents command injection

---

## Extension Points

### Adding a New Panel Feature

**Example: Adding a Seeders Panel**

1. **Create Service** (`services/SeedersService.ts`):
```typescript
export class SeedersService {
  async getSeeders(): Promise<SeederInfo[]> { }
  async runSeeder(name: string): Promise<void> { }
}
```

2. **Create Panel** (`webviews/SeedersPanel.ts`):
```typescript
export class SeedersPanel {
  public static currentPanel: SeedersPanel | undefined;
  // Copy structure from MigrationPanel
}
```

3. **Register Command** (update `commands/registerCommands.ts`):
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('laravel-hero.open-seeders', () => {
    SeedersPanel.createOrShow(context.extensionUri);
  })
);
```

4. **Update Sidebar** (update `providers/LaravelHeroSidebar.ts`):
```typescript
const items = [
  new SidebarItem('Migrations', 'laravel-hero.open-migrations'),
  new SidebarItem('Routes', 'laravel-hero.open-routes'),
  new SidebarItem('Packages', 'laravel-hero.open-packages'),
  new SidebarItem('Seeders', 'laravel-hero.open-seeders'), // Add here
];
```

**That's it!** The sidebar will automatically show the new item and command.

---

## Performance Considerations

### Migration List Loading

**Current Approach:**
1. Read disk files (fast, local FS)
2. Try artisan JSON (fast, usually cached)
3. Parse artisan text (slower, full parsing)

**Performance:**
- **Disk read**: ~50-100ms
- **Artisan JSON**: ~200-500ms (depends on Laravel setup)
- **Text parsing**: ~300-800ms

**Optimization Tips:**
- Cache results in memory
- Add pagination for large projects
- Consider debouncing refresh button
- Lazy load artisan status if slow

### Command Execution

**Current Limits:**
- `maxBuffer: 10 * 1024 * 1024` (10MB output max)
- `timeout: 5000ms` implicit (can be tuned)
- Single command queue (serialized)

**Future Improvements:**
- Parallel command execution
- Progress indicators for long operations
- Cancellation support
- Timeout configuration

### Webview Rendering

**Current Performance:**
- DOM created per migration (not virtual scroll)
- Works fine for <1000 migrations
- Full table re-render on refresh

**Scalability:**
- Consider virtual scrolling for large tables
- Incremental DOM updates
- CSS containment for rendering optimization

---

## Testing Architecture

### Unit Testing (Future)

```typescript
// Example: Test ArtisanService
describe('ArtisanService', () => {
  test('should parse migration table correctly', () => {
    const output = '| Yes | migration_name | 1 |';
    const result = service.parseMigrationTable(output);
    expect(result).toContainEqual({
      ran: true,
      name: 'migration_name',
      batch: 1
    });
  });
});
```

### Integration Testing (Future)

```typescript
// Example: Test full migration run
describe('MigrationPanel Integration', () => {
  test('should run migration and refresh list', async () => {
    // Setup: Create test Laravel project
    // Action: Click run button
    // Assert: Migration status changed
  });
});
```

---

## Debugging Tips

### Enable Debug Logging

```typescript
// In any service:
LoggerService.debug('Detailed info', { variable: value });
```

Then check VS Code Output panel → Laravel Hero.

### Inspect Webview Messages

```typescript
// In MigrationPanel._handleWebviewMessage():
LoggerService.debug('Webview message', { message });
```

### Browser DevTools for Webview

In Extension Development Host:
- Press **Ctrl+Shift+I** to open DevTools
- Check **Console** tab for webview logs
- **Network** tab to see resource loading
- **Sources** tab to set breakpoints

---

## Conclusion

Laravel Hero is built on solid architecture principles:
- ✅ Clean separation of concerns
- ✅ Secure by default (CSP, no eval)
- ✅ Extensible for new features
- ✅ Robust error handling
- ✅ User-friendly feedback
- ✅ Community-ready for contributions

For questions about architecture decisions or design choices, please open a discussion in the GitHub repository.
