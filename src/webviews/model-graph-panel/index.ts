import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { WebviewUtils } from '../lib/webviewUtils';
import { LoggerService } from '../../services/LoggerService';
import { ModelGraphService } from '../../services/ModelGraphService';

export class ModelGraphPanel {
	public static currentPanel: ModelGraphPanel | undefined;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _graphService: ModelGraphService;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._graphService = new ModelGraphService();

		LoggerService.info('ModelGraphPanel created');

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			(message) => this._handleWebviewMessage(message),
			null,
			this._disposables
		);
	}

	/**
	 * Create or reveal the Model Relationship Graph panel.
	 */
	public static createOrShow(extensionUri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (ModelGraphPanel.currentPanel) {
			ModelGraphPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'laravelHeroModelGraph',
			'Laravel: Model Relationship Graph',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true
			}
		);

		ModelGraphPanel.currentPanel = new ModelGraphPanel(panel, extensionUri);
		ModelGraphPanel.currentPanel._loadGraph();
	}

	public dispose(): void {
		ModelGraphPanel.currentPanel = undefined;
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	/**
	 * Load graph data and push to the webview.
	 */
	private async _loadGraph(): Promise<void> {
		try {
			const result = await this._graphService.getModelGraph();
			LoggerService.info(`Model graph loaded: ${result.nodes.length} nodes / ${result.relationships.length} edges`);

			this._panel.webview.postMessage({
				command: 'model-graph-data',
				data: result
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to load model graph', err);
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
					await this._loadGraph();
					break;

				case 'open-file':
					await this._openFile(message.filePath);
					break;
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.error(`ModelGraphPanel message failed: ${message.command}`, err);
			this._panel.webview.postMessage({
				command: 'error',
				error: errorMsg
			});
		}
	}

	/**
	 * Open a file path in the editor.
	 */
	private async _openFile(filePath: string | undefined): Promise<void> {
		if (!filePath) {
			return;
		}

		try {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
			await vscode.window.showTextDocument(document);
		} catch (err) {
			LoggerService.error(`Failed to open file ${filePath}`, err);
			const message = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Could not open file: ${message}`);
		}
	}

	/**
	 * Assemble HTML for the webview from template assets.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const panelDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webviews', 'model-graph-panel');
		const templatePath = panelDir.fsPath;
		const templateFile = path.join(templatePath, 'template.html');
		let bodyContent = '';

		try {
			bodyContent = fs.readFileSync(templateFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read model graph template.html:', err instanceof Error ? err.message : String(err));
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
			LoggerService.error('Failed to read model graph styles.css:', err instanceof Error ? err.message : String(err));
		}

		const jsFile = path.join(templatePath, 'script.js');
		let scriptContent = '';

		try {
			scriptContent = fs.readFileSync(jsFile, 'utf8');
		} catch (err) {
			LoggerService.error('Failed to read model graph script.js:', err instanceof Error ? err.message : String(err));
		}

		return WebviewUtils.generateHtmlTemplate(
			webview,
			this._extensionUri,
			'Laravel Model Relationship Graph',
			bodyContent,
			scriptContent,
			additionalStyles
		);
	}
}
