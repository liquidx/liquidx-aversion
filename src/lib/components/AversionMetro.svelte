<script lang="ts">
	import { onMount } from 'svelte';
	import ModeButton from './ModeButton.svelte';
	import ColorSelector from './ColorSelector.svelte';

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
	let fileInput: HTMLInputElement;
	let stations: Station[] = $state([]);
	let lines: Line[] = $state([]);
	let connections: Connection[] = $state([]);
	let selectedTool: 'station' | 'line' = $state('station');
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
			if (selectedTool === 'line') {
				toggleStationSelection(clickedStation.id);
			} else {
				// Station mode: select the station
				selectStation(clickedStation.id);
			}
		} else {
			// Clicked on empty space
			if (selectedTool === 'station') {
				// Station mode: add a station or check for line selection
				const clickedLine = findLineAt(worldX, worldY);
				if (clickedLine) {
					selectLine(clickedLine.id);
				} else {
					// Add station if no line was clicked
					addStation(gridX, gridY);
				}
			} else if (selectedTool === 'line') {
				// Line mode: check if clicking on a line or clear selections
				const clickedLine = findLineAt(worldX, worldY);
				if (clickedLine) {
					selectLine(clickedLine.id);
				} else {
					// Clear selections when clicking empty space
					selectedStations = [];
					selectedLine = null;
				}
			}
		}
	}

	function handleSvgMouseDown(event: MouseEvent) {
		const [worldX, worldY] = screenToWorld(event.clientX, event.clientY);

		if (selectedTool === 'station') {
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
		svgElement.style.cursor = selectedTool === 'station' ? 'crosshair' : 'default';
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

	function saveMapToFile() {
		const mapData = {
			stations,
			lines,
			connections,
			viewBox,
			createdAt: new Date().toISOString(),
			version: '1.0'
		};

		const dataStr = JSON.stringify(mapData, null, 2);
		const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

		const exportFileDefaultName = `metro-map-${new Date().toISOString().split('T')[0]}.json`;

		const linkElement = document.createElement('a');
		linkElement.setAttribute('href', dataUri);
		linkElement.setAttribute('download', exportFileDefaultName);
		linkElement.click();
	}

	function loadMapFromFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result as string;
				const mapData = JSON.parse(result);

				// Validate the structure
				if (!mapData.stations || !mapData.lines || !mapData.connections) {
					alert('Invalid map file format');
					return;
				}

				// Save current state before loading
				saveState();

				// Load the data
				stations = mapData.stations || [];
				lines = mapData.lines || [];
				connections = mapData.connections || [];
				if (mapData.viewBox) {
					viewBox = mapData.viewBox;
				}

				// Clear selections
				selectedStations = [];
				selectedLine = null;
				editingStation = null;

				console.log('Map loaded successfully');
			} catch (error) {
				alert('Error loading map file: ' + (error as Error).message);
			}
		};
		reader.readAsText(file);

		// Reset the input value so the same file can be loaded again
		input.value = '';
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

