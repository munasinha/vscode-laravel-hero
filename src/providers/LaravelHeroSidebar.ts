import * as vscode from 'vscode';

/**
 * Sidebar menu item representing a feature.
 */
export class SidebarItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly commandId: string,
		public readonly description?: string
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: commandId,
			title: label
		};
		this.iconPath = this.getIcon();
	}

	private getIcon(): vscode.ThemeIcon {
		const icons: { [key: string]: string } = {
			'laravel-hero.open-migrations': 'database',
			'laravel-hero.open-routes': 'git-branch',
			'laravel-hero.open-packages': 'package',
			'laravel-hero.open-model-graph': 'graph'
		};
		return new vscode.ThemeIcon(icons[this.commandId] || 'symbol-constant');
	}
}

/**
 * TreeDataProvider for the Laravel Hero sidebar.
 * Renders a menu of feature buttons (Migrations, Routes, Packages, etc.)
 */
export class LaravelHeroSidebar implements vscode.TreeDataProvider<SidebarItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<SidebarItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor() {}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: SidebarItem): vscode.TreeItem {
		return element;
	}

	getChildren(_element?: SidebarItem): Thenable<SidebarItem[]> {
		// Root level items - these are the main features
		const items = [
			new SidebarItem('Migrations', 'laravel-hero.open-migrations', 'Manage database migrations'),
			new SidebarItem('Routes', 'laravel-hero.open-routes', 'View and test API routes'),
			new SidebarItem('Packages', 'laravel-hero.open-packages', 'Manage Laravel packages'),
			new SidebarItem('Model Graph', 'laravel-hero.open-model-graph', 'Visualize model relationships')
		];

		return Promise.resolve(items);
	}
}
