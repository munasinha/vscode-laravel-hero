const vscode = acquireVsCodeApi();

let graphData = { nodes: [], relationships: [], warnings: [] };
const nodeState = new Map();
const savedPositions = new Map();

// DOM references
const errorContainer = document.getElementById('error-container');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const refreshBtn = document.getElementById('refresh-btn');
const resetBtn = document.getElementById('reset-layout-btn');
const centerBtn = document.getElementById('center-btn');
const canvas = document.getElementById('graph-canvas');
const edgeLayer = document.getElementById('edge-layer');
const labelLayer = document.getElementById('label-layer');
const nodeLayer = document.getElementById('node-layer');
const emptyState = document.getElementById('empty-state');

const relationColors = {
	'One To One': 'one-to-one',
	'One To Many': 'one-to-many',
	'Many To Many': 'many-to-many',
	'Has One Through': 'through',
	'Has Many Through': 'through',
	'One To One (Polymorphic)': 'polymorphic',
	'One To Many (Polymorphic)': 'polymorphic',
	'Many To Many (Polymorphic)': 'polymorphic',
	'Polymorphic': 'polymorphic'
};

refreshBtn.addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
resetBtn.addEventListener('click', () => layoutNodes(true));
centerBtn.addEventListener('click', centerLayout);
searchInput.addEventListener('input', (e) => applySearch(e.target.value));

window.addEventListener('resize', () => {
	drawEdges();
});

window.addEventListener('message', event => {
	const message = event.data;

	switch (message.command) {
		case 'model-graph-data':
			renderGraph(message.data);
			break;
		case 'error':
			showError(message.error || 'Unable to load model graph.');
			break;
	}
});

// Restore saved layout
(() => {
	const state = vscode.getState() || {};
	if (state.positions) {
		Object.entries(state.positions).forEach(([id, pos]) => {
			savedPositions.set(id, pos);
		});
	}
	vscode.postMessage({ command: 'ready' });
})();

function renderGraph(payload) {
	graphData = payload || { nodes: [], relationships: [], warnings: [] };
	graphData.nodes = graphData.nodes || [];
	graphData.relationships = graphData.relationships || [];
	graphData.warnings = graphData.warnings || [];
	errorContainer.innerHTML = '';

	const currentIds = new Set((graphData.nodes || []).map(n => n.id));
	Array.from(savedPositions.keys()).forEach(key => {
		if (!currentIds.has(key)) {
			savedPositions.delete(key);
		}
	});

	if (graphData.error) {
		showError(graphData.error);
	}

	if (graphData.warnings && graphData.warnings.length) {
		graphData.warnings.forEach(warn => {
			const div = document.createElement('div');
			div.className = 'alert alert-warning';
			div.textContent = warn;
			errorContainer.appendChild(div);
		});
	}

	nodeState.clear();
	nodeLayer.innerHTML = '';
	labelLayer.innerHTML = '';
	edgeLayer.innerHTML = '';

	if (!graphData.nodes.length) {
		emptyState.classList.remove('hidden');
		return;
	}

	emptyState.classList.add('hidden');

	graphData.nodes.forEach(node => createNode(node));

	layoutNodes(false);
	drawEdges();
	applySearch(searchInput.value);
}

function createNode(node) {
	const el = document.createElement('div');
	el.className = 'model-node';
	el.dataset.id = node.id;
	el.innerHTML = `
		<div class="node-title">${node.name}</div>
		<div class="node-namespace">${node.namespace || 'Global namespace'}</div>
		<div class="node-meta">
			<span class="node-chip">${node.isExternal ? 'Referenced' : 'Model'}</span>
			${node.relativePath ? `<span class="node-chip">${node.relativePath}</span>` : ''}
		</div>
	`;

	nodeLayer.appendChild(el);
	nodeState.set(node.id, {
		element: el,
		data: node,
		x: 0,
		y: 0
	});

	makeDraggable(el, node.id);

	el.addEventListener('dblclick', () => {
		if (node.filePath) {
			vscode.postMessage({ command: 'open-file', filePath: node.filePath });
		}
	});
}

function layoutNodes(reset) {
	const rect = canvas.getBoundingClientRect();
	const count = graphData.nodes.length || 1;
	const radius = Math.max(160, Math.min(rect.width, rect.height) / 2.2);
	const center = { x: rect.width / 2, y: rect.height / 2 };

	graphData.nodes.forEach((node, index) => {
		const state = nodeState.get(node.id);
		if (!state) {
			return;
		}

		const saved = savedPositions.get(node.id);
		if (!reset && saved) {
			setNodePosition(node.id, saved.x, saved.y);
			return;
		}

		const angle = (index / count) * Math.PI * 2;
		const x = center.x + radius * Math.cos(angle) - 100; // half of node width
		const y = center.y + radius * Math.sin(angle) - 50;
		setNodePosition(node.id, x, y);
	});

	persistPositions();
	drawEdges();
}

