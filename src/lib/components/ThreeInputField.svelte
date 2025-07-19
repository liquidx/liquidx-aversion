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

	let { text = '0', width = 800, height = 80 }: Props = $props();

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
	let cursorY = 1;
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

				if (backgroundBox) {
					const boxWidth = camera.right - camera.left;
					const boxHeight = camera.top - camera.bottom;
					backgroundBox.scale.set(boxWidth, boxHeight, 1);
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

		// Create background box
		const boxWidth = camera.right - camera.left;
		const boxHeight = camera.top - camera.bottom;
		const boxGeometry = new THREE.BoxGeometry(1, 1, 0.1);
		const boxMaterial = new THREE.MeshBasicMaterial({ color: 0xdddddd });
		backgroundBox = new THREE.Mesh(boxGeometry, boxMaterial);
		backgroundBox.scale.set(boxWidth, boxHeight, 1);
		backgroundBox.position.set(cameraX, cameraY, -1); // behind text
		scene.add(backgroundBox);

		// Create cursor first
		createCursor();

		// Create 3D text (this will position the cursor correctly)
		createText();

		// Add some lights for better visibility
		const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(1, 1, 1);
		scene.add(directionalLight);
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
				color: 0x000000,
				shininess: 100
			});

			// Create mesh and position it
			const charMesh = new THREE.Mesh(charGeometry, charMaterial);
			charMesh.position.x = xPosition;

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
		const cursorGeometry = new THREE.BoxGeometry(0.2, 3, 0.3);
		const cursorMaterial = new THREE.MeshPhongMaterial({
			color: 0x000000,
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
			cursor.position.x = 0;
			cursor.position.y = cursorY;
		} else {
			// Position cursor at the end of the text
			const lastMesh = characterMeshes[characterMeshes.length - 1];
			if (lastMesh && lastMesh.geometry.boundingBox) {
				const lastCharWidth =
					lastMesh.geometry.boundingBox.max.x - lastMesh.geometry.boundingBox.min.x;
				cursor.position.x = lastMesh.position.x + lastCharWidth + 0.1;
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

<div class="three-container rounded-lg" style="width: {width}px; height: {height}px;">
	<canvas class="block rounded-lg" bind:this={canvas}></canvas>
</div>

<style>
</style>
