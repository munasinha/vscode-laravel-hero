import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Handles workspace context and Laravel project detection.
 */
export class WorkspaceService {
	/**
	 * Get the primary workspace folder.
	 * Throws error if no workspace is open.
	 */
	static getWorkspaceRoot(): string {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			throw new Error('No workspace open. Please open a Laravel project folder.');
		}
		return folders[0].uri.fsPath;
	}

	/**
	 * Check if the workspace is a Laravel project.
	 * Looks for composer.json and artisan file.
	 */
	static isLaravelProject(): boolean {
		try {
			const root = WorkspaceService.getWorkspaceRoot();
			const composerPath = path.join(root, 'composer.json');
			const artisanPath = path.join(root, 'artisan');
			return fs.existsSync(composerPath) && fs.existsSync(artisanPath);
		} catch {
			return false;
		}
	}

	/**
	 * Get the configured PHP command from settings.
	 * Falls back to 'php' if not configured.
	 */
	static getPhpCommand(): string {
		const config = vscode.workspace.getConfiguration('laravelHero');
		const phpCmd = config.get<string>('phpCommand');
		return phpCmd || 'php';
	}

	/**
	 * Check if PHP is available in the system.
	 */
	static async isPhpAvailable(): Promise<boolean> {
		const { execSync } = await import('child_process');
		try {
			const phpCmd = WorkspaceService.getPhpCommand();
			execSync(`${phpCmd} -v`, { stdio: 'pipe', timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get the migrations directory path.
	 */
	static getMigrationsDir(): string {
		const root = WorkspaceService.getWorkspaceRoot();
		return path.join(root, 'database', 'migrations');
	}

	/**
	 * Check if migrations directory exists.
	 */
	static hasMigrationsDir(): boolean {
		try {
			const dir = WorkspaceService.getMigrationsDir();
			return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
		} catch {
			return false;
		}
	}
}
