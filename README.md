# Laravel Hero

<div align="center">

![Laravel Hero Icon](media/icon.svg)

**A powerful VS Code extension for Laravel developers**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.107.0%2B-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen)](#contributing)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development) • [Contributing](#contributing)

</div>

---

## 📋 Overview

**Laravel Hero** is a VS Code extension that brings powerful Laravel development tools directly into your editor. Manage database migrations, view routes, manage packages, and more—all without leaving VS Code.

Built with production-quality code following [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) and TypeScript best practices.

### Phase 1: Migrations (Complete ✅)
Full migration management with database status tracking, execution, and creation.

### Phase 2: Routes (Planned)
View all application routes, test endpoints, and manage route groups.

### Phase 3: Packages (Planned)
Manage Composer packages, view documentation, and handle dependencies.

---

## ✨ Features

### **Migrations Management** (Phase 1 ✅)
- 📊 **View all migrations** in an organized table
- ✓ **Track status** (Migrated / Pending) with real-time sync
- ▶️ **Run migrations** one-by-one or all at once
- ⚡ **Force run** migrations to re-execute already-run migrations
- ➕ **Create new migrations** via intuitive input dialog
- 🔄 **Auto-refresh** after running or creating migrations
- 📴 **Offline support** - shows disk files even if Artisan fails
- 🚨 **Smart error handling** with helpful messages

### **Developer Experience**
- 🎨 **Native VS Code UI** - modals, input dialogs, notifications
- 📝 **Unified logging** - View all operations in "Laravel Hero" output channel
- ⚙️ **Configurable PHP path** - Support for custom PHP executables
- 🔒 **Secure webviews** - Content Security Policy compliant
- 🏗️ **Clean architecture** - Easy to extend with new features

---

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Laravel Hero"
4. Click Install

### Manual Installation
\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/laravel-hero.git
cd laravel-hero

# Install dependencies
npm install

# Package the extension
npm run package

# Install the .vsix file
# Open VS Code → Extensions → ... menu → Install from VSIX
\`\`\`

---

## 🚀 Usage

### Opening Laravel Hero
1. **Click the Laravel Hero icon** in the Activity Bar (left sidebar)
2. **View the feature menu:**
   - 🗄️ Migrations - Manage database migrations
   - 🌐 Routes - View and test routes (Phase 2)
   - 📦 Packages - Manage packages (Phase 3)

### Managing Migrations

#### View Migrations
- Click **"Migrations"** in the sidebar
- Webview panel opens showing all migrations
- Status shows: ✓ Migrated or ○ Pending

#### Run a Migration
1. Click **"Run"** button on a pending migration
2. Confirm in the dialog
3. Watch the execution in the output panel
4. Table refreshes automatically

#### Run All Migrations
1. Click **"Run All"** button at the top
2. Confirm in the dialog
3. All pending migrations execute in sequence
4. Status updates automatically

#### Force Run
- Click **"Force Run"** to re-execute migrations
- Useful for development and debugging
- Works for individual or all migrations

#### Create New Migration
1. Click **"+ Create Migration"** button
2. Enter migration name (e.g., `create_users_table`)
3. Press Enter or click Create
4. New migration appears in the table (Pending status)

### Configuration

#### Set Custom PHP Path
If your PHP executable is in a non-standard location:

1. Open VS Code Settings (Cmd+, / Ctrl+,)
2. Search for "Laravel Hero"
3. Set `laravelHero.phpCommand` to your PHP path:
   \`\`\`
   /opt/homebrew/bin/php
   /usr/bin/php
   /path/to/custom/php
   \`\`\`

#### View Logs
- Open Output panel (Cmd+Shift+U / Ctrl+Shift+U)
- Select "Laravel Hero" from the dropdown
- See detailed logs of all operations

---

## 🛠️ Development

### Prerequisites
- Node.js 16+ and npm
- TypeScript 5.9+
- VS Code 1.107.0+
- A Laravel project with PHP and Composer

### Setup

\`\`\`bash
# Clone repository
git clone https://github.com/yourusername/laravel-hero.git
cd laravel-hero

# Install dependencies
npm install

# Start development mode (watch & compile)
npm run watch
\`\`\`

### Project Structure

\`\`\`
src/
├── extension.ts                    # Activation entry point
├── commands/
│   └── registerCommands.ts         # All command registrations
├── providers/
│   └── LaravelHeroSidebar.ts       # TreeDataProvider for sidebar
├── webviews/
│   ├── MigrationPanel.ts           # Migrations webview implementation
│   └── lib/
│       └── webviewUtils.ts         # Shared webview utilities
├── services/
│   ├── ArtisanService.ts           # Laravel artisan execution
│   ├── LoggerService.ts            # Unified logging
│   └── WorkspaceService.ts         # Workspace validation & context
└── utils/
    └── getNonce.ts                 # Security utilities
\`\`\`

### Build & Test

\`\`\`bash
# Compile TypeScript to JavaScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Package for distribution
npm run package

# Run linter
npm run lint
\`\`\`

### Debug the Extension

1. **Open the project in VS Code**
2. **Press F5** to launch Extension Development Host
3. **A new VS Code window opens** with your extension loaded
4. **Set breakpoints** in `src/` files
5. **Check the Debug Console** for output
6. **Reload** (Cmd+R / Ctrl+R) to see code changes

### Testing

\`\`\`bash
# Run tests
npm run test

# Watch mode for tests
npm run watch-tests
\`\`\`

---

## 🤝 Contributing

We welcome contributions from the community! Whether it's bug fixes, new features, or documentation improvements.

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   \`\`\`bash
   git clone https://github.com/yourusername/laravel-hero.git
   cd laravel-hero
   \`\`\`
3. **Create a feature branch:**
   \`\`\`bash
   git checkout -b feature/amazing-feature
   \`\`\`
4. **Make your changes** following our code style

### Code Style Guidelines

- **TypeScript**: Use strict mode, proper typing
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Comments**: JSDoc for public APIs, inline comments for complex logic
- **Error Handling**: Always provide user-friendly error messages
- **Logging**: Use `LoggerService` for debugging visibility

### Commit Messages

Follow conventional commits:
\`\`\`
feat: add routes panel
fix: handle missing artisan gracefully
docs: update installation guide
refactor: improve error handling
test: add migration service tests
\`\`\`

### Pull Request Process

1. **Update README.md** if adding new features
2. **Test thoroughly** - Run `npm run compile` and `npm run lint`
3. **Describe changes** - Clear PR description with before/after
4. **Link issues** - Reference related issues or features
5. **Wait for review** - Project maintainers will review and test

### Adding New Features (e.g., Routes Panel)

#### 1. Create Service
\`\`\`typescript
// src/services/RoutesService.ts
export class RoutesService {
  async getRoutes(): Promise<RouteInfo[]> {
    // Implementation
  }
}
\`\`\`

#### 2. Create Webview
\`\`\`typescript
// src/webviews/RoutesPanel.ts
export class RoutesPanel {
  static createOrShow(extensionUri: vscode.Uri) {
    // Implementation similar to MigrationPanel
  }
}
\`\`\`

#### 3. Register Command
\`\`\`typescript
// In src/commands/registerCommands.ts
vscode.commands.registerCommand('laraval-hero.open-routes', () => {
  RoutesPanel.createOrShow(context.extensionUri);
});
\`\`\`

#### 4. Update Sidebar
The sidebar already returns Routes menu item - just add the handler!

### Architecture Patterns

- **Service Layer**: Business logic in `services/`
- **Provider Pattern**: TreeDataProvider for sidebar
- **Message Passing**: Webview ↔ Extension via postMessage
- **Singleton Pattern**: Panel instances (single active panel)
- **Error Handling**: Always provide user feedback, never silent failures

---

## 🐛 Troubleshooting

### Migrations don't load
- ✅ Ensure Laravel project has `database/migrations` folder
- ✅ Run `composer install` in your Laravel root
- ✅ Check PHP is available: `php -v`
- ✅ Set correct PHP path in settings if needed

### "No data provider" error in sidebar
- ✅ Reload VS Code window (Cmd+R / Ctrl+R)
- ✅ Check Output panel for error details
- ✅ Ensure workspace folder is open

### Artisan commands timeout
- ✅ Check Laravel project permissions
- ✅ Verify no long-running migrations
- ✅ Check network if using remote workspace

### "PHP not found" error
- ✅ Install PHP if missing
- ✅ Or set `laravelHero.phpCommand` to correct path

### View logs for debugging
\`\`\`
Output Panel (Cmd+Shift+U) → Select "Laravel Hero"
\`\`\`

---

## 📊 Architecture Overview

\`\`\`
┌─────────────────────────────────────────┐
│        VS Code Extension Host           │
│  ┌──────────────────────────────────┐   │
│  │     Extension (extension.ts)     │   │
│  │  • Initialize services           │   │
│  │  • Register providers & commands │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         ↓          ↓          ↓
┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│  Commands   │ │   Sidebar    │ │   Webviews   │
│  Registry   │ │  TreeView    │ │   Panels     │
└─────────────┘ └──────────────┘ └──────────────┘
         ↓          ↓          ↓
┌─────────────────────────────────────────┐
│            Service Layer                │
│  • ArtisanService                       │
│  • WorkspaceService                     │
│  • LoggerService                        │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│       Laravel Project (Filesystem)       │
│  • database/migrations                  │
│  • artisan binary                       │
│  • composer.json                        │
└─────────────────────────────────────────┘
\`\`\`

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built following [VS Code Extension Best Practices](https://code.visualstudio.com/api)
- Inspired by Laravel community tools
- Thanks to all contributors and users

---

## 🔗 Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Laravel Documentation](https://laravel.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 📧 Support

- **Found a bug?** [Open an issue](https://github.com/yourusername/laravel-hero/issues)
- **Have a feature request?** [Start a discussion](https://github.com/yourusername/laravel-hero/discussions)
- **Want to contribute?** See [Contributing](#contributing) section

---

<div align="center">

**Made with ❤️ for Laravel developers**

⭐ If you find this extension useful, please give it a star on GitHub!

</div>