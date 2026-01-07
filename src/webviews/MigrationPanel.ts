import * as vscode from 'vscode';
import { ArtisanService, MigrationStatus } from '../services/ArtisanService';
import { LoggerService } from '../services/LoggerService';
import { WebviewUtils } from './lib/webviewUtils';

/**
 * Manages the Migrations webview panel.
 * Handles:
 * - Displaying migrations in a table
 * - Running individual migrations
 * - Running all migrations
 * - Creating new migrations
 */
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
	 * Generate HTML for the webview.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const bodyContent = `
			<h1>Laravel Migrations</h1>
			<div id="error-container"></div>
			
			<div class="actions">
				<button id="refresh-btn" class="primary-button">↻ Refresh</button>
				<button id="run-all-btn" class="primary-button">Run All</button>
				<button id="run-all-forced-btn" class="secondary-button">Force Run All</button>
				<button id="create-migration-btn" class="secondary-button">+ Create Migration</button>
			</div>

			<table>
				<thead>
					<tr>
						<th>#</th>
						<th>Migration Name</th>
						<th>Status</th>
						<th>Batch</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody id="migration-list">
					<tr><td colspan="5" class="loading"><span class="spinner"></span> Loading migrations...</td></tr>
				</tbody>
			</table>
		`;

		const scriptContent = `
			const vscode = acquireVsCodeApi();
			let migrations = [];

			// DOM Elements
			const list = document.getElementById('migration-list');
			const errorContainer = document.getElementById('error-container');
			const refreshBtn = document.getElementById('refresh-btn');
			const runAllBtn = document.getElementById('run-all-btn');
			const runAllForcedBtn = document.getElementById('run-all-forced-btn');
			const createBtn = document.getElementById('create-migration-btn');

			// Event Listeners
			refreshBtn.addEventListener('click', () => {
				vscode.postMessage({ command: 'refresh' });
			});

			runAllBtn.addEventListener('click', () => {
				vscode.postMessage({ command: 'request-confirm', action: 'run-all', message: 'Run all pending migrations?' });
			});

			runAllForcedBtn.addEventListener('click', () => {
				vscode.postMessage({ command: 'request-confirm', action: 'force-run-all', message: 'Force run all migrations? This will re-run already executed migrations.' });
			});

			createBtn.addEventListener('click', () => {
				vscode.postMessage({ command: 'show-create-dialog' });
			});

			// Handle messages from extension
			window.addEventListener('message', event => {
				const message = event.data;

				switch (message.command) {
					case 'migrations-loaded':
						migrations = message.data || [];
						errorContainer.innerHTML = '';
						if (message.error) {
							showWarning(message.error);
						}
						renderTable(migrations);
						break;

					case 'migration-running':
					case 'all-migrations-running':
					case 'migration-creating':
						// Show loading state
						break;

					case 'error':
					case 'migration-error':
					case 'all-migrations-error':
					case 'creation-error':
						showError(message.error);
						break;
				}
			});

			function showError(msg) {
				errorContainer.innerHTML = \`
					<div class="error-banner">
						<strong>Error:</strong> \${msg}
					</div>
				\`;
			}

			function showWarning(msg) {
				errorContainer.innerHTML = \`
					<div class="warning-banner">
						<strong>⚠ Warning:</strong> \${msg}
					</div>
				\`;
			}

			function renderTable(items) {
				list.innerHTML = '';
				if (!items || items.length === 0) {
					list.innerHTML = '<tr><td colspan="5">No migrations found.</td></tr>';
					return;
				}

				items.forEach((m, index) => {
					const tr = document.createElement('tr');
					const isRan = m.ran ? 'disabled' : '';
					const isRanAttr = m.ran ? 'disabled' : '';
					
					tr.innerHTML = \`
						<td>\${index + 1}</td>
						<td><code>\${m.name}</code></td>
						<td><span class="\${m.ran ? 'status-ran' : 'status-pending'}">\${m.ran ? '✓ Migrated' : '○ Pending'}</span></td>
						<td>\${m.batch || '-'}</td>
						<td>
							<button class="inline-button" \${isRanAttr} data-action="run" data-migration="\${m.name}">Run</button>
							<button class="inline-button secondary" data-action="force-run" data-migration="\${m.name}">Force</button>
						</td>
					\`;
					
					// Add event listeners to buttons
					const runBtn = tr.querySelector('[data-action="run"]');
					const forceBtn = tr.querySelector('[data-action="force-run"]');
					
					runBtn.addEventListener('click', (e) => {
						e.preventDefault();
						const migName = e.target.getAttribute('data-migration');
						vscode.postMessage({ command: 'request-confirm', action: 'run-migration', migration: migName, message: \`Run migration '\${migName}'?\` });
					});
					
					forceBtn.addEventListener('click', (e) => {
						e.preventDefault();
						const migName = e.target.getAttribute('data-migration');
						vscode.postMessage({ command: 'request-confirm', action: 'force-run-migration', migration: migName, message: \`Force run migration '\${migName}'? This will re-run it even if already executed.\` });
					});
					
					list.appendChild(tr);
				});
			}

			// Notify extension we're ready
			vscode.postMessage({ command: 'ready' });
		`;

		const additionalStyles = `
			table {
				width: 100%;
				border-collapse: collapse;
				margin-top: 20px;
				border: 1px solid var(--vscode-editorGroup-border);
			}

			th, td {
				text-align: left;
				padding: 8px 12px;
				border-bottom: 1px solid var(--vscode-editorGroup-border);
			}

			th {
				font-weight: 600;
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				position: sticky;
				top: 0;
			}

			code {
				background-color: var(--vscode-textCodeBlock-background);
				color: var(--vscode-textCodeBlock-foreground);
				padding: 2px 6px;
				border-radius: 3px;
				font-family: var(--vscode-editor-font-family);
				font-size: 0.9em;
			}

			.status-ran {
				color: var(--vscode-testing-iconPassed);
				font-weight: 600;
			}

			.status-pending {
				color: var(--vscode-testing-iconQueued);
				font-weight: 600;
			}

			.actions {
				margin-bottom: 15px;
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
			}

			.primary-button {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border: none;
				padding: 8px 16px;
				cursor: pointer;
				border-radius: 3px;
				font-weight: 500;
			}

			.primary-button:hover:not(:disabled) {
				background-color: var(--vscode-button-hoverBackground);
			}

			.primary-button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.secondary-button {
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
				border: none;
				padding: 8px 16px;
				cursor: pointer;
				border-radius: 3px;
				font-weight: 500;
			}

			.secondary-button:hover:not(:disabled) {
				background-color: var(--vscode-button-secondaryHoverBackground);
			}

			.inline-button {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border: none;
				padding: 4px 10px;
				cursor: pointer;
				border-radius: 2px;
				font-size: 0.85em;
				margin-right: 4px;
			}

			.inline-button:hover:not(:disabled) {
				background-color: var(--vscode-button-hoverBackground);
			}

			.inline-button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.inline-button.secondary {
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
			}

			.inline-button.secondary:hover:not(:disabled) {
				background-color: var(--vscode-button-secondaryHoverBackground);
			}
		`;

		return WebviewUtils.generateHtmlTemplate(
			this._panel.webview,
			this._extensionUri,
			'Laravel Migrations',
			bodyContent,
			scriptContent,
			additionalStyles
		);
	}
}
