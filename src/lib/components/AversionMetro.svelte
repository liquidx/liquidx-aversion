<script lang="ts">
	import ModeButton from './ModeButton.svelte';
	import ColorSelector from './ColorSelector.svelte';
	import { MapPin, Route, Link2, Trash2, Undo2, Save, FolderOpen, X, Plus, GripVertical } from '@lucide/svelte';

	interface Station {
		id: string;
		x: number;
		y: number;
		name: string;
		isInterchange: boolean;
		lines: string[];
		color: string;
	}

	interface Line {
		id: string;
		name: string;
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
	let selectedStations: string[] = $state([]);
	let editingStation: string | null = $state(null);
	let editingStationName = $state('');
	let dragging = $state(false);
	let dragStationId: string | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let selectedLine: string | null = $state(null);
	let editingLine: string | null = $state(null);
	let editingLineName = $state('');
	let panning = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let hasPanned = $state(false);
	let showColorPicker = $state(false);
	let pendingConnection = $state(false);
	let showLineSelector = $state(false);
	let selectedLineToAddTo: string | null = $state(null);
	let draggedStationIndex: number | null = $state(null);
	let draggedOverIndex: number | null = $state(null);

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

	function handleSvgClick(event: MouseEvent | TouchEvent) {
		if (dragging || panning || hasPanned) return;

		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
		const [worldX, worldY] = screenToWorld(clientX, clientY);
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

	function handleSvgMouseDown(event: MouseEvent | TouchEvent) {
		event.preventDefault(); // Prevent touch scrolling
		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
		const [worldX, worldY] = screenToWorld(clientX, clientY);

		// Check if clicking on a station first (regardless of mode)
		const clickedStation = findStationAt(worldX, worldY);
		
		if (clickedStation && selectedTool === 'station') {
			// In station mode, enable dragging for the clicked station
			saveState(); // Save state before dragging starts
			dragging = true;
			dragStationId = clickedStation.id;
			const rect = svgElement.getBoundingClientRect();
			dragOffset = {
				x: clientX - rect.left - ((clickedStation.x - viewBox.x) / viewBox.width) * rect.width,
				y: clientY - rect.top - ((clickedStation.y - viewBox.y) / viewBox.height) * rect.height
			};
			svgElement.style.cursor = 'grabbing';
			return;
		} else if (clickedStation && selectedTool === 'line') {
			// In line mode, don't start panning when clicking on a station
			// This allows the click event to be processed for station selection
			return;
		}

		// Start panning if not clicking on a station
		panning = true;
		hasPanned = false;
		panStart = { x: clientX, y: clientY };
		svgElement.style.cursor = 'grabbing';
	}

	function handleSvgMouseMove(event: MouseEvent | TouchEvent) {
		if ('touches' in event && event.touches.length === 0) return; // No touch points

		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

		if (dragging && dragStationId) {
			const [worldX, worldY] = screenToWorld(clientX - dragOffset.x, clientY - dragOffset.y);
			const [gridX, gridY] = snapToGrid(worldX, worldY);

			const station = stations.find((s) => s.id === dragStationId);
			if (station) {
				station.x = gridX;
				station.y = gridY;
			}
		} else if (panning) {
			const deltaX = clientX - panStart.x;
			const deltaY = clientY - panStart.y;

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

			panStart = { x: clientX, y: clientY };
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
			lines: [],
			color: '#000000'
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

		// Show color picker instead of immediately connecting
		showColorPicker = true;
		pendingConnection = true;
	}

	function confirmConnection(color: string) {
		if (!pendingConnection || selectedStations.length < 2) return;

		saveState();

		const lineId = `line-${Date.now()}`;
		const newLine: Line = {
			id: lineId,
			name: `Line ${lines.length + 1}`,
			color: color,
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
				// Set station color to the line color if it's the first line
				if (station.lines.length === 1) {
					station.color = color;
				}
				// Mark as interchange if connected to multiple lines
				if (station.lines.length > 1) {
					station.isInterchange = true;
				}
			}
		});

		selectedStations = [];
		showColorPicker = false;
		pendingConnection = false;
	}

	function cancelConnection() {
		showColorPicker = false;
		pendingConnection = false;
	}

	function showAddToLineSelector() {
		if (selectedStations.length === 0) return;
		showLineSelector = true;
	}

	function cancelAddToLine() {
		showLineSelector = false;
		selectedLineToAddTo = null;
	}

	function addStationsToLine(lineId: string) {
		if (selectedStations.length === 0 || !lineId) return;

		saveState();

		const line = lines.find(l => l.id === lineId);
		if (!line) return;

		// Add stations to the line
		selectedStations.forEach((stationId) => {
			const station = stations.find((s) => s.id === stationId);
			if (station && !station.lines.includes(lineId)) {
				station.lines = [...station.lines, lineId];
				
				// Set station color to the line color if it's the first line
				if (station.lines.length === 1) {
					station.color = line.color;
				}
				
				// Mark as interchange if connected to multiple lines
				if (station.lines.length > 1) {
					station.isInterchange = true;
				}
				
				// Add station to line's stations array if not already there
				if (!line.stations.includes(stationId)) {
					line.stations = [...line.stations, stationId];
				}
			}
		});

		// Create connections between the new stations and existing stations on the line
		// For simplicity, we'll connect each new station to the nearest existing station on the line
		selectedStations.forEach((newStationId) => {
			const newStation = stations.find(s => s.id === newStationId);
			if (!newStation) return;

			// Find the closest existing station on this line
			let closestStation: Station | null = null;
			let minDistance = Infinity;

			stations.forEach((station) => {
				if (station.id !== newStationId && 
				    station.lines.includes(lineId) && 
				    !selectedStations.includes(station.id)) {
					const distance = Math.sqrt(
						Math.pow(station.x - newStation.x, 2) + 
						Math.pow(station.y - newStation.y, 2)
					);
					if (distance < minDistance) {
						minDistance = distance;
						closestStation = station;
					}
				}
			});

			// Create connection to the closest station
			if (closestStation !== null) {
				const closestStationId = (closestStation as Station).id;
				const connectionExists = connections.some(c => 
					(c.from === newStationId && c.to === closestStationId && c.lineId === lineId) ||
					(c.from === closestStationId && c.to === newStationId && c.lineId === lineId)
				);

				if (!connectionExists) {
					const connection: Connection = {
						from: newStationId,
						to: closestStationId,
						lineId
					};
					connections = [...connections, connection];
				}
			}
		});

		selectedStations = [];
		showLineSelector = false;
		selectedLineToAddTo = null;
	}

	function removeStationFromLine(lineId: string, stationId: string) {
		saveState();

		const line = lines.find(l => l.id === lineId);
		if (!line) return;

		// Remove station from line's stations array
		line.stations = line.stations.filter(id => id !== stationId);

		// Remove station from line in station object
		const station = stations.find(s => s.id === stationId);
		if (station) {
			station.lines = station.lines.filter(id => id !== lineId);
			
			// Update interchange status
			station.isInterchange = station.lines.length > 1;

			// Update station color if this was the line providing its color
			if (station.lines.length === 0) {
				station.color = '#000000';
			} else {
				// Use color from remaining first line
				const firstLine = lines.find(line => line.id === station.lines[0]);
				if (firstLine) {
					station.color = firstLine.color;
				}
			}
		}

		// Remove connections involving this station on this line
		connections = connections.filter(c => 
			!(c.lineId === lineId && (c.from === stationId || c.to === stationId))
		);

		// Rebuild connections for the remaining stations in order
		rebuildLineConnections(lineId);
	}

	function reorderStations(lineId: string, fromIndex: number, toIndex: number) {
		saveState();

		const line = lines.find(l => l.id === lineId);
		if (!line) return;

		// Reorder stations array
		const stations = [...line.stations];
		const [removed] = stations.splice(fromIndex, 1);
		stations.splice(toIndex, 0, removed);
		line.stations = stations;

		// Rebuild connections with new order
		rebuildLineConnections(lineId);
	}

	function rebuildLineConnections(lineId: string) {
		const line = lines.find(l => l.id === lineId);
		if (!line) return;

		// Remove all existing connections for this line
		connections = connections.filter(c => c.lineId !== lineId);

		// Create new connections based on station order
		for (let i = 0; i < line.stations.length - 1; i++) {
			const connection: Connection = {
				from: line.stations[i],
				to: line.stations[i + 1],
				lineId
			};
			connections = [...connections, connection];
		}
	}

	function handleStationDragStart(event: DragEvent, index: number) {
		draggedStationIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleStationDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		draggedOverIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleStationDrop(event: DragEvent, lineId: string, toIndex: number) {
		event.preventDefault();
		if (draggedStationIndex !== null && draggedStationIndex !== toIndex) {
			reorderStations(lineId, draggedStationIndex, toIndex);
		}
		draggedStationIndex = null;
		draggedOverIndex = null;
	}

	function handleStationDragEnd() {
		draggedStationIndex = null;
		draggedOverIndex = null;
	}

	function handlePopoverClickOutside(event: MouseEvent) {
		if (showColorPicker) {
			const target = event.target as HTMLElement;
			const popover = target.closest('.color-popover');
			const connectButton = target.closest('[data-connect-button]');

			// Don't close if clicking inside the popover or on the connect button
			if (!popover && !connectButton) {
				cancelConnection();
			}
		}
		
		if (showLineSelector) {
			const target = event.target as HTMLElement;
			const popover = target.closest('.line-selector-popover');
			const addToLineButton = target.closest('[data-add-to-line-button]');

			// Don't close if clicking inside the popover or on the add to line button
			if (!popover && !addToLineButton) {
				cancelAddToLine();
			}
		}
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

			// Update station colors for all stations on this line
			stations.forEach((station) => {
				// If this station's color should be updated (it's on this line and this is its primary line)
				if (station.lines.includes(lineId) && station.lines[0] === lineId) {
					station.color = newColor;
				}
			});
		}
	}

	function changeStationColor(stationId: string, newColor: string) {
		const station = stations.find((s) => s.id === stationId);
		if (station && station.color !== newColor) {
			saveState();
			station.color = newColor;
		}
	}

	function startEditingLine(lineId: string) {
		const line = lines.find((l) => l.id === lineId);
		if (line) {
			editingLine = lineId;
			editingLineName = line.name;
		}
	}

	function saveLineName() {
		if (editingLine) {
			const line = lines.find((l) => l.id === editingLine);
			if (line && line.name !== editingLineName) {
				saveState();
				line.name = editingLineName;
			}
		}
		editingLine = null;
		editingLineName = '';
	}

	function deleteSelectedLine() {
		if (!selectedLine) return;

		saveState();

		// Remove connections for this line
		connections = connections.filter((c) => c.lineId !== selectedLine);

		// Remove line from stations and update interchange status and colors
		stations.forEach((station) => {
			const wasConnectedToLine = station.lines.includes(selectedLine!);
			station.lines = station.lines.filter((lineId) => lineId !== selectedLine);
			station.isInterchange = station.lines.length > 1;

			// Update station color if this was the line providing its color
			if (wasConnectedToLine) {
				if (station.lines.length === 0) {
					// No lines left, revert to black
					station.color = '#000000
				} else {
					// Use color from remaining first line
					const firstLine = lines.find((line) => line.id === station.lines[0]);
					if (firstLine) {
						station.color = firstLine.color;
					}
				}
			}
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

				// Ensure all stations have a color property for backward compatibility
				stations.forEach((station) => {
					if (!station.color) {
						// If station has lines, use the color of the first line
						if (station.lines && station.lines.length > 0) {
							const firstLine = lines.find((line) => line.id === station.lines[0]);
							station.color = firstLine ? firstLine.color : '#000000';
						} else {
							station.color = '#000000';
						}
					}
				});

				// Ensure all lines have a name property for backward compatibility
				lines.forEach((line, index) => {
					if (!line.name) {
						line.name = `Line ${index + 1}`;
					}
				});
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

<svelte:window on:keydown={handleKeydown} on:click={handlePopoverClickOutside} />

<div class="flex min-h-screen w-full max-w-4xl flex-col gap-4 p-4 text-xs">
	<div class="flex flex-col gap-3">
		<!-- Main toolbar row -->
		<div class="flex flex-wrap items-center gap-2 sm:gap-4">
			<div class="flex items-center gap-2">
				<ModeButton active={selectedTool === 'station'} onclick={() => (selectedTool = 'station')}>
					<MapPin size={18} />
				</ModeButton>
				<ModeButton active={selectedTool === 'line'} onclick={() => (selectedTool = 'line')}>
					<Route size={18} />
				</ModeButton>
			</div>

			<div class="flex items-center gap-2">
				<button
					onclick={deleteSelectedStations}
					disabled={selectedStations.length === 0}
					class="inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 {selectedStations.length >
					0
						? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
						: 'border-slate-600 bg-slate-700 text-slate-500'}"
					title="Delete Selected"
				>
					<Trash2 size={18} />
				</button>
			</div>

			<div class="flex items-center gap-2">
				<button
					onclick={undo}
					disabled={!canUndo()}
					class="inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 {canUndo()
						? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
						: 'border-slate-600 bg-slate-700 text-slate-500'}"
					title="Undo"
				>
					<Undo2 size={18} />
				</button>
			</div>

			<div class="flex items-center gap-2">
				<button
					onclick={saveMapToFile}
					class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 bg-slate-700 text-slate-300 transition-colors duration-150 hover:bg-slate-600 hover:text-white"
					title="Save Map"
				>
					<Save size={18} />
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
					class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 bg-slate-700 text-slate-300 transition-colors duration-150 hover:bg-slate-600 hover:text-white"
					title="Load Map"
				>
					<FolderOpen size={18} />
				</button>
			</div>
		</div>

		<!-- Second row - Station and Line editing - always present to maintain layout -->
		<div class="flex min-h-10 items-center">
			{#if editingStation}
				{@const station = stations.find((s) => s.id === editingStation)}
				{#if station}
					<div class="flex items-center gap-2">
						<label for="station-name-input" class="text-sm font-medium text-white">Name:</label>
						<input
							id="station-name-input"
							bind:value={editingStationName}
							onblur={saveStationName}
							onkeydown={(e) => e.key === 'Enter' && saveStationName()}
							class="w-48 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white transition-colors placeholder:text-slate-400 focus:border-2 focus:border-blue-500 focus:outline-none"
							placeholder="Enter station name"
						/>
						<button
							onclick={saveStationName}
							class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 bg-slate-700 text-slate-300 transition-colors duration-150 hover:bg-slate-600 hover:text-white"
							title="Save"
						>
							<Save size={16} />
						</button>
						<ColorSelector
							value={station.color}
							onchange={(color) => changeStationColor(station.id, color)}
						/>
					</div>
				{/if}
			{:else if selectedStations.length === 1}
				{@const station = stations.find((s) => s.id === selectedStations[0])}
				{#if station}
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-white">Name:</span>
						<button
							type="button"
							onclick={() => startEditingStation(station.id)}
							class="rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white transition-colors hover:bg-slate-600"
						>
							{station.name}
						</button>
						<ColorSelector
							value={station.color}
							onchange={(color) => changeStationColor(station.id, color)}
						/>
						{#if selectedTool === 'station' && lines.length > 0}
							<div class="relative">
								<button
									onclick={showAddToLineSelector}
									data-add-to-line-button
									class="inline-flex h-10 flex-row items-center justify-center rounded-md border border-blue-500 bg-blue-500 px-3 text-white transition-colors duration-150 hover:bg-blue-600"
									title="Add to existing line"
								>
									<Plus size={18} /> Add to Line
								</button>

								<!-- Line Selector Popover -->
								{#if showLineSelector}
									<div
										class="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transform sm:left-1/2 sm:-translate-x-1/2"
									>
										<div
											class="line-selector-popover rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl sm:p-4"
										>
											<div class="mb-2 flex items-center justify-between sm:mb-3">
												<h3 class="text-xs font-semibold text-white sm:text-sm">Select Line</h3>
												<button
													onclick={cancelAddToLine}
													class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-white sm:h-6 sm:w-6"
												>
													<X size={14} />
												</button>
											</div>
											<div class="mb-2 sm:mb-3">
												<p class="text-xs text-slate-300">Add station to:</p>
											</div>
											<div class="max-h-48 space-y-2 overflow-y-auto">
												{#each lines as line}
													<button
														onclick={() => addStationsToLine(line.id)}
														class="flex w-full items-center gap-2 rounded-md border border-slate-600 bg-slate-700 p-2 text-white transition-colors hover:bg-slate-600"
													>
														<div
															class="h-4 w-4 rounded-full border-2 border-white"
															style="background-color: {line.color}"
														></div>
														<span class="text-sm">{line.name}</span>
													</button>
												{/each}
											</div>
											<!-- Popover arrow -->
											<div
												class="absolute top-full left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 transform border-r border-b border-slate-600 bg-slate-800"
											></div>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{:else if selectedTool === 'line' && selectedStations.length >= 2}
				<div class="relative flex items-center gap-2">
					<span class="text-sm font-medium text-white"
						>Selected Stations ({selectedStations.length}):</span
					>
					<button
						onclick={connectSelectedStations}
						data-connect-button
						class="inline-flex h-10 flex-row items-center justify-center rounded-md border border-green-500 bg-green-500 text-white transition-colors duration-150 hover:bg-green-600"
						title="Connect Stations ({selectedStations.length})"
					>
						<Link2 size={18} /> Link Stations
					</button>

					<!-- Color Picker Popover -->
					{#if showColorPicker}
						<div
							class="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transform sm:left-1/2 sm:-translate-x-1/2"
						>
							<div
								class="color-popover rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl sm:p-4"
							>
								<div class="mb-2 flex items-center justify-between sm:mb-3">
									<h3 class="text-xs font-semibold text-white sm:text-sm">Choose Color</h3>
									<button
										onclick={cancelConnection}
										class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-white sm:h-6 sm:w-6"
									>
										<X size={14} />
									</button>
								</div>
								<div class="mb-2 sm:mb-3">
									<p class="text-xs text-slate-300">
										{selectedStations.length} stations
									</p>
								</div>
								<div class="grid w-40 grid-cols-5 gap-2 sm:w-48 sm:grid-cols-6 sm:gap-2">
									{#each [{ name: 'Red', hex: '#ef4444' }, { name: 'Orange', hex: '#f97316' }, { name: 'Amber', hex: '#f59e0b' }, { name: 'Yellow', hex: '#eab308' }, { name: 'Lime', hex: '#84cc16' }, { name: 'Green', hex: '#22c55e' }, { name: 'Emerald', hex: '#10b981' }, { name: 'Teal', hex: '#14b8a6' }, { name: 'Cyan', hex: '#06b6d4' }, { name: 'Sky', hex: '#0ea5e9' }, { name: 'Blue', hex: '#3b82f6' }, { name: 'Indigo', hex: '#6366f1' }, { name: 'Violet', hex: '#8b5cf6' }, { name: 'Purple', hex: '#a855f7' }, { name: 'Fuchsia', hex: '#d946ef' }, { name: 'Pink', hex: '#ec4899' }, { name: 'Rose', hex: '#f43f5e' }, { name: 'Slate', hex: '#64748b' }] as color}
										<button
											onclick={() => confirmConnection(color.hex)}
											title={color.name}
											aria-label="Select {color.name} color"
											class="h-8 w-8 rounded-full border-2 border-slate-600 transition-all hover:scale-110 hover:border-white focus:border-white focus:outline-none active:scale-95 sm:h-7 sm:w-7"
											style="background-color: {color.hex}"
										>
										</button>
									{/each}
								</div>
								<!-- Popover arrow -->
								<div
									class="absolute top-full left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 transform border-r border-b border-slate-600 bg-slate-800"
								></div>
							</div>
						</div>
					{/if}
				</div>
			{:else if editingLine}
				{@const line = lines.find((l) => l.id === editingLine)}
				{#if line}
					<div class="flex items-center gap-2">
						<label for="line-name-input" class="text-sm font-medium text-white">Name:</label>
						<input
							id="line-name-input"
							bind:value={editingLineName}
							onblur={saveLineName}
							onkeydown={(e) => e.key === 'Enter' && saveLineName()}
							class="w-48 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white transition-colors placeholder:text-slate-400 focus:border-2 focus:border-blue-500 focus:outline-none"
							placeholder="Enter line name"
						/>
						<button
							onclick={saveLineName}
							class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 bg-slate-700 text-slate-300 transition-colors duration-150 hover:bg-slate-600 hover:text-white"
							title="Save"
						>
							<Save size={16} />
						</button>
						<ColorSelector
							value={line.color}
							onchange={(color) => changeLineColor(line.id, color)}
						/>
						<button
							onclick={deleteSelectedLine}
							class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-500 bg-red-500 text-white transition-colors duration-150 hover:bg-red-600"
							title="Delete Line"
						>
							<Trash2 size={18} />
						</button>
					</div>
				{/if}
			{:else if selectedLine}
				{@const line = lines.find((l) => l.id === selectedLine)}
				{#if line}
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-white">Selected Line:</span>
						<button
							type="button"
							onclick={() => startEditingLine(line.id)}
							class="rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white transition-colors hover:bg-slate-600"
						>
							{line.name}
						</button>
						<ColorSelector
							value={line.color}
							onchange={(color) => changeLineColor(line.id, color)}
						/>
						<button
							onclick={deleteSelectedLine}
							class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-500 bg-red-500 text-white transition-colors duration-150 hover:bg-red-600"
							title="Delete Line"
						>
							<Trash2 size={18} />
						</button>
					</div>
				{/if}
			{:else if selectedTool === 'station' && selectedStations.length > 1 && lines.length > 0}
				<div class="relative flex items-center gap-2">
					<span class="text-sm font-medium text-white"
						>Selected Stations ({selectedStations.length}):</span
					>
					<button
						onclick={showAddToLineSelector}
						data-add-to-line-button
						class="inline-flex h-10 flex-row items-center justify-center rounded-md border border-blue-500 bg-blue-500 px-3 text-white transition-colors duration-150 hover:bg-blue-600"
						title="Add to existing line"
					>
						<Plus size={18} /> Add to Line
					</button>

					<!-- Line Selector Popover -->
					{#if showLineSelector}
						<div
							class="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transform sm:left-1/2 sm:-translate-x-1/2"
						>
							<div
								class="line-selector-popover rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-xl sm:p-4"
							>
								<div class="mb-2 flex items-center justify-between sm:mb-3">
									<h3 class="text-xs font-semibold text-white sm:text-sm">Select Line</h3>
									<button
										onclick={cancelAddToLine}
										class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-white sm:h-6 sm:w-6"
									>
										<X size={14} />
									</button>
								</div>
								<div class="mb-2 sm:mb-3">
									<p class="text-xs text-slate-300">
										Add {selectedStations.length} station{selectedStations.length > 1 ? 's' : ''} to:
									</p>
								</div>
								<div class="max-h-48 space-y-2 overflow-y-auto">
									{#each lines as line}
										<button
											onclick={() => addStationsToLine(line.id)}
											class="flex w-full items-center gap-2 rounded-md border border-slate-600 bg-slate-700 p-2 text-white transition-colors hover:bg-slate-600"
										>
											<div
												class="h-4 w-4 rounded-full border-2 border-white"
												style="background-color: {line.color}"
											></div>
											<span class="text-sm">{line.name}</span>
										</button>
									{/each}
								</div>
								<!-- Popover arrow -->
								<div
									class="absolute top-full left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 transform border-r border-b border-slate-600 bg-slate-800"
								></div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<svg
			bind:this={svgElement}
			width="100%"
			height={SVG_HEIGHT}
			viewBox="{viewBox.x} {viewBox.y} {viewBox.width} {viewBox.height}"
			role="application"
			aria-label="Metro map editor"
			onclick={handleSvgClick}
			onmousedown={handleSvgMouseDown}
			onmousemove={handleSvgMouseMove}
			onmouseup={handleSvgMouseUp}
			ontouchstart={handleSvgMouseDown}
			ontouchmove={handleSvgMouseMove}
			ontouchend={handleSvgMouseUp}
			class="block min-h-96 cursor-crosshair touch-none select-none sm:min-h-[600px]"
			style="max-width: 100%; touch-action: none;"
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
					font-weight="bold"
					fill={station.color}
				>
					{station.name}
				</text>
			{/each}
		</svg>
	</div>

	<!-- Station List for Selected Line or Multiple Selected Stations -->
	{#if selectedLine || (selectedTool === 'line' && selectedStations.length >= 2)}
		{@const line = selectedLine ? lines.find((l) => l.id === selectedLine) : null}
		{@const displayStations = line ? line.stations : selectedStations}
		{@const displayLineId = line ? line.id : null}
		{@const displayLineName = line ? line.name : `Selected Stations (${selectedStations.length})`}
		{@const displayLineColor = line ? line.color : '#64748b'}

		<div class="rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-sm sm:p-6">
			<!-- Line Header -->
			<div class="mb-4 flex items-center gap-3">
				<div
					class="h-5 w-5 rounded-full border-2 border-slate-400 shadow-sm"
					style="background-color: {displayLineColor}"
				></div>
				<div>
					<h3 class="text-sm font-semibold text-white">{displayLineName}</h3>
					<p class="text-xs text-slate-400">{displayStations.length} stations</p>
				</div>
			</div>

			<!-- Station List -->
			{#if displayStations.length > 0}
				<div class="space-y-2">
					<h4 class="text-xs font-medium tracking-wide text-slate-300 uppercase">Station Order</h4>
					<div class="space-y-1">
						{#each displayStations as stationId, index}
							{@const station = stations.find((s) => s.id === stationId)}
							{#if station}
								<div
									class="group hover:bg-slate-650 flex items-center gap-3 rounded-md border border-slate-600 bg-slate-700 p-3 transition-colors"
									class:opacity-50={draggedStationIndex === index}
									class:border-blue-500={draggedOverIndex === index && draggedStationIndex !== null}
									draggable={!!displayLineId}
									role={displayLineId ? 'listitem' : 'presentation'}
									ondragstart={(e) => displayLineId && handleStationDragStart(e, index)}
									ondragover={(e) => displayLineId && handleStationDragOver(e, index)}
									ondrop={(e) => displayLineId && handleStationDrop(e, displayLineId, index)}
									ondragend={handleStationDragEnd}
								>
									<!-- Drag Handle (only for established lines) -->
									{#if displayLineId}
										<div
											class="cursor-grab text-slate-400 hover:text-slate-300 active:cursor-grabbing"
										>
											<GripVertical size={16} />
										</div>
									{/if}

									<!-- Station Number -->
									<div
										class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-600 text-xs font-medium text-white"
									>
										{index + 1}
									</div>

									<!-- Station Info -->
									<div class="flex-1">
										<div class="flex items-center gap-2">
											<div
												class="h-3 w-3 rounded-full border border-white"
												style="background-color: {station.color}"
											></div>
											<span class="text-sm font-medium text-white">{station.name}</span>
											{#if station.isInterchange}
												<span
													class="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white"
												>
													Interchange
												</span>
											{/if}
										</div>
									</div>

									<!-- Remove Button (only for established lines) -->
									{#if displayLineId}
										<button
											onclick={() => removeStationFromLine(displayLineId, stationId)}
											class="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-700"
											title="Remove station from line"
										>
											<X size={12} />
										</button>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					<!-- Instructions -->
					{#if displayLineId}
						<div class="bg-slate-750 mt-3 rounded-md p-3">
							<p class="text-xs text-slate-400">
								Drag stations to reorder • Click X to remove from line
							</p>
						</div>
					{:else}
						<div class="bg-slate-750 mt-3 rounded-md p-3">
							<p class="text-xs text-slate-400">
								Click "Link Stations" to create a line with these stations
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
