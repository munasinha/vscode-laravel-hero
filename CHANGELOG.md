# Changelog

All notable changes to the Laravel Hero extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Coming Soon
- **Database Info** - View database configuration and connection status
- **Artisan Command Runner** - Execute custom artisan commands from UI

---

## [0.4.1] - 2026-01-09
### New Features
- **Layout controls**: floating zoom buttons, pan-by-drag, center/reset actions, collision toggle for overlap vs tidy layouts, and degree-aware placement (most-connected models in the center, isolates separated).

---

## [0.4.0] - 2026-01-09
### New Features
- **Model Relationship Graph**: new Activity Bar entry that opens a draggable canvas showing all Eloquent models and their relationships (one-to-one, one-to-many, many-to-many, through, polymorphic). Lines are labeled by relationship type, nodes can be repositioned, and double-click opens the model file.

---

## [0.3.0] - 2026-01-09
### New Features
- New **Packages** panel: lists installed Composer deps (prod + dev), flags updates/deprecations, and links to Packagist

---

## [0.2.1] - 2026-01-09
### New Features
- Export CSV button to save the current routes list
### Fixed / Polished
- Responsive table layout and fixed all the previous 

---

## [0.2.0] - 2026-01-08

### Added - Phase 2: Routes Viewer
- New **Routes** panel in the Activity Bar → Routes sidebar item → full webview
- Fetches routes via `php artisan route:list` (JSON first, text fallback)
- Normalizes methods (splits GET|HEAD and concatenated tokens)
- Shows URI, name, methods, middleware, permissions, full URL
- Middleware chips show class name by default; click to expand full namespace
- Copy URL action posts to VS Code clipboard
- Responsive table layout with search/sort across all columns and wrapping for long middleware/URLs

### Fixed / Polished
- Improved method parsing for routes with combined tokens
- Clipboard handler now guards empty URLs and uses currentTarget attribute
- Middleware chips wrap and toggle correctly without breaking table layout

---

## [0.1.2] - 2026-01-08

### Added - Phase 1 Enhancements: Advanced Migrations Management

#### Advanced Datatable Features
- **Real-time Search** - Filter migrations by name, status, or batch number
  - Search input with visual feedback
  - Case-insensitive filtering across all columns
  - Dynamic result count display

