import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewUtils } from '../lib/webviewUtils';
import { LoggerService } from '../../services/LoggerService';
import { ComposerService } from '../../services/ComposerService';

export class PackagesPanel {
	public static currentPanel: PackagesPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _composer: ComposerService;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._composer = new ComposerService();

		LoggerService.info('PackagesPanel created');

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			(message) => this._handleWebviewMessage(message),
			null,
			this._disposables
		);
	}

	/**
	 * Create or show the packages panel.
	 */
	public static createOrShow(extensionUri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (PackagesPanel.currentPanel) {
			PackagesPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'laravelHeroPackages',
			'Laravel: Packages',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true
			}
		);

		PackagesPanel.currentPanel = new PackagesPanel(panel, extensionUri);
		PackagesPanel.currentPanel._loadPackages();
	}

	/**
	 * Dispose resources.
	 */
	public dispose(): void {
		PackagesPanel.currentPanel = undefined;
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	/**
	 * Load packages and send them to the webview.
	 */
	private async _loadPackages(): Promise<void> {
		try {
			const result = await this._composer.getPackages();

			this._panel.webview.postMessage({
				command: 'packages-loaded',
				data: result.packages,
				error: result.error,
				warnings: result.warnings
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to load packages', err);
			this._panel.webview.postMessage({
				command: 'error',
				error: errorMsg
			});
		}
	}

	/**
	 * Handle messages from the webview.
	 */
	private async _handleWebviewMessage(message: any): Promise<void> {
		try {
			switch (message.command) {
				case 'ready':
				case 'refresh':
					await this._loadPackages();
					break;

				case 'open-packagist':
					await this._openPackagist(message.package);
					break;
			}
		} catch (err) {
			LoggerService.error(`Error handling packages message: ${message.command}`, err);
			const errorMsg = err instanceof Error ? err.message : String(err);
			this._panel.webview.postMessage({
				command: 'error',
				error: errorMsg
			});
		}
	}

	/**
	 * Open a package on packagist.org.
	 */
	private async _openPackagist(packageName: string): Promise<void> {
		if (!packageName) {
			return;
		}

		const url = `https://packagist.org/packages/${packageName}`;
		LoggerService.info(`Opening Packagist for ${packageName}`);
		await vscode.env.openExternal(vscode.Uri.parse(url));
	}

	/**
	 * Generate HTML for webview using external files.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const panelDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webviews', 'packages-panel');

		const templatePath = panelDir.fsPath;
		const templateFile = path.join(templatePath, 'template.html');
		let bodyContent = '';

		try {
			bodyContent = fs.readFileSync(templateFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read packages template.html:', err instanceof Error ? err.message : String(err));
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
			LoggerService.error('Failed to read packages styles.css:', err instanceof Error ? err.message : String(err));
		}

		const jsFile = path.join(templatePath, 'script.js');
		let scriptContent = '';

		try {
			scriptContent = fs.readFileSync(jsFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read packages script.js:', err instanceof Error ? err.message : String(err));
		}

		return WebviewUtils.generateHtmlTemplate(
			webview,
			this._extensionUri,
			'Laravel Packages',
			bodyContent,
			scriptContent,
			additionalStyles
		);
	}
}
