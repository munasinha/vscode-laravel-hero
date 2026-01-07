import { getNonce } from '../../utils/getNonce';
import * as vscode from 'vscode';

/**
 * Message types between webview and extension host.
 */
export interface WebviewMessage {
	command: string;
	[key: string]: any;
}

export interface MigrationData {
	ran: boolean;
	name: string;
	batch?: number;
}

/**
 * Common utilities for webview HTML generation.
 */
export class WebviewUtils {
	/**
	 * Generate a safe CSP-compliant HTML template with VS Code API support.
	 */
	static generateHtmlTemplate(
		webview: vscode.Webview,
		extensionUri: vscode.Uri,
		title: string,
		bodyContent: string,
		scriptContent: string,
		additionalStyles: string = ''
	): string {
		const nonce = getNonce();
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(extensionUri, 'media', 'vscode.css')
		);

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet">
	<title>${title}</title>
	<style>
		body {
			padding: 20px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}
		.error-banner {
			padding: 10px;
			background-color: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			color: var(--vscode-inputValidation-errorForeground);
			margin-bottom: 15px;
			border-radius: 4px;
		}
		.warning-banner {
			padding: 10px;
			background-color: var(--vscode-inputValidation-warningBackground);
			border: 1px solid var(--vscode-inputValidation-warningBorder);
			color: var(--vscode-inputValidation-warningForeground);
			margin-bottom: 15px;
			border-radius: 4px;
		}
		.info-banner {
			padding: 10px;
			background-color: var(--vscode-inputValidation-infoBackground);
			border: 1px solid var(--vscode-inputValidation-infoBorder);
			color: var(--vscode-inputValidation-infoForeground);
			margin-bottom: 15px;
			border-radius: 4px;
		}
		.loading {
			display: inline-block;
			padding: 0 8px;
		}
		.spinner {
			display: inline-block;
			width: 12px;
			height: 12px;
			border: 2px solid var(--vscode-foreground);
			border-radius: 50%;
			border-top-color: transparent;
			animation: spin 0.6s linear infinite;
		}
		@keyframes spin {
			to { transform: rotate(360deg); }
		}
		${additionalStyles}
	</style>
</head>
<body>
	${bodyContent}
	<script nonce="${nonce}">
		${scriptContent}
	</script>
</body>
</html>`;
	}
}
