<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { FontLoader, Font } from 'three-stdlib';
	import { TextGeometry } from 'three-stdlib';

	interface Props {
		text?: string;
		width?: number;
		height?: number;
	}

	let { text = '0', width = 600, height = 60 }: Props = $props();

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.OrthographicCamera;
	let renderer: THREE.WebGLRenderer;
	let characterMeshes: THREE.Mesh[] = [];
	let animationId: number;
	let font: Font;
	let backgroundBox: THREE.Mesh;
	let cursor: THREE.Mesh;
	let cursorBlinkTime = 0;
	let characterSpacing = 0.1;
	let viewportWidth = 10;
	let cameraX = 45;
	let cameraY = 2;
	let cursorY = 1.5;
	let cursorHeight = 4;
	let cursorWidth = 0.5;
	let cursorMarginX = 0.5;
	let initialViewWidth = 0;
	let initialViewHeight = 0;
	let hiddenInput: HTMLInputElement;

	let previousText = '';
	let animatingCharacters: {
		mesh: THREE.Mesh;
		startY: number;
		targetY: number;
		progress: number;
	}[] = [];
	let explodingCharacters: {
		mesh: THREE.Mesh;
		velocity: THREE.Vector3;
		angularVelocity: THREE.Vector3;
		progress: number;
	}[] = [];

	onMount(() => {
		// Load font and initialize scene
		loadFont();

		// Handle window resize
		const handleResize = () => {
			if (camera && renderer) {
				const aspectRatio = width / height;
				const viewSize = 5;
				camera.left = -viewSize * aspectRatio;
				camera.right = viewSize * aspectRatio;
				camera.top = viewSize;
				camera.bottom = -viewSize;
				camera.updateProjectionMatrix();
				renderer.setSize(width, height);

				if (backgroundBox && initialViewWidth > 0) {
					const newViewWidth = camera.right - camera.left;
					const newViewHeight = camera.top - camera.bottom;
					const scaleX = (newViewWidth * 1.5) / (initialViewWidth * 1.5);
					const scaleY = (newViewHeight * 1.5) / (initialViewHeight * 1.5);
					backgroundBox.scale.set(scaleX, scaleY, 1);
				}
			}
		};

		window.addEventListener('resize', handleResize);

		// Cleanup on component destroy
		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
			if (renderer) {
				renderer.dispose();
			}
		};
	});

	function loadFont() {
		const loader = new FontLoader();
		loader.load('/helvetiker_regular.typeface.json', (loadedFont) => {
			font = loadedFont;
			initScene();
			animate();
		});
	}

	function initScene() {
		// Create scene
		scene = new THREE.Scene();

		// Create orthographic camera for isometric view
		const aspectRatio = width / height;
		const viewSize = 5;
		camera = new THREE.OrthographicCamera(
			-viewSize * aspectRatio, // left
			viewSize * aspectRatio, // right
			viewSize, // top
			-viewSize, // bottom
			0.1, // near
			1000 // far
		);

		// Position camera to face front of characters head-on
		camera.position.set(-width, cameraY, 10);
		camera.lookAt(-width, cameraY, 0);

		// Create renderer
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true
		});
		renderer.setSize(width, height);
		renderer.setPixelRatio(window.devicePixelRatio);

		// Enable shadows
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Create background curved surface
		const viewWidth = camera.right - camera.left;
		const viewHeight = camera.top - camera.bottom;
		initialViewWidth = viewWidth;
		initialViewHeight = viewHeight;

		// Create vertical background wall
		const wallGeometry = new THREE.PlaneGeometry(viewWidth * 1.5, viewHeight * 1.5);

		// Create horizontal reflective floor
		const floorGeometry = new THREE.PlaneGeometry(viewWidth * 2, viewHeight);
		floorGeometry.rotateX(-Math.PI / 2); // Rotate to be horizontal

		// Create a simple gradient environment map for reflections
		const envMapCanvas = document.createElement('canvas');
		envMapCanvas.width = 256;
		envMapCanvas.height = 256;
		const envMapContext = envMapCanvas.getContext('2d')!;

		// Create a radial gradient for the environment
		const gradient = envMapContext.createRadialGradient(128, 128, 0, 128, 128, 128);
		gradient.addColorStop(0, '#ffffff'); // Pure white center
		gradient.addColorStop(0.5, '#f0f0f0'); // Light gray
		gradient.addColorStop(1, '#d0d0d0'); // Medium gray

		envMapContext.fillStyle = gradient;
		envMapContext.fillRect(0, 0, 256, 256);

		const envMapTexture = new THREE.CanvasTexture(envMapCanvas);
		envMapTexture.mapping = THREE.EquirectangularReflectionMapping;

		// Also set the scene environment for global reflections
		scene.environment = envMapTexture;

		// Create wall material (less reflective)
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: 0xc0c0c0,
			metalness: 0.1,
			roughness: 0.8
		});

		// Create floor material (highly reflective)
		const floorMaterial = new THREE.MeshStandardMaterial({
			color: 0xc0c0c0,
			metalness: 1.0,
			roughness: 0.05,
			envMap: envMapTexture,
			envMapIntensity: 2.0
		});

		// Create and position wall
		backgroundBox = new THREE.Mesh(wallGeometry, wallMaterial);
		backgroundBox.position.set(cameraX, cameraY, -8); // Behind text
		backgroundBox.receiveShadow = true;
		scene.add(backgroundBox);

		// Create and position floor
		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.position.set(cameraX, cameraY - viewHeight * 0.6, -3); // Below text
		floor.receiveShadow = true;
		scene.add(floor);

		// Create cursor first
		createCursor();

		// Create 3D text (this will position the cursor correctly)
		createText();

		// Add some lights for better visibility
		const ambientLight = new THREE.AmbientLight(0x404040, 0.01);
		scene.add(ambientLight);

		// Main directional light (key light)
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
		directionalLight.position.set(0, 8, 15);

		// Enable shadow casting
		directionalLight.castShadow = true;
		directionalLight.shadow.mapSize.width = 2048;
		directionalLight.shadow.mapSize.height = 2048;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.camera.left = -200;
		directionalLight.shadow.camera.right = 200;
		directionalLight.shadow.camera.top = 20;
		directionalLight.shadow.camera.bottom = -20;

		// Make shadows much softer
		directionalLight.shadow.radius = 25;
		directionalLight.shadow.blurSamples = 50;
		directionalLight.shadow.bias = -0.0001;

		scene.add(directionalLight);

		// Setup mobile keyboard handling
		setupMobileInput();
	}

	function setupMobileInput() {
		// Add click handler to canvas to focus hidden input (only on mobile)
		canvas.addEventListener('click', () => {
			// Only focus on touch devices (mobile)
			if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
				// Prevent scroll behavior when focusing
				hiddenInput.focus({ preventScroll: true });
			}
		});

		// Handle input events from hidden input
		hiddenInput.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			text = target.value;
		});

		// Handle enter key to dismiss keyboard
		hiddenInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				hiddenInput.blur(); // Dismiss keyboard
				e.preventDefault();
			}
		});

		// Keep hidden input value in sync with text prop
		hiddenInput.value = text;
	}

	function createText() {
		if (!font) return;

		// Determine if text got longer (new characters added) or shorter (deleted)
		const isTextLonger = text.length > previousText.length;
		const isTextShorter = text.length < previousText.length;

		// Handle character deletion with explosion
		if (isTextShorter && characterMeshes.length > 0) {
			const deletedCount = previousText.length - text.length;
			// Take the last few meshes for explosion
			const meshesToExplode = characterMeshes.slice(-deletedCount);

			meshesToExplode.forEach((mesh) => {
				// Create explosion effect
				explodingCharacters.push({
					mesh: mesh.clone(),
					velocity: new THREE.Vector3(
						(Math.random() - 0.5) * 10, // Random X velocity
						Math.random() * 8 + 2, // Upward Y velocity
						(Math.random() - 0.5) * 5 // Random Z velocity
					),
					angularVelocity: new THREE.Vector3(
						(Math.random() - 0.5) * 10,
						(Math.random() - 0.5) * 10,
						(Math.random() - 0.5) * 10
					),
					progress: 0
				});
				scene.add(explodingCharacters[explodingCharacters.length - 1].mesh);
			});
		}

		// Remove existing character meshes
		characterMeshes.forEach((mesh) => {
			scene.remove(mesh);
			mesh.geometry.dispose();
			if (Array.isArray(mesh.material)) {
				mesh.material.forEach((material) => material.dispose());
			} else {
				mesh.material.dispose();
			}
		});
		characterMeshes = [];

		// Create individual character meshes
		let xPosition = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text[i];

			// Create geometry for single character
			const charGeometry = new TextGeometry(char, {
				font: font,
				size: 3,
				height: 0.2,
				curveSegments: 12,
				bevelEnabled: true,
				bevelThickness: 0.05,
				bevelSize: 0.05,
				bevelOffset: 0,
				bevelSegments: 5
			} as any);

			// Center character vertically
			charGeometry.computeBoundingBox();
			// const charHeight = charGeometry.boundingBox!.max.y - charGeometry.boundingBox!.min.y;
			// const charDepth = charGeometry.boundingBox!.max.z - charGeometry.boundingBox!.min.z;
			// charGeometry.translate(0, -charHeight / 2, -charDepth / 2);

			// Create material
			const charMaterial = new THREE.MeshPhongMaterial({
				color: 0x333333,
				shininess: 80
			});

			// Create mesh and position it
			const charMesh = new THREE.Mesh(charGeometry, charMaterial);
			charMesh.position.x = xPosition;
			charMesh.castShadow = true; // Enable shadow casting

			// Check if this is a new character that should animate in
			const isNewCharacter = isTextLonger && i >= previousText.length;
			if (isNewCharacter) {
				// Start from top of viewport
				charMesh.position.y = 8;
				// Add to animation queue
				animatingCharacters.push({
					mesh: charMesh,
					startY: 8,
					targetY: 0,
					progress: 0
				});
			} else {
				charMesh.position.y = 0;
			}

			charMesh.position.z = 0;

			scene.add(charMesh);
			characterMeshes.push(charMesh);

			// Calculate width of current character for next position
			const charWidth = charGeometry.boundingBox!.max.x - charGeometry.boundingBox!.min.x;
			xPosition += charWidth + characterSpacing;
		}

		// Update previous text for next comparison
		previousText = text;

		// Update camera position to follow text
		updateCameraPosition();

		// Update cursor position
		updateCursorPosition();
	}

	function createCursor() {
		// Create cursor geometry (rectangular block)
		const cursorGeometry = new THREE.BoxGeometry(cursorWidth, cursorHeight, 0.3);
		const cursorMaterial = new THREE.MeshPhongMaterial({
			color: 0x0066ff,
			transparent: true,
			opacity: 1
		});

		cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
		cursor.position.set(0, cursorY, 0.1); // Slightly in front of text
		scene.add(cursor);
	}

	function updateCursorPosition() {
		if (!cursor) return;

		if (characterMeshes.length === 0) {
			// If no text, position at start
			cursor.position.x = cursorMarginX;
			cursor.position.y = cursorY;
		} else {
			// Position cursor at the end of the text
			const lastMesh = characterMeshes[characterMeshes.length - 1];
			if (lastMesh && lastMesh.geometry.boundingBox) {
				const lastCharWidth =
					lastMesh.geometry.boundingBox.max.x - lastMesh.geometry.boundingBox.min.x;
				cursor.position.x = lastMesh.position.x + lastCharWidth + cursorMarginX;
				cursor.position.y = cursorY;
			}
		}
	}

	// Watch for text changes and update the 3D text
	$effect(() => {
		text; // Track text dependency
		if (font && scene) {
			createText();
		}
		// Keep hidden input in sync
		if (hiddenInput) {
			hiddenInput.value = text;
		}
	});

	function updateCameraPosition() {
		if (!camera || characterMeshes.length === 0) return;

		// Keep camera fixed at left side so text appears to expand to the right
		camera.position.x = cameraX;
		camera.lookAt(cameraX, cameraY, 0);
		if (backgroundBox) {
			backgroundBox.position.x = cameraX;
			backgroundBox.position.y = cameraY;
		}
	}

	function animate() {
		animationId = requestAnimationFrame(animate);

		// Update cursor blinking
		if (cursor) {
			cursorBlinkTime += 0.02;
			const opacity = Math.sin(cursorBlinkTime * 3) > 0 ? 1 : 0;
			(cursor.material as THREE.MeshPhongMaterial).opacity = opacity;
		}

		// Update animating characters
		for (let i = animatingCharacters.length - 1; i >= 0; i--) {
			const animChar = animatingCharacters[i];
			animChar.progress += 0.08; // Animation speed

			if (animChar.progress >= 1) {
				// Animation complete
				animChar.mesh.position.y = animChar.targetY;
				animatingCharacters.splice(i, 1);
			} else {
				// Ease-out animation
				const easeProgress = 1 - Math.pow(1 - animChar.progress, 3);
				animChar.mesh.position.y =
					animChar.startY + (animChar.targetY - animChar.startY) * easeProgress;
			}
		}

		// Update exploding characters
		for (let i = explodingCharacters.length - 1; i >= 0; i--) {
			const explChar = explodingCharacters[i];
			explChar.progress += 0.02; // Explosion duration

			if (explChar.progress >= 1) {
				// Remove exploded character
				scene.remove(explChar.mesh);
				explChar.mesh.geometry.dispose();
				if (Array.isArray(explChar.mesh.material)) {
					explChar.mesh.material.forEach((material) => material.dispose());
				} else {
					explChar.mesh.material.dispose();
				}
				explodingCharacters.splice(i, 1);
			} else {
				// Apply physics to explosion
				const deltaTime = 0.016; // ~60fps
				const gravity = -20;

				// Apply gravity to velocity
				explChar.velocity.y += gravity * deltaTime;

				// Update position based on velocity
				explChar.mesh.position.add(explChar.velocity.clone().multiplyScalar(deltaTime));

				// Apply rotation
				explChar.mesh.rotation.x += explChar.angularVelocity.x * deltaTime;
				explChar.mesh.rotation.y += explChar.angularVelocity.y * deltaTime;
				explChar.mesh.rotation.z += explChar.angularVelocity.z * deltaTime;

				// Fade out
				const opacity = 1 - explChar.progress;
				if (explChar.mesh.material instanceof THREE.MeshPhongMaterial) {
					explChar.mesh.material.transparent = true;
					explChar.mesh.material.opacity = opacity;
				}
			}
		}

		// Render the scene
		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<div
	class="three-container"
	style="width: {width}px; height: {height}px; position: relative; w-[600px]"
>
	<canvas class="block rounded-lg" bind:this={canvas}></canvas>
	<input
		bind:this={hiddenInput}
		type="text"
		style="position: absolute; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -1; transform: scale(0);"
		tabindex="-1"
		autocomplete="off"
		autocorrect="off"
		autocapitalize="off"
		spellcheck="false"
	/>
</div>

<style>
</style>
