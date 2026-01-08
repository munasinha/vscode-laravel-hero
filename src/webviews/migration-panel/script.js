const vscode = acquireVsCodeApi();
let migrations = [];
let filteredMigrations = [];
let currentSort = { column: 'index', direction: 'asc' };

// DOM Elements
const list = document.getElementById('migration-list');
const errorContainer = document.getElementById('error-container');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const refreshBtn = document.getElementById('refresh-btn');
const runAllBtn = document.getElementById('run-all-btn');
const runAllForcedBtn = document.getElementById('run-all-forced-btn');
const rollbackAllBtn = document.getElementById('rollback-all-btn');
const createBtn = document.getElementById('create-migration-btn');

// Modal Elements
const rollbackModal = document.getElementById('rollback-modal');
const rollbackStepsInput = document.getElementById('rollback-steps');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalRollbackBtn = document.getElementById('modal-rollback-btn');

// Event Listeners
refreshBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'refresh' });
});

runAllBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'request-confirm', action: 'run-all', message: 'Run all pending migrations?' });
});

runAllForcedBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'request-confirm', action: 'force-run-all', message: 'Force run all migrations? This will re-run already executed migrations.' });
});

rollbackAllBtn.addEventListener('click', () => {
	rollbackStepsInput.value = '';
	showRollbackModal();
});

createBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'show-create-dialog' });
});

// Modal Event Listeners
modalCloseBtn.addEventListener('click', closeRollbackModal);
modalCancelBtn.addEventListener('click', closeRollbackModal);

rollbackModal.addEventListener('click', (e) => {
	if (e.target === rollbackModal) {
		closeRollbackModal();
	}
});

modalRollbackBtn.addEventListener('click', () => {
	const steps = rollbackStepsInput.value.trim();
	const stepsValue = steps === '' || steps === '0' ? null : parseInt(steps);
	closeRollbackModal();
	vscode.postMessage({ 
		command: 'rollback-all', 
		steps: stepsValue,
		message: stepsValue === null ? 'Rollback all migrations?' : `Rollback ${stepsValue} step(s)?`
	});
});

// Search functionality
searchInput.addEventListener('input', (e) => {
	const searchTerm = e.target.value.toLowerCase();
	filterAndRender(searchTerm);
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

function filterAndRender(searchTerm) {
	// Filter migrations based on search term
	if (searchTerm.trim() === '') {
		filteredMigrations = [...migrations];
	} else {
		filteredMigrations = migrations.filter(m => 
			m.name.toLowerCase().includes(searchTerm) ||
			(m.batch && m.batch.toString().includes(searchTerm)) ||
			(m.ran ? 'migrated' : 'pending').includes(searchTerm)
		);
	}

	// Sort filtered migrations
	sortMigrations();

	// Render table
	renderTable(filteredMigrations);

	// Update search results count
	updateSearchResults();
}

function sortMigrations() {
	const compareFunction = (a, b) => {
		let valueA, valueB;

		switch (currentSort.column) {
			case 'name':
				valueA = a.name.toLowerCase();
				valueB = b.name.toLowerCase();
				break;
			case 'status':
				valueA = a.ran ? 1 : 0;
				valueB = b.ran ? 1 : 0;
				break;
			case 'batch':
				valueA = a.batch || 0;
				valueB = b.batch || 0;
				break;
			case 'index':
			default:
				// Sort by original index in migrations array
				valueA = migrations.indexOf(a);
				valueB = migrations.indexOf(b);
		}

		if (valueA < valueB) return currentSort.direction === 'asc' ? -1 : 1;
		if (valueA > valueB) return currentSort.direction === 'asc' ? 1 : -1;
		return 0;
	};

	filteredMigrations.sort(compareFunction);
}

function updateSearchResults() {
	if (searchInput.value.trim() === '') {
		searchResults.textContent = '';
	} else {
		searchResults.textContent = `${filteredMigrations.length} of ${migrations.length} results`;
	}
}

// Modal Functions
function showRollbackModal() {
	rollbackModal.classList.remove('hidden');
	rollbackStepsInput.focus();
}

function closeRollbackModal() {
	rollbackModal.classList.add('hidden');
}

// Handle messages from extension
window.addEventListener('message', event => {
	const message = event.data;

	switch (message.command) {
		case 'migrations-loaded':
			// Add original index to each migration
			migrations = (message.data || []).map((m, idx) => ({
				...m,
				_originalIndex: idx + 1
			}));
			filteredMigrations = [...migrations];
			errorContainer.innerHTML = '';
			if (message.error) {
				showWarning(message.error);
			}
			searchInput.value = '';
			filterAndRender('');
			break;

		case 'migration-running':
		case 'all-migrations-running':
		case 'migration-creating':
			// Show loading state
			break;

		case 'error':
		case 'migration-error':
		case 'all-migrations-error':
		case 'creation-error':
			showError(message.error);
			break;
	}
});

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
		if (migrations.length === 0) {
			list.innerHTML = `
				<tr>
					<td colspan="6" class="empty-state">
						<span class="empty-state-icon">📂</span>
						<strong>No migrations found</strong>
						<p>Start by creating your first migration</p>
					</td>
				</tr>
			`;
		} else {
			list.innerHTML = `
				<tr>
					<td colspan="6" class="no-results">
						No migrations match your search
					</td>
				</tr>
			`;
		}
		return;
	}

	items.forEach((m, index) => {
		const tr = document.createElement('tr');
		const isRanAttr = m.ran ? 'disabled' : '';
		const isNotRanAttr = !m.ran ? 'disabled' : '';
		
		tr.innerHTML = `
			<td>${m._originalIndex}</td>
			<td><code>${m.name}</code></td>
			<td><span class="${m.ran ? 'status-ran' : 'status-pending'}">${m.ran ? '✓ Migrated' : '○ Pending'}</span></td>
			<td>${m.batch || '-'}</td>
			<td>
				<button class="inline-button secondary" data-action="open-file" data-migration="${m.name}"> Open </button>
			</td>
			<td>
				<button class="inline-button migration-action-button" ${isRanAttr} data-action="run" data-migration="${m.name}"> Run </button>
				<button class="inline-button migration-action-button secondary" data-action="force-run" data-migration="${m.name}"> Force </button>
				<button class="inline-button migration-action-button rollback" ${isNotRanAttr} data-action="rollback" data-migration="${m.name}"> Rollback </button>
			</td>
		`;
		
		// Add event listeners to buttons
		const runBtn = tr.querySelector('[data-action="run"]');
		const forceBtn = tr.querySelector('[data-action="force-run"]');
		const fileBtn = tr.querySelector('[data-action="open-file"]');
		const rollbackBtn = tr.querySelector('[data-action="rollback"]');
		
		runBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const migName = e.target.getAttribute('data-migration');
			vscode.postMessage({ command: 'request-confirm', action: 'run-migration', migration: migName, message: `Run migration '${migName}'?` });
		});
		
		forceBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const migName = e.target.getAttribute('data-migration');
			vscode.postMessage({ command: 'request-confirm', action: 'force-run-migration', migration: migName, message: `Force run migration '${migName}'? This will re-run it even if already executed.` });
		});
		
		fileBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const migName = e.target.getAttribute('data-migration');
			vscode.postMessage({ command: 'open-migration-file', migration: migName });
		});
		
		rollbackBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const migName = e.target.getAttribute('data-migration');
			vscode.postMessage({ command: 'request-confirm', action: 'rollback-migration', migration: migName, message: `Rollback migration '${migName}'?` });
		});
		
		list.appendChild(tr);
	});
}

// Notify extension we're ready
vscode.postMessage({ command: 'ready' });
