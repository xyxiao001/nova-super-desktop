import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AtlasAttachmentLoader,
  EventTimeline,
  SkeletonBinary,
  TextureAtlas,
} from "@esotericsoftware/spine-core";

const DEFAULT_LIFECYCLE = ["stand", "run", "attack_1", "hurt", "dead"];

export const inspectSpineActor = async (actor, outputRoot) => {
  const atlasText = await readFile(
    resolve(outputRoot, actor.files.atlas.path),
    "utf8",
  );
  const skeletonBytes = await readFile(
    resolve(outputRoot, actor.files.skeleton.path),
  );
  const atlas = new TextureAtlas(atlasText);
  const binary = new SkeletonBinary(new AtlasAttachmentLoader(atlas));
  binary.scale = actor.scale;
  const skeletonData = binary.readSkeletonData(new Uint8Array(skeletonBytes));

  if (!skeletonData.version?.startsWith("4.2.")) {
    throw new Error(
      `${actor.id} uses unsupported Spine version ${skeletonData.version}`,
    );
  }

  actor.binaryVersion = skeletonData.version;
  actor.bounds = {
    x: skeletonData.x,
    y: skeletonData.y,
    width: skeletonData.width,
    height: skeletonData.height,
  };
  actor.skins = skeletonData.skins.map((skin) => skin.name);
  actor.animations = skeletonData.animations.map((animation) => ({
    name: animation.name,
    duration: animation.duration,
    events: animation.timelines
      .filter((timeline) => timeline instanceof EventTimeline)
      .flatMap((timeline) =>
        timeline.events.map((event) => ({
          time: event.time,
          name: event.data.name,
          intValue: event.intValue,
          floatValue: event.floatValue,
          stringValue: event.stringValue,
        })),
      ),
  }));

  const available = new Set(
    actor.animations.map((animation) => animation.name),
  );
  const required = actor.requiredAnimations ?? DEFAULT_LIFECYCLE;
  actor.lifecycleAudit = {
    required,
    missing: required.filter((name) => !available.has(name)),
  };
};
