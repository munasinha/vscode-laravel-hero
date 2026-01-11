import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { LoggerService } from './LoggerService';
import { WorkspaceService } from './WorkspaceService';

export interface ConnectionStatus {
	name: string;
	status: 'connected' | 'disconnected' | 'unknown';
	error?: string;
	size?: string;
	version?: string;
}

export interface ArtisanCommandDefinition {
	id: string;
	label: string;
	description: string;
}

export interface OverviewData {
	projectName: string;
	laravelVersion?: string;
	phpVersion?: string;
	environment?: string;
	database: ConnectionStatus;
	cache: ConnectionStatus;
	artisanCommands: ArtisanCommandDefinition[];
	warnings: string[];
}

export class OverviewService {
	private static readonly ARTISAN_COMMANDS: Array<
		ArtisanCommandDefinition & { command: string }
	> = [
		{
			id: 'config-cache',
			label: 'Config Cache',
			description: 'Rebuild the configuration cache for faster boot.',
			command: 'php artisan config:cache'
		},
		{
			id: 'config-clear',
			label: 'Clear Config Cache',
			description: 'Remove cached configuration files.',
			command: 'php artisan config:clear'
		},
		{
			id: 'optimize',
			label: 'Optimize',
			description: 'Optimize framework bootstrap files.',
			command: 'php artisan optimize'
		},
		{
			id: 'cache-clear',
			label: 'Clear Cache',
			description: 'Flush the default cache store.',
			command: 'php artisan cache:clear'
		},
		{
			id: 'route-clear',
			label: 'Clear Routes Cache',
			description: 'Remove cached routes.',
			command: 'php artisan route:clear'
		},
		{
			id: 'view-clear',
			label: 'Clear Compiled Views',
			description: 'Delete compiled Blade views.',
			command: 'php artisan view:clear'
		}
	];

	public getArtisanCommands(): ArtisanCommandDefinition[] {
		return OverviewService.ARTISAN_COMMANDS.map(({ id, label, description }) => ({
			id,
			label,
			description
		}));
	}

	public async getOverview(): Promise<OverviewData> {
		if (!WorkspaceService.isLaravelProject()) {
			throw new Error('Laravel Hero works best inside a Laravel project workspace.');
		}

		const warnings: string[] = [];
		const projectName = await this.resolveProjectName(warnings);

		const [laravelVersion, phpVersion, environment, database, cache] = await Promise.all([
			this.getLaravelVersion(warnings),
			this.getPhpVersion(warnings),
			this.getEnvironment(warnings),
			this.getDatabaseStatus(warnings),
			this.getCacheStatus(warnings)
		]);

		return {
			projectName,
			laravelVersion: laravelVersion || undefined,
			phpVersion: phpVersion || undefined,
			environment: environment || undefined,
			database,
			cache,
			artisanCommands: this.getArtisanCommands(),
			warnings
		};
	}

	public async runArtisanCommand(commandId: string): Promise<string> {
		const entry = OverviewService.ARTISAN_COMMANDS.find(cmd => cmd.id === commandId);
		if (!entry) {
			throw new Error(`Unknown artisan command: ${commandId}`);
		}

		LoggerService.info(`Running artisan command from overview: ${entry.label}`);

		return this.runCommand(entry.command);
	}

	private async resolveProjectName(warnings: string[]): Promise<string> {
		try {
			const env = this.readEnv();
			const envName = this.cleanName(env.APP_NAME);
			if (envName) {
				return envName;
			}

			try {
				const configName = await this.runLaravelScript('echo config("app.name");');
				const clean = this.cleanName(configName);
				if (clean) {
					return clean;
				}
			} catch (err) {
				LoggerService.warn('Could not resolve project name from config(app.name)', err);
			}

			const root = WorkspaceService.getWorkspaceRoot();
			const composerPath = path.join(root, 'composer.json');
			if (fs.existsSync(composerPath)) {
				const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
				if (composer.name) {
					return composer.name;
				}
			}
			return path.basename(root);
		} catch (err) {
			LoggerService.warn('Failed to resolve project name', err);
			warnings.push('Could not resolve project name from APP_NAME or composer.json.');
			return 'Laravel Project';
		}
	}

