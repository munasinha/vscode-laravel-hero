const vscode = acquireVsCodeApi();

const refreshBtn = document.getElementById('refresh-btn');
const alertContainer = document.getElementById('alert-container');

const projectNameEl = document.getElementById('project-name');
const environmentEl = document.getElementById('environment');
const laravelVersionEl = document.getElementById('laravel-version');
const phpVersionEl = document.getElementById('php-version');

const dbDriverEl = document.getElementById('db-driver');
const dbStatusEl = document.getElementById('db-status');
const dbErrorEl = document.getElementById('db-error');

const cacheDriverEl = document.getElementById('cache-driver');
const cacheStatusEl = document.getElementById('cache-status');
const cacheErrorEl = document.getElementById('cache-error');

const commandsList = document.getElementById('commands-list');
const playIcon = commandsList.getAttribute('data-play-icon') || '';

const runningCommands = new Set();

refreshBtn.addEventListener('click', () => {
	vscode.postMessage({ command: 'refresh' });
});

window.addEventListener('message', (event) => {
	const message = event.data;

	switch (message.command) {
		case 'overview-loaded':
			renderOverview(message.data);
			break;
		case 'overview-error':
			showError(message.error);
			break;
		case 'artisan-started':
			runningCommands.add(message.id);
			updateCommandButtons();
			break;
		case 'artisan-finished':
			runningCommands.delete(message.id);
			updateCommandButtons();
			if (message.success) {
				addAlert('info', 'Command completed successfully.');
			} else {
				addAlert('error', message.error || 'Command failed.');
			}
			break;
	}
});

function renderOverview(data) {
	if (!data) {
		return;
	}

	const persistentAlerts = Array.from(alertContainer.children)
		.filter(el => !el.classList.contains('warning-banner'));

	alertContainer.innerHTML = '';
		persistentAlerts.forEach(el => alertContainer.appendChild(el));

	if (Array.isArray(data.warnings)) {
		data.warnings.forEach(msg => addAlert('warning', msg));
	}

	projectNameEl.textContent = data.projectName || 'Laravel Project';
	environmentEl.textContent = data.environment || 'Unknown';
	laravelVersionEl.textContent = data.laravelVersion || 'Unknown';
	phpVersionEl.textContent = data.phpVersion || 'Unknown';

	updateConnection(dbDriverEl, dbStatusEl, dbErrorEl, data.database);
	updateConnection(cacheDriverEl, cacheStatusEl, cacheErrorEl, data.cache);

	renderCommands(data.artisanCommands);
}

function updateConnection(driverEl, statusEl, errorEl, info) {
	driverEl.textContent = info?.name || '—';
	setStatusPill(statusEl, info?.status);

	if (info?.error) {
		errorEl.textContent = info.error;
		errorEl.style.display = 'block';
	} else {
		errorEl.textContent = '';
		errorEl.style.display = 'none';
	}
}

function setStatusPill(el, status) {
	el.classList.remove('success', 'danger', 'warn');
	let label = 'Unknown';

	switch (status) {
		case 'connected':
			el.classList.add('success');
			label = 'Connected';
			break;
		case 'disconnected':
			el.classList.add('danger');
			label = 'Disconnected';
			break;
		default:
			el.classList.add('warn');
			label = 'Unknown';
	}

	el.textContent = label;
}

function renderCommands(commands) {
	if (!Array.isArray(commands) || commands.length === 0) {
		commandsList.innerHTML = '<p class="muted">No commands available.</p>';
		return;
	}

	commandsList.innerHTML = '';

	commands.forEach(cmd => {
		const card = document.createElement('div');
		card.className = 'command-card';

		const title = document.createElement('p');
		title.className = 'command-title';
		title.textContent = cmd.label;

		const desc = document.createElement('p');
		desc.className = 'command-description';
		desc.textContent = cmd.description || '';

		const button = document.createElement('button');
		button.className = 'command-button';
		button.dataset.commandId = cmd.id;
		button.dataset.commandLabel = cmd.label;
		button.innerHTML = playIcon
			? `<img src="${playIcon}" alt="Run ${escapeHtml(cmd.label)}"> <span>Run</span>`
			: '▶ Run';
		button.title = `Run ${cmd.label}`;
		button.addEventListener('click', () => runCommand(cmd.id));

		card.appendChild(title);
		card.appendChild(desc);
		card.appendChild(button);
		commandsList.appendChild(card);
	});

	updateCommandButtons();
}

function runCommand(id) {
	if (!id) {
		return;
	}

	runningCommands.add(id);
	updateCommandButtons();
	vscode.postMessage({ command: 'run-artisan', id });
}

function updateCommandButtons() {
	const buttons = commandsList.querySelectorAll('.command-button');
	buttons.forEach((btn) => {
		const id = btn.dataset.commandId;
		const isRunning = runningCommands.has(id);
		btn.disabled = isRunning;

		if (isRunning) {
			btn.innerHTML = '<span class="spinner"></span> Running...';
		} else {
			if (playIcon) {
				btn.innerHTML = `<img src="${playIcon}" alt="Run ${escapeHtml(btn.dataset.commandLabel || '')}"> <span>Run</span>`;
			} else {
				btn.textContent = '▶ Run';
			}
		}
	});
}

function showError(message) {
	clearAlerts();
	addAlert('error', message || 'Something went wrong while loading overview data.');
}

function clearAlerts() {
	alertContainer.innerHTML = '';
}

function addAlert(type, text) {
	if (!text) {
		return;
	}

	const div = document.createElement('div');
	div.className = `${type}-banner`;
	div.textContent = text;
	alertContainer.appendChild(div);

	if (type === 'info') {
		setTimeout(() => {
			if (div.parentElement === alertContainer) {
				div.remove();
			}
		}, 3500);
	}
}

function escapeHtml(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

vscode.postMessage({ command: 'ready' });
