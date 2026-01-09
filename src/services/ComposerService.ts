import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { LoggerService } from './LoggerService';
import { WorkspaceService } from './WorkspaceService';

export interface PackageInfo {
	name: string;
	version: string;
	latest?: string;
	description?: string;
	type?: string;
	homepage?: string;
	license?: string[];
	isDev?: boolean;
	isUpgradable?: boolean;
	isDeprecated?: boolean;
	replacement?: string;
}

interface OutdatedPackageInfo {
	latest: string;
	latestStatus?: string;
}

interface PackageResult {
	packages: PackageInfo[];
	error?: string;
	warnings: string[];
}

/**
 * ComposerService handles reading installed packages and detecting upgrades.
 */
export class ComposerService {
	/**
	 * Load package details from composer.lock and merge upgrade info.
	 */
	public async getPackages(): Promise<PackageResult> {
		const warnings: string[] = [];

		try {
			const installed = await this.getInstalledPackages();
			const outdated = await this.getOutdatedPackages(warnings);

			const packages = installed.map(pkg => {
				const outdatedInfo = outdated.get(pkg.name);
				const latest = outdatedInfo?.latest ?? pkg.version;
				const isUpgradable = Boolean(outdatedInfo && outdatedInfo.latest && outdatedInfo.latest !== pkg.version);

				return {
					...pkg,
					latest,
					isUpgradable
				};
			});

			LoggerService.info(`Loaded ${packages.length} composer packages`);

			return { packages, warnings };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			LoggerService.error('Failed to load composer packages', err);
			return { packages: [], error: message, warnings };
		}
	}

	/**
	 * Read installed packages from composer.lock.
	 */
	private async getInstalledPackages(): Promise<PackageInfo[]> {
		const root = WorkspaceService.getWorkspaceRoot();
		const lockPath = path.join(root, 'composer.lock');

		if (!fs.existsSync(lockPath)) {
			throw new Error('composer.lock not found. Run composer install in your project root.');
		}

		const content = await fs.promises.readFile(lockPath, 'utf8');
		const data = JSON.parse(content);

		const packages: PackageInfo[] = [];

		const addPackages = (entries: any[], isDev: boolean) => {
			for (const pkg of entries) {
				packages.push({
					name: pkg.name,
					version: pkg.version,
					description: pkg.description,
					type: pkg.type,
					homepage: pkg.homepage,
					license: pkg.license,
					isDev,
					isDeprecated: Boolean(pkg.abandoned),
					replacement: typeof pkg.abandoned === 'string' ? pkg.abandoned : undefined
				});
			}
		};

		addPackages(data.packages || [], false);
		addPackages(data['packages-dev'] || [], true);

		return packages.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Execute `composer outdated` to find upgrade candidates.
	 * Errors are captured as warnings so the rest of the view can still render.
	 */
	private async getOutdatedPackages(warnings: string[]): Promise<Map<string, OutdatedPackageInfo>> {
		const root = WorkspaceService.getWorkspaceRoot();
		const command = 'composer outdated --direct --format=json';

		try {
			const output = await this.exec(command, root);
			return this.parseOutdatedJson(output);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			LoggerService.warn('composer outdated failed', err);
			warnings.push(`Could not check for updates: ${msg}`);
			return new Map();
		}
	}

	/**
	 * Run a shell command and return stdout.
	 */
	private async exec(command: string, cwd: string): Promise<string> {
		return new Promise((resolve, reject) => {
			cp.exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) {
					reject(new Error(stderr || error.message));
					return;
				}

				resolve(stdout.trim());
			});
		});
	}

	/**
	 * Parse JSON from composer outdated output.
	 */
	private parseOutdatedJson(jsonOutput: string): Map<string, OutdatedPackageInfo> {
		const result = new Map<string, OutdatedPackageInfo>();

		if (!jsonOutput) {
			return result;
		}

		try {
			const parsed = JSON.parse(jsonOutput);
			const packages = parsed.installed || parsed.packages || [];

			for (const pkg of packages) {
				if (!pkg.name || !pkg.latest) {
					continue;
				}

				result.set(pkg.name, {
					latest: pkg.latest,
					latestStatus: pkg['latest-status']
				});
			}
		} catch (err) {
			LoggerService.warn('Failed to parse composer outdated JSON', err);
		}

		return result;
	}
}