	private async getLaravelVersion(warnings: string[]): Promise<string | null> {
		try {
			const output = await this.runCommand('php artisan --version', { silent: true });
			const match = output.match(/Laravel Framework\s+([\\w\\.\\-]+)/i);
			if (match && match[1]) {
				return match[1];
			}
			return output || null;
		} catch (err) {
			LoggerService.warn('Failed to get Laravel version via artisan', err);
			warnings.push('Could not resolve Laravel version from artisan.');
		}

		const lockVersion = this.getLaravelVersionFromLock(warnings);
		return lockVersion || null;
	}

	private getLaravelVersionFromLock(warnings: string[]): string | null {
		try {
			const root = WorkspaceService.getWorkspaceRoot();
			const lockPath = path.join(root, 'composer.lock');

			if (!fs.existsSync(lockPath)) {
				warnings.push('composer.lock not found. Laravel version unknown.');
				return null;
			}

			const data = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
			const packages = [...(data.packages || []), ...(data['packages-dev'] || [])];
			const laravelPkg = packages.find((pkg: any) => pkg.name === 'laravel/framework');
			return laravelPkg?.version || null;
		} catch (err) {
			LoggerService.warn('Failed to parse composer.lock for Laravel version', err);
			warnings.push('Could not parse composer.lock to determine Laravel version.');
			return null;
		}
	}

	private async getPhpVersion(warnings: string[]): Promise<string | null> {
		try {
			const output = await this.runCommand('php -v', { silent: true });
			const [firstLine] = output.split(/\r?\n/);
			const match = firstLine.match(/PHP\s+([\d\.]+)/i);
			if (match && match[1]) {
				return `PHP ${match[1]}`;
			}
			return firstLine || output;
		} catch (err) {
			LoggerService.warn('Failed to get PHP version', err);
			warnings.push('Unable to resolve PHP version. Check the phpCommand setting.');
			return null;
		}
	}

	private async getEnvironment(warnings: string[]): Promise<string | null> {
		const env = this.readEnv();
		if (env.APP_ENV) {
			return this.normalizeEnv(env.APP_ENV);
		}

		try {
			const output = await this.runCommand('php artisan env', { silent: true });
			const match = output.match(/environment[:\[]\s*([^\]\n]+)/i);
			if (match && match[1]) {
				return this.normalizeEnv(match[1]);
			}
			return this.normalizeEnv(output);
		} catch (err) {
			LoggerService.warn('Failed to read APP_ENV', err);
			warnings.push('APP_ENV not found in .env and artisan env failed.');
		}

		try {
			const output = await this.runLaravelScript('echo config("app.env");');
			if (output) {
				return this.normalizeEnv(output);
			}
		} catch (err) {
			LoggerService.warn('Failed to resolve APP_ENV from config', err);
		}

		return null;
	}

	private async getDatabaseStatus(warnings: string[]): Promise<ConnectionStatus> {
		const env = this.readEnv();
		let connection = env.DB_CONNECTION;

		if (!connection) {
			try {
				const resolved = await this.runLaravelScript('echo config(\"database.default\");');
				if (resolved) {
					connection = resolved;
				}
			} catch (err) {
				LoggerService.warn('Could not resolve database driver from config', err);
			}
		}

		connection = connection || 'Not configured';

		const script = `
			try {
				$conn = $app->make('db')->connection();
				$pdo = $conn->getPdo();
				$driver = $conn->getDriverName();
				$version = $pdo ? $pdo->getAttribute(PDO::ATTR_SERVER_VERSION) : '';
				$sizeBytes = null;

				if ($driver === 'mysql') {
					$stmt = $pdo->query("SELECT SUM(DATA_LENGTH + INDEX_LENGTH) AS size FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();");
					$row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
					if ($row && isset($row['size'])) {
						$sizeBytes = (int)$row['size'];
					}
				} elseif ($driver === 'pgsql') {
					$stmt = $pdo->query("SELECT pg_database_size(current_database()) AS size;");
					$row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
					if ($row && isset($row['size'])) {
						$sizeBytes = (int)$row['size'];
					}
				} elseif ($driver === 'sqlite') {
					$dbPath = $conn->getConfig('database');
					if ($dbPath && file_exists($dbPath)) {
						$sizeBytes = filesize($dbPath);
					}
				}

				echo json_encode([
					'driver' => $driver,
					'version' => $version,
					'size' => $sizeBytes
				]);
			} catch (Throwable $e) {
				fwrite(STDERR, $e->getMessage());
				exit(1);
			}
		`;

		try {
			const raw = await this.runLaravelScript(script);
			let driverLabel = this.formatDriver(connection);
			let versionLabel: string | undefined;
			let sizeLabel: string | undefined;

			try {
				const parsed = JSON.parse(raw || '{}');
				if (parsed.driver) {
					driverLabel = this.formatDriver(parsed.driver);
				}
				if (parsed.version) {
					const version = String(parsed.version);
					versionLabel = version.split(/\s+/)[0];
				}
				if (parsed.size) {
					sizeLabel = this.formatBytes(Number(parsed.size));
				}
			} catch {
				// fall back to env-based label
			}

			let display = versionLabel ? `${driverLabel} ${versionLabel}` : driverLabel;
			if (sizeLabel) {
				display += ` (${sizeLabel})`;
			}

			return { name: display, status: 'connected', version: versionLabel, size: sizeLabel };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			LoggerService.warn('Database connection check failed', err);
			warnings.push('Database connection check failed. See output for details.');
			return { name: connection, status: 'disconnected', error: message };
		}
	}

