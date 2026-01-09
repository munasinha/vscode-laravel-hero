import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from './LoggerService';
import { WorkspaceService } from './WorkspaceService';

export interface ModelNode {
	id: string;
	name: string;
	namespace?: string;
	filePath: string;
	relativePath: string;
	isExternal?: boolean;
}

export interface ModelRelationship {
	source: string;
	target: string;
	type: string;
	relation: string;
	method: string;
	filePath: string;
}

export interface ModelGraphResult {
	nodes: ModelNode[];
	relationships: ModelRelationship[];
	warnings: string[];
	error?: string;
}

/**
 * Scans the workspace for Eloquent models and their relationships to build
 * a graph representation suitable for visualization.
 */
export class ModelGraphService {
	/**
	 * Build the model relationship graph by scanning PHP files.
	 */
	public async getModelGraph(): Promise<ModelGraphResult> {
		const warnings: string[] = [];

		try {
			const root = WorkspaceService.getWorkspaceRoot();
			const phpFiles = await this.collectPhpFiles(root);
			const nodes = new Map<string, ModelNode>();
			const relationships: ModelRelationship[] = [];

			for (const file of phpFiles) {
				try {
					const content = await fs.promises.readFile(file, 'utf8');
					const useMap = this.extractUseStatements(content);
					const model = this.extractModel(file, content, useMap);

					if (!model) {
						continue;
					}

					if (!nodes.has(model.id)) {
						nodes.set(model.id, model);
					}

					const modelRelationships = this.extractRelationships(model, content, useMap);
					for (const rel of modelRelationships) {
						relationships.push(rel);

						if (!nodes.has(rel.target)) {
							// Create a placeholder node so the graph stays connected.
							nodes.set(rel.target, {
								id: rel.target,
								name: this.getClassBaseName(rel.target),
								namespace: this.getNamespace(rel.target),
								filePath: '',
								relativePath: '',
								isExternal: true
							});
						}
					}
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					warnings.push(`Could not parse ${path.basename(file)}: ${message}`);
					LoggerService.warn(`ModelGraphService: failed to parse ${file}`, err);
				}
			}

			return {
				nodes: Array.from(nodes.values()),
				relationships,
				warnings
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			LoggerService.error('ModelGraphService: failed to build graph', err);
			return { nodes: [], relationships: [], warnings, error: message };
		}
	}

	/**
	 * Recursively collect PHP files from the workspace, skipping vendor/binaries.
	 */
	private async collectPhpFiles(root: string): Promise<string[]> {
		const skipDirs = new Set(['vendor', 'node_modules', 'storage', 'bootstrap', 'public', '.git', 'dist']);
		const phpFiles: string[] = [];

		const walk = async (dir: string) => {
			const entries = await fs.promises.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.name.startsWith('.')) {
					continue;
				}

				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					if (skipDirs.has(entry.name)) {
						continue;
					}
					await walk(fullPath);
				} else if (entry.isFile() && entry.name.endsWith('.php')) {
					phpFiles.push(fullPath);
				}
			}
		};

		await walk(root);
		return phpFiles;
	}

	/**
	 * Extract namespace imports from a PHP file.
	 */
	private extractUseStatements(content: string): Map<string, string> {
		const useMap = new Map<string, string>();
		const useRegex = /use\s+([^;]+);/g;
		let match: RegExpExecArray | null;

		while ((match = useRegex.exec(content)) !== null) {
			const raw = match[1].trim();
			const [fqcnPart, aliasPart] = raw.split(/\s+as\s+/i);
			const fqcn = fqcnPart.trim();
			const alias = aliasPart ? aliasPart.trim() : this.getClassBaseName(fqcn);
			useMap.set(alias, fqcn);
		}

		return useMap;
	}

	/**
	 * Parse a PHP file for a class that directly extends Eloquent's Model.
	 */
	private extractModel(filePath: string, content: string, useMap: Map<string, string>): ModelNode | undefined {
		const namespace = this.extractNamespace(content);
		const classRegex = /(abstract\s+class|class)\s+(\w+)\s+extends\s+([\\\w]+)/;
		const match = classRegex.exec(content);

		if (!match) {
			return undefined;
		}

		const className = match[2];
		const parentRaw = match[3];

		if (!this.isModelParent(parentRaw, useMap)) {
			return undefined;
		}

		const id = this.normalizeClassName(namespace ? `${namespace}\\${className}` : className);
		const relativePath = path.relative(WorkspaceService.getWorkspaceRoot(), filePath);

		return {
			id,
			name: className,
			namespace,
			filePath,
			relativePath
		};
	}

	/**
	 * Extract relationships defined inside a model class.
	 */
	private extractRelationships(
		model: ModelNode,
		content: string,
		useMap: Map<string, string>
	): ModelRelationship[] {
		const relationships: ModelRelationship[] = [];
		const classStart = content.indexOf(model.name);
		const classBody = classStart >= 0 ? content.slice(classStart) : content;

		const methodRegex = /function\s+(\w+)\s*\([^)]*\)\s*{([\s\S]*?)}/g;
		let methodMatch: RegExpExecArray | null;

		while ((methodMatch = methodRegex.exec(classBody)) !== null) {
			const methodName = methodMatch[1];
			const body = methodMatch[2];
			const relationMatch = body.match(/return\s+\$this->\s*(hasOneThrough|hasManyThrough|hasOne|hasMany|belongsToMany|belongsTo|morphOne|morphMany|morphToMany|morphedByMany|morphTo)\s*\(([^;]+?)\)/);

			if (!relationMatch) {
				continue;
			}

			const relationType = relationMatch[1];
			const args = relationMatch[2];
			const target = this.resolveTargetModel(args, useMap, model.namespace);

			if (!target) {
				continue;
			}

			relationships.push({
				source: model.id,
				target,
				type: this.mapRelationLabel(relationType),
				relation: relationType,
				method: methodName,
				filePath: model.filePath
			});
		}

		return relationships;
	}

	/**
	 * Map relation helper to a human-readable label shown in the webview.
	 */
	private mapRelationLabel(relation: string): string {
		switch (relation) {
			case 'hasOne':
			case 'belongsTo':
				return 'One To One';
			case 'hasMany':
				return 'One To Many';
			case 'belongsToMany':
				return 'Many To Many';
			case 'hasOneThrough':
				return 'Has One Through';
			case 'hasManyThrough':
				return 'Has Many Through';
			case 'morphOne':
				return 'One To One (Polymorphic)';
			case 'morphMany':
				return 'One To Many (Polymorphic)';
			case 'morphToMany':
			case 'morphedByMany':
				return 'Many To Many (Polymorphic)';
			case 'morphTo':
				return 'Polymorphic';
			default:
				return relation;
		}
	}

	/**
	 * Resolve the related model from relation arguments.
	 */
	private resolveTargetModel(args: string, useMap: Map<string, string>, namespace?: string): string | undefined {
		if (!args) {
			return undefined;
		}

		const firstArg = args.split(',')[0].trim();
		if (!firstArg) {
			return undefined;
		}

		// Handle ::class references
		if (firstArg.includes('::class')) {
			const classToken = firstArg.split('::class')[0].trim().replace(/^\\+/, '');
			const alias = this.getClassBaseName(classToken);
			const resolved = useMap.get(classToken) || useMap.get(alias);

			if (resolved) {
				return this.normalizeClassName(resolved);
			}

			if (classToken.includes('\\')) {
				return this.normalizeClassName(classToken);
			}

			if (namespace) {
				return this.normalizeClassName(`${namespace}\\${classToken}`);
			}

			return this.normalizeClassName(classToken);
		}

		// Handle string class names: 'App\\Models\\User'
		if (firstArg.startsWith('\'') || firstArg.startsWith('"')) {
			const cleaned = firstArg.replace(/^['"]|['"]$/g, '').replace(/^\\+/, '');
			return cleaned ? this.normalizeClassName(cleaned) : undefined;
		}

		// Fallback to raw token
		const token = firstArg.replace(/^\\+/, '');
		const resolved = useMap.get(token) || useMap.get(this.getClassBaseName(token));
		if (resolved) {
			return this.normalizeClassName(resolved);
		}

		if (namespace) {
			return this.normalizeClassName(`${namespace}\\${token}`);
		}

		return this.normalizeClassName(token);
	}

	private extractNamespace(content: string): string | undefined {
		const nsMatch = content.match(/namespace\s+([^;]+);/);
		return nsMatch ? nsMatch[1].trim() : undefined;
	}

	private normalizeClassName(name: string): string {
		return name.replace(/^\\+/, '');
	}

	private getClassBaseName(fqcn: string): string {
		const parts = this.normalizeClassName(fqcn).split('\\');
		return parts[parts.length - 1] || fqcn;
	}

	private getNamespace(fqcn: string): string | undefined {
		const parts = this.normalizeClassName(fqcn).split('\\');
		if (parts.length <= 1) {
			return undefined;
		}
		return parts.slice(0, -1).join('\\');
	}

	private isModelParent(parentRaw: string, useMap: Map<string, string>): boolean {
		const normalized = this.normalizeClassName(parentRaw);
		const baseName = this.getClassBaseName(normalized);
		const resolvedFromUse = useMap.get(normalized) || useMap.get(baseName);
		const resolved = this.normalizeClassName(resolvedFromUse || normalized);

		const allowedParents = new Set([
			'Illuminate\\Database\\Eloquent\\Model',
			'Illuminate\\Foundation\\Auth\\User',
			'Model',
			'Authenticatable'
		]);

		if (allowedParents.has(resolved) || allowedParents.has(baseName) || allowedParents.has(normalized)) {
			return true;
		}

		// If the alias maps to a known parent, accept it.
		if (resolvedFromUse) {
			const resolvedBase = this.getClassBaseName(resolvedFromUse);
			return allowedParents.has(resolvedFromUse) || allowedParents.has(resolvedBase);
		}

		return false;
	}
}
