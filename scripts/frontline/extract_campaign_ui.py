#!/usr/bin/env python3
"""Extract the fixed-version campaign map and challenge panel artwork."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from extract_assets import ensure_exact_bundle, find_named_object, output_file


SOURCE_VERSION = "412f11e3c27d645ddeafcf921f558d57"

BUNDLES = {
    "background": {
        "file": "gui_mainline_main_background_01_f8d3ee575bbeffccb8f4402a0442762e",
        "sha256": "b81fc2648c37c4b9adf5232ebcab19b76255d76fbf2f6462076fbffbead7c007",
    },
    "mainline": {
        "file": "gui_mainline_97f0e7d83537ebdac5c94c270da8f374",
        "sha256": "3950bb2d71b6f44c6e0226b18368c6482946e4f2154ad04564fc00498bcd79c5",
    },
    "monsters": {
        "file": "gui_common_tex_iconitem_monster_6f25b88648faa65d68347c2f20f09b8c",
        "sha256": "6ededabbed885e414db5172ab42ca303b307b241c9c7a8e88b7564190c34c529",
    },
    "currency": {
        "file": "gui_common_tex_iconitem_currencyicon_bdd2603a4237b25b8f4ae05fde794429",
        "sha256": "a85e4d5cf63bcbd9ce50e5e453578012e02d548af3e623f70f70d9fe3d3cb889",
    },
}

MAINLINE_SPRITES = {
    "Main_guangka_xuanze01": "map-node-locked.png",
    "Main_guangka_xuanze02": "map-node-current.png",
    "Main_guangka_xuanze03": "map-node-selection.png",
    "Main_guangka_map01": "map-node-frame.png",
    "Main_guangka_map01_hei": "map-node-frame-locked.png",
    "Main_guanka_di": "map-level-label.png",
    "Battle_guangka_di": "challenge-panel.png",
    "Battle_guangka_biaoti": "challenge-heading.png",
    "Battle_guangka_title": "challenge-title.png",
    "Battle_guangka_zhengrongdi": "challenge-lineup-strip.png",
    "Battle_guangka_tongguang": "challenge-complete.png",
    "Battle_guangka_bossdi01": "challenge-enemy-card.png",
    "Main_button_kszd": "challenge-button.png",
    "Main_guangka_tishi": "challenge-warning.png",
}

MONSTER_SPRITES = {
    "lihui_monster_01_jiachong": "monster-scarab.png",
    "lihui_monster_01_xiyi": "monster-lizard.png",
    "lihui_monster_01_zongquan": "monster-hound.png",
}

REWARD_SPRITES = {
    "Icon_tongbi": "reward-coin.png",
    "Icon_item_jingyan": "reward-experience.png",
    "Icon_dianjiangqi": "reward-ticket.png",
    "Icon_item_liangcao": "reward-ration.png",
}


def asset_file(path: Path, asset_root: Path) -> dict[str, Any]:
    return output_file(path, asset_root)


def export_sprite_set(
    bundle_path: Path,
    sprites: dict[str, str],
    campaign_root: Path,
    asset_root: Path,
) -> list[dict[str, Any]]:
    import UnityPy

    environment = UnityPy.load(str(bundle_path))
    files: list[dict[str, Any]] = []
    for object_name, output_name in sprites.items():
        _, sprite = find_named_object(environment, "Sprite", object_name)
        output_path = campaign_root / output_name
        image = sprite.image
        image.save(output_path)
        files.append(
            {
                "sourceBundle": bundle_path.name,
                "sourceObject": object_name,
                "width": image.width,
                "height": image.height,
                "file": asset_file(output_path, asset_root),
            }
        )
    return files


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
    asset_root = args.output_root.resolve()
    campaign_root = asset_root / "ui" / "campaign"
    campaign_root.mkdir(parents=True, exist_ok=True)
    bundle_paths = {
        key: ensure_exact_bundle(bundle_root, descriptor)
        for key, descriptor in BUNDLES.items()
    }

    import UnityPy

    background_environment = UnityPy.load(str(bundle_paths["background"]))
    _, background = find_named_object(
        background_environment,
        "Texture2D",
        "Main_background_01",
    )
    background_path = asset_root / "world-map.png"
    background.image.save(background_path)
    files: list[dict[str, Any]] = [
        {
            "sourceBundle": bundle_paths["background"].name,
            "sourceObject": "Main_background_01",
            "width": int(background.m_Width),
            "height": int(background.m_Height),
            "file": asset_file(background_path, asset_root),
        }
    ]
    files.extend(
        export_sprite_set(
            bundle_paths["mainline"],
            MAINLINE_SPRITES,
            campaign_root,
            asset_root,
        )
    )
    files.extend(
        export_sprite_set(
            bundle_paths["monsters"],
            MONSTER_SPRITES,
            campaign_root,
            asset_root,
        )
    )
    files.extend(
        export_sprite_set(
            bundle_paths["currency"],
            REWARD_SPRITES,
            campaign_root,
            asset_root,
        )
    )

    manifest_path = campaign_root / "source-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "sourceVersion": SOURCE_VERSION,
                "bundles": [
                    {
                        "file": bundle_paths[key].name,
                        "bytes": bundle_paths[key].stat().st_size,
                        "sha256": descriptor["sha256"],
                    }
                    for key, descriptor in BUNDLES.items()
                ],
                "files": files,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted campaign UI assets to {campaign_root}")


if __name__ == "__main__":
    main()