	private async getCacheStatus(warnings: string[]): Promise<ConnectionStatus> {
		const env = this.readEnv();
		let driver = env.CACHE_DRIVER;

		if (!driver) {
			try {
				const resolved = await this.runLaravelScript('echo config(\"cache.default\");');
				if (resolved) {
					driver = resolved;
				}
			} catch (err) {
				LoggerService.warn('Could not resolve cache driver from config', err);
			}
		}

		driver = driver || 'file';

		const script = `
			try {
				$store = $app->make('cache')->store();
				$store->get('laravel_hero_ping');

				$driver = config('cache.default');
				$version = '';
				$sizeBytes = null;

				if ($driver === 'redis') {
					$client = $app->make('redis')->connection();
					$info = method_exists($client, 'info') ? $client->info() : [];
					if (is_array($info)) {
						if (isset($info['Server']['redis_version'])) {
							$version = $info['Server']['redis_version'];
						} elseif (isset($info['redis_version'])) {
							$version = $info['redis_version'];
						}
						$sizeBytes = $info['used_memory'] ?? ($info['Memory']['used_memory'] ?? null);
					}
				} elseif ($driver === 'memcached' || $driver === 'memcache') {
					$client = $store->getStore()->getMemcached();
					if ($client) {
						$versions = $client->getVersion();
						if (is_array($versions)) {
							$version = implode(', ', array_filter($versions));
						}
						$stats = $client->getStats();
						if (is_array($stats)) {
							foreach ($stats as $stat) {
								if (isset($stat['bytes'])) {
									$sizeBytes = $stat['bytes'];
									break;
								}
							}
						}
					}
				} elseif ($driver === 'file') {
					$path = storage_path('framework/cache/data');
					$sizeBytes = 0;
					if (is_dir($path)) {
						$rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS));
						foreach ($rii as $file) {
							if ($file->isFile()) {
								$sizeBytes += $file->getSize();
							}
						}
					}
				}

				echo json_encode([
					'driver' => $driver,
					'version' => $version,
					'size' => $sizeBytes
				]);
			} catch (Throwable $e) {
				fwrite(STDERR, $e->getMessage());
				exit(1);
			}
		`;

		try {
			const raw = await this.runLaravelScript(script);
			let label = this.formatCacheDriver(driver);
			let versionLabel: string | undefined;
			let sizeLabel: string | undefined;

			try {
				const parsed = JSON.parse(raw || '{}');
				if (parsed.driver) {
					label = this.formatCacheDriver(parsed.driver);
				}
				if (parsed.version) {
					versionLabel = String(parsed.version).split(/\s+/)[0];
				}
				if (parsed.size) {
					sizeLabel = this.formatBytes(Number(parsed.size));
				}
			} catch {
				// ignore parse issues
			}

			let display = label;
			if (versionLabel) {
				display += ` ${versionLabel}`;
			}
			if (sizeLabel) {
				display += ` (${sizeLabel})`;
			}

			return { name: display, status: 'connected', version: versionLabel, size: sizeLabel };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			LoggerService.warn('Cache connection check failed', err);
			warnings.push('Cache driver check failed. See output for details.');
			return { name: driver, status: 'disconnected', error: message };
		}
	}

