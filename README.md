# Laravel Hero

<div align="center">

  <img style="height:200px; width:200px" src="https://raw.githubusercontent.com/munasinha/vscode-laravel-hero/refs/heads/master/media/logo.png">

</div>

<div align="center">

**Supercharge Your Laravel Development Workflow in VS Code**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.107.0%2B-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![GitHub](https://img.shields.io/badge/GitHub-munasinha-black?logo=github)](https://github.com/munasinha/vscode-laravel-hero)

</div>

---

## What is Laravel Hero?

[Laravel Hero](https://marketplace.visualstudio.com/items?itemName=navod-rashmika.laravel-hero) is your ultimate VS Code companion for Laravel development. Stop switching between your editor and terminal manage your entire Laravel application directly from VS Code with an intuitive, powerful interface.

Phase 1 (Migrations) is complete and **Phase 2 (Routes)** is now available: view all registered routes with search, sort, middleware/permission visibility, copyable full URLs, and CSV export. Packages coming next.

---

## ✨ Key Features

### 🌐 **Routes Viewer (New)**
- **List all routes** with methods, URI, name, middleware, permissions, and full URL
- **Search and sort** across all columns
- **Middleware chips** show class name by default; click to expand full namespace
- **Copy URL** quickly from the table
- **Export CSV** for the current route list
- **Responsive table** with wrapping for long middleware/URLs and sticky headers with scroll

### 🗄️ **Database Migrations Management**
- **View all migrations** in a clean, organized interface
- **Track status** at a glance see which migrations are pending and which have been applied
- **Run migrations** with a single click no terminal needed
- **Create new migrations** instantly through an intuitive dialog
- **Force re-run migrations** for development and testing
- **Auto-refresh** after every operation
- **Offline mode** still see your migrations even if Laravel commands are unavailable
### 📊 **Advanced Datatable**
- **Search migrations** in real-time across names, statuses, and batches
- **Sort all columns** with visual up/down indicators
- **View original index** that persists even when sorted
- **Quick file access** with one-click navigation to migration source code

### ⟲ **Rollback Migrations**
- **Rollback all migrations** instantly with optional step control
- **Individual rollback** for specific migrations with confirmation
- **Smart button states** — rollback disabled for unmigrated migrations
- **Batch control** — specify how many steps to rollback (0 or empty = all)
### 🎯 **Built for Developers**
- **Native VS Code UI** — feels like part of the editor, not a plugin
- **Detailed logging** — see exactly what's happening in the "Laravel Hero" output panel
- **Custom PHP paths** — support for any PHP installation
- **Smart error handling** — helpful messages when things go wrong
- **Production-ready code** — built with TypeScript, tested, and following VS Code best practices

---

## 🚀 Getting Started

### Installation (30 seconds)
1. Open **Extensions** in VS Code (`Cmd+Shift+X` on Mac, `Ctrl+Shift+X` on Windows)
2. Search for **"Laravel Hero"**
3. Click **Install**
4. Click the Laravel Hero icon in the Activity Bar (left sidebar)
5. Select **Migrations** or **Routes** to get started

### Requirements
- **VS Code** 1.107.0 or later
- **Laravel project** with `artisan` binary
- **PHP** 7.4+ installed
- **Composer** (usually already in Laravel projects)

---

## 💡 How to Use

### View Your Migrations
1. Click the **Laravel Hero icon** in the Activity Bar
2. Select **Migrations**
3. Your webview panel opens showing all database migrations
4. Green checkmarks mean **migrated**, circles mean **pending**

<div align="center" style="margin-top:30px;margin-bottom:30px;">
  <img style="height:500px;width:auto" src="media/overview/laravel-heo-migration.png">
</div>

### Run a Migration
- Click **"Run"** on any pending migration → Confirm → Done! ✓

### Run All Pending Migrations
- Click **"Run All"** at the top → Confirm → Watch them execute in sequence

### Create a New Migration
1. Click **"+ Create Migration"**
2. Type your migration name (e.g., `create_users_table`)
3. Press Enter
4. Your new migration appears instantly (Pending status)

### Force Re-run a Migration
- Click **\"Force Run All\"** on any migration
- Perfect for development and debugging
- Works on already-migrated migrations

### Search & Sort Migrations
- Use the **🔍 search bar** to filter migrations by name, status, or batch
- Click any **column header** to sort (click again to reverse)
- Visual indicators show which column is currently sorted

### Open Migration Files
- Click the **📄 Open** button in the File column
- Opens the migration source code directly in your editor
- No need to hunt through the database/migrations folder

### Rollback Migrations
- Click **\"⟲ Rollback All\"** to open the rollback modal
- Specify how many steps to rollback (0 or empty = rollback all)
- Individual migrations show **⟲ Rollback** button (enabled only for migrated ones)
- Confirm and watch the rollback execute

### View Your Routes
1. Click the **Laravel Hero icon** in the Activity Bar
2. Select **Routes**
3. Browse all routes with methods, name, middleware, permissions, and full URL
4. **Search** and **sort** any column; long middleware and URLs wrap gracefully
5. Click a middleware chip to expand its full namespace
6. Use **Copy URL** to send the route URL to your clipboard
7. Click **Export CSV** to download the current route list

<div align="center" style="margin-top:30px;margin-bottom:30px;">
  <img style="height:500px;width:auto" src="media/overview/laravel-hero-routes.png">
</div>
---

## ⚙️ Configuration

### Using a Custom PHP Path?
Some setups have PHP in non-standard locations. Configure it:

1. Open **Settings** (`Cmd+,` on Mac, `Ctrl+,` on Windows)
2. Search for **"laravel hero"**
3. Set `laravelHero.phpCommand` to your PHP path:
   - Examples: `/opt/homebrew/bin/php`, `/usr/bin/php`, `C:\php\php.exe`

That's it! Laravel Hero will now use your custom PHP installation.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Migrations won't load** | Ensure your Laravel project has `database/migrations` folder and run `composer install` |
| **"PHP not found" error** | Install PHP or set `laravelHero.phpCommand` in settings to your PHP path |
| **No sidebar icon appearing** | Reload VS Code (`Cmd+R`) and make sure a folder is open |
| **Artisan commands timing out** | Check your Laravel project permissions and network (if remote) |
| **Need more details?** | Check the Laravel Hero output channel (`Cmd+Shift+U`) for detailed logs |

---

## 🎯 What's Coming Next?

### Phase 2: Routes Management (Shipped)
- View all application routes with methods, names, middleware, permissions
- Search/sort, responsive table with sticky headers, copy full URLs, toggle middleware namespaces
- Export CSV of the current routes list
- More route testing tools coming soon

### Phase 3: Package Management (Planned)
- Browse installed Composer packages
- View package documentation
- Update packages safely
- Manage dependencies

---

## 🤝 Want to Help?

We're open source and love contributions! Whether it's bug reports, feature suggestions, or code contributions—we welcome all help.

### Quick Links
- **Found a bug?** [Report it on GitHub](https://github.com/munasinha/vscode-laravel-hero/issues)
- **Have an idea?** [Start a discussion](https://github.com/munasinha/vscode-laravel-hero/discussions)
- **Want to code?** Check [CONTRIBUTING.md](https://github.com/munasinha/vscode-laravel-hero/blob/master/CONTRIBUTING.md) for the full guide

---

## 📝 License

MIT License - See [LICENSE](LICENSE) for details. Free to use, modify, and distribute.

---

## ❤️ Made for Laravel Developers

Laravel Hero was built with a passion for Laravel development and a commitment to making your workflow seamless and enjoyable.

**If you find this extension useful, please give it a ⭐ on [GitHub](https://github.com/munasinha/vscode-laravel-hero)**

---

### More Resources
- [Laravel Documentation](https://laravel.com/docs)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [GitHub Repository](https://github.com/munasinha/vscode-laravel-hero)

---

**Questions?** Open an issue or start a discussion on GitHub. We're here to help!
