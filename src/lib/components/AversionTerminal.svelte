<script lang="ts">
	import Terminal from './Terminal.svelte';
	import { fileSystem, type FileEntry } from '$lib/filesystem.js';

	interface HistoryEntry {
		command: string;
		output: string[];
		timestamp?: number;
	}

	let history: HistoryEntry[] = $state([]);

	function formatLsOutput(files: FileEntry[], showLong: boolean, showAll: boolean): string[] {
		// Filter files based on showAll flag
		const filteredFiles = showAll ? files : files.filter(file => !file.hidden);

		if (showLong) {
			// Calculate total blocks for long format
			const totalBlocks = filteredFiles.reduce((sum, file) => sum + Math.ceil(file.size / 1024), 0);
			const output = [`total ${totalBlocks}`];

			// Add each file in long format
			filteredFiles.forEach(file => {
				const line = `${file.permissions} ${file.links.toString().padStart(2)} ${file.owner} ${file.group} ${file.size.toString().padStart(4)} ${file.modified} ${file.name}`;
				output.push(line);
			});

			return output;
		} else {
			// Simple format - just file names
			const names = filteredFiles.map(file => file.name);
			return [names.join('  ')];
		}
	}

	function handleCommand(command: string) {
		const args = command.trim().split(/\s+/);
		const cmd = args[0];
		let output: string[] = [];

		switch (cmd) {
			case 'echo':
				// Handle echo command
				if (args.length > 1) {
					// Join all arguments after 'echo' and remove quotes if present
					const text = args
						.slice(1)
						.join(' ')
						.replace(/^["']|["']$/g, '');
					output = [text];
				} else {
					output = [''];
				}
				break;

			case 'ls':
				// Handle ls command
				const hasLongFormat = args.includes('-l') || args.includes('-la') || args.includes('-al');
				const hasAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
				
				output = formatLsOutput(fileSystem, hasLongFormat, hasAll);
				break;

			default:
				output = [`Command not found: ${cmd}`];
		}

		const newEntry: HistoryEntry = {
			command,
			output,
			timestamp: Date.now()
		};

		history = [...history, newEntry];
	}
</script>

<div class="p-4">
	<div class="mb-4 font-bold text-amber-700">Terminal Demo</div>
	<Terminal {history} prompt="$" placeholder="" oncommand={handleCommand} />
</div>
