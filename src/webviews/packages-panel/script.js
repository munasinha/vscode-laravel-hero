const vscode = acquireVsCodeApi();

let packages = [];
let filteredPackages = [];
let currentSort = { column: 'name', direction: 'asc' };

const list = document.getElementById('package-list');
const errorContainer = document.getElementById('error-container');
const warningContainer = document.getElementById('warning-container');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const refreshBtn = document.getElementById('refresh-btn');

refreshBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'refresh' });
});

searchInput.addEventListener('input', (e) => {
	const term = e.target.value.toLowerCase();
	filterAndRender(term);
});

document.querySelectorAll('th.sortable').forEach(header => {
	header.addEventListener('click', () => {
		const column = header.getAttribute('data-sort');
		toggleSort(column);
		filterAndRender(searchInput.value.toLowerCase());
	});
});

function toggleSort(column) {
	if (currentSort.column === column) {
		currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
	} else {
		currentSort.column = column;
		currentSort.direction = 'asc';
	}
	updateSortIndicators();
}

function updateSortIndicators() {
	document.querySelectorAll('th.sortable').forEach(header => {
		header.classList.remove('sort-asc', 'sort-desc');
		if (header.getAttribute('data-sort') === currentSort.column) {
			header.classList.add(`sort-${currentSort.direction}`);
		}
	});
}

function escapeHtml(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function filterAndRender(searchTerm) {
	if (searchTerm.trim() === '') {
		filteredPackages = [...packages];
	} else {
		filteredPackages = packages.filter(pkg => {
			const combined = [
				pkg.name,
				pkg.description || '',
				pkg.type || '',
				pkg.version || '',
				pkg.latest || '',
				pkg.replacement || '',
				pkg.isDev ? 'dev' : 'prod'
			].join(' ').toLowerCase();
			return combined.includes(searchTerm);
		});
	}

	sortPackages();
	renderTable(filteredPackages);
	updateSearchResults();
}

function statusWeight(pkg) {
	if (pkg.isDeprecated) return 0;
	if (pkg.isUpgradable) return 1;
	return 2;
}

function sortPackages() {
	const compare = (a, b) => {
		let valueA;
		let valueB;

		switch (currentSort.column) {
			case 'version':
				valueA = a.version || '';
				valueB = b.version || '';
				break;
			case 'latest':
				valueA = a.latest || '';
				valueB = b.latest || '';
				break;
			case 'status':
				valueA = statusWeight(a);
				valueB = statusWeight(b);
				break;
			case 'type':
				valueA = (a.type || '') + (a.isDev ? ' dev' : '');
				valueB = (b.type || '') + (b.isDev ? ' dev' : '');
				break;
			case 'index':
				valueA = a._originalIndex || 0;
				valueB = b._originalIndex || 0;
				break;
			case 'name':
			default:
				valueA = (a.name || '').toLowerCase();
				valueB = (b.name || '').toLowerCase();
		}

		if (valueA < valueB) return currentSort.direction === 'asc' ? -1 : 1;
		if (valueA > valueB) return currentSort.direction === 'asc' ? 1 : -1;
		return 0;
	};

	filteredPackages.sort(compare);
}

function updateSearchResults() {
	if (searchInput.value.trim() === '') {
		searchResults.textContent = '';
	} else {
		searchResults.textContent = `${filteredPackages.length} of ${packages.length} results`;
	}
}

function showError(msg) {
	if (!msg) {
		errorContainer.innerHTML = '';
		return;
	}

	errorContainer.innerHTML = `
		<div class="error-banner">
			<strong>Error:</strong> ${escapeHtml(msg)}
		</div>
	`;
}

function showWarnings(warnings) {
	if (!warnings || warnings.length === 0) {
		warningContainer.innerHTML = '';
		return;
	}

	warningContainer.innerHTML = warnings.map(msg => `
		<div class="warning-banner">
			<strong>⚠</strong> ${escapeHtml(msg)}
		</div>
	`).join('');
}

function renderTable(items) {
	list.innerHTML = '';

	if (!items || items.length === 0) {
		const emptyState = packages.length === 0
			? `
				<tr>
					<td colspan="8" class="empty-state">
						<span class="empty-state-icon">📦</span>
						<strong>No packages found</strong>
						<p>Open a Laravel project with composer.lock to view dependencies.</p>
					</td>
				</tr>
			`
			: `
				<tr>
					<td colspan="8" class="no-results">
						No packages match your search
					</td>
				</tr>
			`;

		list.innerHTML = emptyState;
		return;
	}

	items.forEach(pkg => {
		const tr = document.createElement('tr');
		const badges = [];

		if (pkg.isDeprecated) {
			const replacement = pkg.replacement ? ` → ${escapeHtml(pkg.replacement)}` : '';
			badges.push(`<span class="status-chip danger">Deprecated${replacement}</span>`);
		}

		if (pkg.isUpgradable) {
			badges.push(`<span class="status-chip warn">Update available</span>`);
		}

		if (badges.length === 0) {
			badges.push(`<span class="status-chip success">Up to date</span>`);
		}

		if (pkg.isDev) {
			badges.push(`<span class="status-chip muted">dev</span>`);
		}

		const latestLabel = pkg.latest || pkg.version || '—';
		const description = pkg.description ? escapeHtml(pkg.description) : '—';
		const typeLabel = pkg.type ? escapeHtml(pkg.type) : 'library';

		tr.innerHTML = `
			<td>${pkg._originalIndex}</td>
			<td class="package-name">
				<code>${escapeHtml(pkg.name)}</code>
			</td>
			<td>${escapeHtml(pkg.version || '—')}</td>
			<td>${escapeHtml(latestLabel)}</td>
			<td>${badges.join(' ')}</td>
			<td><span class="package-type">${typeLabel}</span></td>
			<td class="description-cell">${description}</td>
			<td>
				<button class="inline-button secondary" data-action="packagist" data-name="${escapeHtml(pkg.name)}">View</button>
			</td>
		`;

		const openBtn = tr.querySelector('[data-action="packagist"]');
		openBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const pkgName = e.currentTarget.getAttribute('data-name');
			if (pkgName) {
				vscode.postMessage({ command: 'open-packagist', package: pkgName });
			}
		});

		list.appendChild(tr);
	});
}

window.addEventListener('message', event => {
	const message = event.data;

	switch (message.command) {
		case 'packages-loaded':
			packages = (message.data || []).map((pkg, idx) => ({
				...pkg,
				_originalIndex: idx + 1
			}));
			filteredPackages = [...packages];
			showError(message.error);
			showWarnings(message.warnings);
			searchInput.value = '';
			filterAndRender('');
			break;

		case 'error':
			showError(message.error);
			break;
	}
});

vscode.postMessage({ command: 'ready' });
