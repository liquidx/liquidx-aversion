import * as THREE from 'three';

export interface SceneConfig {
	width: number;
	height: number;
	background?: THREE.Color;
	enableLights?: boolean;
}

export class ThreeScene {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	animationId?: number;

	constructor(canvas: HTMLCanvasElement, config: SceneConfig) {
		// Create scene
		this.scene = new THREE.Scene();
		if (config.background) {
			this.scene.background = config.background;
		}

		// Create camera
		this.camera = new THREE.PerspectiveCamera(75, config.width / config.height, 0.1, 1000);
		this.camera.position.z = 5;

		// Create renderer
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true
		});
		this.renderer.setSize(config.width, config.height);
		this.renderer.setPixelRatio(window.devicePixelRatio);

		// Add default lights if requested
		if (config.enableLights) {
			this.addDefaultLights();
		}
	}

	addDefaultLights() {
		const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(1, 1, 1);
		this.scene.add(directionalLight);
	}

	add(object: THREE.Object3D) {
		this.scene.add(object);
	}

	remove(object: THREE.Object3D) {
		this.scene.remove(object);
	}

	render() {
		this.renderer.render(this.scene, this.camera);
	}

	startAnimation(callback?: () => void) {
		const animate = () => {
			this.animationId = requestAnimationFrame(animate);

			if (callback) {
				callback();
			}

			this.render();
		};
		animate();
	}

	stopAnimation() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = undefined;
		}
	}

	resize(width: number, height: number) {
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}

	dispose() {
		this.stopAnimation();
		this.renderer.dispose();
	}
}

// Helper functions for common Three.js objects
export function createRotatingCube(color: number = 0x00ff00, wireframe: boolean = false) {
	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial({ color, wireframe });
	return new THREE.Mesh(geometry, material);
}

export function createParticleSystem(
	count: number = 1000,
	color: THREE.Color = new THREE.Color(0x00ff00)
) {
	const geometry = new THREE.BufferGeometry();
	const positions = new Float32Array(count * 3);
	const colors = new Float32Array(count * 3);

	for (let i = 0; i < count; i++) {
		const i3 = i * 3;

		// Random positions
		positions[i3] = (Math.random() - 0.5) * 20;
		positions[i3 + 1] = (Math.random() - 0.5) * 20;
		positions[i3 + 2] = (Math.random() - 0.5) * 20;

		// Set colors
		colors[i3] = color.r;
		colors[i3 + 1] = color.g;
		colors[i3 + 2] = color.b;
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

	const material = new THREE.PointsMaterial({
		size: 0.05,
		vertexColors: true,
		blending: THREE.AdditiveBlending,
		transparent: true,
		opacity: 0.8
	});

	return new THREE.Points(geometry, material);
}
