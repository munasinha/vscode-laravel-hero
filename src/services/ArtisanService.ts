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

export interface RouteInfo {
	methods: string[];
	uri: string;
	name?: string | null;
	action?: string;
	middleware: string[];
	domain?: string | null;
	fullUrl: string;
	permissions: string[];
}

export interface RouteInfo {
	methods: string[];
	uri: string;
	name?: string | null;
	action?: string;
	middleware: string[];
	domain?: string | null;
	fullUrl: string;
	permissions: string[];
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
	private appUrlCache: string | undefined;

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
	 * Get all application routes from artisan.
	 */
	public async getRoutes(): Promise<{ routes: RouteInfo[]; error?: string }> {
		let routes: RouteInfo[] = [];
		let errorMsg: string | undefined;
		const baseUrl = this.getBaseAppUrl();

		try {
			// Validate PHP is available
			await this.execSync('php -v', { silent: true });

			try {
				const jsonOut = await this.execSync('php artisan route:list --json', { silent: true });
				routes = this.parseRoutesFromJson(jsonOut, baseUrl);
				LoggerService.info(`Got ${routes.length} routes from JSON output`);
			} catch (jsonErr) {
				LoggerService.warn('Route list JSON failed, falling back to text parsing', jsonErr);
				const textOut = await this.execSync('php artisan route:list', { silent: true });
				routes = this.parseRouteTable(textOut, baseUrl);
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : String(err);
			LoggerService.warn('Failed to fetch routes', err);
		}

		return { routes, error: errorMsg };
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
	 * Parse routes from JSON output of artisan.
	 */
	private parseRoutesFromJson(jsonOut: string, baseUrl: string): RouteInfo[] {
		let raw: any[] = [];
		try {
			raw = JSON.parse(jsonOut);
		} catch (err) {
			LoggerService.warn('Could not parse route:list JSON output', err);
			return [];
		}

		return raw.map((route: any) => {
			const middleware = this.normalizeMiddleware(route.middleware);
			return {
				methods: this.normalizeMethods(route.method ?? route.methods),
				uri: route.uri || '',
				name: route.name ?? '',
				action: route.action ?? '',
				middleware,
				domain: route.domain ?? null,
				fullUrl: this.buildFullUrl(baseUrl, route.domain, route.uri || ''),
				permissions: this.extractPermissions(middleware)
			};
		});
	}

	/**
	 * Parse routes from the table output of artisan.
	 */
	private parseRouteTable(output: string, baseUrl: string): RouteInfo[] {
		const lines = output.split('\n').filter(l => l.trim().length > 0);
		const routes: RouteInfo[] = [];

		for (const line of lines) {
			// Skip headers and separators
			if (line.includes('Domain') && line.includes('Method')) {
				continue;
			}
			if (line.match(/^\s*\+?-+\+?/)) {
				continue;
			}

			const trimmed = line.trim();
			if (!trimmed.startsWith('|')) {
				continue;
			}

			const cells = trimmed
				.replace(/^\|\s*/, '')
				.replace(/\s*\|$/, '')
				.split(/\s+\|\s+/);

			if (cells.length < 5) {
				continue;
			}

			const [domain, method, uri, name, action, middleware] = cells;
			const middlewareList = this.normalizeMiddleware(middleware);

			routes.push({
				methods: this.normalizeMethods(method),
				uri,
				name,
				action,
				middleware: middlewareList,
				domain: domain || null,
				fullUrl: this.buildFullUrl(baseUrl, domain || null, uri),
				permissions: this.extractPermissions(middlewareList)
			});
		}

		return routes;
	}

	/**
	 * Normalize HTTP method(s) to an array.
	 */
	private normalizeMethods(methodField: unknown): string[] {
		if (!methodField) {
			return [];
		}

		if (Array.isArray(methodField)) {
			return methodField.map(m => String(m).trim().toUpperCase()).filter(Boolean);
		}

		const raw = String(methodField).trim().toUpperCase();
		if (!raw) {
			return [];
		}

		const hasSeparators = raw.includes('|') || raw.includes(',');
		if (hasSeparators) {
			return raw
				.split(/[|,]/)
				.map(m => m.trim())
				.filter(Boolean);
		}

		// Fallback: split concatenated tokens like GETHEAD into chunks
		const chunks = raw.match(/[A-Z]+/g);
		return (chunks || []).filter(Boolean);
	}

	/**
	 * Normalize middleware to an array of names.
	 */
	private normalizeMiddleware(middlewareField: unknown): string[] {
		if (!middlewareField) {
			return [];
		}

		if (Array.isArray(middlewareField)) {
			return middlewareField.map(m => String(m).trim()).filter(Boolean);
		}

		return String(middlewareField)
			.split(/[,|]/)
			.map(m => m.trim())
			.filter(Boolean);
	}

	/**
	 * Extract permission-like middleware entries.
	 */
	private extractPermissions(middleware: string[]): string[] {
		const permissionMarkers = ['can:', 'permission:', 'abilities:', 'ability:', 'role:', 'scope:'];
		return middleware.filter(m => permissionMarkers.some(marker => m.includes(marker)));
	}

	/**
	 * Build a full URL for a route.
	 */
	private buildFullUrl(baseUrl: string, domain: string | null | undefined, uri: string): string {
		const normalizedBase = this.ensureScheme((domain && domain.length > 0 ? domain : baseUrl) || 'http://localhost').replace(/\/+$/, '');
		const normalizedUri = uri ? uri.replace(/^\/+/, '') : '';
		return normalizedUri ? `${normalizedBase}/${normalizedUri}` : normalizedBase;
	}

	/**
	 * Ensure URL has a scheme.
	 */
	private ensureScheme(url: string): string {
		if (!url) {
			return 'http://localhost';
		}
		if (url.startsWith('http://') || url.startsWith('https://')) {
			return url;
		}
		return `https://${url}`;
	}

	/**
	 * Resolve the application's base URL from .env or fallback.
	 */
	private getBaseAppUrl(): string {
		if (this.appUrlCache) {
			return this.appUrlCache;
		}

		try {
			const root = WorkspaceService.getWorkspaceRoot();
			const envPath = path.join(root, '.env');
			if (!fs.existsSync(envPath)) {
				this.appUrlCache = 'http://localhost';
				return this.appUrlCache;
			}

			const envContent = fs.readFileSync(envPath, 'utf8');
			const line = envContent
				.split(/\r?\n/)
				.find(l => l.trim().startsWith('APP_URL='));

			if (!line) {
				this.appUrlCache = 'http://localhost';
				return this.appUrlCache;
			}

			const value = line.split('APP_URL=')[1].trim().replace(/^['"]|['"]$/g, '');
			this.appUrlCache = value || 'http://localhost';
		} catch (err) {
			LoggerService.warn('Could not resolve APP_URL from workspace', err);
			this.appUrlCache = 'http://localhost';
		}

		return this.appUrlCache;
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
