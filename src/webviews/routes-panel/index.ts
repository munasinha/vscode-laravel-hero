import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewUtils } from '../lib/webviewUtils';
import { LoggerService } from '../../services/LoggerService';
import { ArtisanService } from '../../services/ArtisanService';

export class RoutesPanel {

	public static currentPanel: RoutesPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _artisan: ArtisanService;
	private _routes: any[] = [];
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._artisan = new ArtisanService();

		LoggerService.info('RoutesPanel created');

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			(message) => this._handleWebviewMessage(message),
			null,
			this._disposables
		);
	}

	public static createOrShow(extensionUri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (RoutesPanel.currentPanel) {
			RoutesPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'laravelHeroRoutes',
			'Laravel: Routes',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true
			}
		);

		RoutesPanel.currentPanel = new RoutesPanel(panel, extensionUri);
		RoutesPanel.currentPanel._loadRoutes();
	}

	public dispose(): void {
		RoutesPanel.currentPanel = undefined;
		this._panel.dispose();
		this._artisan.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private async _loadRoutes(): Promise<void> {
		try {
			const result = await this._artisan.getRoutes();
			LoggerService.info(`Loaded ${result.routes.length} routes`);
			this._routes = result.routes;

			this._panel.webview.postMessage({
				command: 'routes-loaded',
				data: result.routes,
				error: result.error
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to load routes', err);
			this._panel.webview.postMessage({
				command: 'error',
				error: errorMsg
			});
		}
	}

	private async _handleWebviewMessage(message: any): Promise<void> {
		try {
			switch (message.command) {
				case 'ready':
				case 'refresh':
					await this._loadRoutes();
					break;

				case 'copy-text':
					await this._copyText(message.text);
					break;

				case 'export-csv':
					await this._exportCsv();
					break;
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

	private async _copyText(text: string): Promise<void> {
		if (!text) {
			return;
		}

		try {
			await vscode.env.clipboard.writeText(text);
			vscode.window.showInformationMessage('Route URL copied to clipboard');
		} catch (err) {
			LoggerService.error('Failed to copy to clipboard', err);
			vscode.window.showErrorMessage('Failed to copy route URL');
		}
	}

	private async _exportCsv(): Promise<void> {
		if (!this._routes || this._routes.length === 0) {
			vscode.window.showWarningMessage('No routes to export');
			return;
		}

		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file('routes.csv'),
			filters: { CSV: ['csv'] },
			saveLabel: 'Export Routes CSV'
		});

		if (!uri) {
			return;
		}

		try {
			const header = ['Method', 'URI', 'Name', 'Action', 'Middleware', 'Permissions', 'Domain', 'Full URL'];
			const lines = [header.join(',')];

			for (const route of this._routes) {
				const row = [
					(route.methods || []).join(' | '),
					route.uri || '',
					route.name || '',
					route.action || '',
					(route.middleware || []).join('; '),
					(route.permissions || []).join('; '),
					route.domain || '',
					route.fullUrl || ''
				].map(value => {
					const safe = String(value ?? '');
					if (safe.includes('"') || safe.includes(',') || safe.includes('\n')) {
						return `"${safe.replace(/"/g, '""')}"`;
					}
					return safe;
				});
				lines.push(row.join(','));
			}

			const csvContent = lines.join('\n');
			await fs.promises.writeFile(uri.fsPath, csvContent, 'utf8');
			vscode.window.showInformationMessage(`Routes exported to ${uri.fsPath}`);
		} catch (err) {
			LoggerService.error('Failed to export routes CSV', err);
			const msg = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Export failed: ${msg}`);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const panelDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webviews', 'routes-panel');

		const templatePath = panelDir.fsPath;
		const templateFile = path.join(templatePath, 'template.html');
		let bodyContent = '';

		try {
			bodyContent = fs.readFileSync(templateFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read routes template.html:', err instanceof Error ? err.message : String(err));
			bodyContent = '<h1>Error loading template</h1>';
		}

		const iconMap: Record<string, string> = {
			'icon-refresh': 'arrow-path.svg'
		};

		for (const [token, fileName] of Object.entries(iconMap)) {
			const iconUri = webview.asWebviewUri(
				vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', fileName)
			);
			bodyContent = bodyContent.replaceAll(`{{${token}}}`, iconUri.toString());
		}

		const cssFile = path.join(templatePath, 'styles.css');
		let additionalStyles = '';

		try {
			additionalStyles = fs.readFileSync(cssFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read routes styles.css:', err instanceof Error ? err.message : String(err));
		}

		const jsFile = path.join(templatePath, 'script.js');
		let scriptContent = '';

		try {
			scriptContent = fs.readFileSync(jsFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read routes script.js:', err instanceof Error ? err.message : String(err));
		}

		return WebviewUtils.generateHtmlTemplate(
			webview,
			this._extensionUri,
			'Laravel Routes',
			bodyContent,
			scriptContent,
			additionalStyles
		);
	}
}
