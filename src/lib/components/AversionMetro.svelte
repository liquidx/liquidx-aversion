<script lang="ts">
	import { onMount } from 'svelte';

	interface Station {
		id: string;
		x: number;
		y: number;
		name: string;
		isInterchange: boolean;
		lines: string[];
	}

	interface Line {
		id: string;
		color: string;
		stations: string[];
	}

	interface Connection {
		from: string;
		to: string;
		lineId: string;
	}

	let svgElement: SVGSVGElement;
	let stations: Station[] = $state([]);
	let lines: Line[] = $state([]);
	let connections: Connection[] = $state([]);
	let selectedTool: 'add' | 'connect' | 'select' = $state('add');
	let selectedColor = $state('#0066cc');
	let selectedStations: string[] = $state([]);
	let editingStation: string | null = $state(null);
	let editingStationName = $state('');
	let dragging = $state(false);
	let dragStationId: string | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let selectedLine: string | null = $state(null);
	let panning = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let hasPanned = $state(false);

	const GRID_SIZE = 40;
	const STATION_RADIUS = 8;
	const LINE_WIDTH = 6;
	const SVG_WIDTH = 800;
	const SVG_HEIGHT = 600;

	let viewBox = $state({ x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT });

	// Undo system
	interface HistoryState {
		stations: Station[];
		lines: Line[];
		connections: Connection[];
	}

	let history: HistoryState[] = $state([]);
	let historyIndex = $state(-1);
	const MAX_HISTORY = 50;

	// Initialize history with empty state
	$effect(() => {
		if (history.length === 0) {
			history.push({
				stations: [],
				lines: [],
				connections: []
			});
			historyIndex = 0;
		}
	});

	function snapToGrid(x: number, y: number): [number, number] {
		return [Math.round(x / GRID_SIZE) * GRID_SIZE, Math.round(y / GRID_SIZE) * GRID_SIZE];
	}

	function screenToWorld(screenX: number, screenY: number): [number, number] {
		const rect = svgElement.getBoundingClientRect();
		const x = ((screenX - rect.left) / rect.width) * viewBox.width + viewBox.x;
		const y = ((screenY - rect.top) / rect.height) * viewBox.height + viewBox.y;
		return [x, y];
	}

	// Reactive grid lines based on viewBox
	let gridLines = $derived.by(() => {
		const lines = { x: [] as number[], y: [] as number[] };
		
		// Calculate the grid bounds that are visible in the current viewBox
		const startX = Math.floor(viewBox.x / GRID_SIZE) * GRID_SIZE;
		const endX = Math.ceil((viewBox.x + viewBox.width) / GRID_SIZE) * GRID_SIZE;
		const startY = Math.floor(viewBox.y / GRID_SIZE) * GRID_SIZE;
		const endY = Math.ceil((viewBox.y + viewBox.height) / GRID_SIZE) * GRID_SIZE;
		
		// Generate vertical lines
		for (let x = startX; x <= endX; x += GRID_SIZE) {
			lines.x.push(x);
		}
		
		// Generate horizontal lines
		for (let y = startY; y <= endY; y += GRID_SIZE) {
			lines.y.push(y);
		}
		
		return lines;
	});

	function saveState() {
		// Deep clone the current state
		const currentState: HistoryState = {
			stations: JSON.parse(JSON.stringify(stations)),
			lines: JSON.parse(JSON.stringify(lines)),
			connections: JSON.parse(JSON.stringify(connections))
		};

		// Remove any history after current index (for when undoing then making new changes)
		history = history.slice(0, historyIndex + 1);

		// Add new state
		history.push(currentState);
		historyIndex++;

		// Limit history size
		if (history.length > MAX_HISTORY) {
			history.shift();
			historyIndex--;
		}
	}

	function canUndo(): boolean {
		return historyIndex > 0;
	}

	function undo() {
		if (!canUndo()) return;

		historyIndex--;
		const previousState = history[historyIndex];

		// Restore state
		stations = JSON.parse(JSON.stringify(previousState.stations));
		lines = JSON.parse(JSON.stringify(previousState.lines));
		connections = JSON.parse(JSON.stringify(previousState.connections));

		// Clear selections
		selectedStations = [];
		selectedLine = null;
		editingStation = null;
	}

	function handleSvgClick(event: MouseEvent) {
		if (dragging || panning || hasPanned) return;

		const [worldX, worldY] = screenToWorld(event.clientX, event.clientY);
		const [gridX, gridY] = snapToGrid(worldX, worldY);
		
		const clickedStation = findStationAt(worldX, worldY);
		
		if (clickedStation) {
			// Clicked on an existing station
			if (selectedTool === 'connect') {
				toggleStationSelection(clickedStation.id);
			} else {
				// Default behavior: select the station
				selectStation(clickedStation.id);
			}
		} else {
			// Clicked on empty space
			if (selectedTool === 'add') {
				// Default behavior: add a station
				addStation(gridX, gridY);
			} else if (selectedTool === 'select') {
				// Check if clicking on a line
				const clickedLine = findLineAt(worldX, worldY);
				if (clickedLine) {
					selectLine(clickedLine.id);
				} else {
					// Clear all selections if clicking empty space
					selectedStations = [];
					selectedLine = null;
				}
			} else if (selectedTool === 'connect') {
				// Clear selections in connect mode when clicking empty space
				selectedStations = [];
				selectedLine = null;
			}
		}
	}

	function handleSvgMouseDown(event: MouseEvent) {
		const [worldX, worldY] = screenToWorld(event.clientX, event.clientY);

		if (selectedTool === 'select') {
			const clickedStation = findStationAt(worldX, worldY);
			if (clickedStation) {
				saveState(); // Save state before dragging starts
				dragging = true;
				dragStationId = clickedStation.id;
				const rect = svgElement.getBoundingClientRect();
				dragOffset = {
					x:
						event.clientX -
						rect.left -
						((clickedStation.x - viewBox.x) / viewBox.width) * rect.width,
					y:
						event.clientY -
						rect.top -
						((clickedStation.y - viewBox.y) / viewBox.height) * rect.height
				};
				svgElement.style.cursor = 'grabbing';
				return;
			}
		}

		// Start panning if not clicking on a station or not in a mode that handles stations
		panning = true;
		hasPanned = false;
		panStart = { x: event.clientX, y: event.clientY };
		svgElement.style.cursor = 'grabbing';
	}

	function handleSvgMouseMove(event: MouseEvent) {
		if (dragging && dragStationId) {
			const [worldX, worldY] = screenToWorld(
				event.clientX - dragOffset.x,
				event.clientY - dragOffset.y
			);
			const [gridX, gridY] = snapToGrid(worldX, worldY);

			const station = stations.find((s) => s.id === dragStationId);
			if (station) {
				station.x = gridX;
				station.y = gridY;
			}
		} else if (panning) {
			const deltaX = event.clientX - panStart.x;
			const deltaY = event.clientY - panStart.y;

			// Mark as having panned if there's significant movement
			if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
				hasPanned = true;
			}

			const rect = svgElement.getBoundingClientRect();
			const worldDeltaX = (deltaX / rect.width) * viewBox.width;
			const worldDeltaY = (deltaY / rect.height) * viewBox.height;

			viewBox = {
				...viewBox,
				x: viewBox.x - worldDeltaX,
				y: viewBox.y - worldDeltaY
			};

			panStart = { x: event.clientX, y: event.clientY };
		}
	}

	function handleSvgMouseUp() {
		if (dragging) {
			dragging = false;
			dragStationId = null;
			dragOffset = { x: 0, y: 0 };
		}
		if (panning) {
			panning = false;
			// Reset hasPanned after a short delay to allow click event to be prevented
			setTimeout(() => {
				hasPanned = false;
			}, 0);
		}
		svgElement.style.cursor = selectedTool === 'select' ? 'default' : 'crosshair';
	}

	function addStation(x: number, y: number) {
		const existingStation = stations.find((s) => s.x === x && s.y === y);
		if (existingStation) return;

		saveState();

		const newStation: Station = {
			id: `station-${Date.now()}`,
			x,
			y,
			name: `Station ${stations.length + 1}`,
			isInterchange: false,
			lines: []
		};

		stations = [...stations, newStation];
	}

	function findStationAt(x: number, y: number): Station | undefined {
		return stations.find((station) => {
			const dx = station.x - x;
			const dy = station.y - y;
			return Math.sqrt(dx * dx + dy * dy) <= STATION_RADIUS * 2;
		});
	}

	function selectStation(stationId: string) {
		selectedStations = [stationId];
		selectedLine = null;
	}

	function selectLine(lineId: string) {
		selectedLine = lineId;
		selectedStations = [];
	}

	function findLineAt(x: number, y: number): Line | undefined {
		const tolerance = LINE_WIDTH / 2 + 5;

		for (const connection of connections) {
			const fromStation = stations.find((s) => s.id === connection.from);
			const toStation = stations.find((s) => s.id === connection.to);

			if (fromStation && toStation) {
				const distance = distanceToLineSegment(
					x,
					y,
					fromStation.x,
					fromStation.y,
					toStation.x,
					toStation.y
				);
				if (distance <= tolerance) {
					return lines.find((l) => l.id === connection.lineId);
				}
			}
		}

		return undefined;
	}

	function distanceToLineSegment(
		px: number,
		py: number,
		x1: number,
		y1: number,
		x2: number,
		y2: number
	): number {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const length = Math.sqrt(dx * dx + dy * dy);

		if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

		const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
		const projX = x1 + t * dx;
		const projY = y1 + t * dy;

		return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
	}

	function toggleStationSelection(stationId: string) {
		if (selectedStations.includes(stationId)) {
			selectedStations = selectedStations.filter((id) => id !== stationId);
		} else {
			selectedStations = [...selectedStations, stationId];
		}
		selectedLine = null;
	}

	function connectSelectedStations() {
		if (selectedStations.length < 2) return;

		saveState();

		const lineId = `line-${Date.now()}`;
		const newLine: Line = {
			id: lineId,
			color: selectedColor,
			stations: [...selectedStations]
		};

		lines = [...lines, newLine];

		for (let i = 0; i < selectedStations.length - 1; i++) {
			const connection: Connection = {
				from: selectedStations[i],
				to: selectedStations[i + 1],
				lineId
			};
			connections = [...connections, connection];
		}

		selectedStations.forEach((stationId) => {
			const station = stations.find((s) => s.id === stationId);
			if (station) {
				station.lines = [...station.lines, lineId];
				if (station.lines.length > 1) {
					station.isInterchange = true;
				}
			}
		});

		selectedStations = [];
	}

	function startEditingStation(stationId: string) {
		const station = stations.find((s) => s.id === stationId);
		if (station) {
			editingStation = stationId;
			editingStationName = station.name;
		}
	}

	function saveStationName() {
		if (editingStation) {
			const station = stations.find((s) => s.id === editingStation);
			if (station && station.name !== editingStationName) {
				saveState();
				station.name = editingStationName;
			}
		}
		editingStation = null;
		editingStationName = '';
	}

	function deleteSelectedStations() {
		if (selectedStations.length === 0) return;

		saveState();

		selectedStations.forEach((stationId) => {
			connections = connections.filter((c) => c.from !== stationId && c.to !== stationId);
			lines = lines.filter((line) => !line.stations.includes(stationId));
		});
		stations = stations.filter((s) => !selectedStations.includes(s.id));
		selectedStations = [];
	}

	function changeLineColor(lineId: string, newColor: string) {
		const line = lines.find((l) => l.id === lineId);
		if (line && line.color !== newColor) {
			saveState();
			line.color = newColor;
		}
	}

	function deleteSelectedLine() {
		if (!selectedLine) return;

		saveState();

		// Remove connections for this line
		connections = connections.filter((c) => c.lineId !== selectedLine);

		// Remove line from stations and update interchange status
		stations.forEach((station) => {
			station.lines = station.lines.filter((lineId) => lineId !== selectedLine);
			station.isInterchange = station.lines.length > 1;
		});

		// Remove the line
		lines = lines.filter((l) => l.id !== selectedLine);

		selectedLine = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Delete') {
			if (selectedStations.length > 0) {
				deleteSelectedStations();
			} else if (selectedLine) {
				deleteSelectedLine();
			}
		} else if (event.key === 'Enter' && selectedStations.length >= 2) {
			connectSelectedStations();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
			event.preventDefault();
			undo();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="metro-editor">
	<div class="toolbar">
		<div class="tool-group">
			<button class:active={selectedTool === 'add'} onclick={() => (selectedTool = 'add')}>
				Add Mode
			</button>
			<button class:active={selectedTool === 'connect'} onclick={() => (selectedTool = 'connect')}>
				Connect Mode
			</button>
			<button class:active={selectedTool === 'select'} onclick={() => (selectedTool = 'select')}>
				Select Mode
			</button>
		</div>

		<div class="tool-group">
			<label>
				Line Color:
				<input type="color" bind:value={selectedColor} />
			</label>
		</div>

		{#if selectedTool === 'connect'}
			<div class="tool-group">
				<button onclick={connectSelectedStations} disabled={selectedStations.length < 2}>
					Connect Stations ({selectedStations.length})
				</button>
			</div>
		{/if}

		<div class="tool-group">
			<button onclick={deleteSelectedStations} disabled={selectedStations.length === 0}>
				Delete Selected
			</button>
		</div>

		<div class="tool-group">
			<button onclick={undo} disabled={!canUndo()}> Undo </button>
		</div>

		{#if selectedLine}
			<div class="tool-group">
				<label>
					Change Line Color:
					<input
						type="color"
						value={lines.find((l) => l.id === selectedLine)?.color || '#0066cc'}
						onchange={(e) =>
							selectedLine &&
							e.target &&
							changeLineColor(selectedLine, (e.target as HTMLInputElement).value)}
					/>
				</label>
			</div>
			<div class="tool-group">
				<button onclick={deleteSelectedLine} class="delete-button"> Delete Line </button>
			</div>
		{/if}
	</div>

	<div class="svg-container">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<svg
			bind:this={svgElement}
			width={SVG_WIDTH}
			height={SVG_HEIGHT}
			viewBox="{viewBox.x} {viewBox.y} {viewBox.width} {viewBox.height}"
			role="application"
			aria-label="Metro map editor"
			onclick={handleSvgClick}
			onmousedown={handleSvgMouseDown}
			onmousemove={handleSvgMouseMove}
			onmouseup={handleSvgMouseUp}
		>
			<!-- Dynamic Grid lines -->
			<!-- Vertical grid lines -->
			{#each gridLines.x as x}
				<line
					x1={x}
					y1={viewBox.y}
					x2={x}
					y2={viewBox.y + viewBox.height}
					stroke="#f0f0f0"
					stroke-width="1"
				/>
			{/each}
			
			<!-- Horizontal grid lines -->
			{#each gridLines.y as y}
				<line
					x1={viewBox.x}
					y1={y}
					x2={viewBox.x + viewBox.width}
					y2={y}
					stroke="#f0f0f0"
					stroke-width="1"
				/>
			{/each}

			<!-- Connections/Lines -->
			{#each connections as connection}
				{@const fromStation = stations.find((s) => s.id === connection.from)}
				{@const toStation = stations.find((s) => s.id === connection.to)}
				{@const line = lines.find((l) => l.id === connection.lineId)}
				{#if fromStation && toStation && line}
					{@const isSelected = selectedLine === line.id}
					<line
						x1={fromStation.x}
						y1={fromStation.y}
						x2={toStation.x}
						y2={toStation.y}
						stroke={line.color}
						stroke-width={isSelected ? LINE_WIDTH + 2 : LINE_WIDTH}
						stroke-linecap="round"
					/>
					{#if isSelected}
						<line
							x1={fromStation.x}
							y1={fromStation.y}
							x2={toStation.x}
							y2={toStation.y}
							stroke="#ff6600"
							stroke-width="2"
							stroke-dasharray="8,4"
							stroke-linecap="round"
						/>
					{/if}
				{/if}
			{/each}

			<!-- Stations -->
			{#each stations as station}
				{@const isSelected = selectedStations.includes(station.id)}
				{@const primaryLine = lines.find((l) => station.lines[0] === l.id)}
				{@const strokeColor = station.isInterchange ? 'black' : primaryLine?.color || '#666666'}

				<!-- Station circle -->
				<circle
					cx={station.x}
					cy={station.y}
					r={STATION_RADIUS}
					fill="white"
					stroke={strokeColor}
					stroke-width="3"
				/>

				<!-- Selection highlight -->
				{#if isSelected}
					<circle
						cx={station.x}
						cy={station.y}
						r={STATION_RADIUS + 4}
						fill="none"
						stroke="#ff6600"
						stroke-width="4"
					/>
				{/if}

				<!-- Station name -->
				<text
					x={station.x}
					y={station.y - STATION_RADIUS - 5}
					text-anchor="middle"
					font-family="Arial"
					font-size="12"
					fill="black"
				>
					{station.name}
				</text>
			{/each}
		</svg>
	</div>

	<div class="instructions">
		<p><strong>Instructions:</strong></p>
		<ul>
			<li><strong>Add Mode</strong>: Click anywhere to add stations, click existing stations to select them</li>
			<li><strong>Connect Mode</strong>: Click stations to select multiple, then "Connect Stations" to draw lines</li>
			<li><strong>Select Mode</strong>: Drag stations to move them, click lines to select and edit them</li>
			<li>Drag on empty space to pan around the infinite canvas</li>
			<li>In Select mode, click on a line to change its color or delete it</li>
			<li>
				Interchange stations (white with black border) appear automatically when connected to
				multiple lines
			</li>
			<li>Press Delete to remove selected stations or lines</li>
			<li>Use "Undo" button or Ctrl+Z (Cmd+Z on Mac) to reverse the last action</li>
		</ul>
	</div>

	{#if selectedStations.length > 0}
		<div class="selected-info">
			<h3>Selected Stations:</h3>
			{#each selectedStations as stationId}
				{@const station = stations.find((s) => s.id === stationId)}
				{#if station}
					<div class="station-info">
						{#if editingStation === stationId}
							<input
								bind:value={editingStationName}
								onblur={saveStationName}
								onkeydown={(e) => e.key === 'Enter' && saveStationName()}
							/>
						{:else}
							<button
								type="button"
								onclick={() => startEditingStation(stationId)}
								class="station-name-button"
							>
								{station.name}
							</button>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if selectedLine}
		{@const line = lines.find((l) => l.id === selectedLine)}
		<div class="selected-info">
			<h3>Selected Line:</h3>
			{#if line}
				<div class="line-info">
					<div class="line-color-preview" style="background-color: {line.color}"></div>
					<span>Line with {line.stations.length} stations</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.metro-editor {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		max-width: 800px;
		margin: 0;
		background-color: hsl(210 11% 96%);
		min-height: 100vh;
	}

	.toolbar {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1.5rem;
		background-color: hsl(0 0% 100%);
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.5rem;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
		flex-wrap: wrap;
	}

	.tool-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
		height: 2.25rem;
		padding-left: 0.75rem;
		padding-right: 0.75rem;
		border: 1px solid hsl(214.3 31.8% 91.4%);
		background-color: hsl(0 0% 100%);
		color: hsl(222.2 84% 4.9%);
		cursor: pointer;
	}

	button:hover {
		background-color: hsl(210 40% 98%);
		color: hsl(222.2 84% 4.9%);
	}

	button.active {
		background-color: hsl(222.2 47.4% 11.2%);
		color: hsl(210 40% 98%);
		border-color: hsl(222.2 47.4% 11.2%);
	}

	button.active:hover {
		background-color: hsl(222.2 47.4% 11.2%);
		opacity: 0.9;
	}

	button:disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	.svg-container {
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.5rem;
		overflow: hidden;
		background-color: hsl(0 0% 100%);
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	svg {
		display: block;
		cursor: crosshair;
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
	}

	.instructions {
		background-color: hsl(0 0% 100%);
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.5rem;
		padding: 1.5rem;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	.instructions p {
		margin: 0 0 1rem 0;
		font-weight: 600;
		color: hsl(222.2 84% 4.9%);
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.instructions ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	.instructions li {
		margin: 0.5rem 0;
		color: hsl(215.4 16.3% 46.9%);
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.selected-info {
		background-color: hsl(0 0% 100%);
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.5rem;
		padding: 1.5rem;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	.selected-info h3 {
		margin: 0 0 1rem 0;
		font-weight: 600;
		color: hsl(222.2 84% 4.9%);
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.station-info {
		margin: 0.75rem 0;
		padding: 0.75rem;
		background-color: hsl(210 40% 98%);
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.375rem;
	}

	.station-info input {
		flex: 1;
		border: 1px solid hsl(214.3 31.8% 91.4%);
		background-color: hsl(0 0% 100%);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		border-radius: 0.375rem;
		color: hsl(222.2 84% 4.9%);
		width: 100%;
		transition-property: border-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
	}

	.station-info input:focus {
		outline: 2px solid transparent;
		outline-offset: 2px;
		border-color: hsl(221.2 83.2% 53.3%);
	}

	.station-name-button {
		background: none;
		border: none;
		padding: 0.5rem;
		font: inherit;
		cursor: pointer;
		text-align: left;
		width: 100%;
		border-radius: 0.25rem;
		transition-property: background-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
		color: hsl(222.2 84% 4.9%);
	}

	.station-name-button:hover {
		background-color: hsl(210 40% 96%);
	}

	.line-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.75rem 0;
		padding: 0.75rem;
		background-color: hsl(210 40% 98%);
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.375rem;
	}

	.line-color-preview {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		border: 2px solid hsl(214.3 31.8% 91.4%);
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(222.2 84% 4.9%);
	}

	input[type='color'] {
		width: 2.5rem;
		height: 2.25rem;
		border: 1px solid hsl(214.3 31.8% 91.4%);
		border-radius: 0.375rem;
		cursor: pointer;
		background-color: hsl(0 0% 100%);
	}

	.delete-button {
		background-color: hsl(0 84.2% 60.2%);
		color: hsl(210 40% 98%);
		border-color: hsl(0 84.2% 60.2%);
	}

	.delete-button:hover {
		background-color: hsl(0 84.2% 60.2%);
		opacity: 0.9;
	}
</style>