	private readEnv(): Record<string, string> {
		const envVars: Record<string, string> = {};

		try {
			const root = WorkspaceService.getWorkspaceRoot();
			const envPath = path.join(root, '.env');
			if (!fs.existsSync(envPath)) {
				return envVars;
			}

			const content = fs.readFileSync(envPath, 'utf8');
			for (const line of content.split(/\\r?\\n/)) {
				if (!line || line.trim().startsWith('#')) {
					continue;
				}
				const [key, ...rest] = line.split('=');
				if (!key || rest.length === 0) {
					continue;
				}
				const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
				envVars[key.trim()] = value;
			}
		} catch (err) {
			LoggerService.warn('Failed to parse .env file', err);
		}

		return envVars;
	}

	private async runPhpScript(snippet: string): Promise<string> {
		const phpCmd = WorkspaceService.getPhpCommand();

		// Use single quotes for php -r to avoid backslash doubling; escape single quotes only.
		const sanitized = snippet
			.replace(/\r?\n/g, ' ')
			.replace(/\s+/g, ' ')
			.replace(/'/g, `'\\''`)
			.trim();

		const command = `${phpCmd} -r '${sanitized}'`;
		return this.runCommand(command);
	}

	private async runLaravelScript(body: string): Promise<string> {
		const snippet = `
			$base = getcwd();
			require $base . '/vendor/autoload.php';
			$app = require $base . '/bootstrap/app.php';
			$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
			$kernel->bootstrap();
			${body}
		`;
		return this.runPhpScript(snippet);
	}

	private normalizeEnv(value: string): string {
		if (!value) {
			return value;
		}

		const cleaned = value
			.replace(/info\s*/i, '')
			.replace(/the application environment is[:\s]*/i, '')
			.replace(/[\[\]]/g, '')
			.trim();

		const lower = cleaned.toLowerCase();
		return lower.charAt(0).toUpperCase() + lower.slice(1);
	}

	private formatDriver(driver: string): string {
		const lower = (driver || '').toLowerCase();
		if (lower === 'pgsql' || lower === 'postgresql') {
			return 'PostgreSQL';
		}
		if (lower === 'mysql') {
			return 'MySQL';
		}
		if (lower === 'sqlite' || lower === 'sqlite3') {
			return 'SQLite';
		}
		if (lower === 'sqlsrv' || lower === 'mssql') {
			return 'SQL Server';
		}
		return driver || 'Database';
	}

	private formatCacheDriver(driver: string): string {
		const lower = (driver || '').toLowerCase();
		if (lower === 'redis') {
			return 'Redis';
		}
		if (lower === 'memcached' || lower === 'memcache') {
			return 'Memcached';
		}
		if (lower === 'file' || lower === 'array') {
			return 'File Cache';
		}
		return driver || 'Cache';
	}

	private formatBytes(bytes: number): string {
		if (!bytes || bytes <= 0) {
			return '0 B';
		}
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, power);
		return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[power]}`;
	}

	private cleanName(value: string | undefined): string | undefined {
		if (!value) {
			return undefined;
		}
		let cleaned = value
			.replace(/[\r\n]+/g, ' ')
			.replace(/^["']|["']$/g, '')
			.trim();

		// Guard against malformed single-line env files where multiple keys are on one line.
		const appIdx = cleaned.indexOf(' APP_');
		if (appIdx > 0) {
			cleaned = cleaned.slice(0, appIdx).trim();
		} else if (cleaned.includes('=') && cleaned.includes(' ')) {
			cleaned = cleaned.split(' ')[0].trim();
		}

		return cleaned || undefined;
	}

	private async runCommand(command: string, options: { silent?: boolean } = {}): Promise<string> {
		const root = WorkspaceService.getWorkspaceRoot();
		const phpCmd = WorkspaceService.getPhpCommand();

		let finalCommand = command;
		if (command.startsWith('php ')) {
			finalCommand = `${phpCmd}${command.substring(3)}`;
		}

		LoggerService.debug(`Executing overview command: ${finalCommand}`, { cwd: root });

		return new Promise((resolve, reject) => {
			cp.exec(finalCommand, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
				if (err) {
					if (!options.silent) {
						LoggerService.error(`Overview command failed: ${finalCommand}`, stderr || err.message);
					}

					if ((stdout + stderr).includes('vendor/autoload.php')) {
						reject(new Error('Laravel dependencies missing. Please run `composer install` in your project.'));
						return;
					}

					if (stderr.includes('PHP version')) {
						reject(new Error('PHP version mismatch. Check "laravelHero.phpCommand" setting.'));
						return;
					}

					reject(new Error(stderr || err.message));
					return;
				}

				resolve(stdout.trim());
			});
		});
	}
}
