import * as vscode from 'vscode';

/**
 * Unified logging service for Laravel Hero extension.
 * Logs to both console and VS Code output channel.
 */
export class LoggerService {
	private static outputChannel: vscode.OutputChannel | undefined;

	static initialize(): void {
		if (!LoggerService.outputChannel) {
			LoggerService.outputChannel = vscode.window.createOutputChannel('Laravel Hero', { log: true });
		}
	}

	static info(message: string, data?: any): void {
		LoggerService.initialize();
		console.log(`[Laravel Hero] ${message}`, data);
		LoggerService.outputChannel?.appendLine(`[INFO] ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
	}

	static warn(message: string, data?: any): void {
		LoggerService.initialize();
		console.warn(`[Laravel Hero] ${message}`, data);
		LoggerService.outputChannel?.appendLine(`[WARN] ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
	}

	static error(message: string, error?: any): void {
		LoggerService.initialize();
		console.error(`[Laravel Hero] ${message}`, error);
		const errorMsg = error instanceof Error ? error.message : String(error);
		LoggerService.outputChannel?.appendLine(`[ERROR] ${message}: ${errorMsg}`);
	}

	static debug(message: string, data?: any): void {
		LoggerService.initialize();
		console.debug(`[Laravel Hero DEBUG] ${message}`, data);
		LoggerService.outputChannel?.appendLine(`[DEBUG] ${message}${data ? ' ' + JSON.stringify(data) : ''}`);
	}

	static show(): void {
		LoggerService.initialize();
		LoggerService.outputChannel?.show();
	}
}
