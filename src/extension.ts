import * as vscode from 'vscode';
import { LaravelHeroSidebar } from './providers/LaravelHeroSidebar';
import { registerCommands } from './commands/registerCommands';
import { LoggerService } from './services/LoggerService';
import { WorkspaceService } from './services/WorkspaceService';

export function activate(context: vscode.ExtensionContext) {
	LoggerService.initialize();
	LoggerService.info('=== Laravel Hero Extension Activating ===');

	try {
		// Register the sidebar TreeDataProvider
		LoggerService.info('Registering sidebar TreeDataProvider...');
		const sidebar = new LaravelHeroSidebar();
		context.subscriptions.push(
			vscode.window.registerTreeDataProvider('laravel-hero.main-panel', sidebar)
		);
		LoggerService.info('✓ Sidebar registered successfully');

		// Register all commands
		registerCommands(context);

		// Check workspace on activation
		try {
			if (WorkspaceService.isLaravelProject()) {
				LoggerService.info('✓ Laravel project detected');
				vscode.window.showInformationMessage('Laravel Hero: Ready!');
			} else {
				LoggerService.warn('No Laravel project detected in workspace');
			}
		} catch (err) {
			LoggerService.warn('Could not verify Laravel project', err);
		}

		LoggerService.info('=== Laravel Hero Extension Activated ===');
	} catch (error) {
		LoggerService.error('Failed to activate extension', error);
		vscode.window.showErrorMessage(`Laravel Hero activation failed: ${error}`);
	}
}

export function deactivate() {
	LoggerService.info('Laravel Hero Extension Deactivating');
}
