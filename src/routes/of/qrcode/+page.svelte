<script lang="ts">
	import { encode } from 'uqr';
	import { Download, Link as LinkIcon, Type, Contact, Square, Circle, Box, Code } from '@lucide/svelte';

	const inputClass =
		'border border-neutral-300 dark:border-neutral-700 bg-transparent rounded-md px-3 py-2 w-full outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm';

	let textMode = $state<'url' | 'text' | 'vcard'>('url');

	let urlInput = $state('https://liquidx.net/');
	let textInput = $state('Hello, World!');
	let vcard = $state({
		firstName: 'John',
		lastName: 'Doe',
		org: 'Acme Corp',
		title: 'Engineer',
		tel: '+1234567890',
		email: 'john@example.com',
		url: 'https://example.com'
	});

	let dotStyle = $state<'square' | 'circle' | 'rounded' | 'custom'>('square');
	let dotSize = $state(1.0);
	let dotRadius = $state(0.3);
	let isHollow = $state(false);

	const defaultCustomCode = `// Available variables: x, y, cell, size, dotSize, foreground, background, outlineColor, isHollow
// Return an SVG element string, or '' to render nothing.

if (!cell) return '';

// Ripple: dot radius varies with distance from center
const dx = x - size / 2;
const dy = y - size / 2;
const dist = Math.sqrt(dx * dx + dy * dy);
const r = dotSize * 0.5 * (0.4 + 0.6 * Math.abs(Math.sin(dist * 0.55)));

return \`<circle cx="\${x + 0.5}" cy="\${y + 0.5}" r="\${r}" fill="\${foreground}" />\`;`;

	let customCode = $state(defaultCustomCode);

	// Compile the custom function whenever the code changes; error captured without side effects
	let customFnResult = $derived.by(() => {
		if (dotStyle !== 'custom') return { fn: null, error: '' };
		try {
			const fn = new Function(
				'x', 'y', 'cell', 'size', 'dotSize',
				'foreground', 'background', 'outlineColor', 'isHollow',
				customCode
			) as (
				x: number, y: number, cell: boolean, size: number, dotSize: number,
				foreground: string, background: string, outlineColor: string, isHollow: boolean
			) => string;
			return { fn, error: '' };
		} catch (e) {
			return { fn: null, error: String(e) };
		}
	});

	function callCustomFn(x: number, y: number, cell: boolean): string {
		if (!customFnResult.fn) return '';
		try {
			return customFnResult.fn(
				x, y, cell, qrData.size, dotSize,
				foreground, background, outlineColor, isHollow
			) || '';
		} catch {
			return '';
		}
	}

	let foreground = $state('#000000');
	let outlineColor = $state('#cccccc');
	let background = $state('#ffffff');
	let transparentBg = $state(false);

	let qrContent = $derived.by(() => {
		if (textMode === 'url') return urlInput || ' ';
		if (textMode === 'text') return textInput || ' ';
		if (textMode === 'vcard') {
			let lines = ['BEGIN:VCARD', 'VERSION:3.0'];
			lines.push(`N:${vcard.lastName || ''};${vcard.firstName || ''};;;`);
			lines.push(`FN:${vcard.firstName || ''} ${vcard.lastName || ''}`.trim());
			if (vcard.org) lines.push(`ORG:${vcard.org}`);
			if (vcard.title) lines.push(`TITLE:${vcard.title}`);
			if (vcard.tel) lines.push(`TEL;TYPE=WORK,VOICE:${vcard.tel}`);
			if (vcard.email) lines.push(`EMAIL;TYPE=WORK,INTERNET:${vcard.email}`);
			if (vcard.url) lines.push(`URL:${vcard.url}`);
			lines.push('END:VCARD');
			return lines.join('\n');
		}
		return ' ';
	});

	let eccLevel = $state<'L' | 'M' | 'Q' | 'H'>('L');
	let qrData = $derived(encode(qrContent, { ecc: eccLevel }));

	let svgElement: SVGSVGElement;

	function downloadSvg() {
		if (!svgElement) return;
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svgElement);
		const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `qrcode-${Date.now()}.svg`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>QR Code Generator // a version one</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col items-start gap-8 p-4 font-mono md:flex-row md:p-8">
	<!-- Left Side: Controls -->
	<div class="flex w-full flex-col gap-6 md:w-1/2">
		<div class="flex flex-col gap-2">
			<h1 class="text-2xl font-bold tracking-tight">QR Code Generator</h1>
			<p class="text-sm opacity-60">Generate highly customizable SVG QR Codes.</p>
		</div>

		<!-- Type Selection -->
		<div class="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition-all {textMode ===
				'url'
					? 'bg-white text-neutral-900 shadow'
					: 'text-neutral-500 hover:text-neutral-700'}"
				onclick={() => (textMode = 'url')}
			>
				<LinkIcon size={16} /> URL
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition-all {textMode ===
				'text'
					? 'bg-white text-neutral-900 shadow'
					: 'text-neutral-500 hover:text-neutral-700'}"
				onclick={() => (textMode = 'text')}
			>
				<Type size={16} /> Text
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm transition-all {textMode ===
				'vcard'
					? 'bg-white text-neutral-900 shadow'
					: 'text-neutral-500 hover:text-neutral-700'}"
				onclick={() => (textMode = 'vcard')}
			>
				<Contact size={16} /> vCard
			</button>
		</div>

		<!-- Input Forms -->
		<div class="flex flex-col gap-4">
			{#if textMode === 'url'}
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="url"
						>Website URL</label
					>
					<input
						id="url"
						type="url"
						class={inputClass}
						bind:value={urlInput}
						placeholder="https://example.com"
					/>
				</div>
			{:else if textMode === 'text'}
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="text"
						>Plain Text</label
					>
					<textarea
						id="text"
						class="{inputClass} min-h-24 font-mono text-sm"
						bind:value={textInput}
						placeholder="Enter any text here..."
					></textarea>
				</div>
			{:else if textMode === 'vcard'}
				<div class="grid grid-cols-2 gap-4">
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="firstName"
							>First Name</label
						>
						<input id="firstName" class={inputClass} bind:value={vcard.firstName} />
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="lastName"
							>Last Name</label
						>
						<input id="lastName" class={inputClass} bind:value={vcard.lastName} />
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="tel"
							>Phone</label
						>
						<input id="tel" type="tel" class={inputClass} bind:value={vcard.tel} />
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="email"
							>Email</label
						>
						<input id="email" type="email" class={inputClass} bind:value={vcard.email} />
					</div>
					<div class="col-span-2 flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="org"
							>Company/Organization</label
						>
						<input id="org" class={inputClass} bind:value={vcard.org} />
					</div>
					<div class="col-span-2 flex flex-col gap-1">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="vc-url"
							>Website</label
						>
						<input id="vc-url" type="url" class={inputClass} bind:value={vcard.url} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Appearance Settings -->
		<hr class="my-2 border-neutral-200 shadow-sm dark:border-neutral-800" />

		<div class="flex flex-col gap-4">
			<h3 class="text-md font-bold">Encoding & Appearance</h3>

			<div class="flex flex-col gap-2">
				<div class="text-xs font-bold tracking-wider uppercase opacity-50">Error Correction</div>
				<div class="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
					{#each [{v: 'L', l: 'Low (7%)'}, {v: 'M', l: 'Medium (15%)'}, {v: 'Q', l: 'Quartile (25%)'}, {v: 'H', l: 'High (30%)'}] as ecc}
						<button
							class="flex-1 rounded-md py-1 text-xs outline-none transition-all {eccLevel === ecc.v ? 'bg-white text-neutral-900 shadow' : 'text-neutral-500 hover:text-neutral-700'}"
							onclick={() => (eccLevel = ecc.v as 'L' | 'M' | 'Q' | 'H')}
						>
							{ecc.l}
						</button>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-2 mt-2">
				<div class="text-xs font-bold tracking-wider uppercase opacity-50">Dot Style</div>
				<div class="flex gap-2">
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'square'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'square')}
					>
						<Square size={24} />
						<span class="text-xs">Square</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'rounded'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'rounded')}
					>
						<Box size={24} />
						<span class="text-xs">Rounded</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'circle'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'circle')}
					>
						<Circle size={24} />
						<span class="text-xs">Circle</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center gap-2 rounded-md border p-3 transition-all {dotStyle ===
						'custom'
							? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
							: 'border-neutral-300 opacity-60 hover:opacity-100 dark:border-neutral-700'}"
						onclick={() => (dotStyle = 'custom')}
					>
						<Code size={24} />
						<span class="text-xs">Custom</span>
					</button>
				</div>
			</div>

			{#if dotStyle === 'custom'}
				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<div class="text-xs font-bold tracking-wider uppercase opacity-50">Pixel Renderer (JS)</div>
						<button
							class="text-xs opacity-40 transition-opacity hover:opacity-70"
							onclick={() => (customCode = defaultCustomCode)}
						>Reset to default</button>
					</div>
					<textarea
						class="{inputClass} min-h-52 font-mono text-xs leading-relaxed"
						bind:value={customCode}
						spellcheck="false"
						autocomplete="off"
						autocapitalize="off"
					></textarea>
					{#if customFnResult.error}
						<div class="rounded-md bg-red-50 px-3 py-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
							{customFnResult.error}
						</div>
					{/if}
					<p class="text-xs opacity-40">
						Variables: <code>x</code>, <code>y</code>, <code>cell</code>, <code>size</code>, <code>dotSize</code>, <code>foreground</code>, <code>background</code>, <code>outlineColor</code>, <code>isHollow</code>. Return an SVG element string.
					</p>
				</div>
			{/if}

			{#if dotStyle === 'rounded'}
				<div class="mt-2 flex flex-col gap-1">
					<div class="flex items-center justify-between">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="dotRadius"
							>Corner Radius</label
						>
						<span class="font-mono text-xs opacity-70">{dotRadius.toFixed(2)}</span>
					</div>
					<input
						id="dotRadius"
						type="range"
						min="0"
						max="0.5"
						step="0.05"
						bind:value={dotRadius}
						class="w-full"
					/>
				</div>
			{/if}

			<div class="mt-2 flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="dotSize"
						>Dot Size</label
					>
					<span class="font-mono text-xs opacity-70">{dotSize.toFixed(2)}</span>
				</div>
				<input
					id="dotSize"
					type="range"
					min="0.1"
					max="1.0"
					step="0.05"
					bind:value={dotSize}
					class="w-full"
				/>
			</div>

			<div class="mt-2 flex flex-col gap-2">
				<label class="flex cursor-pointer items-center gap-2 text-sm">
					<input
						type="checkbox"
						bind:checked={isHollow}
						class="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
					/>
					<span class="font-medium">Draw Blank Pixels as Outlines</span>
				</label>
				{#if isHollow}
					<div class="flex items-center gap-2 pl-6">
						<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="outlineColor">Outline Color</label>
						<input
							type="color"
							id="outlineColor"
							bind:value={outlineColor}
							class="h-6 w-6 shrink-0 cursor-pointer rounded"
						/>
						<input type="text" bind:value={outlineColor} class="{inputClass} flex-1 py-1 uppercase" />
					</div>
				{/if}
			</div>

			<hr class="my-2 border-neutral-200 shadow-sm dark:border-neutral-800" />

			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="foreground"
						>Foreground</label
					>
					<div class="flex items-center gap-2">
						<input
							type="color"
							id="foreground"
							bind:value={foreground}
							class="h-8 w-8 shrink-0 cursor-pointer rounded"
						/>
						<input type="text" bind:value={foreground} class="{inputClass} flex-1 uppercase" />
					</div>
				</div>
				<div class="flex flex-col gap-1">
					<label class="text-xs font-bold tracking-wider uppercase opacity-50" for="background"
						>Background</label
					>
					<div class="flex items-center gap-2">
						<input
							type="color"
							id="background"
							bind:value={background}
							disabled={transparentBg}
							class="h-8 w-8 shrink-0 cursor-pointer rounded disabled:opacity-30"
						/>
						<input
							type="text"
							bind:value={background}
							disabled={transparentBg}
							class="{inputClass} flex-1 uppercase disabled:opacity-30"
						/>
					</div>
					<label class="mt-1 flex cursor-pointer items-center gap-2 text-xs">
						<input type="checkbox" bind:checked={transparentBg} class="h-4 w-4" />
						Transparent
					</label>
				</div>
			</div>
		</div>
	</div>

	<!-- Right Side: Preview & Download -->
	<div
		class="flex w-full flex-col items-center justify-center gap-8 rounded-2xl bg-neutral-100 p-4 md:sticky md:top-8 md:w-1/2 md:p-12 dark:bg-neutral-800"
	>
		<div
			class="relative flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-xl bg-white/10 p-8 shadow-xl transition-all"
			style="background-color: {transparentBg ? 'transparent' : background}"
		>
			{#if transparentBg}
				<div
					class="absolute inset-0 z-0 opacity-10"
					style="background-image: linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;"
				></div>
			{/if}

			<svg
				bind:this={svgElement}
				viewBox="0 0 {qrData.size} {qrData.size}"
				xmlns="http://www.w3.org/2000/svg"
				class="relative z-10 h-full w-full"
			>
				{#if !transparentBg}
					<rect width={qrData.size} height={qrData.size} fill={background} />
				{/if}
				{#each qrData.data as row, y}
					{#each row as cell, x}
						{#if dotStyle === 'custom'}
							{@html callCustomFn(x, y, cell)}
						{:else if cell}
							{#if dotStyle === 'square'}
								<rect
									x={x + (1 - dotSize) / 2}
									y={y + (1 - dotSize) / 2}
									width={dotSize}
									height={dotSize}
									fill={foreground}
								/>
							{:else if dotStyle === 'circle'}
								<circle cx={x + 0.5} cy={y + 0.5} r={dotSize * 0.5} fill={foreground} />
							{:else if dotStyle === 'rounded'}
								<rect
									x={x + (1 - dotSize) / 2}
									y={y + (1 - dotSize) / 2}
									width={dotSize}
									height={dotSize}
									rx={dotRadius}
									ry={dotRadius}
									fill={foreground}
								/>
							{/if}
						{:else if isHollow}
							{#if dotStyle === 'square'}
								<rect
									x={x + (1 - dotSize) / 2 + 0.05}
									y={y + (1 - dotSize) / 2 + 0.05}
									width={Math.max(0.1, dotSize - 0.1)}
									height={Math.max(0.1, dotSize - 0.1)}
									fill="none"
									stroke={outlineColor}
									stroke-width="0.1"
								/>
							{:else if dotStyle === 'circle'}
								<circle
									cx={x + 0.5}
									cy={y + 0.5}
									r={Math.max(0.05, dotSize * 0.5 - 0.05)}
									fill="none"
									stroke={outlineColor}
									stroke-width="0.1"
								/>
							{:else if dotStyle === 'rounded'}
								<rect
									x={x + (1 - dotSize) / 2 + 0.05}
									y={y + (1 - dotSize) / 2 + 0.05}
									width={Math.max(0.1, dotSize - 0.1)}
									height={Math.max(0.1, dotSize - 0.1)}
									rx={dotRadius}
									ry={dotRadius}
									fill="none"
									stroke={outlineColor}
									stroke-width="0.1"
								/>
							{/if}
						{/if}
					{/each}
				{/each}
			</svg>
		</div>

		<button
			onclick={downloadSvg}
			class="flex items-center gap-2 rounded-full bg-neutral-900 px-8 py-3 font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 dark:bg-neutral-100 dark:text-neutral-900"
		>
			<Download size={20} />
			Download SVG
		</button>
	</div>
</div>
