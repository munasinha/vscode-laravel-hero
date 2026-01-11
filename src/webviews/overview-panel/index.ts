import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewUtils } from '../lib/webviewUtils';
import { LoggerService } from '../../services/LoggerService';
import { OverviewService } from '../../services/OverviewService';

export class OverviewPanel {
	public static currentPanel: OverviewPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _overview: OverviewService;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._overview = new OverviewService();

		LoggerService.info('OverviewPanel created');

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

		if (OverviewPanel.currentPanel) {
			OverviewPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'laravelHeroOverview',
			'Laravel: Overview',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true
			}
		);

		OverviewPanel.currentPanel = new OverviewPanel(panel, extensionUri);
		OverviewPanel.currentPanel._loadOverview();
	}

	public dispose(): void {
		OverviewPanel.currentPanel = undefined;
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private async _loadOverview(): Promise<void> {
		try {
			const data = await this._overview.getOverview();

			this._panel.webview.postMessage({
				command: 'overview-loaded',
				data
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to load overview', err);
			this._panel.webview.postMessage({
				command: 'overview-error',
				error: errorMsg
			});
		}
	}

	private async _handleWebviewMessage(message: any): Promise<void> {
		try {
			switch (message.command) {
				case 'ready':
				case 'refresh':
					await this._loadOverview();
					break;

				case 'run-artisan':
					await this._runArtisanCommand(message.id);
					break;
			}
		} catch (err) {
			LoggerService.error(`Error handling overview message: ${message.command}`, err);
			const errorMsg = err instanceof Error ? err.message : String(err);
			this._panel.webview.postMessage({
				command: 'overview-error',
				error: errorMsg
			});
		}
	}

	private async _runArtisanCommand(commandId: string): Promise<void> {
		if (!commandId) {
			return;
		}

		this._panel.webview.postMessage({
			command: 'artisan-started',
			id: commandId
		});

		try {
			const output = await this._overview.runArtisanCommand(commandId);

			this._panel.webview.postMessage({
				command: 'artisan-finished',
				id: commandId,
				success: true,
				output
			});
			vscode.window.showInformationMessage(`Artisan command completed: ${commandId}`);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error(`Artisan command failed: ${commandId}`, err);
			this._panel.webview.postMessage({
				command: 'artisan-finished',
				id: commandId,
				success: false,
				error: errorMsg
			});
			vscode.window.showErrorMessage(`Artisan command failed: ${errorMsg}`);
		}

		await this._loadOverview();
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const panelDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webviews', 'overview-panel');

		const templatePath = panelDir.fsPath;
		const templateFile = path.join(templatePath, 'template.html');
		let bodyContent = '';

		try {
			bodyContent = fs.readFileSync(templateFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read overview template.html:', err instanceof Error ? err.message : String(err));
			bodyContent = '<h1>Error loading template</h1>';
		}

		const iconMap: Record<string, string> = {
			'icon-refresh': 'arrow-path.svg',
			'icon-play': 'play.svg'
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
			LoggerService.error('Failed to read overview styles.css:', err instanceof Error ? err.message : String(err));
		}

		const jsFile = path.join(templatePath, 'script.js');
		let scriptContent = '';

		try {
			scriptContent = fs.readFileSync(jsFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read overview script.js:', err instanceof Error ? err.message : String(err));
		}

		return WebviewUtils.generateHtmlTemplate(
			webview,
			this._extensionUri,
			'Laravel Overview',
			bodyContent,
			scriptContent,
			additionalStyles
		);
	}
}