function centerLayout() {
	layoutNodes(false);
}

function drawEdges() {
	const rect = canvas.getBoundingClientRect();
	edgeLayer.setAttribute('width', `${rect.width}`);
	edgeLayer.setAttribute('height', `${rect.height}`);
	edgeLayer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

	edgeLayer.innerHTML = '';
	labelLayer.innerHTML = '';

	graphData.relationships.forEach(rel => {
		const from = nodeState.get(rel.source);
		const to = nodeState.get(rel.target);

		if (!from || !to) {
			return;
		}

		const fromCenter = getNodeCenter(from);
		const toCenter = getNodeCenter(to);

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', `${fromCenter.x}`);
		line.setAttribute('y1', `${fromCenter.y}`);
		line.setAttribute('x2', `${toCenter.x}`);
		line.setAttribute('y2', `${toCenter.y}`);
		line.setAttribute('class', `edge-line ${normalizeRelation(rel.type)}`);
		line.setAttribute('data-method', rel.method);
		line.setAttribute('data-relation', rel.relation);
		line.setAttribute('stroke-linecap', 'round');
		line.setAttribute('opacity', '0.9');
		edgeLayer.appendChild(line);

		const midPoint = {
			x: (fromCenter.x + toCenter.x) / 2,
			y: (fromCenter.y + toCenter.y) / 2
		};

		const label = document.createElement('div');
		label.className = `edge-label relation-${normalizeRelation(rel.type)}`;
		label.textContent = rel.type;
		label.style.left = `${midPoint.x}px`;
		label.style.top = `${midPoint.y}px`;
		label.title = `${rel.method} (${rel.relation})`;
		labelLayer.appendChild(label);
	});
}

function normalizeRelation(label) {
	return (relationColors[label] || 'default').replace(/\s+/g, '-');
}

function makeDraggable(el, id) {
	let dragging = false;
	let pointerId = null;
	let offset = { x: 0, y: 0 };

	el.addEventListener('pointerdown', (e) => {
		dragging = true;
		pointerId = e.pointerId;
		offset = {
			x: e.clientX - (nodeState.get(id)?.x || 0),
			y: e.clientY - (nodeState.get(id)?.y || 0)
		};
		el.setPointerCapture(pointerId);
	});

	el.addEventListener('pointermove', (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const x = e.clientX - offset.x;
		const y = e.clientY - offset.y;
		setNodePosition(id, x, y);
		drawEdges();
	});

	const stopDragging = () => {
		if (!dragging) return;
		dragging = false;
		persistPositions();
	};

	el.addEventListener('pointerup', stopDragging);
	el.addEventListener('pointercancel', stopDragging);
}

function setNodePosition(id, x, y) {
	const state = nodeState.get(id);
	if (!state) return;

	const canvasRect = canvas.getBoundingClientRect();
	const nodeRect = state.element.getBoundingClientRect();

	const maxX = Math.max(0, canvasRect.width - nodeRect.width);
	const maxY = Math.max(0, canvasRect.height - nodeRect.height);

	const clampedX = clamp(x, 0, maxX);
	const clampedY = clamp(y, 0, maxY);

	state.x = clampedX;
	state.y = clampedY;
	state.element.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

	savedPositions.set(id, { x: clampedX, y: clampedY });
}

function getNodeCenter(state) {
	const rect = state.element.getBoundingClientRect();
	const canvasRect = canvas.getBoundingClientRect();
	return {
		x: state.x + rect.width / 2,
		y: state.y + rect.height / 2
	};
}

function applySearch(term) {
	const query = (term || '').toLowerCase();
	let visibleCount = 0;

	graphData.nodes.forEach(node => {
		const state = nodeState.get(node.id);
		if (!state) return;
		const matches = !query ||
			node.name.toLowerCase().includes(query) ||
			(node.namespace || '').toLowerCase().includes(query) ||
			graphData.relationships.some(rel =>
				(rel.source === node.id || rel.target === node.id) &&
				(rel.type || '').toLowerCase().includes(query)
			);

		state.element.style.opacity = matches ? '1' : '0.25';
		if (matches) visibleCount += 1;
	});

	searchResults.textContent = query ? `${visibleCount} of ${graphData.nodes.length} matching` : '';
	drawEdges();
}

function persistPositions() {
	const positions = {};
	savedPositions.forEach((pos, id) => {
		positions[id] = pos;
	});
	vscode.setState({ positions });
}

function showError(message) {
	const alert = document.createElement('div');
	alert.className = 'alert alert-error';
	alert.textContent = message;
	errorContainer.appendChild(alert);
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}
