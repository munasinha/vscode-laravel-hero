import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewUtils } from '../lib/webviewUtils';
import { LoggerService } from '../../services/LoggerService';
import { ArtisanService } from '../../services/ArtisanService';

export class MigrationPanel {

	public static currentPanel: MigrationPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _artisan: ArtisanService;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._artisan = new ArtisanService();

		LoggerService.info('MigrationPanel created');

		// Set initial HTML
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

		// Handle panel disposal
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from webview
		this._panel.webview.onDidReceiveMessage(
			(message) => this._handleWebviewMessage(message),
			null,
			this._disposables
		);
	}

	/**
	 * Create or show the migration panel.
	 */
	public static createOrShow(extensionUri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (MigrationPanel.currentPanel) {
			MigrationPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'laravelHeroMigrations',
			'Laravel: Migrations',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true
			}
		);

		MigrationPanel.currentPanel = new MigrationPanel(panel, extensionUri);
		MigrationPanel.currentPanel._loadMigrations();
	}

	/**
	 * Dispose resources.
	 */
	public dispose(): void {
		MigrationPanel.currentPanel = undefined;
		this._panel.dispose();
		this._artisan.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	/**
	 * Load and send migrations data to webview.
	 */
	private async _loadMigrations(): Promise<void> {
		try {
			const result = await this._artisan.getMigrations();
			LoggerService.info(`Loaded ${result.migrations.length} migrations`);

			this._panel.webview.postMessage({
				command: 'migrations-loaded',
				data: result.migrations,
				error: result.error
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to load migrations', err);
			this._panel.webview.postMessage({
				command: 'error',
				error: errorMsg
			});
		}
	}

	/**
	 * Handle messages from webview.
	 */
	private async _handleWebviewMessage(message: any): Promise<void> {
		try {
			switch (message.command) {
				case 'ready':
					await this._loadMigrations();
					break;

				case 'refresh':
					await this._loadMigrations();
					break;

				case 'request-confirm':
					await this._handleConfirmRequest(message);
					break;

				case 'show-create-dialog':
					await this._showCreateMigrationDialog();
					break;

				case 'create-migration':
					await this._createMigration(message.name);
					break;

				case 'open-migration-file':
					await this._openMigrationFile(message.migration);
					break;

				default:
					LoggerService.warn(`Unknown command from webview: ${message.command}`);
			}
		} catch (err) {
			LoggerService.error(`Error handling webview message: ${message.command}`, err);
			const errorMsg = err instanceof Error ? err.message : String(err);
			this._panel.webview.postMessage({
				command: 'error',
				error: errorMsg
			});
		}
	}

	/**
	 * Handle confirmation requests from webview.
	 */
	private async _handleConfirmRequest(message: any): Promise<void> {
		const action = message.action;
		const confirmed = await vscode.window.showInformationMessage(
			message.message,
			{ modal: true },
			'Yes'
		);

		if (!confirmed) {
			return;
		}

		switch (action) {
			case 'run-migration':
				await this._runMigration(message.migration, false);
				break;

			case 'force-run-migration':
				await this._runMigration(message.migration, true);
				break;

			case 'run-all':
				await this._runAllMigrations(false);
				break;

			case 'force-run-all':
				await this._runAllMigrations(true);
				break;
		}
	}

	/**
	 * Run a specific migration.
	 */
	private async _runMigration(name: string, force: boolean): Promise<void> {
		LoggerService.info(`Running migration: ${name}`, { force });

		try {
			this._panel.webview.postMessage({
				command: 'migration-running',
				name
			});

			await this._artisan.runMigration(name, force);

			vscode.window.showInformationMessage(`✓ Migration '${name}' completed successfully`);

			// Refresh the list
			await this._loadMigrations();
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error(`Failed to run migration: ${name}`, err);
			vscode.window.showErrorMessage(`Failed to run migration '${name}': ${errorMsg}`);

			this._panel.webview.postMessage({
				command: 'migration-error',
				name,
				error: errorMsg
			});
		}
	}

	/**
	 * Run all migrations.
	 */
	private async _runAllMigrations(force: boolean): Promise<void> {
		LoggerService.info('Running all migrations', { force });

		try {
			this._panel.webview.postMessage({
				command: 'all-migrations-running'
			});

			await this._artisan.runAllMigrations(force);

			vscode.window.showInformationMessage('✓ All pending migrations completed successfully');

			// Refresh the list
			await this._loadMigrations();
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to run all migrations', err);
			vscode.window.showErrorMessage(`Failed to run all migrations: ${errorMsg}`);

			this._panel.webview.postMessage({
				command: 'all-migrations-error',
				error: errorMsg
			});
		}
	}

	/**
	 * Show input dialog for creating a migration.
	 */
	private async _showCreateMigrationDialog(): Promise<void> {
		const name = await vscode.window.showInputBox({
			prompt: 'Enter migration name',
			placeHolder: 'e.g., create_users_table',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Migration name cannot be empty';
				}
				if (!/^[a-z0-9_]+$/.test(value)) {
					return 'Migration name can only contain lowercase letters, numbers, and underscores';
				}
				return undefined;
			}
		});

		if (name) {
			await this._createMigration(name);
		}
	}

	/**
	 * Create a new migration.
	 */
	private async _createMigration(name: string): Promise<void> {
		if (!name || name.trim().length === 0) {
			vscode.window.showErrorMessage('Migration name cannot be empty');
			return;
		}

		LoggerService.info(`Creating migration: ${name}`);

		try {
			this._panel.webview.postMessage({
				command: 'migration-creating'
			});

			const output = await this._artisan.createMigration(name);

			vscode.window.showInformationMessage(`✓ Migration '${name}' created successfully`);
			LoggerService.info(`Migration created: ${output}`);

			// Refresh the list
			await this._loadMigrations();
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error(`Failed to create migration: ${name}`, err);
			vscode.window.showErrorMessage(`Failed to create migration: ${errorMsg}`);

			this._panel.webview.postMessage({
				command: 'creation-error',
				error: errorMsg
			});
		}
	}

	/**
	 * Generate HTML for webview using external files.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const panelDir = vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'migration-panel');
		
		// Read template HTML
		const templatePath = panelDir.fsPath;
		const templateFile = path.join(templatePath, 'template.html');
		let bodyContent = '';
		
		try {
			bodyContent = fs.readFileSync(templateFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read template.html:', err instanceof Error ? err.message : String(err));
			bodyContent = '<h1>Error loading template</h1>';
		}

		// Read stylesheet
		const cssFile = path.join(templatePath, 'styles.css');
		let additionalStyles = '';
		
		try {
			additionalStyles = fs.readFileSync(cssFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read styles.css:', err instanceof Error ? err.message : String(err));
		}

		// Read JavaScript
		const jsFile = path.join(templatePath, 'script.js');
		let scriptContent = '';
		
		try {
			scriptContent = fs.readFileSync(jsFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read script.js:', err instanceof Error ? err.message : String(err));
		}

		return WebviewUtils.generateHtmlTemplate(
			webview,
			this._extensionUri,
			'Laravel Migrations',
			bodyContent,
			scriptContent,
			additionalStyles
		);
	}

	/**
	 * Open a migration file in the editor.
	 */
	private async _openMigrationFile(migrationName: string): Promise<void> {
		try {
			LoggerService.info(`Opening migration file: ${migrationName}`);

			// Get the workspace folder
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder is open');
				return;
			}

			const workspaceRoot = workspaceFolders[0].uri;

			// Construct the migration file path
			// Migrations are typically in database/migrations/
			const migrationPath = vscode.Uri.joinPath(workspaceRoot, 'database', 'migrations', `${migrationName}.php`);

			// Check if file exists
			try {
				await vscode.workspace.fs.stat(migrationPath);
			} catch (err) {
				LoggerService.error(`Migration file not found: ${migrationPath.fsPath}`);
				vscode.window.showErrorMessage(`Migration file not found: database/migrations/${migrationName}.php`);
				return;
			}

			// Open the file in the editor
			const document = await vscode.workspace.openTextDocument(migrationPath);
			await vscode.window.showTextDocument(document);

			LoggerService.info(`Successfully opened migration file: ${migrationName}`);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error(`Failed to open migration file: ${migrationName}`, err);
			vscode.window.showErrorMessage(`Failed to open migration file: ${errorMsg}`);
		}
	}
}
