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
	let characterSpacing = 0.1;
	let viewportWidth = 10;
	let cameraX = 45;
	let cameraY = 2;

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
		scene.background = new THREE.Color(0x000000);

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
			antialias: true
		});
		renderer.setSize(width, height);
		renderer.setPixelRatio(window.devicePixelRatio);

		// Create 3D text
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
				color: 0xffffff,
				shininess: 100
			});

			// Create mesh and position it
			const charMesh = new THREE.Mesh(charGeometry, charMaterial);
			charMesh.position.x = xPosition;
			charMesh.position.y = 0;
			charMesh.position.z = 0;

			scene.add(charMesh);
			characterMeshes.push(charMesh);

			// Calculate width of current character for next position
			const charWidth = charGeometry.boundingBox!.max.x - charGeometry.boundingBox!.min.x;
			xPosition += charWidth + characterSpacing;
		}

		// Update camera position to follow text
		updateCameraPosition();
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
	}

	function animate() {
		animationId = requestAnimationFrame(animate);

		// Render the scene
		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<div class="three-container" style="width: {width}px; height: {height}px;">
	<canvas class="block" bind:this={canvas}></canvas>
</div>

<style>
</style>
