import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { LoggerService } from './LoggerService';
import { WorkspaceService } from './WorkspaceService';

export interface MigrationStatus {
	ran: boolean;
	name: string;
	batch?: number;
}

/**
 * Service to execute Laravel artisan commands and manage migrations.
 * Handles:
 * - Migration listing and status
 * - Running individual migrations
 * - Forcing migrations
 * - Creating new migrations
 * 
 * Uses VS Code Terminal API for better UX and output capture.
 */
export class ArtisanService {
	private terminal: vscode.Terminal | undefined;

	constructor() {
		LoggerService.info('ArtisanService initialized');
	}

	/**
	 * Get or create a dedicated terminal for artisan commands.
	 */
	private getOrCreateTerminal(): vscode.Terminal {
		if (!this.terminal || this.terminal.exitStatus) {
			const root = WorkspaceService.getWorkspaceRoot();
			this.terminal = vscode.window.createTerminal({
				name: 'Laravel Artisan',
				cwd: root,
				shellPath: undefined
			});
		}
		return this.terminal;
	}

	/**
	 * Execute an artisan command via child_process and return stdout.
	 * This is used for commands where we need the output directly (like migrate:status --json).
	 */
	private async execSync(command: string, options: { silent?: boolean } = {}): Promise<string> {
		const root = WorkspaceService.getWorkspaceRoot();
		const phpCmd = WorkspaceService.getPhpCommand();

		// Replace 'php' prefix with configured command if needed
		let finalCommand = command;
		if (command.startsWith('php ')) {
			finalCommand = phpCmd + command.substring(3);
		}

		LoggerService.debug(`Executing (sync): ${finalCommand}`, { cwd: root });

		return new Promise((resolve, reject) => {
			cp.exec(finalCommand, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
				if (err) {
					if (!options.silent) {
						LoggerService.error(`Command failed: ${finalCommand}`, stderr);
					}

					// Provide helpful error messages
					if (stdout.includes('vendor/autoload.php') || stderr.includes('vendor/autoload.php')) {
						reject(new Error('Laravel dependencies missing. Please run `composer install` in your project root.'));
					} else if (stderr.includes('PHP version')) {
						reject(new Error('PHP Version Mismatch. Check "laravelHero.phpCommand" setting.'));
					} else {
						reject(new Error(stderr || err.message));
					}
				} else {
					LoggerService.debug(`Command succeeded: ${finalCommand}`, { outputLength: stdout.length });
					resolve(stdout.trim());
				}
			});
		});
	}

	/**
	 * Get all migrations with their status.
	 * Merges file system data with artisan status.
	 */
	public async getMigrations(): Promise<{ migrations: MigrationStatus[]; error?: string }> {
		// 1. Get files from disk (works offline)
		let files: MigrationStatus[] = [];
		try {
			files = await this.getMigrationFiles();
			LoggerService.info(`Found ${files.length} migration files on disk`);
		} catch (err) {
			LoggerService.warn('Failed to scan migration files', err);
		}

		// 2. Try to get status from artisan
		let statuses: MigrationStatus[] = [];
		let errorMsg: string | undefined;

		try {
			// Check if PHP is available
			await this.execSync('php -v', { silent: true });

			// Try JSON output first (more reliable)
			try {
				const jsonOut = await this.execSync('php artisan migrate:status --json', { silent: true });
				statuses = JSON.parse(jsonOut);
				LoggerService.info(`Got migration status for ${statuses.length} items`);
			} catch (jsonErr) {
				// Fallback to text parsing
				LoggerService.warn('JSON format failed, trying text format', jsonErr);
				const textOut = await this.execSync('php artisan migrate:status', { silent: true });
				statuses = this.parseMigrationTable(textOut);
			}
		} catch (cmdErr) {
			LoggerService.warn('Failed to fetch migration status from artisan', cmdErr);
			errorMsg = cmdErr instanceof Error ? cmdErr.message : String(cmdErr);
		}

		// 3. Merge statuses into files
		const merged = files.map(f => {
			const status = statuses.find(s => s.name === f.name);
			return status ? { ...f, ran: status.ran, batch: status.batch } : f;
		});

		return { migrations: merged, error: errorMsg };
	}

	/**
	 * Get migration files from disk.
	 */
	private async getMigrationFiles(): Promise<MigrationStatus[]> {
		const migrationDir = WorkspaceService.getMigrationsDir();
		if (!fs.existsSync(migrationDir)) {
			return [];
		}

		const files = await fs.promises.readdir(migrationDir);
		return files
			.filter(f => f.endsWith('.php'))
			.map(f => ({
				name: path.basename(f, '.php'),
				ran: false,
				batch: undefined
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Parse migration status from text output.
	 * Handles both table and dot-style formats from different Laravel versions.
	 */
	private parseMigrationTable(output: string): MigrationStatus[] {
		const lines = output.split('\n').filter(l => l.trim().length > 0);
		const migrations: MigrationStatus[] = [];

		for (const line of lines) {
			// Skip headers and separators
			if (line.includes('Migration') || line.includes('Batch') || line.match(/^\s*\+?-+\+?/)) {
				continue;
			}

			// Table format: "| Yes  | 2014_10_12_000000_create_users_table | 1 |"
			if (line.includes('|')) {
				const parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0);
				if (parts.length >= 2) {
					const statusPart = parts[0];
					const namePart = parts[1];
					const batchPart = parts[2];

					migrations.push({
						ran: statusPart === 'Yes' || statusPart === 'Ran',
						name: namePart,
						batch: batchPart ? parseInt(batchPart, 10) : undefined
					});
				}
			}
			// Dot format: "2014_10_12_000000_create_users_table ................ [1] Ran"
			else if (line.includes('.')) {
				const dotMatch = line.match(/^\s*(\S+?)\s*\.+\s*(?:\[(\d+)\])?\s*(Ran|Pending)\s*$/i);
				if (dotMatch) {
					migrations.push({
						ran: dotMatch[3].toLowerCase() === 'ran',
						name: dotMatch[1],
						batch: dotMatch[2] ? parseInt(dotMatch[2], 10) : undefined
					});
				}
			}
		}

		return migrations;
	}

	/**
	 * Run a specific migration.
	 */
	public async runMigration(migrationName: string, force: boolean = false): Promise<void> {
		const root = WorkspaceService.getWorkspaceRoot();

		// Find the actual file to get the correct path
		const files = await this.getMigrationFiles();
		const found = files.find(f => f.name === migrationName);

		if (!found) {
			throw new Error(`Migration file not found: ${migrationName}`);
		}

		const relativePath = path.join('database', 'migrations', migrationName + '.php');
		const forceFlag = force ? ' --force' : '';
		const command = `php artisan migrate --path=${relativePath}${forceFlag}`;

		LoggerService.info(`Running migration: ${migrationName}`, { force });

		return new Promise((resolve, reject) => {
			cp.exec(command, { cwd: root }, (err, stdout, stderr) => {
				if (err) {
					LoggerService.error(`Migration failed: ${migrationName}`, stderr);
					reject(new Error(stderr || err.message));
				} else {
					LoggerService.info(`Migration succeeded: ${migrationName}`);
					resolve();
				}
			});
		});
	}

	/**
	 * Run all pending migrations.
	 */
	public async runAllMigrations(force: boolean = false): Promise<void> {
		const forceFlag = force ? ' --force' : '';
		const command = `php artisan migrate${forceFlag}`;

		LoggerService.info('Running all pending migrations', { force });

		const root = WorkspaceService.getWorkspaceRoot();

		return new Promise((resolve, reject) => {
			cp.exec(command, { cwd: root }, (err, stdout, stderr) => {
				if (err) {
					LoggerService.error('Migrate all failed', stderr);
					reject(new Error(stderr || err.message));
				} else {
					LoggerService.info('All migrations completed');
					resolve();
				}
			});
		});
	}

	/**
	 * Create a new migration file.
	 */
	public async createMigration(name: string): Promise<string> {
		const root = WorkspaceService.getWorkspaceRoot();
		const command = `php artisan make:migration ${name}`;

		LoggerService.info(`Creating migration: ${name}`);

		return new Promise((resolve, reject) => {
			cp.exec(command, { cwd: root }, (err, stdout, stderr) => {
				if (err) {
					LoggerService.error('Create migration failed', stderr);
					reject(new Error(stderr || err.message));
				} else {
					LoggerService.info(`Migration created: ${name}`);
					resolve(stdout.trim());
				}
			});
		});
	}

	/**
	 * Rollback a specific migration.
	 */
	public async rollbackMigration(migrationName: string): Promise<void> {
		const root = WorkspaceService.getWorkspaceRoot();

		// Find the actual file to get the correct path
		const files = await this.getMigrationFiles();
		const found = files.find(f => f.name === migrationName);

		if (!found) {
			throw new Error(`Migration file not found: ${migrationName}`);
		}

		const relativePath = path.join('database', 'migrations', migrationName + '.php');
		const command = `php artisan migrate:rollback --path=${relativePath}`;

		LoggerService.info(`Rolling back migration: ${migrationName}`);

		return new Promise((resolve, reject) => {
			cp.exec(command, { cwd: root }, (err, stdout, stderr) => {
				if (err) {
					LoggerService.error(`Migration rollback failed: ${migrationName}`, stderr);
					reject(new Error(stderr || err.message));
				} else {
					LoggerService.info(`Migration rolled back: ${migrationName}`);
					resolve();
				}
			});
		});
	}

	/**
	 * Rollback all migrations or a specific number of steps/batches.
	 * @param steps - Number of steps/batches to rollback, or null to rollback all
	 */
	public async rollbackAllMigrations(steps: number | null = null): Promise<void> {
		const stepsLabel = steps === null ? 'all' : `${steps} step(s)`;
		let command = 'php artisan migrate:rollback';

		if (steps !== null && steps > 0) {
			command += ` --step=${steps}`;
		}

		LoggerService.info(`Rolling back ${stepsLabel} migrations`);

		const root = WorkspaceService.getWorkspaceRoot();

		return new Promise((resolve, reject) => {
			cp.exec(command, { cwd: root }, (err, stdout, stderr) => {
				if (err) {
					LoggerService.error(`Rollback all failed`, stderr);
					reject(new Error(stderr || err.message));
				} else {
					LoggerService.info(`Rolled back ${stepsLabel} migrations`);
					resolve();
				}
			});
		});
	}

	/**
	 * Dispose of terminal resources.
	 */
	public dispose(): void {
		if (this.terminal) {
			this.terminal.dispose();
			this.terminal = undefined;
		}
	}
}
