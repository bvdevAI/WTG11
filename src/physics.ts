import RAPIER from '@dimforge/rapier3d-compat';

export class Physics {
  R!: typeof RAPIER;
  world!: RAPIER.World;

  async init() {
    const R = await RAPIER.init();
    this.R = R;
    this.world = new R.World({ x: 0.0, y: -18.0, z: 0.0 });
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step();
  }
}
