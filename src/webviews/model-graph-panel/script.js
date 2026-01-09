const vscode = acquireVsCodeApi();

let graphData = { nodes: [], relationships: [], warnings: [] };
const nodeState = new Map();
const savedPositions = new Map();
let visibleNodes = new Set();
let matchedNodes = new Set();

let pan = { x: 0, y: 0 };
let scale = 1;
const allowOverlap = false;

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const OVERLAP_SPACING = 28;
const LARGE_GRAPH_THRESHOLD = 150;
const NODE_SPACING = 220;
const GRID_MARGIN = 120;
let layoutWidth = 0;
let layoutHeight = 0;
const isPanBlockedTarget = (target) => {
	return Boolean(
		target.closest('.model-node') ||
		target.closest('.zoom-controls') ||
		target.closest('.icon-button')
	);
};

// DOM references
const errorContainer = document.getElementById('error-container');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const refreshBtn = document.getElementById('refresh-btn');
const resetBtn = document.getElementById('reset-layout-btn');
const centerBtn = document.getElementById('center-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const canvas = document.getElementById('graph-canvas');
const viewport = document.getElementById('graph-viewport');
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
resetBtn.addEventListener('click', () => resetLayout());
centerBtn.addEventListener('click', () => centerLayout(true));
zoomInBtn.addEventListener('click', () => zoomBy(0.15));
zoomOutBtn.addEventListener('click', () => zoomBy(-0.15));
searchInput.addEventListener('input', (e) => applySearch(e.target.value));

const wheelHandler = (e) => {
	e.preventDefault();
	const step = e.ctrlKey ? 0.06 : 0.1; // ctrlKey covers pinch-zoom on many touchpads
	const delta = e.deltaY > 0 ? -step : step;
	zoomBy(delta, { anchor: { x: e.clientX, y: e.clientY } });
};

canvas.addEventListener('wheel', wheelHandler, { passive: false });

let panning = false;
let panPointerId = null;
let panStart = { x: 0, y: 0 };
let panOrigin = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
	if (isPanBlockedTarget(e.target)) {
		return;
	}
	panning = true;
	panPointerId = e.pointerId;
	panStart = { x: e.clientX, y: e.clientY };
	panOrigin = { ...pan };
	canvas.setPointerCapture(panPointerId);
});

canvas.addEventListener('pointermove', (e) => {
	if (!panning || e.pointerId !== panPointerId) return;
	const dx = (e.clientX - panStart.x);
	const dy = (e.clientY - panStart.y);
	pan = { x: panOrigin.x + dx, y: panOrigin.y + dy };
	applyTransform();
});

const stopPan = (e) => {
	if (!panning || (e && e.pointerId !== panPointerId)) return;
	panning = false;
	panPointerId = null;
	persistState();
};

canvas.addEventListener('pointerup', stopPan);
canvas.addEventListener('pointercancel', stopPan);

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

