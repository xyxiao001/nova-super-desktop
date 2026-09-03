#!/usr/bin/env python3
"""Extract the fixed Frontline preview asset set from Unity AssetBundles."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import UnityPy


SOURCE_VERSION = "412f11e3c27d645ddeafcf921f558d57"
UNITY_VERSION = "2022.3.48t7"
SPINE_RUNTIME_VERSION = "4.2.120"

ACTOR_BUNDLE = {
    "file": "char_monster_01_xiyi_456d6772844976e47545a4d7fc110d56",
    "sha256": "2b179728b8ffff220b7090daeba7c678585852304482e7f2bbcb27636dc31b0f",
}
EFFECT_BUNDLE = {
    "file": "fx_monster_common_af0b200688dc9813201a4c5a5fb05442",
    "sha256": "f18dff609f540c73b3160b9e145ec5ecb910c04135cfe4ed7b8e4323727abfed",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def text_asset_bytes(value: Any) -> bytes:
    if isinstance(value, str):
        return value.encode("utf-8", "surrogateescape")
    return bytes(value)


def ensure_exact_bundle(bundle_root: Path, descriptor: dict[str, str]) -> Path:
    path = bundle_root / descriptor["file"]
    if not path.is_file():
        raise FileNotFoundError(f"Required AssetBundle is missing: {path}")
    actual_hash = sha256(path)
    if actual_hash != descriptor["sha256"]:
        raise RuntimeError(
            f"AssetBundle hash mismatch for {path.name}: "
            f"expected {descriptor['sha256']}, got {actual_hash}"
        )
    header = path.read_bytes()[:64]
    if not header.startswith(b"UnityFS\x00") or UNITY_VERSION.encode() not in header:
        raise RuntimeError(f"Unexpected UnityFS header for {path.name}")
    return path


def read_objects(bundle_path: Path) -> tuple[Any, dict[int, Any]]:
    environment = UnityPy.load(str(bundle_path))
    return environment, {obj.path_id: obj for obj in environment.objects}


def find_named_object(environment: Any, type_name: str, name: str) -> tuple[Any, Any]:
    matches: list[tuple[Any, Any]] = []
    for obj in environment.objects:
        if obj.type.name != type_name:
            continue
        data = obj.read()
        if getattr(data, "m_Name", "") == name:
            matches.append((obj, data))
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one {type_name} named {name!r}, found {len(matches)}"
        )
    return matches[0]


def pointer_name(objects: dict[int, Any], path_id: int) -> str:
    target = objects.get(path_id)
    if target is None:
        return ""
    return getattr(target.read(), "m_Name", "")


def output_file(path: Path, output_root: Path) -> dict[str, Any]:
    return {
        "path": path.relative_to(output_root).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def scalar(module: dict[str, Any]) -> float:
    return float(module["scalar"])


def color(value: dict[str, Any]) -> dict[str, float]:
    return {channel: float(value[channel]) for channel in ("r", "g", "b", "a")}


def gradient(value: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "colorKeys": [],
        "alphaKeys": [],
    }
    color_count = int(value["m_NumColorKeys"])
    alpha_count = int(value["m_NumAlphaKeys"])
    for index in range(color_count):
        key = value[f"key{index}"]
        result["colorKeys"].append(
            {
                "time": int(value[f"ctime{index}"]) / 65535,
                **color(key),
            }
        )
    for index in range(alpha_count):
        key = value[f"key{index}"]
        result["alphaKeys"].append(
            {
                "time": int(value[f"atime{index}"]) / 65535,
                "alpha": float(key["a"]),
            }
        )
    return result


def export_spine_actor(
    bundle_path: Path,
    output_root: Path,
    asset_name: str,
    actor_id: str,
) -> dict[str, Any]:
    environment, _ = read_objects(bundle_path)
    actor_root = output_root / "spine" / asset_name
    actor_root.mkdir(parents=True, exist_ok=True)

    _, atlas_asset = find_named_object(
        environment, "TextAsset", f"{asset_name}.atlas"
    )
    _, skeleton_asset = find_named_object(
        environment, "TextAsset", f"{asset_name}.skel"
    )
    _, texture_asset = find_named_object(
        environment, "Texture2D", asset_name
    )

    atlas_text = text_asset_bytes(atlas_asset.m_Script).decode("utf-8")
    source_page_name = atlas_text.splitlines()[0]
    atlas_text = atlas_text.replace(source_page_name, "texture.png", 1)

    atlas_path = actor_root / "skeleton.atlas"
    skeleton_path = actor_root / "skeleton.skel"
    texture_path = actor_root / "texture.png"
    atlas_path.write_text(atlas_text, encoding="utf-8", newline="\n")
    skeleton_path.write_bytes(text_asset_bytes(skeleton_asset.m_Script))
    texture_asset.image.save(texture_path)

    skeleton_scale = None
    gpu_animations: list[dict[str, Any]] = []
    for obj in environment.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            tree = obj.read_typetree()
        except Exception:
            continue
        if tree.get("m_Name") == f"{asset_name}_SkeletonData":
            skeleton_scale = float(tree["scale"])
        if tree.get("m_Name") == asset_name and "Groups" in tree:
            gpu_animations = [
                {
                    "name": group["GroupName"],
                    "fps": int(group["AnimFPS"]),
                    "frames": len(group["Sprites"]),
                }
                for group in tree["Groups"]
            ]
    if skeleton_scale is None:
        raise RuntimeError(f"Spine SkeletonData scale was not found for {asset_name}")

    return {
        "id": actor_id,
        "sourceBundle": bundle_path.name,
        "sourceObjects": {
            "atlas": f"{asset_name}.atlas",
            "skeleton": f"{asset_name}.skel",
            "texture": asset_name,
        },
        "runtime": {
            "package": "@esotericsoftware/spine-webgl",
            "version": SPINE_RUNTIME_VERSION,
            "pipeline": "binary",
        },
        "scale": skeleton_scale,
        "defaultSkin": "default",
        "gpuFrameReference": gpu_animations,
        "files": {
            "atlas": output_file(atlas_path, output_root),
            "skeleton": output_file(skeleton_path, output_root),
            "texture": output_file(texture_path, output_root),
        },
    }


def export_actor(bundle_path: Path, output_root: Path) -> dict[str, Any]:
    return export_spine_actor(
        bundle_path,
        output_root,
        "monster_01_xiyi",
        "monster-01-xiyi",
    )


def export_effect(bundle_path: Path, output_root: Path) -> dict[str, Any]:
    environment, objects = read_objects(bundle_path)
    effect_root = output_root / "effects" / "monster-fireball"
    effect_root.mkdir(parents=True, exist_ok=True)

    _, texture_asset = find_named_object(
        environment, "Texture2D", "eff_xulie_lzh_34"
    )
    material_object, _ = find_named_object(
        environment, "Material", "eff_boss_rongyan05"
    )
    material_tree = material_object.read_typetree()

    particle_tree = None
    particle_path_id = None
    for obj in environment.objects:
        if obj.type.name != "ParticleSystem":
            continue
        tree = obj.read_typetree()
        game_object_id = tree["m_GameObject"]["m_PathID"]
        if pointer_name(objects, game_object_id) == "huoqiu_start":
            particle_tree = tree
            particle_path_id = obj.path_id
            break
    if particle_tree is None:
        raise RuntimeError("ParticleSystem for huoqiu_start was not found")

    texture_path = effect_root / "texture.png"
    config_path = effect_root / "particle.json"
    texture_asset.image.save(texture_path)

    initial = particle_tree["InitialModule"]
    emission = particle_tree["EmissionModule"]
    uv = particle_tree["UVModule"]
    color_over_lifetime = particle_tree["ColorModule"]["gradient"]["maxGradient"]
    material_colors = dict(material_tree["m_SavedProperties"]["m_Colors"])
    particle_config = {
        "source": {
            "bundle": bundle_path.name,
            "gameObject": "huoqiu_start",
            "particleSystemPathId": particle_path_id,
            "material": material_tree["m_Name"],
            "texture": texture_asset.m_Name,
        },
        "duration": float(particle_tree["lengthInSec"]),
        "loop": bool(particle_tree["looping"]),
        "simulationSpeed": float(particle_tree["simulationSpeed"]),
        "maxParticles": int(initial["maxNumParticles"]),
        "lifetime": scalar(initial["startLifetime"]),
        "startSpeed": scalar(initial["startSpeed"]),
        "startSize": scalar(initial["startSize"]),
        "startRotationRadians": scalar(initial["startRotation"]),
        "startColor": color(initial["startColor"]["maxColor"]),
        "burst": {
            "time": float(emission["m_Bursts"][0]["time"]),
            "count": int(scalar(emission["m_Bursts"][0]["countCurve"])),
        },
        "textureSheet": {
            "columns": int(uv["tilesX"]),
            "rows": int(uv["tilesY"]),
            "fps": float(uv["fps"]),
            "cycles": float(uv["cycles"]),
        },
        "colorOverLifetime": gradient(color_over_lifetime),
        "material": {
            "webBlend": "additive",
            "tint": color(material_colors["_TintColor"])
            if "_TintColor" in material_colors
            else {"r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0},
        },
    }
    config_path.write_text(
        json.dumps(particle_config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {
        "id": "monster-fireball",
        "kind": "unity-particle-flipbook",
        "sourceBundle": bundle_path.name,
        "files": {
            "texture": output_file(texture_path, output_root),
            "config": output_file(config_path, output_root),
        },
    }


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        default=os.environ.get("FRONTLINE_ASSET_ROOT"),
        help="Path to the TJCS cache root containing bundles/",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=repo_root / "public" / "assets" / "games" / "frontline",
    )
    args = parser.parse_args()
    if not args.source_root:
        parser.error("--source-root or FRONTLINE_ASSET_ROOT is required")

    bundle_root = Path(args.source_root).expanduser().resolve() / "bundles"
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    actor_bundle = ensure_exact_bundle(bundle_root, ACTOR_BUNDLE)
    effect_bundle = ensure_exact_bundle(bundle_root, EFFECT_BUNDLE)
    manifest = {
        "schemaVersion": 1,
        "scope": "iteration-1-animation-feasibility",
        "sourceVersion": SOURCE_VERSION,
        "unityVersion": UNITY_VERSION,
        "generator": {
            "name": "scripts/frontline/extract_assets.py",
            "unityPy": UnityPy.__version__,
        },
        "bundles": [
            {
                "file": descriptor["file"],
                "bytes": path.stat().st_size,
                "sha256": descriptor["sha256"],
            }
            for descriptor, path in (
                (ACTOR_BUNDLE, actor_bundle),
                (EFFECT_BUNDLE, effect_bundle),
            )
        ],
        "spineActors": [export_actor(actor_bundle, output_root)],
        "effects": [export_effect(effect_bundle, output_root)],
    }
    manifest_path = output_root / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted Frontline iteration-1 assets to {output_root}")


if __name__ == "__main__":
    main()
