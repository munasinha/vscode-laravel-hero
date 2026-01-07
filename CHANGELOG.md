# Changelog

All notable changes to the Laravel Hero extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Coming Soon
- **Routes Feature** - View and test Laravel API routes
- **Packages Feature** - Manage Laravel package installations
- **Advanced Filtering** - Filter migrations by status, batch, or date range
- **Database Info** - View database configuration and connection status
- **Migration Rollback** - Rollback to specific batches or migrations
- **Artisan Command Runner** - Execute custom artisan commands from UI
- **Dark Mode Improvements** - Enhanced theming for better visibility

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