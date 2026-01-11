# Changelog

All notable changes to the Laravel Hero extension will be documented in this file.

The format is based on [Keep a Changelog]
and this project adheres to [Semantic Versioning]

---

## [0.6.0] - 2026-01-11
### New Features
- **Overview Dashboard**: new primary sidebar entry showing project name, environment, Laravel + PHP versions.
- **Connection Health**: DB and cache driver cards with live connectivity checks and inline warnings.
- **Quick Artisan Actions**: buttons for config cache/clear, optimize, cache clear, route clear, and view clear (runs in-background with status banners).

---

## [0.5.1] - 2026-01-09
### New Features 
  - Touch pad zoom in and zoom out
### Fixed / Polished
  - Fixed Model Relationship Graph zooming issues
  - Fixed Incorrect relationship label issue

---

## [0.5.0] - 2026-01-09
### New Features
- **Cardinality on edges**: single label per relationship line with inline `1 / ∞` badges indicating directionality.
- **Always tidy layouts**: overlap toggle removed; collision avoidance is always on, with better large-graph grid sizing and zoom/pan controls on-canvas.
- **Search clarity**: matches stay as full models (not referenced), and filtering keeps first-degree neighbors/edges only.

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

### New Features
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

### New Features

#### Advanced Migrations Management
- **Real-time Search** - Filter migrations by name, status, or batch number
- **Column Sorting** - Click any column header to sort
- **File Navigation** - Quick access to migration source code
- **Rollback All Migrations** - Modal dialog for controlled rollback
- **Individual Migration Rollback** - Per-migration action

### Fixed / Polished
- Fixed button ordering in header (now: Create, Refresh, Run All, Force Run All, Rollback All)
- Fixed sort indicator not showing on initial load
- Fixed migration index changing when sorted (now uses original index)
- Improved error messages for rollback failures

---

## [0.1.1] - 2026-01-07

### Fixed / Polished

- This release Only Contains the README.md file updates.

---

## [0.1.0] - 2026-01-07

### New Features

#### Migration Actions
- **Run Individual Migrations** - Execute any pending migration with one click
- **Force Run Migrations** - Re-run already executed migrations
- **Run All Migrations** - Execute all pending migrations at once
- **Force Run All** - Force re-run all migrations
- **Create New Migrations** - Generate new migration files via VS Code input dialog
  - Name validation (lowercase letters, numbers, underscores only)
  - Automatic table refresh after creation

---

### For Contributors
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines

---

## Feedback & Support

- **Issues**: [GitHub Issues](https://github.com/munasinha/vscode-laravel-hero/issues)
- **Discussions**: [GitHub Discussions](https://github.com/munasinha/vscode-laravel-hero/discussions)
- **Security**: Please email security concerns to [navod199736@gmail.com]

---

[Keep a Changelog]: https://keepachangelog.com/
[Semantic Versioning]: https://semver.org/
[0.6.1]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.6.1
[0.6.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.6.0
[0.5.1]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.5.1
[0.5.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.5.0
[0.4.1]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.4.1
[0.4.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.4.0
[0.3.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.3.0
[0.2.1]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.2.1
[0.2.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.2.0
[0.1.3]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.1.3
[0.1.2]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.1.2
[0.1.1]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.1.1
[0.1.0]: https://github.com/munasinha/vscode-laravel-hero/releases/tag/v0.1.0
[navod199736@gmail.com]: mailto:navod199736@gmail.com
