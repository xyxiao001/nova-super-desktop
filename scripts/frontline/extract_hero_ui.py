#!/usr/bin/env python3
"""Extract the fixed-version hero screen artwork from Unity AssetBundles."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from extract_assets import ensure_exact_bundle, find_named_object, output_file


SOURCE_VERSION = "412f11e3c27d645ddeafcf921f558d57"

RAW_TEXTURES = (
    (
        {
            "file": "gui_common_raw_hero_background_6fe60a6e99502b6ceb3873d7dcba16ef",
            "sha256": "c9236b42782dfc9ab004a9724e89b371b30ea58a1db719317543f7d39f254708",
        },
        "Hero_background",
        "hero-background.png",
    ),
    (
        {
            "file": "gui_common_raw_hero_buzheng_beijing_cac3909cb10509b40de00dd74a5e97b7",
            "sha256": "93a0af35289b70a8f68a76ce69bb9cb4701e73f6de09881c34c35b848e8e1912",
        },
        "Hero_buzheng_beijing",
        "hero-formation-background.png",
    ),
    (
        {
            "file": "gui_common_raw_hero_qianghuadi_01_ce30ab6cbc6ff0edc3ca9eccb982aeca",
            "sha256": "69fd33cd0e49c771a5b35a1b1aa86bc5aca9e746068221ce95fdad0e01c7eaa0",
        },
        "Hero_qianghuadi_01",
        "hero-detail-panel.png",
    ),
)

WARRIOR_SPRITE_BUNDLE = {
    "file": "gui_tex_warrior_ad30d9aea6299507c8a1a054bf1fcc58",
    "sha256": "b0733e13d148e09588869658539298001ae59646730d3b608ed388b39482242f",
}

WARRIOR_SPRITES = {
    "Hero_diban": "hero-pedestal.png",
    "Hero_diban_gq": "hero-page-panel.png",
    "Hero_diban_gq01": "hero-formation-panel.png",
    "Hero_liebiao_di": "hero-list-panel.png",
    "Hero_liebiao_diT": "hero-list-panel-top.png",
    "Hero_zhandouzhong": "hero-active-ribbon.png",
    "Hero_zhiye_xuanzhong": "hero-role-selected.png",
    "Hero_zhiye_bq_fashi": "hero-role-label-mage.png",
    "Hero_zhiye_bq_yuancheng": "hero-role-label-ranger.png",
    "Hero_zhiye_bq_zhaohuan": "hero-role-label-summon.png",
    "Hero_zhiye_bq_duxi": "hero-role-label-poison.png",
    "Hero_xiangqingtitle": "hero-detail-title.png",
    "Hero_yingxiong_huawen": "hero-detail-ornament.png",
    "Hero_icon_dengji": "hero-stat-level.png",
    "Hero_icon_gongji": "hero-stat-attack.png",
    "Hero_icon_jiange": "hero-stat-interval.png",
    "Hero_skill_kuang": "hero-skill-frame.png",
    "Hero_skill_kuang_dazhao": "hero-skill-ultimate-frame.png",
    "Hero_skill_kuang_tianhu": "hero-skill-talent-frame.png",
    "Hero_touxiang_zhezhao": "hero-formation-selected.png",
    "Challenge_suo": "hero-lock.png",
    "Hero_shengji_di": "hero-upgrade-bar.png",
    "Hero_qianghuadi_title": "hero-milestone-title.png",
    "Hero_qianghuadi_02": "hero-milestone-row.png",
    "Hero_qianghuadi_03": "hero-upgrade-material.png",
    "Rune_text_gzjs": "hero-rune-title.png",
    "Hero_dazhao_title": "hero-ultimate-title.png",
}

SKILL_SPRITE_BUNDLE = {
    "file": "gui_common_tex_warriorskillicon_2527cc6ae35a5bd50bbe9ba21a02ba6f",
    "sha256": "a6f0aa0e7dd084d060beb85bdf7eb90efcc05ad73972a3335e551f7a9682b6ad",
}

SKILL_SPRITES = {
    "icon_skill_xiaozhiSkill1": "skill-summoner-1.png",
    "icon_skill_xiaozhiSkill2": "skill-summoner-2.png",
    "icon_skill_xiaozhiSkill3": "skill-summoner-3.png",
    "icon_skill_timoSkill1": "skill-clown-1.png",
    "icon_skill_timoSkill2": "skill-clown-2.png",
    "icon_skill_timoSkill3": "skill-clown-3.png",
    "icon_skill_jinkesi1": "skill-jinx-1.png",
    "icon_skill_jinkesi2": "skill-jinx-2.png",
    "icon_skill_jinkesi3": "skill-jinx-3.png",
    "icon_skill_shandianqiu1": "skill-lightning-1.png",
    "icon_skill_shandianqiu2": "skill-lightning-2.png",
    "icon_skill_shandianqiu3": "skill-lightning-3.png",
}

VOCATION_SPRITE_BUNDLE = {
    "file": "gui_common_tex_warriorvocation_b709e8d3f93b9845a472af8a10b6cfc6",
    "sha256": "49ae3bb897f846135add9021bda2a89930ad22d461bbae19f77d389bc678663a",
}

VOCATION_SPRITES = {
    "Common_zhiye_quan": "hero-role-all.png",
    "Common_zhiye_sheshou": "hero-role-ranger.png",
    "Common_zhiye_fashi": "hero-role-mage.png",
    "Common_zhiye_zhanshi": "hero-role-warrior.png",
    "Common_zhiye_zhaohuan": "hero-role-summon.png",
    "Common_zhiye_duxi": "hero-role-poison.png",
    "Common_zhiye_kongzhi": "hero-role-control.png",
    "Common_zhiye_fuzhu": "hero-role-support.png",
}

RESOURCE_SPRITE_BUNDLE = {
    "file": "gui_common_tex_iconitem_swleechdom_903608687112c2701e45f491e79600f9",
    "sha256": "68244398a266136135c3cf798c222327cdbc71c46b0852424166edd785748140",
}

RESOURCE_SPRITES = {
    "Icon_item_zuanshi": "hero-resource-crystal.png",
    "Icon_item_jinbi": "hero-resource-coin.png",
    "Icon_item_tili": "hero-resource-stamina.png",
}

COMMON_SPRITE_BUNDLE = {
    "file": "gui_common_tex_commonimg_424035c415f59d9562bc82c009d3edd2",
    "sha256": "3df7c22870005ad439ef2caf91e23575be69b7fb908bbd413308d7ea4b2c9c52",
}

COMMON_SPRITES = {
    "Common_huobi_di": "hero-resource-slot.png",
    "Common_jiahao": "hero-resource-add.png",
    "Hero_dengji_di": "hero-card-level.png",
    "Common_kapai_jingdu02": "hero-card-progress.png",
}

CARD_SPRITE_BUNDLE = {
    "file": "gui_common_tex_cardbg_987a417fc0f36079cfa8327d012a5065",
    "sha256": "b7628c54d4ee58071dd5a6e42b6ca52855ebe62dd271ef795d39b0c84613e31d",
}

CARD_SPRITES = {
    "Common_kapai_cheng": "hero-card-orange.png",
}

BUST_SPRITE_BUNDLE = {
    "file": "gui_common_tex_icon_bust_a2be0b233df195a88f52f6d37b21194d",
    "sha256": "e7ffac470441595f4bbdc0c629c89adbf9bdacd9940a8021ddb2a02fa0ed4e73",
}

BUST_SPRITES = {
    "lihui_hero_25_xiaozi": "lihui_hero_25_xiaozi.png",
    "lihui_hero_23_timo": "lihui_hero_23_timo.png",
    "lihui_hero_20_jinkesi": "lihui_hero_20_jinkesi.png",
    "lihui_hero_21_pikaqiu": "lihui_hero_21_pikaqiu.png",
}

SPRITE_BUNDLES = (
    (WARRIOR_SPRITE_BUNDLE, WARRIOR_SPRITES),
    (SKILL_SPRITE_BUNDLE, SKILL_SPRITES),
    (VOCATION_SPRITE_BUNDLE, VOCATION_SPRITES),
    (RESOURCE_SPRITE_BUNDLE, RESOURCE_SPRITES),
    (COMMON_SPRITE_BUNDLE, COMMON_SPRITES),
    (CARD_SPRITE_BUNDLE, CARD_SPRITES),
    (BUST_SPRITE_BUNDLE, BUST_SPRITES),
)


def export_texture(
    bundle_path: Path,
    object_name: str,
    output_path: Path,
) -> dict[str, Any]:
    import UnityPy

    environment = UnityPy.load(str(bundle_path))
    _, texture = find_named_object(environment, "Texture2D", object_name)
    texture.image.save(output_path)
    return {
        "sourceBundle": bundle_path.name,
        "sourceObject": object_name,
        "width": int(texture.m_Width),
        "height": int(texture.m_Height),
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
        default=repo_root / "public" / "assets" / "games" / "frontline" / "ui" / "heroes",
    )
    args = parser.parse_args()
    if not args.source_root:
        parser.error("--source-root or FRONTLINE_ASSET_ROOT is required")

    bundle_root = Path(args.source_root).expanduser().resolve() / "bundles"
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    files: list[dict[str, Any]] = []
    bundles: dict[str, dict[str, Any]] = {}

    for descriptor, object_name, output_name in RAW_TEXTURES:
        bundle_path = ensure_exact_bundle(bundle_root, descriptor)
        bundles[bundle_path.name] = {
            "file": bundle_path.name,
            "bytes": bundle_path.stat().st_size,
            "sha256": descriptor["sha256"],
        }
        output_path = output_root / output_name
        source = export_texture(bundle_path, object_name, output_path)
        files.append({**source, "file": output_file(output_path, output_root)})

    import UnityPy

    for descriptor, sprites in SPRITE_BUNDLES:
        sprite_bundle = ensure_exact_bundle(bundle_root, descriptor)
        bundles[sprite_bundle.name] = {
            "file": sprite_bundle.name,
            "bytes": sprite_bundle.stat().st_size,
            "sha256": descriptor["sha256"],
        }
        environment = UnityPy.load(str(sprite_bundle))
        for object_name, output_name in sprites.items():
            _, sprite = find_named_object(environment, "Sprite", object_name)
            output_path = output_root / output_name
            image = sprite.image
            image.save(output_path)
            files.append(
                {
                    "sourceBundle": sprite_bundle.name,
                    "sourceObject": object_name,
                    "width": image.width,
                    "height": image.height,
                    "file": output_file(output_path, output_root),
                }
            )

    manifest_path = output_root / "source-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "sourceVersion": SOURCE_VERSION,
                "bundles": list(bundles.values()),
                "files": files,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"Extracted hero UI assets to {output_root}")


if __name__ == "__main__":
    main()
