import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createPlaceWorld, disposePlaceWorld } from "../../src/apps/music/placeWorlds";

describe("listening place lifecycle", () => {
  it.each(["train", "rain", "vinyl", "space"] as const)("resizes %s for narrow and wide windows and releases every GPU resource", (scene) => {
    const world = createPlaceWorld(scene, "", () => {});
    world.resize(.65, "stands");world.update(12, .4, .2, "ice");
    const camera = world.camera as THREE.OrthographicCamera;
    expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    world.resize(2.1, "front");world.update(15, .7, .6, "rose");
    expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    world.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        resources.add(object.geometry);
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) resources.add(m);
      }
    });
    const spies = [...resources].map(resource => vi.spyOn(resource, "dispose"));
    disposePlaceWorld(world.scene);
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
  });
  it("keeps fixed geometry while a record rotates and the lunar antenna scans", () => {
    for (const scene of ["vinyl", "space"] as const) {
      const world = createPlaceWorld(scene, "", () => {});
      world.resize(1.8, "stands");
      const nodes: THREE.Object3D[] = [];world.scene.traverse(object => nodes.push(object));
      const before = nodes.map(node => node.rotation.toArray().slice(0, 3));
      world.update(10, .2, .1, "violet");
      const changed = nodes.filter((node, i) => node.rotation.toArray().slice(0, 3).some((value, axis) => value !== before[i][axis]));
      expect(changed.length).toBeGreaterThan(0);
      expect(changed.length).toBeLessThan(4);
      disposePlaceWorld(world.scene);
    }
  });
});