- **Column Sorting** - Click any column header to sort
  - Visual indicators (↑↓) show current sort state
  - Click again to reverse sort order
  - Original index number persists (doesn't change with sort)

- **File Navigation** - Quick access to migration source code
  - New "File" column with 📄 Open button
  - Opens migration file directly in VS Code editor
  - Validates file exists before opening

#### Migration Rollback Support
- **Rollback All Migrations** - Modal dialog for controlled rollback
  - Input field to specify number of steps to rollback
  - Default 0 or empty = rollback all migrations
  - User confirmation before execution
  - Clear success/error messages

- **Individual Migration Rollback** - Per-migration action
  - Rollback button for each migration (⟲)
  - Button disabled for unmigrated migrations
  - Confirmation dialog before rollback
  - Auto-refresh after completion

#### UI/UX Improvements
- **Improved Layout** - Single-row button layout with flex container
  - Better spacing and organization
  - Responsive button group
  - Color-coded buttons (primary, secondary, danger)

- **Modal Dialog** - Custom VS Code themed modal
  - Matches VS Code color scheme
  - Smooth show/hide animations
  - Keyboard-friendly (Escape to close)
  - Proper focus management

- **Visual Enhancements**
  - Danger buttons in red (error foreground color)
  - Loading spinner with animation
  - Empty state messaging
  - Error container for operation feedback

#### Backend Improvements
- **ArtisanService Expansion**
  - New `rollbackMigration(name)` method
  - New `rollbackAllMigrations(steps)` method
  - Proper error handling and logging

- **MigrationPanel Enhancements**
  - New `_rollbackMigration()` method
  - New `_rollbackAllMigrations()` method
  - Improved `_handleConfirmRequest()` with rollback cases
  - Message-based communication for rollback operations

### Fixed Issues
- Fixed button ordering in header (now: Create, Refresh, Run All, Force Run All, Rollback All)
- Fixed sort indicator not showing on initial load
- Fixed migration index changing when sorted (now uses original index)
- Improved error messages for rollback failures

### Technical Details
- **Extension Size**: 56.4 KiB (compiled)
- **Compilation Time**: ~2.8 seconds
- **Lines of Code Added**: ~500+ lines
  - Template: +50 lines (modal + search)
  - Styles: +120 lines (modal + datatable)
  - JavaScript: +150 lines (search, sort, rollback logic)
  - TypeScript: +180 lines (rollback methods in both MigrationPanel and ArtisanService)

### Performance Notes
- Search filtering is debounced for smooth UX
- Sort operations maintain O(n log n) complexity
- Modal operations don't block extension UI
- Rollback commands execute asynchronously

---


## [0.1.1] - 2026-01-07

### Added Proper Overview for the README.md File

### Core Changes

- This release Only Contains the README.md file updates.

---

## [0.1.0] - 2026-01-07

### Added - Phase 1: Migrations Management

#### Core Features
- **Activity Bar Icon** - New "Laravel Hero" icon in VS Code Activity Bar
- **Primary Sidebar** - Feature menu with Migrations, Routes, and Packages options
- **Migrations Webview** - Full-featured migrations management interface
  - View all migrations with their current status (Migrated/Pending)
  - Display batch number for executed migrations
  - Offline fallback - shows disk files even if artisan command fails

#### Migration Actions
- **Run Individual Migrations** - Execute any pending migration with one click
- **Force Run Migrations** - Re-run already executed migrations
- **Run All Migrations** - Execute all pending migrations at once
- **Force Run All** - Force re-run all migrations
- **Create New Migrations** - Generate new migration files via VS Code input dialog
  - Name validation (lowercase letters, numbers, underscores only)
  - Automatic table refresh after creation


#### Configuration
- **PHP Command Setting** - Configurable PHP executable path
  - Default: `php`
  - Supports custom paths: `/opt/homebrew/bin/php`, `/usr/bin/php`, etc.
  - Setting: `laravelHero.phpCommand`

#### Platform Support
- **macOS** - Fully tested and working
- **Windows** - Should work (path handling compatible)
- **Linux** - Should work (standard PHP paths supported)

### Technical Details
- **VS Code API Version**: 1.107.0+
- **Node Version**: 18.x+
- **TypeScript**: 5.9.3
- **Webpack**: 5.104.1

### Fixed Issues
- Fixed "There is no data provider" error in sidebar
  - Properly implemented TreeDataProvider registration
  - Fixed view container and views configuration in package.json

- Fixed CSP violations in webview
  - Removed inline `onclick` handlers
  - Implemented message-based event handling
  - Added proper CSP meta tags

- Fixed confirmation dialog blocking
  - Replaced `confirm()` with extension-handled modals
  - Uses `vscode.window.showInformationMessage()` for proper UX

- Fixed migration file path resolution
  - Now finds actual file before executing artisan command
  - Properly handles `.php` extension

### Known Limitations
- Routes and Packages features are placeholders (Phase 2)
- Only supports single workspace folder
- Migration status JSON parsing requires Laravel 8.0+
- Text-based parsing works with most Laravel versions

---

## Migration Guide

### From Earlier Builds
This is the first public release (v0.1.0). No migration needed.

### For Contributors
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines


---

## Roadmap

### Phase 2 (Upcoming)
- ✅ Migrations Management
- 🔲 Routes Viewer & Tester
- 🔲 Package Management
- 🔲 Migration Rollback UI

---

## Feedback & Support

- **Issues**: [GitHub Issues](https://github.com/munasinha/vscode-laravel-hero/issues)
- **Discussions**: [GitHub Discussions](https://github.com/munasinha/vscode-laravel-hero/discussions)
- **Security**: Please email security concerns to [your-email@example.com]

---

[Keep a Changelog]: https://keepachangelog.com/
[Semantic Versioning]: https://semver.org/
[Unreleased]: https://github.com/munasinha/vscode-laravel-hero/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.1.0
