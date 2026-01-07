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
			'laraval-hero.open-migrations': 'database',
			'laraval-hero.open-routes': 'git-branch',
			'laraval-hero.open-packages': 'package'
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
			new SidebarItem('Migrations', 'laraval-hero.open-migrations', 'Manage database migrations'),
			new SidebarItem('Routes', 'laraval-hero.open-routes', 'View and test API routes'),
			new SidebarItem('Packages', 'laraval-hero.open-packages', 'Manage Laravel packages')
		];

		return Promise.resolve(items);
	}
}
