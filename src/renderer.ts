import * as THREE from 'three';
import { damp } from './math';

export type CameraMode = 'follow' | 'overShoulder';

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  private hemi: THREE.HemisphereLight;
  private dir: THREE.DirectionalLight;

  private camPos = new THREE.Vector3(0, 4, 10);
  private camLook = new THREE.Vector3();
  private mode: CameraMode = 'follow';

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0b0f14, 30, 240);
    this.scene.background = new THREE.Color(0x0b0f14);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 600);
    this.camera.position.copy(this.camPos);

    this.hemi = new THREE.HemisphereLight(0xaecbff, 0x091018, 0.85);
    this.dir = new THREE.DirectionalLight(0xffffff, 0.9);
    this.dir.position.set(20, 30, 10);

    this.scene.add(this.hemi);
    this.scene.add(this.dir);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setCameraMode(mode: CameraMode) { this.mode = mode; }

  updateCamera(targetPos: THREE.Vector3, targetVel: THREE.Vector3, dt: number) {
    const speed = targetVel.length();
    const fovTarget = 68 + Math.min(12, speed * 0.35);
    this.camera.fov = damp(this.camera.fov, fovTarget, 8, dt);
    this.camera.updateProjectionMatrix();

    const forward = new THREE.Vector3(targetVel.x, 0, targetVel.z);
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();

    let desiredPos: THREE.Vector3;
    let desiredLook: THREE.Vector3;

    if (this.mode === 'overShoulder') {
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward).normalize();
      desiredPos = targetPos.clone()
        .addScaledVector(side, 1.4)
        .addScaledVector(forward, -4.2)
        .add(new THREE.Vector3(0, 2.1, 0));
      desiredLook = targetPos.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(forward, 6);
    } else {
      desiredPos = targetPos.clone()
        .addScaledVector(forward, -9.5)
        .add(new THREE.Vector3(0, 5.2, 0));
      desiredLook = targetPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    }

    this.camPos.lerp(desiredPos, 1 - Math.exp(-7 * dt));
    this.camLook.lerp(desiredLook, 1 - Math.exp(-10 * dt));

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
