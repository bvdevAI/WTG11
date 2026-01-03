import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { clamp, damp } from './math';
import type { InputState } from './input';

export type PlayerConfig = {
  radius: number;
  height: number;
  moveSpeed: number;
  airControl: number;
  jumpVel: number;
  maxSpeed: number;
  swingAssist: number;      // arcade pull toward tangent
  swingDamping: number;     // reduces oscillation a touch
  reelSpeed: number;
  minRope: number;
  maxRope: number;
  attachRange: number;
};

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  mesh: THREE.Mesh;
  private mat = new THREE.MeshStandardMaterial({ color: 0xd9e7ff, roughness: 0.5, metalness: 0.0 });

  // Swing state
  isSwinging = false;
  anchor = new THREE.Vector3();
  ropeLength = 0;
  private ropeVis: THREE.Line;
  private ropeGeo = new THREE.BufferGeometry();
  private ropePos = new Float32Array(6);

  // Ground probe
  private grounded = false;
  private groundGrace = 0; // small coyote time
  private lastVel = new THREE.Vector3();

  constructor(
    private R: typeof RAPIER,
    private world: RAPIER.World,
    private scene: THREE.Scene,
    start: THREE.Vector3,
    private cfg: PlayerConfig
  ) {
    // Physics body
    const rbDesc = this.R.RigidBodyDesc.dynamic()
      .setTranslation(start.x, start.y, start.z)
      .setCanSleep(false)
      .setLinearDamping(0.05)
      .setAngularDamping(0.9);
    this.body = this.world.createRigidBody(rbDesc);

    // Capsule collider
    const half = Math.max(0.1, (cfg.height * 0.5) - cfg.radius);
    const colDesc = this.R.ColliderDesc.capsule(half, cfg.radius)
      .setFriction(1.2)
      .setRestitution(0.0);
    this.collider = this.world.createCollider(colDesc, this.body);

    // Visual mesh
    const geo = new THREE.CapsuleGeometry(cfg.radius, cfg.height - cfg.radius * 2, 8, 16);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);

    // Rope visual
    const ropeMat = new THREE.LineBasicMaterial({ color: 0xbfdcff, transparent: true, opacity: 0.7 });
    this.ropeGeo.setAttribute('position', new THREE.BufferAttribute(this.ropePos, 3));
    this.ropeVis = new THREE.Line(this.ropeGeo, ropeMat);
    this.scene.add(this.ropeVis);
    this.ropeVis.visible = false;
  }

  reset(pos: THREE.Vector3) {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.detach();
  }

  getPosition(out = new THREE.Vector3()) {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z);
  }
  getVelocity(out = new THREE.Vector3()) {
    const v = this.body.linvel();
    return out.set(v.x, v.y, v.z);
  }

  private setVelocity(v: THREE.Vector3) {
    this.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
  }

  private updateGrounded(dt: number) {
    const t = this.body.translation();
    const origin = { x: t.x, y: t.y - this.cfg.height * 0.5 + this.cfg.radius + 0.05, z: t.z };
    const dir = { x: 0, y: -1, z: 0 };

    // Raycast slightly below feet
    const hit = this.world.castRay(new this.R.Ray(origin, dir), 0.18, true);
    const wasGrounded = this.grounded;
    this.grounded = !!hit;

    if (this.grounded) this.groundGrace = 0.09;
    else this.groundGrace = Math.max(0, this.groundGrace - dt);

    // Extra friction feeling when grounded (arcade)
    if (!wasGrounded && this.grounded) {
      const v = this.getVelocity(this.lastVel);
      v.y = Math.max(v.y, 0);
      this.setVelocity(v);
    }
  }

  tryAttachFromCamera(camera: THREE.Camera, pointerX: number, pointerY: number): boolean {
    // Aim: ray from camera through reticle (center-ish)
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(pointerX, pointerY), camera);

    const origin = ray.ray.origin;
    const dir = ray.ray.direction;

    const hit = this.world.castRay(new this.R.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z }
    ), this.cfg.attachRange, true);

    if (!hit) return false;

    const p = hit.point;
    this.anchor.set(p.x, p.y, p.z);

    const pos = this.getPosition();
    const dist = pos.distanceTo(this.anchor);
    if (dist < this.cfg.minRope) return false;

    this.isSwinging = true;
    this.ropeLength = clamp(dist, this.cfg.minRope, this.cfg.maxRope);

    this.ropeVis.visible = true;
    return true;
  }

  detach() {
    this.isSwinging = false;
    this.ropeVis.visible = false;
  }

  update(input: InputState, camera: THREE.Camera, dt: number) {
    this.updateGrounded(dt);

    const pos = this.getPosition();
    let vel = this.getVelocity(this.lastVel);

    // Jump (coyote time)
    if (input.jumpPressed && (this.grounded || this.groundGrace > 0)) {
      vel.y = this.cfg.jumpVel;
      this.groundGrace = 0;
      this.setVelocity(vel);
    }

    // Attach/release
    if (input.webPressed) {
      if (this.isSwinging) this.detach();
      else this.tryAttachFromCamera(camera, input.pointerX, input.pointerY);
    }
    if (input.webReleased) {
      // Optional: releasing ends web hold only; keep attached until tap again for arcade clarity
    }

    // Movement direction relative to camera
    const camFwd = new THREE.Vector3();
    camera.getWorldDirection(camFwd);
    camFwd.y = 0;
    camFwd.normalize();
    const camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0,1,0)).normalize();

    const wish = new THREE.Vector3()
      .addScaledVector(camRight, input.moveX)
      .addScaledVector(camFwd, input.moveY);

    if (wish.lengthSq() > 1e-6) wish.normalize();

    // Ground / air accel
    const speed = this.cfg.moveSpeed;
    const control = (this.grounded || this.groundGrace > 0) ? 1.0 : this.cfg.airControl;

    // Arcade: accelerate toward desired horizontal velocity
    const desired = new THREE.Vector3(wish.x * speed, vel.y, wish.z * speed);

    vel.x = damp(vel.x, desired.x, 10 * control, dt);
    vel.z = damp(vel.z, desired.z, 10 * control, dt);

    // Swing logic (arcade)
    if (this.isSwinging) {
      // Reel in/out
      if (Math.abs(input.reelDelta) > 1e-4) {
        this.ropeLength = clamp(
          this.ropeLength + input.reelDelta * this.cfg.reelSpeed,
          this.cfg.minRope,
          this.cfg.maxRope
        );
      }

      // Constraint: keep player on sphere radius ropeLength around anchor
      const toPlayer = pos.clone().sub(this.anchor);
      const dist = Math.max(1e-4, toPlayer.length());
      const n = toPlayer.multiplyScalar(1 / dist); // direction from anchor -> player

      // Pull strength increases when stretched; slack is allowed slightly (arcade forgiving)
      const stretch = dist - this.ropeLength;
      if (stretch > 0) {
        // Correct position by adding velocity toward constraint surface
        const pull = stretch * 22; // springiness
        vel.addScaledVector(n, -pull * dt);

        // Damping along rope direction (reduce yo-yo)
        const along = vel.dot(n);
        vel.addScaledVector(n, -along * this.cfg.swingDamping * dt);
      }

      // Tangential assist: helps keep momentum around anchor
      const toward = this.anchor.clone().sub(pos).normalize();
      const tangent = vel.clone().sub(toward.multiplyScalar(vel.dot(toward)));
      if (tangent.lengthSq() > 1e-5) {
        tangent.normalize();
        vel.addScaledVector(tangent, this.cfg.swingAssist * dt);
      }
    }

    // Clamp max horizontal speed
    const hv = new THREE.Vector3(vel.x, 0, vel.z);
    const hlen = hv.length();
    if (hlen > this.cfg.maxSpeed) {
      hv.multiplyScalar(this.cfg.maxSpeed / hlen);
      vel.x = hv.x; vel.z = hv.z;
    }

    this.setVelocity(vel);

    // Visual updates
    const t = this.body.translation();
    this.mesh.position.set(t.x, t.y, t.z);

    // Rope visual
    if (this.isSwinging) {
      const top = new THREE.Vector3(t.x, t.y + 0.2, t.z);
      this.ropePos[0] = top.x; this.ropePos[1] = top.y; this.ropePos[2] = top.z;
      this.ropePos[3] = this.anchor.x; this.ropePos[4] = this.anchor.y; this.ropePos[5] = this.anchor.z;
      (this.ropeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.ropeVis.visible = true;
    } else {
      this.ropeVis.visible = false;
    }
  }
}
