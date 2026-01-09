const vscode = acquireVsCodeApi();

let routes = [];
let filteredRoutes = [];
let currentSort = { column: 'index', direction: 'asc' };

const list = document.getElementById('route-list');
const errorContainer = document.getElementById('error-container');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');

refreshBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'refresh' });
});

exportBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'export-csv', data: filteredRoutes });
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

function normalizeMethods(methods) {
	if (!methods) {
		return [];
	}
	if (Array.isArray(methods)) {
		return methods.map(m => String(m).trim()).filter(Boolean);
	}

	const tokens = String(methods)
		.split(/[|,]/)
		.flatMap(part => {
			const trimmed = part.trim();
			if (trimmed.includes(' ')) {
				return trimmed.split(/\s+/);
			}
			return trimmed;
		})
		.flatMap(token => token.match(/[A-Z]+/g) || [token])
		.map(m => m.trim())
		.filter(Boolean);

	return tokens.length ? tokens : [String(methods).trim()].filter(Boolean);
}

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function filterAndRender(searchTerm) {
	if (searchTerm.trim() === '') {
		filteredRoutes = [...routes];
	} else {
		filteredRoutes = routes.filter(route => {
			const combined = [
				route.uri,
				route.name,
				normalizeMethods(route.methods).join(' '),
				route.middleware.join(' '),
				(route.permissions || []).join(' '),
				route.fullUrl,
				route.action || ''
			].join(' ').toLowerCase();
			return combined.includes(searchTerm);
		});
	}

	sortRoutes();
	renderTable(filteredRoutes);
	updateSearchResults();
}

function sortRoutes() {
	const compare = (a, b) => {
		let valueA;
		let valueB;

		switch (currentSort.column) {
			case 'method':
				valueA = normalizeMethods(a.methods).join(' ');
				valueB = normalizeMethods(b.methods).join(' ');
				break;
			case 'uri':
				valueA = a.uri.toLowerCase();
				valueB = b.uri.toLowerCase();
				break;
			case 'name':
				valueA = (a.name || '').toLowerCase();
				valueB = (b.name || '').toLowerCase();
				break;
			case 'permissions':
				valueA = (a.permissions || []).join(',').toLowerCase();
				valueB = (b.permissions || []).join(',').toLowerCase();
				break;
			case 'middleware':
				valueA = a.middleware.join(',').toLowerCase();
				valueB = b.middleware.join(',').toLowerCase();
				break;
			case 'url':
				valueA = (a.fullUrl || '').toLowerCase();
				valueB = (b.fullUrl || '').toLowerCase();
				break;
			case 'index':
			default:
				valueA = a._originalIndex || 0;
				valueB = b._originalIndex || 0;
		}

		if (valueA < valueB) return currentSort.direction === 'asc' ? -1 : 1;
		if (valueA > valueB) return currentSort.direction === 'asc' ? 1 : -1;
		return 0;
	};

	filteredRoutes.sort(compare);
}

function updateSearchResults() {
	if (searchInput.value.trim() === '') {
		searchResults.textContent = '';
	} else {
		searchResults.textContent = `${filteredRoutes.length} of ${routes.length} results`;
	}
}

function showError(msg) {
	errorContainer.innerHTML = `
		<div class="error-banner">
			<strong>Error:</strong> ${msg}
		</div>
	`;
}

function showWarning(msg) {
	errorContainer.innerHTML = `
		<div class="warning-banner">
			<strong>⚠ Warning:</strong> ${msg}
		</div>
	`;
}

function renderTable(items) {
	list.innerHTML = '';

	if (!items || items.length === 0) {
		const emptyState = routes.length === 0
			? `
				<tr>
					<td colspan="8" class="empty-state">
						<span class="empty-state-icon">🛰️</span>
						<strong>No routes found</strong>
						<p>Ensure your Laravel app is installed and has defined routes.</p>
					</td>
				</tr>
			`
			: `
				<tr>
					<td colspan="8" class="no-results">
						No routes match your search
					</td>
				</tr>
			`;

		list.innerHTML = emptyState;
		return;
	}

	items.forEach(route => {
		const tr = document.createElement('tr');
		const methodParts = normalizeMethods(route.methods);
		const methodsLabel = methodParts.length ? methodParts.join(' | ') : 'ANY';
		const permissionsLabel = route.permissions && route.permissions.length ? route.permissions.join(', ') : '—';

		const middlewareItems = (route.middleware || []).map(m => {
			const shortName = m.includes('\\') ? m.split('\\').pop() : m;
			return { short: shortName || m, full: m };
		});

		const middlewareContent = middlewareItems.length
			? middlewareItems.map(m => `<span class="middleware-chip" data-full="${escapeHtml(m.full)}" data-short="${escapeHtml(m.short)}">${escapeHtml(m.short)}</span>`).join(' ')
			: '—';

		const safeUrl = route.fullUrl || '';

		tr.innerHTML = `
			<td>${route._originalIndex}</td>
			<td><span class="method-chip">${escapeHtml(methodsLabel)}</span></td>
			<td class="mono-text">${escapeHtml(route.uri)}</td>
			<td>${escapeHtml(route.name || '—')}</td>
			<td>${escapeHtml(permissionsLabel)}</td>
			<td class="middleware-cell">${middlewareContent}</td>
			<td class="url-cell mono-text">${escapeHtml(safeUrl || '—')}</td>
			<td>
				<button class="inline-button secondary" data-action="copy" data-url="${escapeHtml(safeUrl)}">Copy URL</button>
			</td>
		`;

		const copyBtn = tr.querySelector('[data-action="copy"]');
		copyBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const url = e.currentTarget.getAttribute('data-url');
			if (!url) {
				showWarning('No URL available to copy');
				return;
			}
			vscode.postMessage({ command: 'copy-text', text: url });
		});

		tr.querySelectorAll('.middleware-chip').forEach(chip => {
			chip.addEventListener('click', (e) => {
				const el = e.currentTarget;
				const showingFull = el.getAttribute('data-state') === 'full';
				if (showingFull) {
					el.textContent = el.getAttribute('data-short');
					el.setAttribute('data-state', 'short');
				} else {
					el.textContent = el.getAttribute('data-full');
					el.setAttribute('data-state', 'full');
				}
			});
		});

		list.appendChild(tr);
	});
}

window.addEventListener('message', event => {
	const message = event.data;

	switch (message.command) {
		case 'routes-loaded':
			routes = (message.data || []).map((route, idx) => ({
				...route,
				_originalIndex: idx + 1
			}));
			filteredRoutes = [...routes];
			errorContainer.innerHTML = '';
			if (message.error) {
				showWarning(message.error);
			}
			searchInput.value = '';
			filterAndRender('');
			break;

		case 'error':
			showError(message.error);
			break;
	}
});

vscode.postMessage({ command: 'ready' });
