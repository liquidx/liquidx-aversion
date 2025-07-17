<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { FontLoader } from 'three-stdlib';
	import { TextGeometry } from 'three-stdlib';

	interface Props {
		text?: string;
	}

	let { text = '0' }: Props = $props();

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let textMesh: THREE.Mesh;
	let startTime = Date.now();
	let animationId: number;
	let font: THREE.Font;

	onMount(() => {
		// Load font and initialize scene
		loadFont();

		// Handle window resize
		const handleResize = () => {
			if (camera && renderer) {
				camera.aspect = window.innerWidth / window.innerHeight;
				camera.updateProjectionMatrix();
				renderer.setSize(window.innerWidth, window.innerHeight);
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

		// Create camera
		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
		camera.position.z = 5;

		// Create renderer
		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
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

		// Remove existing text mesh if it exists
		if (textMesh) {
			scene.remove(textMesh);
			textMesh.geometry.dispose();
			if (Array.isArray(textMesh.material)) {
				textMesh.material.forEach((material) => material.dispose());
			} else {
				textMesh.material.dispose();
			}
		}

		// Create text geometry
		const textGeometry = new TextGeometry(text, {
			font: font,
			size: 2,
			height: 0.5,
			curveSegments: 12,
			bevelEnabled: true,
			bevelThickness: 0.1,
			bevelSize: 0.1,
			bevelOffset: 0,
			bevelSegments: 5
		} as any);

		// Center the text at origin
		textGeometry.computeBoundingBox();
		const textWidth = textGeometry.boundingBox!.max.x - textGeometry.boundingBox!.min.x;
		const textHeight = textGeometry.boundingBox!.max.y - textGeometry.boundingBox!.min.y;
		const textDepth = textGeometry.boundingBox!.max.z - textGeometry.boundingBox!.min.z;

		textGeometry.translate(-textWidth / 2, -textHeight / 2, -textDepth / 2);

		// Create material with animated greyscale color
		const textMaterial = new THREE.MeshPhongMaterial({
			color: 0xffffff,
			shininess: 100
		});

		// Create mesh
		textMesh = new THREE.Mesh(textGeometry, textMaterial);
		scene.add(textMesh);
	}

	// Watch for text changes and update the 3D text
	$effect(() => {
		text; // Track text dependency
		if (font && scene) {
			createText();
		}
	});

	function animate() {
		animationId = requestAnimationFrame(animate);

		// Rotate the text
		if (textMesh) {
			textMesh.rotation.y += 0.01;
			
			// Animate color - pulsing greyscale
			const elapsed = (Date.now() - startTime) * 0.001;
			const intensity = (Math.sin(elapsed * 2) + 1) * 0.5; // 0 to 1
			const greyValue = Math.floor(intensity * 255);
			const color = (greyValue << 16) | (greyValue << 8) | greyValue;
			
			if (textMesh.material instanceof THREE.MeshPhongMaterial) {
				textMesh.material.color.setHex(color);
			}
		}

		// Render the scene
		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}
	}
</script>

<div class="three-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.three-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
	}

	canvas {
		display: block;
	}
</style>