<div class="flex flex-col gap-6 p-6 max-w-4xl bg-slate-100 min-h-screen">
	<div class="flex gap-4 items-center p-6 bg-white border border-slate-200 rounded-lg shadow-sm flex-wrap">
		<div class="flex gap-2 items-center">
			<ModeButton active={selectedTool === 'station'} onclick={() => (selectedTool = 'station')}>
				Station Mode
			</ModeButton>
			<ModeButton active={selectedTool === 'line'} onclick={() => (selectedTool = 'line')}>
				Line Mode
			</ModeButton>
		</div>

		<div class="flex gap-2 items-center">
			<ColorSelector 
				value={selectedColor} 
				onchange={(color) => selectedColor = color}
				label="Line Color"
			/>
		</div>

		{#if selectedTool === 'line'}
			<div class="flex gap-2 items-center">
				<button 
					onclick={connectSelectedStations} 
					disabled={selectedStations.length < 2}
					class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-900"
				>
					Connect Stations ({selectedStations.length})
				</button>
			</div>
		{/if}

		<div class="flex gap-2 items-center">
			<button 
				onclick={deleteSelectedStations} 
				disabled={selectedStations.length === 0}
				class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 h-9 px-3 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-900"
			>
				Delete Selected
			</button>
		</div>

		<div class="flex gap-2 items-center">
			<button 
				onclick={undo} 
				disabled={!canUndo()}
				class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-900"
			>
				Undo
			</button>
		</div>

		<div class="flex gap-2 items-center">
			<button 
				onclick={saveMapToFile}
				class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
			>
				Save Map
			</button>
			<input 
				type="file" 
				accept=".json" 
				onchange={loadMapFromFile}
				style="display: none;"
				bind:this={fileInput}
			/>
			<button 
				onclick={() => fileInput?.click()}
				class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
			>
				Load Map
			</button>
		</div>

		{#if editingStation}
			{@const station = stations.find((s) => s.id === editingStation)}
			{#if station}
				<div class="flex gap-2 items-center">
					<label for="station-name-input" class="text-sm font-medium text-slate-900">Station Name:</label>
					<input
						id="station-name-input"
						bind:value={editingStationName}
						onblur={saveStationName}
						onkeydown={(e) => e.key === 'Enter' && saveStationName()}
						class="border border-slate-200 bg-white px-3 py-1.5 text-sm rounded-md text-slate-900 w-48 transition-colors focus:outline-none focus:border-blue-500 focus:border-2"
						placeholder="Enter station name"
					/>
					<button 
						onclick={saveStationName}
						class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
					>
						Save
					</button>
				</div>
			{/if}
		{:else if selectedStations.length === 1}
			{@const station = stations.find((s) => s.id === selectedStations[0])}
			{#if station}
				<div class="flex gap-2 items-center">
					<span class="text-sm font-medium text-slate-900">Selected Station:</span>
					<button
						type="button"
						onclick={() => startEditingStation(station.id)}
						class="px-3 py-1.5 text-sm rounded-md bg-slate-50 border border-slate-200 text-slate-900 hover:bg-slate-100 transition-colors"
					>
						{station.name}
					</button>
				</div>
			{/if}
		{:else if selectedLine}
			<div class="flex gap-2 items-center">
				<ColorSelector 
					value={lines.find((l) => l.id === selectedLine)?.color || '#3b82f6'}
					onchange={(color) => selectedLine && changeLineColor(selectedLine, color)}
					label="Change Line Color"
				/>
			</div>
			<div class="flex gap-2 items-center">
				<button 
					onclick={deleteSelectedLine} 
					class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 h-9 px-3 bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700"
				>
					Delete Line
				</button>
			</div>
		{/if}
	</div>

	<div class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
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
			class="block cursor-crosshair select-none"
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

	<div class="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
		<p class="mb-4 font-semibold text-slate-900 text-base">Instructions:</p>
		<ul class="space-y-2 pl-5 list-disc">
			<li class="text-slate-700 text-sm leading-relaxed"><strong>Station Mode</strong>: Click anywhere to add stations, click existing stations to select/drag them, click lines to select them</li>
			<li class="text-slate-700 text-sm leading-relaxed"><strong>Line Mode</strong>: Click stations to select multiple, then "Connect Stations" to draw lines, or click lines to select them</li>
			<li class="text-slate-700 text-sm leading-relaxed">Drag on empty space to pan around the infinite canvas</li>
			<li class="text-slate-700 text-sm leading-relaxed">In Select mode, click on a line to change its color or delete it</li>
			<li class="text-slate-700 text-sm leading-relaxed">
				Interchange stations (white with black border) appear automatically when connected to
				multiple lines
			</li>
			<li class="text-slate-700 text-sm leading-relaxed">Press Delete to remove selected stations or lines</li>
			<li class="text-slate-700 text-sm leading-relaxed">Use "Undo" button or Ctrl+Z (Cmd+Z on Mac) to reverse the last action</li>
		</ul>
	</div>

	{#if selectedStations.length > 1}
		<div class="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
			<h3 class="mb-4 font-semibold text-slate-900 text-base">Selected Stations ({selectedStations.length}):</h3>
			{#each selectedStations as stationId}
				{@const station = stations.find((s) => s.id === stationId)}
				{#if station}
					<div class="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
						<button
							type="button"
							onclick={() => startEditingStation(stationId)}
							class="bg-transparent border-none p-2 font-inherit cursor-pointer text-left w-full rounded transition-colors hover:bg-slate-100 text-slate-900"
						>
							{station.name}
						</button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if selectedLine}
		{@const line = lines.find((l) => l.id === selectedLine)}
		<div class="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
			<h3 class="mb-4 font-semibold text-slate-900 text-base">Selected Line:</h3>
			{#if line}
				<div class="flex items-center gap-3 mb-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
					<div class="w-5 h-5 rounded-full border-2 border-slate-400 shadow-sm" style="background-color: {line.color}"></div>
					<span class="text-slate-700 text-sm">Line with {line.stations.length} stations</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

