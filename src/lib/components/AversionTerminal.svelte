<script lang="ts">
	import Terminal from './Terminal.svelte';
	import { fileSystem, type FileEntry } from '$lib/filesystem.js';

	interface HistoryEntry {
		command: string;
		output?: string[];
		html?: string;
		image?: string;
		timestamp?: number;
	}

	let history: HistoryEntry[] = $state([]);
	let currentDirectory = $state('/home/user');

	function formatLsOutput(files: FileEntry[], showLong: boolean, showAll: boolean): string[] {
		// Filter files based on showAll flag
		const filteredFiles = showAll ? files : files.filter((file) => !file.hidden);

		if (showLong) {
			// Calculate total blocks for long format
			const totalBlocks = filteredFiles.reduce((sum, file) => sum + Math.ceil(file.size / 1024), 0);
			const output = [`total ${totalBlocks}`];

			// Add each file in long format
			filteredFiles.forEach((file) => {
				const line = `${file.permissions} ${file.links.toString().padStart(2)} ${file.owner} ${file.group} ${file.size.toString().padStart(4)} ${file.modified} ${file.name}`;
				output.push(line);
			});

			return output;
		} else {
			// Simple format - just file names
			const names = filteredFiles.map((file) => file.name);
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

			case 'pwd':
				// Print working directory
				output = [currentDirectory];
				break;

			case 'date':
				// Display current date and time
				const now = new Date();
				const dateString = now.toLocaleDateString('en-US', {
					weekday: 'short',
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				});
				const timeString = now.toLocaleTimeString('en-US', {
					hour12: false,
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				output = [
					`${dateString} ${timeString} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
				];
				break;

			case 'cd':
				// Change directory
				if (args.length === 1) {
					// No argument, go to home directory
					currentDirectory = '/home/user';
					output = [];
				} else {
					const targetPath = args[1];

					if (targetPath === '..') {
						// Go up one directory
						if (currentDirectory !== '/') {
							const pathParts = currentDirectory.split('/').filter(Boolean);
							pathParts.pop();
							currentDirectory = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
						}
						output = [];
					} else if (targetPath === '/') {
						// Go to root directory
						currentDirectory = '/';
						output = [];
					} else if (targetPath === '~' || targetPath === '$HOME') {
						// Go to home directory
						currentDirectory = '/home/user';
						output = [];
					} else if (targetPath.startsWith('/')) {
						// Absolute path - for demo purposes, limit to certain paths
						if (targetPath === '/home/user' || targetPath === '/home/user/src') {
							currentDirectory = targetPath;
							output = [];
						} else {
							output = [`cd: ${targetPath}: No such file or directory`];
						}
					} else {
						// Relative path - check if it's a valid directory in our file system
						const targetDir = fileSystem.find(
							(file) => file.name === targetPath && file.type === 'directory' && !file.hidden
						);

						if (targetDir) {
							currentDirectory = `${currentDirectory}/${targetPath}`.replace(/\/+/g, '/');
							output = [];
						} else {
							output = [`cd: ${targetPath}: No such file or directory`];
						}
					}
				}
				break;

			case 'rm':
				// Handle rm command with funny error messages
				const hasRecursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
				const hasForce = args.includes('-f') || args.includes('-rf') || args.includes('-fr');

				if (hasRecursive && hasForce) {
					// rm -rf - the dangerous one!
					const funnyMessages = [
						"Nice try! I'm not falling for that one. 🙃",
						'rm -rf? Really? I have trust issues now... 😅',
						'Error: My lawyer advised me not to do that.',
						'rm -rf detected. Activating safety protocols... NOPE!',
						"I'm sorry Dave, I'm afraid I can't do that.",
						'rm -rf: Permission denied by the Council of Responsible Computing.',
						'Error: Files have feelings too! Please be gentle. 🥺',
						'rm -rf: Command blocked by the International Treaty of Data Preservation.',
						"Nice try, but I've seen what happens in the movies...",
						'rm -rf: Denied. The files are under the protection of the Digital Geneva Convention.'
					];
					const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
					output = [randomMessage];
				} else if (hasRecursive) {
					output = [
						"rm -r: I'll only remove directories if you say please... and provide a warrant."
					];
				} else if (args.length === 1) {
					output = ['rm: missing operand'];
				} else {
					// Regular rm command - pretend to work
					const fileName = args[args.length - 1];
					const fileExists = fileSystem.find(
						(file) => file.name === fileName && file.type === 'file'
					);

					if (fileExists) {
						output = [`rm: removed '${fileName}' (just kidding, nothing was actually deleted)`];
					} else {
						output = [`rm: cannot remove '${fileName}': No such file or directory`];
					}
				}
				break;

			case 'cat':
				// Handle cat command - return a cat emoji instead of file contents
				if (args.length === 1) {
					output = ['🐱'];
				} else {
					const fileName = args[1];
					
					// Special case for background.jpg - display as image
					if (fileName === 'background.jpg') {
						const imageEntry: HistoryEntry = {
							command,
							image: '/terminal/background.jpg',
							timestamp: Date.now()
						};
						history = [...history, imageEntry];
						return; // Exit early to avoid adding another entry
					}
					
					// Check if the file exists in our file system
					const fileExists = fileSystem.find(
						(file) => file.name === fileName && file.type === 'file'
					);
					
					if (fileExists) {
						// Return a cat emoji instead of actual file contents
						output = ['🐱'];
					} else {
						output = [`cat: ${fileName}: No such file or directory`];
					}
				}
				break;

			case 'curl':
				// Handle curl command - fetch URL contents
				if (args.length === 1) {
					output = ['curl: try \'curl --help\' for more information'];
				} else {
					const url = args[1];
					
					// Add command to history immediately with loading message
					const loadingEntry: HistoryEntry = {
						command,
						output: ['Fetching...'],
						timestamp: Date.now()
					};
					history = [...history, loadingEntry];
					
					// Fetch the URL
					fetch(url)
						.then(response => {
							if (!response.ok) {
								throw new Error(`HTTP ${response.status}: ${response.statusText}`);
							}
							return response.text();
						})
						.then(content => {
							// Update the last entry with the fetched content
							const updatedEntry: HistoryEntry = {
								command,
								output: content.split('\n').slice(0, 50), // Limit to first 50 lines
								timestamp: Date.now()
							};
							history = [...history.slice(0, -1), updatedEntry];
						})
						.catch(error => {
							// Update the last entry with error message
							const errorEntry: HistoryEntry = {
								command,
								output: [`curl: (${error.message})`],
								timestamp: Date.now()
							};
							history = [...history.slice(0, -1), errorEntry];
						});
					
					// Return early to avoid adding another entry
					return;
				}
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

<div class="">
	<Terminal {history} prompt="$" placeholder="" oncommand={handleCommand} />
</div>
