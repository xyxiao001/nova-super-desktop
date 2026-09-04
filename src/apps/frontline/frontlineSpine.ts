import {
  AtlasAttachmentLoader,
  GLTexture,
  SkeletonBinary,
  type Skeleton,
  TextureAtlas,
  type SkeletonData,
} from "@esotericsoftware/spine-webgl";

const ASSET_ROOT = "/assets/games/frontline";

export const FRONTLINE_ACTOR_DIRECTORIES: Record<string, string> = {
  "hero-basic-ranger": "hero_04_sheshou",
  "hero-basic-gunner": "hero_02_paoshou",
  "hero-summoner": "hero_25_xiaozhi",
  "hero-clown": "hero_23_baji",
  "hero-jinx": "hero_20_jinkesi",
  "hero-lightning": "hero_21_pikaqiu",
  "lord-sand-king": "lingzhu_01_shawang",
  "summon-little-ghost": "zhaohuan_xiaozhiguai01",
  "monster-01-jiachong": "monster_01_jiachong",
  "monster-01-xiyi": "monster_01_xiyi",
  "monster-01-zongquan": "monster_01_zongquan",
};

const FRONTLINE_ACTOR_SKINS: Record<string, string> = {
  "hero-basic-ranger": "01",
  "hero-basic-gunner": "01",
  "hero-summoner": "01",
  "hero-clown": "01",
  "hero-jinx": "01",
  "hero-lightning": "01",
};

export type FrontlineSpineAsset = {
  data: SkeletonData;
  texture: GLTexture;
};

export const applyFrontlineActorSkin = (
  skeleton: Skeleton,
  actorId: string,
) => {
  const skin = FRONTLINE_ACTOR_SKINS[actorId];
  if (!skin) return;
  skeleton.setSkinByName(skin);
  skeleton.setSlotsToSetupPose();
};

const fetchRequired = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Failed to load ${source}: ${response.status}`);
  return response;
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Failed to load ${source}`));
  image.src = source;
});

export const loadFrontlineSpineActor = async (
  gl: WebGLRenderingContext,
  actorId: string,
): Promise<FrontlineSpineAsset> => {
  const directory = FRONTLINE_ACTOR_DIRECTORIES[actorId];
  if (!directory) throw new Error(`Unknown Frontline actor: ${actorId}`);
  const root = `${ASSET_ROOT}/spine/${directory}`;
  const [atlasResponse, skeletonResponse, image] = await Promise.all([
    fetchRequired(`${root}/skeleton.atlas`),
    fetchRequired(`${root}/skeleton.skel`),
    loadImage(`${root}/texture.png`),
  ]);
  const [atlasText, skeletonBuffer] = await Promise.all([
    atlasResponse.text(),
    skeletonResponse.arrayBuffer(),
  ]);
  const texture = new GLTexture(gl, image, false);
  const atlas = new TextureAtlas(atlasText);
  if (atlas.pages.length !== 1) {
    texture.dispose();
    throw new Error(`${actorId} has ${atlas.pages.length} atlas pages`);
  }
  atlas.pages[0].setTexture(texture);
  const binary = new SkeletonBinary(new AtlasAttachmentLoader(atlas));
  binary.scale = 0.01;
  return {
    data: binary.readSkeletonData(new Uint8Array(skeletonBuffer)),
    texture,
  };
};
