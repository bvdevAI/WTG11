import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

export type CityConfig = {
  blocks: number;
  blockSize: number;
  street: number;
  minH: number;
  maxH: number;
};

export class City {
  group = new THREE.Group();

  constructor(
    private R: typeof RAPIER,
    private world: RAPIER.World,
    private cfg: CityConfig
  ) {}

  build() {
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(1600, 1600);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f1620, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.group.add(ground);

    // Physics ground
    const groundBody = this.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
    const groundCol = this.R.ColliderDesc.cuboid(800, 0.1, 800).setTranslation(0, -0.1, 0);
    this.world.createCollider(groundCol, groundBody);

    // Buildings (instanced)
    const { blocks, blockSize, street, minH, maxH } = this.cfg;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c2a3a, roughness: 0.95, metalness: 0.05 });
    const inst = new THREE.InstancedMesh(boxGeo, mat, blocks * blocks);
    inst.frustumCulled = true;

    const dummy = new THREE.Object3D();
    let i = 0;

    const pitch = (blockSize + street);
    const half = (blocks * pitch) * 0.5;

    // Deterministic-ish heights
    const rnd = (seed: number) => {
      const x = Math.sin(seed * 999.123) * 10000;
      return x - Math.floor(x);
    };

    for (let gx = 0; gx < blocks; gx++) {
      for (let gz = 0; gz < blocks; gz++) {
        const cx = gx * pitch - half + pitch * 0.5;
        const cz = gz * pitch - half + pitch * 0.5;

        // Slight street gaps already implied by pitch; keep buildings centered
        const r = rnd(gx * 1337 + gz * 7331);
        const h = minH + (maxH - minH) * Math.pow(r, 0.65);

        // Slight variety in footprint
        const w = blockSize * (0.62 + 0.28 * rnd(gx * 91 + gz * 17));
        const d = blockSize * (0.62 + 0.28 * rnd(gx * 37 + gz * 53));

        dummy.position.set(cx, h * 0.5, cz);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        // Physics: fixed rigidbody per building (cheap enough at this scale)
        const rb = this.world.createRigidBody(
          this.R.RigidBodyDesc.fixed().setTranslation(cx, h * 0.5, cz)
        );
        const col = this.R.ColliderDesc.cuboid(w * 0.5, h * 0.5, d * 0.5);
        // Mark as "solid" for raycast web attachments
        col.setFriction(0.9);
        this.world.createCollider(col, rb);

        i++;
      }
    }

    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);

    // A few tall landmarks (fun to swing from)
    const landmarkGeo = new THREE.CylinderGeometry(8, 10, 220, 16);
    const landmarkMat = new THREE.MeshStandardMaterial({ color: 0x23364b, roughness: 0.9, metalness: 0.05 });
    for (const p of [
      new THREE.Vector3(-220, 110, -180),
      new THREE.Vector3(260, 110, 220),
      new THREE.Vector3(-320, 110, 260),
    ]) {
      const m = new THREE.Mesh(landmarkGeo, landmarkMat);
      m.position.copy(p);
      this.group.add(m);

      const rb = this.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z));
      const col = this.R.ColliderDesc.cylinder(110, 10);
      this.world.createCollider(col, rb);
    }
  }
}
