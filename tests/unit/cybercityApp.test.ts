import { describe, expect, it } from "vitest";
import { standaloneAppRoute } from "../../app/standaloneAppRoute";
import { APP_REGISTRY, appModuleLoaders } from "../../src/platform/apps/appRegistry";
import { roomWalkingPosition } from "../../src/apps/cybercity/interiors";
import { serviceWorkerResourcePackages } from "../../app/resourcePackageManifest";

describe("standalone Cyber City", () => {
  it("routes a shared city link without selecting a desktop theme", () => {
    expect(standaloneAppRoute("?app=cybercity")).toBe("cybercity");
    expect(standaloneAppRoute("?desktop=cyberpunk")).toBeNull();
    expect(standaloneAppRoute("?game=mines")).toBeNull();
  });
  it("is a launchable singleton app with a lazy entry and its own removable art package", () => {
    expect(APP_REGISTRY.cybercity).toMatchObject({label:"赛博城市",launcher:true,window:{instancePolicy:"singleton"}});
    expect(typeof appModuleLoaders.cybercity).toBe("function");
    const path="/assets/apps/cybercity/facade-atlas.png";
    expect(serviceWorkerResourcePackages().find(item=>item.pathPrefixes.some(prefix=>path.startsWith(prefix)))?.id).toBe("cybercity");
  });
  it("keeps indoor walking clear of the walls and counter", () => {
    expect(roomWalkingPosition(1,2)).toEqual({x:1,z:2});
    expect(roomWalkingPosition(-10,-6)).toEqual({x:-3.15,z:-1.4});
    expect(roomWalkingPosition(8,10)).toEqual({x:3.15,z:5.4});
  });
});
