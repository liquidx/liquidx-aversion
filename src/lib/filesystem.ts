export interface FileEntry {
	name: string;
	type: 'file' | 'directory';
	permissions: string;
	size: number;
	modified: string;
	hidden: boolean;
	owner: string;
	group: string;
	links: number;
}

// Mock file system
export const fileSystem: FileEntry[] = [
	{
		name: '.',
		type: 'directory',
		permissions: 'drwxr-xr-x',
		size: 4096,
		modified: 'Jan 15 10:30',
		hidden: true,
		owner: 'user',
		group: 'user',
		links: 3
	},
	{
		name: '..',
		type: 'directory',
		permissions: 'drwxr-xr-x',
		size: 4096,
		modified: 'Jan 15 10:25',
		hidden: true,
		owner: 'user',
		group: 'user',
		links: 5
	},
	{
		name: '.bashrc',
		type: 'file',
		permissions: '-rw-r--r--',
		size: 220,
		modified: 'Jan 15 10:25',
		hidden: true,
		owner: 'user',
		group: 'user',
		links: 1
	},
	{
		name: 'README.md',
		type: 'file',
		permissions: '-rw-r--r--',
		size: 1024,
		modified: 'Jan 15 10:30',
		hidden: false,
		owner: 'user',
		group: 'user',
		links: 1
	},
	{
		name: 'package.json',
		type: 'file',
		permissions: '-rw-r--r--',
		size: 2048,
		modified: 'Jan 15 10:29',
		hidden: false,
		owner: 'user',
		group: 'user',
		links: 1
	},
	{
		name: 'src',
		type: 'directory',
		permissions: 'drwxr-xr-x',
		size: 4096,
		modified: 'Jan 15 10:28',
		hidden: false,
		owner: 'user',
		group: 'user',
		links: 2
	},
	{
		name: 'node_modules',
		type: 'directory',
		permissions: 'drwxr-xr-x',
		size: 4096,
		modified: 'Jan 15 10:27',
		hidden: false,
		owner: 'user',
		group: 'user',
		links: 2
	},
	{
		name: 'background.jpg',
		type: 'file',
		permissions: '-rw-r--r--',
		size: 245760,
		modified: 'Jan 15 10:26',
		hidden: false,
		owner: 'user',
		group: 'user',
		links: 1
	}
];
