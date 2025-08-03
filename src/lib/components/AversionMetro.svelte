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

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let stations: Station[] = $state([]);
	let lines: Line[] = $state([]);
	let connections: Connection[] = $state([]);
	let selectedTool: 'station' | 'line' | 'select' = $state('station');
	let selectedColor = $state('#0066cc');
	let selectedStations: string[] = $state([]);
	let editingStation: string | null = $state(null);
	let editingStationName = $state('');
	let dragging = $state(false);
	let dragStationId: string | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let selectedLine: string | null = $state(null);

	const GRID_SIZE = 40;
	const STATION_RADIUS = 8;
	const LINE_WIDTH = 6;

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		redraw();
	});

	function snapToGrid(x: number, y: number): [number, number] {
		return [Math.round(x / GRID_SIZE) * GRID_SIZE, Math.round(y / GRID_SIZE) * GRID_SIZE];
	}

	function handleCanvasClick(event: MouseEvent) {
		if (dragging) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const [gridX, gridY] = snapToGrid(x, y);

		if (selectedTool === 'station') {
			addStation(gridX, gridY);
		} else if (selectedTool === 'select') {
			const clickedStation = findStationAt(gridX, gridY);
			if (clickedStation) {
				if (event.shiftKey) {
					toggleStationSelection(clickedStation.id);
				} else {
					selectStation(clickedStation.id);
				}
			} else {
				// Check if clicking on a line
				const clickedLine = findLineAt(x, y);
				if (clickedLine) {
					selectLine(clickedLine.id);
				} else {
					// Clear all selections if clicking empty space
					selectedStations = [];
					selectedLine = null;
					redraw();
				}
			}
		}
	}

	function handleCanvasMouseDown(event: MouseEvent) {
		if (selectedTool !== 'select') return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const [gridX, gridY] = snapToGrid(x, y);

		const clickedStation = findStationAt(gridX, gridY);
		if (clickedStation) {
			dragging = true;
			dragStationId = clickedStation.id;
			dragOffset = {
				x: x - clickedStation.x,
				y: y - clickedStation.y
			};
			canvas.style.cursor = 'grabbing';
		}
	}

	function handleCanvasMouseMove(event: MouseEvent) {
		if (!dragging || !dragStationId) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const [gridX, gridY] = snapToGrid(x - dragOffset.x, y - dragOffset.y);

		const station = stations.find(s => s.id === dragStationId);
		if (station) {
			station.x = gridX;
			station.y = gridY;
			redraw();
		}
	}

	function handleCanvasMouseUp() {
		if (dragging) {
			dragging = false;
			dragStationId = null;
			dragOffset = { x: 0, y: 0 };
			canvas.style.cursor = selectedTool === 'select' ? 'default' : 'crosshair';
		}
	}

	function addStation(x: number, y: number) {
		const existingStation = stations.find(s => s.x === x && s.y === y);
		if (existingStation) return;

		const newStation: Station = {
			id: `station-${Date.now()}`,
			x,
			y,
			name: `Station ${stations.length + 1}`,
			isInterchange: false,
			lines: []
		};

		stations = [...stations, newStation];
		redraw();
	}

	function findStationAt(x: number, y: number): Station | undefined {
		return stations.find(station => {
			const dx = station.x - x;
			const dy = station.y - y;
			return Math.sqrt(dx * dx + dy * dy) <= STATION_RADIUS * 2;
		});
	}

	function selectStation(stationId: string) {
		selectedStations = [stationId];
		selectedLine = null;
		redraw();
	}

	function selectLine(lineId: string) {
		selectedLine = lineId;
		selectedStations = [];
		redraw();
	}

	function findLineAt(x: number, y: number): Line | undefined {
		const tolerance = LINE_WIDTH / 2 + 5;
		
		for (const connection of connections) {
			const fromStation = stations.find(s => s.id === connection.from);
			const toStation = stations.find(s => s.id === connection.to);
			
			if (fromStation && toStation) {
				const distance = distanceToLineSegment(x, y, fromStation.x, fromStation.y, toStation.x, toStation.y);
				if (distance <= tolerance) {
					return lines.find(l => l.id === connection.lineId);
				}
			}
		}
		
		return undefined;
	}

	function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
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
			selectedStations = selectedStations.filter(id => id !== stationId);
		} else {
			selectedStations = [...selectedStations, stationId];
		}
		selectedLine = null;
		redraw();
	}

	function connectSelectedStations() {
		if (selectedStations.length < 2) return;

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

		selectedStations.forEach(stationId => {
			const station = stations.find(s => s.id === stationId);
			if (station) {
				station.lines = [...station.lines, lineId];
				if (station.lines.length > 1) {
					station.isInterchange = true;
				}
			}
		});

		selectedStations = [];
		redraw();
	}

	function startEditingStation(stationId: string) {
		const station = stations.find(s => s.id === stationId);
		if (station) {
			editingStation = stationId;
			editingStationName = station.name;
		}
	}

	function saveStationName() {
		if (editingStation) {
			const station = stations.find(s => s.id === editingStation);
			if (station) {
				station.name = editingStationName;
				redraw();
			}
		}
		editingStation = null;
		editingStationName = '';
	}

	function deleteSelectedStations() {
		selectedStations.forEach(stationId => {
			connections = connections.filter(c => c.from !== stationId && c.to !== stationId);
			lines = lines.filter(line => !line.stations.includes(stationId));
		});
		stations = stations.filter(s => !selectedStations.includes(s.id));
		selectedStations = [];
		redraw();
	}

	function changeLineColor(lineId: string, newColor: string) {
		const line = lines.find(l => l.id === lineId);
		if (line) {
			line.color = newColor;
			redraw();
		}
	}

	function deleteSelectedLine() {
		if (!selectedLine) return;

		// Remove connections for this line
		connections = connections.filter(c => c.lineId !== selectedLine);
		
		// Remove line from stations and update interchange status
		stations.forEach(station => {
			station.lines = station.lines.filter(lineId => lineId !== selectedLine);
			station.isInterchange = station.lines.length > 1;
		});

		// Remove the line
		lines = lines.filter(l => l.id !== selectedLine);
		
		selectedLine = null;
		redraw();
	}

	function redraw() {
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		drawGrid();
		drawConnections();
		drawStations();
	}

	function drawGrid() {
		ctx.strokeStyle = '#f0f0f0';
		ctx.lineWidth = 1;

		for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, canvas.height);
			ctx.stroke();
		}

		for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(canvas.width, y);
			ctx.stroke();
		}
	}

	function drawConnections() {
		connections.forEach(connection => {
			const fromStation = stations.find(s => s.id === connection.from);
			const toStation = stations.find(s => s.id === connection.to);
			const line = lines.find(l => l.id === connection.lineId);

			if (fromStation && toStation && line) {
				const isSelected = selectedLine === line.id;
				
				ctx.strokeStyle = line.color;
				ctx.lineWidth = isSelected ? LINE_WIDTH + 2 : LINE_WIDTH;
				ctx.lineCap = 'round';

				ctx.beginPath();
				ctx.moveTo(fromStation.x, fromStation.y);
				ctx.lineTo(toStation.x, toStation.y);
				ctx.stroke();

				// Draw selection highlight
				if (isSelected) {
					ctx.strokeStyle = '#ff6600';
					ctx.lineWidth = 2;
					ctx.setLineDash([8, 4]);
					ctx.beginPath();
					ctx.moveTo(fromStation.x, fromStation.y);
					ctx.lineTo(toStation.x, toStation.y);
					ctx.stroke();
					ctx.setLineDash([]);
				}
			}
		});
	}

	function drawStations() {
		stations.forEach(station => {
			const isSelected = selectedStations.includes(station.id);

			ctx.fillStyle = 'white';
			ctx.lineWidth = 3;

			if (station.isInterchange) {
				ctx.strokeStyle = 'black';
			} else {
				const primaryLine = lines.find(l => station.lines[0] === l.id);
				ctx.strokeStyle = primaryLine?.color || '#666666';
			}

			ctx.beginPath();
			ctx.arc(station.x, station.y, STATION_RADIUS, 0, 2 * Math.PI);
			ctx.fill();
			ctx.stroke();

			if (isSelected) {
				ctx.strokeStyle = '#ff6600';
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(station.x, station.y, STATION_RADIUS + 4, 0, 2 * Math.PI);
				ctx.stroke();
			}

			ctx.fillStyle = 'black';
			ctx.font = '12px Arial';
			ctx.textAlign = 'center';
			ctx.fillText(station.name, station.x, station.y - STATION_RADIUS - 5);
		});
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
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="metro-editor">
	<div class="toolbar">
		<div class="tool-group">
			<button 
				class:active={selectedTool === 'station'}
				onclick={() => selectedTool = 'station'}
			>
				Add Station
			</button>
			<button 
				class:active={selectedTool === 'select'}
				onclick={() => selectedTool = 'select'}
			>
				Select
			</button>
		</div>

		<div class="tool-group">
			<label>
				Line Color:
				<input type="color" bind:value={selectedColor} />
			</label>
		</div>

		<div class="tool-group">
			<button 
				onclick={connectSelectedStations}
				disabled={selectedStations.length < 2}
			>
				Connect Stations ({selectedStations.length})
			</button>
		</div>

		<div class="tool-group">
			<button 
				onclick={deleteSelectedStations}
				disabled={selectedStations.length === 0}
			>
				Delete Selected
			</button>
		</div>

		{#if selectedLine}
			<div class="tool-group">
				<label>
					Change Line Color:
					<input 
						type="color" 
						value={lines.find(l => l.id === selectedLine)?.color || '#0066cc'}
						onchange={(e) => changeLineColor(selectedLine, e.target.value)}
					/>
				</label>
			</div>
			<div class="tool-group">
				<button 
					onclick={deleteSelectedLine}
					class="delete-button"
				>
					Delete Line
				</button>
			</div>
		{/if}
	</div>

	<div class="canvas-container">
		<canvas 
			bind:this={canvas}
			width="800"
			height="600"
			onclick={handleCanvasClick}
			onmousedown={handleCanvasMouseDown}
			onmousemove={handleCanvasMouseMove}
			onmouseup={handleCanvasMouseUp}
		></canvas>
	</div>

	<div class="instructions">
		<p><strong>Instructions:</strong></p>
		<ul>
			<li>Click "Add Station" and click on grid to add stations</li>
			<li>Use "Select" tool to select stations (Shift+click for multiple) or lines</li>
			<li>In Select mode, drag stations to move them to new grid positions</li>
			<li>Click on a line to select it and change its color or delete it</li>
			<li>Select 2+ stations and click "Connect Stations" or press Enter</li>
			<li>Interchange stations (white with black border) appear automatically when connected to multiple lines</li>
			<li>Press Delete to remove selected stations or lines</li>
		</ul>
	</div>

	{#if selectedStations.length > 0}
		<div class="selected-info">
			<h3>Selected Stations:</h3>
			{#each selectedStations as stationId}
				{@const station = stations.find(s => s.id === stationId)}
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
		{@const line = lines.find(l => l.id === selectedLine)}
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
		gap: 1rem;
		padding: 1rem;
		max-width: 1000px;
		margin: 0 auto;
	}

	.toolbar {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 8px;
		flex-wrap: wrap;
	}

	.tool-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	button {
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:hover {
		background: #f0f0f0;
	}

	button.active {
		background: #0066cc;
		color: white;
		border-color: #0066cc;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.canvas-container {
		border: 2px solid #ddd;
		border-radius: 8px;
		overflow: hidden;
		background: white;
	}

	canvas {
		display: block;
		cursor: crosshair;
	}

	.instructions {
		background: #f9f9f9;
		padding: 1rem;
		border-radius: 8px;
		border-left: 4px solid #0066cc;
	}

	.instructions ul {
		margin: 0.5rem 0 0 1rem;
	}

	.instructions li {
		margin: 0.25rem 0;
	}

	.selected-info {
		background: #fff3cd;
		padding: 1rem;
		border-radius: 8px;
		border-left: 4px solid #ffc107;
	}

	.station-info {
		margin: 0.5rem 0;
		padding: 0.25rem;
		background: white;
		border-radius: 4px;
		cursor: pointer;
	}

	.station-info input {
		border: 1px solid #ccc;
		padding: 0.25rem;
		border-radius: 2px;
		width: 100%;
	}

	.station-name-button {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.station-name-button:hover {
		background: #f0f0f0;
	}

	.line-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.5rem 0;
		padding: 0.5rem;
		background: white;
		border-radius: 4px;
	}

	.line-color-preview {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid #ddd;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	input[type="color"] {
		width: 40px;
		height: 30px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.delete-button {
		background-color: #dc3545;
		color: white;
		border-color: #dc3545;
	}

	.delete-button:hover {
		background-color: #c82333;
		border-color: #bd2130;
	}
</style>