// Restore saved layout and view state
(() => {
	const state = vscode.getState() || {};
	if (state.positions) {
		Object.entries(state.positions).forEach(([id, pos]) => {
			savedPositions.set(id, pos);
		});
	}
	if (state.pan) {
		pan = state.pan;
	}
	if (state.scale) {
		scale = state.scale;
	}
	applyTransform();
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
	visibleNodes = new Set(graphData.nodes.map(n => n.id));
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
	const viewWidth = rect.width / scale;
	const viewHeight = rect.height / scale;
	const degreeMap = buildDegreeMap();

	const connected = graphData.nodes.filter(n => (degreeMap.get(n.id) || 0) > 0);
	const isolated = graphData.nodes.filter(n => (degreeMap.get(n.id) || 0) === 0);

	// For very large graphs, use a grid layout and expand the viewport.
	if (graphData.nodes.length > LARGE_GRAPH_THRESHOLD) {
		const cols = Math.ceil(Math.sqrt(graphData.nodes.length));
		const rows = Math.ceil(graphData.nodes.length / cols);
		layoutWidth = cols * NODE_SPACING + GRID_MARGIN * 2;
		layoutHeight = rows * NODE_SPACING + GRID_MARGIN * 2;
		viewport.style.width = `${layoutWidth}px`;
		viewport.style.height = `${layoutHeight}px`;

		graphData.nodes.forEach((node, index) => {
			const state = nodeState.get(node.id);
			if (!state) return;

			const saved = savedPositions.get(node.id);
			if (!reset && saved) {
				setNodePosition(node.id, saved.x, saved.y, { skipPersist: true });
				return;
			}

			const col = index % cols;
			const row = Math.floor(index / cols);
			const x = GRID_MARGIN + col * NODE_SPACING;
			const y = GRID_MARGIN + row * NODE_SPACING;
			setNodePosition(node.id, x, y, { skipPersist: true });
		});
	} else {
		layoutWidth = viewWidth;
		layoutHeight = viewHeight;
		viewport.style.width = `${layoutWidth}px`;
		viewport.style.height = `${layoutHeight}px`;

		const sorted = [...connected].sort((a, b) => (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0));
		const center = { x: viewWidth / 2, y: viewHeight / 2 };
		const clusterRadius = Math.max(180, Math.min(viewWidth, viewHeight) / 2.4);

		// Place connected nodes
		sorted.forEach((node, index) => {
			const state = nodeState.get(node.id);
			if (!state) return;

			const saved = savedPositions.get(node.id);
			if (!reset && saved) {
				setNodePosition(node.id, saved.x, saved.y, { skipPersist: true });
				return;
			}

			if (index === 0) {
				setNodePosition(node.id, center.x - 100, center.y - 50, { skipPersist: true });
				return;
			}

			const angle = (index / Math.max(1, sorted.length - 1)) * Math.PI * 2;
			const x = center.x + clusterRadius * Math.cos(angle) - 100;
			const y = center.y + clusterRadius * Math.sin(angle) - 50;
			setNodePosition(node.id, x, y, { skipPersist: true });
		});

		// Place isolated nodes along the bottom edge to visually separate them
		const isoCols = Math.max(1, Math.floor(viewWidth / 220));
		const isoStartX = 20;
		const isoStartY = viewHeight - 140;

		isolated.forEach((node, index) => {
			const state = nodeState.get(node.id);
			if (!state) return;

			const saved = savedPositions.get(node.id);
			if (!reset && saved) {
				setNodePosition(node.id, saved.x, saved.y, { skipPersist: true });
				return;
			}

			const col = index % isoCols;
			const row = Math.floor(index / isoCols);
			const x = isoStartX + col * 220;
			const y = isoStartY - row * 130;
			setNodePosition(node.id, x, y, { skipPersist: true });
		});
	}

	if (!allowOverlap) {
		resolveCollisions();
	}

	persistState();
	drawEdges();
}

function centerLayout(resetPan = false) {
	if (resetPan) {
		pan = { x: 0, y: 0 };
		scale = 1;
		applyTransform();
	}
	layoutNodes(false);
}

function resetLayout() {
	pan = { x: 0, y: 0 };
	scale = 1;
	applyTransform();
	layoutNodes(true);
}

function buildDegreeMap() {
	const map = new Map();
	graphData.nodes.forEach(n => map.set(n.id, 0));
	graphData.relationships.forEach(rel => {
		map.set(rel.source, (map.get(rel.source) || 0) + 1);
		map.set(rel.target, (map.get(rel.target) || 0) + 1);
	});
	return map;
}

function drawEdges() {
	const baseWidth = layoutWidth || canvas.getBoundingClientRect().width / scale;
	const baseHeight = layoutHeight || canvas.getBoundingClientRect().height / scale;
	edgeLayer.setAttribute('width', `${baseWidth}`);
	edgeLayer.setAttribute('height', `${baseHeight}`);
	edgeLayer.setAttribute('viewBox', `0 0 ${baseWidth} ${baseHeight}`);

	edgeLayer.innerHTML = '';
	labelLayer.innerHTML = '';

	const edgeMap = new Map();

	graphData.relationships.forEach(rel => {
		if (visibleNodes.size && (!visibleNodes.has(rel.source) || !visibleNodes.has(rel.target))) {
			return;
		}

		const sorted = [rel.source, rel.target].sort();
		const undirectedKey = `${sorted[0]}|${sorted[1]}`;
		const needSwap = rel.source !== sorted[0];
		const srcCard = needSwap ? rel.targetCardinality : rel.sourceCardinality;
		const tgtCard = needSwap ? rel.sourceCardinality : rel.targetCardinality;

		const existing = edgeMap.get(undirectedKey);
		const mergedSrc = pickCardinality(existing?.sourceCardinality, srcCard);
		const mergedTgt = pickCardinality(existing?.targetCardinality, tgtCard);
		const normalizedLabel = relationLabelFromCardinality(mergedSrc, mergedTgt);

		edgeMap.set(undirectedKey, {
			fromId: sorted[0],
			toId: sorted[1],
			label: normalizedLabel,
			method: existing?.method || rel.method,
			relation: existing?.relation || rel.relation,
			sourceCardinality: mergedSrc,
			targetCardinality: mergedTgt
		});
	});

	edgeMap.forEach(edge => {
		const from = nodeState.get(edge.fromId);
		const to = nodeState.get(edge.toId);

		if (!from || !to) {
			return;
		}

		const fromCenter = getNodeCenter(from);
		const toCenter = getNodeCenter(to);
		const dx = toCenter.x - fromCenter.x;
		const dy = toCenter.y - fromCenter.y;
		const dist = Math.hypot(dx, dy) || 1;
		const ux = dx / dist;
		const uy = dy / dist;
		const offset = 18;

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', `${fromCenter.x}`);
		line.setAttribute('y1', `${fromCenter.y}`);
		line.setAttribute('x2', `${toCenter.x}`);
		line.setAttribute('y2', `${toCenter.y}`);
		line.setAttribute('class', `edge-line ${normalizeRelation(edge.label)}`);
		line.setAttribute('data-method', edge.method);
		line.setAttribute('data-relation', edge.relation);
		line.setAttribute('stroke-linecap', 'round');
		line.setAttribute('opacity', '0.9');
		edgeLayer.appendChild(line);

		const midPoint = {
			x: (fromCenter.x + toCenter.x) / 2,
			y: (fromCenter.y + toCenter.y) / 2
		};
		const normal = { x: -uy, y: ux };
		const labelOffset = 0;

		const label = document.createElement('div');
		label.className = `edge-label relation-${normalizeRelation(edge.label)}`;
		label.textContent = edge.label;
		label.style.left = `${midPoint.x + normal.x * labelOffset}px`;
		label.style.top = `${midPoint.y + normal.y * labelOffset}px`;
		label.title = `${edge.method} (${edge.relation})`;
		labelLayer.appendChild(label);

		// Cardinalities placed on the line near the label (1 --- label --- ∞).
		const badgeOffset = 60;
		const fromBadge = document.createElement('div');
		fromBadge.className = `edge-endpoint cardinality-${edge.sourceCardinality || 'one'}`;
		fromBadge.textContent = edge.sourceCardinality === 'many' ? '∞' : '1';
		fromBadge.style.left = `${midPoint.x - ux * badgeOffset}px`;
		fromBadge.style.top = `${midPoint.y - uy * badgeOffset}px`;
		fromBadge.style.transform = 'translate(-50%, -50%)';
		labelLayer.appendChild(fromBadge);

		const toBadge = document.createElement('div');
		toBadge.className = `edge-endpoint cardinality-${edge.targetCardinality || 'one'}`;
		toBadge.textContent = edge.targetCardinality === 'many' ? '∞' : '1';
		toBadge.style.left = `${midPoint.x + ux * badgeOffset}px`;
		toBadge.style.top = `${midPoint.y + uy * badgeOffset}px`;
		toBadge.style.transform = 'translate(-50%, -50%)';
		labelLayer.appendChild(toBadge);
	});
}

function normalizeRelation(label) {
	return (relationColors[label] || 'default').replace(/\s+/g, '-');
}

function pickCardinality(existing, incoming) {
	if (existing === 'many' || incoming === 'many') {
		return 'many';
	}
	return existing || incoming || 'one';
}

function relationLabelFromCardinality(sourceCardinality, targetCardinality) {
	const src = sourceCardinality || 'one';
	const tgt = targetCardinality || 'one';
	if (src === 'many' && tgt === 'many') {
		return 'Many To Many';
	}
	if (src === 'many' || tgt === 'many') {
		return 'One To Many';
	}
	return 'One To One';
}

function makeDraggable(el, id) {
	let dragging = false;
	let pointerId = null;
	let offset = { x: 0, y: 0 };

	el.addEventListener('pointerdown', (e) => {
		dragging = true;
		pointerId = e.pointerId;
		const start = toGraphCoords(e.clientX, e.clientY);
		const state = nodeState.get(id);
		offset = {
			x: start.x - (state?.x || 0),
			y: start.y - (state?.y || 0)
		};
		el.setPointerCapture(pointerId);
	});

	el.addEventListener('pointermove', (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const pos = toGraphCoords(e.clientX, e.clientY);
		const x = pos.x - offset.x;
		const y = pos.y - offset.y;
		setNodePosition(id, x, y);
		drawEdges();
	});

	const stopDragging = (e) => {
		if (!dragging || (e && e.pointerId !== pointerId)) return;
		dragging = false;
		pointerId = null;
		persistState();
	};

	el.addEventListener('pointerup', stopDragging);
	el.addEventListener('pointercancel', stopDragging);
}

function setNodePosition(id, x, y, options = {}) {
	const state = nodeState.get(id);
	if (!state) return;

	const nodeWidth = state.element.offsetWidth;
	const nodeHeight = state.element.offsetHeight;

	const extentWidth = layoutWidth || canvas.getBoundingClientRect().width / scale;
	const extentHeight = layoutHeight || canvas.getBoundingClientRect().height / scale;

	const maxX = Math.max(0, extentWidth - nodeWidth);
	const maxY = Math.max(0, extentHeight - nodeHeight);

	const clampedX = clamp(x, 0, maxX);
	const clampedY = clamp(y, 0, maxY);

	state.x = clampedX;
	state.y = clampedY;
	state.element.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

	if (!options.skipPersist) {
		savedPositions.set(id, { x: clampedX, y: clampedY });
	}
}

function getNodeCenter(state) {
	const width = state.element.offsetWidth;
	const height = state.element.offsetHeight;
	return {
		x: state.x + width / 2,
		y: state.y + height / 2
	};
}

function applySearch(term) {
	const query = (term || '').toLowerCase();
	let visibleCount = 0;

	if (!query) {
		visibleNodes = new Set(graphData.nodes.map(n => n.id));
		matchedNodes = new Set();
	} else {
		const matched = new Set(
			graphData.nodes
				.filter(node =>
					node.name.toLowerCase().includes(query) ||
					(node.namespace || '').toLowerCase().includes(query) ||
					graphData.relationships.some(rel =>
						(rel.source === node.id || rel.target === node.id) &&
						(rel.type || '').toLowerCase().includes(query)
					)
				)
				.map(node => node.id)
		);
		matchedNodes = matched;

		const neighbors = new Set();
		graphData.relationships.forEach(rel => {
			if (matched.has(rel.source)) {
				neighbors.add(rel.target);
			}
			if (matched.has(rel.target)) {
				neighbors.add(rel.source);
			}
		});

		// Show only direct matches and their first-degree relationships.
		visibleNodes = new Set([...matched, ...neighbors]);
	}

	graphData.nodes.forEach(node => {
		const state = nodeState.get(node.id);
		if (!state) return;
		const isVisible = visibleNodes.has(node.id);
		state.element.style.display = isVisible ? 'block' : 'none';

		// If this node is a direct search match, treat it as a first-class model for display.
		const chips = state.element.querySelectorAll('.node-chip');
		if (chips.length > 0) {
			chips[0].textContent = matchedNodes.has(node.id) ? 'Model' : (state.data?.isExternal ? 'Referenced' : 'Model');
		}

		if (isVisible) visibleCount += 1;
	});

	searchResults.textContent = query ? `${visibleCount} of ${graphData.nodes.length} matching (showing matches + related)` : '';
	drawEdges();
}

function zoomBy(delta, options = {}) {
	const anchor = options.anchor || null;
	const prevScale = scale;
	scale = clamp(scale + delta, MIN_SCALE, MAX_SCALE);

	if (anchor) {
		const before = toGraphCoords(anchor.x, anchor.y, prevScale);
		const after = toGraphCoords(anchor.x, anchor.y, scale);
		pan.x += (after.x - before.x) * scale;
		pan.y += (after.y - before.y) * scale;
	}

	applyTransform();
	persistState();
	drawEdges();
}

function applyTransform() {
	viewport.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
}

function toGraphCoords(clientX, clientY, customScale) {
	const rect = canvas.getBoundingClientRect();
	const currentScale = customScale || scale;
	return {
		x: (clientX - rect.left - pan.x) / currentScale,
		y: (clientY - rect.top - pan.y) / currentScale
	};
}

function resolveCollisions() {
	const nodes = Array.from(nodeState.values());
	const iterations = graphData.nodes.length > LARGE_GRAPH_THRESHOLD ? 20 : 120;

	for (let i = 0; i < iterations; i++) {
		let moved = false;
		for (let a = 0; a < nodes.length; a++) {
			for (let b = a + 1; b < nodes.length; b++) {
				const na = nodes[a];
				const nb = nodes[b];
				const ax1 = na.x;
				const ay1 = na.y;
				const ax2 = na.x + na.element.offsetWidth;
				const ay2 = na.y + na.element.offsetHeight;

				const bx1 = nb.x;
				const by1 = nb.y;
				const bx2 = nb.x + nb.element.offsetWidth;
				const by2 = nb.y + nb.element.offsetHeight;

				const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
				const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

				if (overlapX > 0 && overlapY > 0) {
					const pushX = (overlapX + OVERLAP_SPACING) / 2;
					const pushY = (overlapY + OVERLAP_SPACING) / 2;
					na.x = clamp(na.x - pushX, 0, canvas.getBoundingClientRect().width / scale - na.element.offsetWidth);
					na.y = clamp(na.y - pushY, 0, canvas.getBoundingClientRect().height / scale - na.element.offsetHeight);
					nb.x = clamp(nb.x + pushX, 0, canvas.getBoundingClientRect().width / scale - nb.element.offsetWidth);
					nb.y = clamp(nb.y + pushY, 0, canvas.getBoundingClientRect().height / scale - nb.element.offsetHeight);
					moved = true;
				}
			}
		}

		if (!moved) break;
	}

	nodes.forEach(node => {
		node.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
		savedPositions.set(node.data.id, { x: node.x, y: node.y });
	});
}

function toggleOverlap() {
	resolveCollisions();
	drawEdges();
	persistState();
}

function persistState() {
	const positions = {};
	savedPositions.forEach((pos, id) => {
		positions[id] = pos;
	});
	vscode.setState({
		positions,
		pan,
		scale
	});
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
