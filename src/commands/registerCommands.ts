import * as vscode from 'vscode';
import { MigrationPanel } from '../webviews/migration-panel';
import { RoutesPanel } from '../webviews/routes-panel';
import { PackagesPanel } from '../webviews/packages-panel';
import { ModelGraphPanel } from '../webviews/model-graph-panel';
import { LoggerService } from '../services/LoggerService';

/**
 * Register all extension commands.
 */
export function registerCommands(context: vscode.ExtensionContext): void {
	LoggerService.info('Registering commands...');

	// Open sidebar view
	context.subscriptions.push(
		vscode.commands.registerCommand('laravel-hero.openView', async () => {
			LoggerService.info('openView command triggered');
			await vscode.commands.executeCommand('workbench.view.extension.laravelHeroContainer');
		})
	);

	// Open migrations panel
	context.subscriptions.push(
		vscode.commands.registerCommand('laravel-hero.open-migrations', () => {
			LoggerService.info('open-migrations command triggered');
			MigrationPanel.createOrShow(context.extensionUri);
		})
	);

	// Open routes panel (placeholder for future)
	context.subscriptions.push(
		vscode.commands.registerCommand('laravel-hero.open-routes', () => {
			LoggerService.info('open-routes command triggered');
			RoutesPanel.createOrShow(context.extensionUri);
		})
	);

	// Open packages panel (placeholder for future)
	context.subscriptions.push(
		vscode.commands.registerCommand('laravel-hero.open-packages', () => {
			LoggerService.info('open-packages command triggered');
			PackagesPanel.createOrShow(context.extensionUri);
		})
	);

	// Open model relationship graph panel
	context.subscriptions.push(
		vscode.commands.registerCommand('laravel-hero.open-model-graph', () => {
			LoggerService.info('open-model-graph command triggered');
			ModelGraphPanel.createOrShow(context.extensionUri);
		})
	);

	// Show output channel
	context.subscriptions.push(
		vscode.commands.registerCommand('laravel-hero.showOutput', () => {
			LoggerService.show();
		})
	);

	LoggerService.info('Commands registered successfully');
}
