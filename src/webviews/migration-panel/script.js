const vscode = acquireVsCodeApi();
let migrations = [];

// DOM Elements
const list = document.getElementById('migration-list');
const errorContainer = document.getElementById('error-container');
const refreshBtn = document.getElementById('refresh-btn');
const runAllBtn = document.getElementById('run-all-btn');
const runAllForcedBtn = document.getElementById('run-all-forced-btn');
const createBtn = document.getElementById('create-migration-btn');

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

createBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'show-create-dialog' });
});

// Handle messages from extension
window.addEventListener('message', event => {
	const message = event.data;

	switch (message.command) {
		case 'migrations-loaded':
			migrations = message.data || [];
			errorContainer.innerHTML = '';
			if (message.error) {
				showWarning(message.error);
			}
			renderTable(migrations);
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
		list.innerHTML = '<tr><td colspan="5">No migrations found.</td></tr>';
		return;
	}

	items.forEach((m, index) => {
		const tr = document.createElement('tr');
		const isRan = m.ran ? 'disabled' : '';
		const isRanAttr = m.ran ? 'disabled' : '';
		
		tr.innerHTML = `
			<td>${index + 1}</td>
			<td><code>${m.name}</code></td>
			<td><span class="${m.ran ? 'status-ran' : 'status-pending'}">${m.ran ? '✓ Migrated' : '○ Pending'}</span></td>
			<td>${m.batch || '-'}</td>
			<td>
				<button class="inline-button" ${isRanAttr} data-action="run" data-migration="${m.name}">Run</button>
				<button class="inline-button secondary" data-action="force-run" data-migration="${m.name}">Force</button>
			</td>
		`;
		
		// Add event listeners to buttons
		const runBtn = tr.querySelector('[data-action="run"]');
		const forceBtn = tr.querySelector('[data-action="force-run"]');
		
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
		
		list.appendChild(tr);
	});
}

// Notify extension we're ready
vscode.postMessage({ command: 'ready' });
