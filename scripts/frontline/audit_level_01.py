#!/usr/bin/env python3
"""Extract and audit the fixed reference assets used by Frontline level 1-1."""

from __future__ import annotations

import argparse
from collections import Counter
import csv
import hashlib
from io import StringIO
import json
import os
from pathlib import Path
import re
import struct
from typing import Any

import UnityPy

from extract_assets import (
    SOURCE_VERSION,
    SPINE_RUNTIME_VERSION,
    UNITY_VERSION,
    ensure_exact_bundle,
    export_spine_actor,
    find_named_object,
    output_file,
    read_objects,
    sha256,
    text_asset_bytes,
)
from rkt_formats import decode_dbc, read_recoverable_rkt_entry


LEVEL_ID = "desert-1"
SOURCE_LEVEL_ID = 100101
LOGICAL_WIDTH = 900
LOGICAL_HEIGHT = 1600
ORTHOGRAPHIC_SIZE = 8.0
PIXELS_PER_WORLD_UNIT = LOGICAL_HEIGHT / (ORTHOGRAPHIC_SIZE * 2)
BOOT_RKT_SHA256 = "e57d37860136a649a521f007c2ec1d1f28e656013dc035a082a9abfc133d1688"

BUNDLES = {
    "level": {
        "file": "firstlv_6566684a9d702f3f858b5d06a932f6ef",
        "sha256": "84b219faad69326b074e44ebf557d8172d3421e90b39f551d9a80e18f8c6db09",
    },
    "map": {
        "file": "map_bg_01_01_0ca484b9fa2aca65583bc497497ad86b",
        "sha256": "f591949db37cc75dab1b1a6fdbf40efd40ec2f7670c49a9bd5a151b4e21a7b91",
    },
    "mapSprites": {
        "file": "map_sprite_5bde9e378cf440be6bfac5cfe3abed49",
        "sha256": "20f87a86273d730a1acb622f681420594e1b3b1119f57acda0b8e28d69230983",
    },
    "monsterJiachong": {
        "file": "char_monster_01_jiachong_eb6889266afecfac3f012cdc193ee3bd",
        "sha256": "98377ac1feca79b71282847a9eac4fd38a866b35a143fae0417303fb9257c696",
    },
    "monsterXiyi": {
        "file": "char_monster_01_xiyi_456d6772844976e47545a4d7fc110d56",
        "sha256": "2b179728b8ffff220b7090daeba7c678585852304482e7f2bbcb27636dc31b0f",
    },
    "monsterZongquan": {
        "file": "char_monster_01_zongquan_58c3c2c43f9548700d6a329d2f6fcd2a",
        "sha256": "5a893a72794bd9b902f82d80ef3db3df76e649f5c97e23333a8013f5d5aba595",
    },
    "fightUi": {
        "file": "gui_fight_d913352ead4336b6b4e34cbb023b66ad",
        "sha256": "17f34f8f4b5a520340a3839cb789bd857e7ee8fa4b9c65ac8b217da4bc69dbfa",
    },
    "fightUiTextures": {
        "file": "gui_tex_fight_d1a8ba972cd7aeab5ddf8c8aab1dda61",
        "sha256": "cfe52964990f3c2dbba943d092e3bbe9f0964c3411f3b830a6f44b46e26d06b3",
    },
    "heroJinx": {
        "file": "char_hero_20_jinkesi_2c5f8ce8280086fac9e42c2ff9c3802f",
        "sha256": "e12058882326fd5209b495ba8f52e67e59d379f4d6b3127e0d7dab8a3e510b71",
    },
    "heroLightning": {
        "file": "char_hero_21_pikaqiu_9b9b8fd4cc2ca2ffc280d41598ee5b6e",
        "sha256": "2d62b0e63d732a677398faaa7d623baee2b3fafb19d15f318e295933667cf1c6",
    },
    "heroClown": {
        "file": "char_hero_23_baji_fc2526e17298e4bbb6e361da0c75a2b5",
        "sha256": "74bf9a2197f7cd2dd13b84a30428aeadd2cd7677828a307547aba7c73cb1ad2f",
    },
    "heroSummoner": {
        "file": "char_hero_25_xiaozhi_f359208d0c91fdfb66ec629dc5333117",
        "sha256": "12e7348ac673ee69e6ffbbc097c15444897688399c56e84ddd123bb77eb278af",
    },
    "lordSandKing": {
        "file": "char_player_lingzhu_01_shawang_642442ff3e8844a691e98bd6da7b94cd",
        "sha256": "422b04e4976f5c82253995d12adc4e701ba753fae2c22ecd7e5942040acaaf77",
    },
    "fxJinx": {
        "file": "fx_heros_jinkesi_1b56cf83ddfd9d492bd726f437c419f9",
        "sha256": "5dae9e6f45bb2e3f7c185b3f40e558beceabb835bc7ba36e6b07cdc1078e3ab0",
    },
    "fxLightning": {
        "file": "fx_heros_shandianqiu_eba63a02041be39d16eb3c7d86092f3f",
        "sha256": "3fa83e1e2f627abdb9615f5bbcb04816db173e2afe87947aaeae9014c3ec07ac",
    },
    "fxClown": {
        "file": "fx_heros_timo_dc7189aedbc9e1c88ed4102e55d74c55",
        "sha256": "137d535cdcfea86d5926e2f693511fa0d331fd18b0ad324d123b096d5ac3334c",
    },
    "fxSummon": {
        "file": "fx_heros_xiaozhiguai_4050e8c9f089d54cc640dd4e5e33931c",
        "sha256": "22a19218e68dc118f2f1fb2e49e816d58a962f136125db723fb94438568b6a2f",
    },
    "summonMinion": {
        "file": "char_zhaohuan_xiaozhiguai01_63d009a0028072e0d6caed47c3fcfcb2",
        "sha256": "e2ce2a07ebf4b9dd81fe611c3692ca6e1411dfaa5f95dc8ded8220f87b602cf7",
    },
    "fxLordSandKing": {
        "file": "fx_player_shawang_63649f6f7c2d890d2affcd29ec728b38",
        "sha256": "4cf00500764b17c02716f6dd44b3eb440359283d71bd90b0eed3d58f3ca4c9ee",
    },
}

HEROES = [
    ("hero-summoner", "hero_25_xiaozhi", "精灵大师", "heroSummoner"),
    ("hero-clown", "hero_23_baji", "小丑皇", "heroClown"),
    ("hero-jinx", "hero_20_jinkesi", "暴走萌弹", "heroJinx"),
    ("hero-lightning", "hero_21_pikaqiu", "闪电丘", "heroLightning"),
]
LORD = ("lord-sand-king", "lingzhu_01_shawang", "沙王", "lordSandKing")
SUMMONS = [
    ("summon-little-ghost", "zhaohuan_xiaozhiguai01", "小笑笑鬼", "summonMinion"),
]
ENEMIES = [
    ("monster-01-jiachong", "monster_01_jiachong", "沙甲虫", "monsterJiachong"),
    ("monster-01-xiyi", "monster_01_xiyi", "沙漠蜥蜴", "monsterXiyi"),
    ("monster-01-zongquan", "monster_01_zongquan", "野狗", "monsterZongquan"),
]
MAP_SPRITES = [
    ("map_00_dizuo_1", "deployable"),
    ("map_00_dizuo_2", "locked"),
    ("map_00_dizuo_3", "occupied-variant"),
    ("Fight_juese_xuanzhong", "selection-ring"),
    ("Fight_juese_xuanzhong_lv", "selection-ring-green"),
    ("Fight_jiantou", "placement-arrow"),
]
FIGHT_UI_OBJECTS = [
    "BtnPause",
    "SpeedUp",
    "SpeedImg",
    "BtnStatistic",
    "WaveInfo",
    "WaveText",
    "NextWaveProgress",
    "StarTimeParent",
    "StarTimeText",
    "BtnSkill",
    "SkillIcon",
    "Boss",
    "BossHead",
]
FIGHT_UI_SPRITES = [
    "Fight_zanting_fgx",
    "Fight_zanting_zhezhao",
    "Fight_zhandou_gongneng_01",
    "Fight_zhandou_gongneng_02",
    "Fight_zhandou_gongneng_03",
    "Fight_icon_gn_qianghua",
    "Fight_icon_gn_zhaohuan",
    "Fight_boci_di",
    "Fight_icon_xing",
    "Fight_icon_boss_xuetiao",
]


def decode_text_csv(raw: bytes) -> list[dict[str, str]]:
    reader = csv.DictReader(StringIO(raw.decode("utf-8-sig")))
    next(reader)
    return list(reader)


def export_wave_config(
    source_root: Path,
    level_root: Path,
    output_root: Path,
) -> dict[str, Any]:
    boot_path = source_root / f"Boot_{SOURCE_VERSION}.zip"
    if not boot_path.is_file():
        raise FileNotFoundError(f"Missing fixed-version Boot RKT: {boot_path}")
    if sha256(boot_path) != BOOT_RKT_SHA256:
        raise RuntimeError(f"Unexpected fixed-version Boot RKT hash: {boot_path}")

    boot_raw = boot_path.read_bytes()
    csv_rkt = read_recoverable_rkt_entry(boot_raw, "BinaryAssets/CSV.zip")
    dbc_table_names = (
        "EctypeWave.csv",
        "ectype_spawn_monster_info_c.csv",
        "Monster.csv",
        "MonsterLevelProp_C.csv",
        "ConfigResource.csv",
        "Skill.csv",
        "Buff.csv",
        "Effect.csv",
    )
    text_table_names = (
        "ectype_misc_info_c.csv",
        "hero_c.csv",
        "HeroPropBase.csv",
        "PetSkill.csv",
        "Freeze.csv",
        "Soldier.csv",
        "hero_step_c.csv",
    )
    table_names = (*dbc_table_names, *text_table_names)
    table_bytes = {
        name: read_recoverable_rkt_entry(csv_rkt, name)
        for name in table_names
    }
    tables = {
        **{
            name: decode_dbc(table_bytes[name])
            for name in dbc_table_names
        },
        **{
            name: decode_text_csv(table_bytes[name])
            for name in text_table_names
        },
    }

    wave_rows = [
        row
        for row in tables["EctypeWave.csv"]
        if row["nEctypeSID"] == SOURCE_LEVEL_ID
    ]
    spawn_rows = [
        row
        for row in tables["ectype_spawn_monster_info_c.csv"]
        if row["nEctypeID"] == SOURCE_LEVEL_ID
    ]
    if [row["nWave"] for row in wave_rows] != list(range(1, 7)):
        raise RuntimeError("First-level DBC does not contain waves 1 through 6")
    if len(spawn_rows) != 18:
        raise RuntimeError(
            f"Expected 18 first-level spawn rows, got {len(spawn_rows)}"
        )

    monster_ids = sorted({row["monsterId"] for row in spawn_rows})
    monsters_by_id = {
        row["lMonsterID"]: row
        for row in tables["Monster.csv"]
        if row["lMonsterID"] in monster_ids
    }
    if sorted(monsters_by_id) != monster_ids:
        raise RuntimeError("First-level monster metadata is incomplete")
    monster_resource_ids = {
        monster["lResID"]
        for monster in monsters_by_id.values()
    }
    resources_by_id = {
        row["nResID"]: row
        for row in tables["ConfigResource.csv"]
        if row["nResID"] in monster_resource_ids
    }
    if sorted(resources_by_id) != sorted(monster_resource_ids):
        raise RuntimeError("First-level monster model resources are incomplete")

    monster_levels_by_id = {
        (row["lMonsterID"], row["lLevel"]): row
        for row in tables["MonsterLevelProp_C.csv"]
        if row["lMonsterID"] in monster_ids
    }
    ectype_misc = next(
        row
        for row in tables["ectype_misc_info_c.csv"]
        if int(row["nEctypeSID(key)"]) == SOURCE_LEVEL_ID
    )
    economy = {
        "initialCoins": 100,
        "baseHp": int(ectype_misc["nEctypeHealth"]),
        "summonCosts": [
            int(value)
            for value in ectype_misc["tCallCostList(list;int)"].split(";")
        ],
        "strengthenCosts": [
            int(value)
            for value in ectype_misc["tStrengthCostList(list;int)"].split(";")
        ],
        "strengthenUnlockSummons": 5,
    }

    waves = []
    for wave_row in wave_rows:
        wave = wave_row["nWave"]
        monster_prop_ratios = wave_row["monsterPropRatios"]
        if not isinstance(monster_prop_ratios, list) or len(monster_prop_ratios) % 2:
            raise RuntimeError(f"Invalid monster property ratios for wave {wave}")
        ratios_by_property = dict(zip(
            monster_prop_ratios[::2],
            monster_prop_ratios[1::2],
            strict=True,
        ))
        hp_ratio = ratios_by_property[2]
        groups = []
        for row in spawn_rows:
            if row["nWave"] != wave:
                continue
            monster = monsters_by_id[row["monsterId"]]
            monster_level = monster_levels_by_id.get(
                (row["monsterId"], row["monsterLevel"])
            )
            if monster_level is None:
                raise RuntimeError(
                    f"Missing level {row['monsterLevel']} properties "
                    f"for monster {row['monsterId']}"
                )
            base_hp = monster_level["lHP"]
            resource = resources_by_id[monster["lResID"]]
            groups.append(
                {
                    "id": row["id"],
                    "spawnPointId": row["nSpawnPointId"],
                    "subKey": row["nSubKey"],
                    "waitTimeMs": row["waitTime"],
                    "intervalMs": row["interval"],
                    "durationMs": row["duration"],
                    "count": row["monsterCount"],
                    "coin": row["coin"],
                    "experience": row["lExp"],
                    "pathOffsetType": row["pathOffsetType"],
                    "monsterLevel": row["monsterLevel"],
                    "monster": {
                        "id": row["monsterId"],
                        "name": monster["szName"],
                        "resourceId": monster["lResID"],
                        "modelRadius": round(resource["fModelRadius"], 6),
                        "moveSpeed": monster["lMoveSpeed"],
                        "hpSegments": monster["lHP_Count"],
                        "baseHp": base_hp,
                        "hpRatio": hp_ratio / 10000,
                        "hp": base_hp * hp_ratio / 10000,
                        "crystalDamage": monster["nEctypeHealthDamage"],
                    },
                }
            )
        waves.append(
            {
                "wave": wave,
                "totalWaves": wave_row["nSumWave"],
                "waitTimeMs": wave_row["nWaitTime"],
                "leftMonsterNextWave": wave_row["nLeftMonsterNextWave"],
                "violentLeftMonsterNextWave": wave_row[
                    "nViolentLeftMonsterNextWave"
                ],
                "notWaitWaveAllSpawn": bool(wave_row["bNotWaitWaveAllSpawn"]),
                "bossEffect": int(wave_row["bIsBoosEffect"]),
                "monsterPropRatios": monster_prop_ratios,
                "monsterHpRatio": hp_ratio / 10000,
                "totalMonsterCount": sum(group["count"] for group in groups),
                "spawnGroups": groups,
            }
        )

    base_prop = next(
        row
        for row in tables["HeroPropBase.csv"]
        if row["nTier(key)"] == "1"
    )
    base_attack = next(
        int(base_prop[f"nValue{index}"])
        for index in range(1, 9)
        if base_prop[f"nPropID{index}"] == "1"
    )
    hero_specs = (
        (30004, "hero-summoner", 1739, None),
        (30005, "hero-clown", 1819, 0.166667),
        (30002, "hero-jinx", 1819, 0.033333),
        (30001, "hero-lightning", 2060, 0.233333),
    )
    heroes = []
    for source_id, actor_id, reference_attack, hit_time in hero_specs:
        hero = next(
            row
            for row in tables["hero_c.csv"]
            if int(row["heroID(key)"]) == source_id
        )
        pet_skill = next(
            row
            for row in tables["PetSkill.csv"]
            if row["nID(key)"] == hero["nNormalSkillID"]
            and row["SkillLevel(key)"] == hero["nNormalSkillLV"]
        )
        skill_id = int(pet_skill["Param11"])
        skill = next(
            row
            for row in tables["Skill.csv"]
            if row["SkillID"] == skill_id and row["SkillSubID"] == 1
        )
        freeze = next(
            row
            for row in tables["Freeze.csv"]
            if int(row["FreezeID(key)"]) == skill["CoolDown"]
        )
        heroes.append(
            {
                "id": actor_id,
                "sourceId": source_id,
                "name": hero["szName"],
                "normalSkillId": skill_id,
                "baseAttack": reference_attack,
                "damageCoefficient": skill["DamageCoefficient"],
                "cooldownMs": int(freeze["Time"]),
                "rangeValue": skill["RangeValue"],
                "animation": "attack_1",
                "hitTimeSeconds": hit_time,
            }
        )

    summoner_hero = next(
        row for row in tables["hero_c.csv"]
        if int(row["heroID(key)"]) == 30004
    )
    summoner_skill = next(
        row for row in tables["Skill.csv"]
        if row["SkillID"] == 2100 and row["SkillSubID"] == 1
    )
    summon_buff_id = summoner_skill["SelfChanceBuff"][2]
    summon_buff = next(
        row for row in tables["Buff.csv"]
        if row["dwBuffID"] == summon_buff_id
    )
    summon_effect = next(
        row for row in tables["Effect.csv"]
        if row["nEffectID"] == summon_buff["listEffect"][0]
    )
    summon_params = [int(value) for value in summon_effect["listParam"]]
    if summon_params != [52001, 1, 1, 1, 0]:
        raise RuntimeError(f"Unexpected summoner effect parameters: {summon_params}")
    summon_soldier = next(
        row for row in tables["Soldier.csv"]
        if int(row["lSoldierID(key)"]) == summon_params[0]
    )
    summon_skill = next(
        row for row in tables["Skill.csv"]
        if row["SkillID"] == int(summon_soldier["nNormalSkillID"])
        and row["SkillSubID"] == 1
    )
    summon_freeze = next(
        row for row in tables["Freeze.csv"]
        if int(row["FreezeID(key)"])
        == int(summon_soldier["FreezeID(list;int)"].split(";")[0])
    )
    summon_resource = next(
        row for row in tables["ConfigResource.csv"]
        if row["nResID"] == int(summon_soldier["lResID"])
    )
    summon_step = next(
        row for row in tables["hero_step_c.csv"]
        if row["nVocation(key)"] == summoner_hero["nVocation"]
        and row["nStep(key)"] == "1"
    )
    summon_profile = {
        "ownerSourceId": 30004,
        "skillId": 2100,
        "skillNeedsTarget": bool(summoner_skill["NeedSkillTarget"]),
        "selfChanceBuff": summoner_skill["SelfChanceBuff"],
        "buffId": summon_buff_id,
        "effectId": summon_effect["nEffectID"],
        "effectParameters": summon_params,
        "soldierId": summon_params[0],
        "resourceId": int(summon_soldier["lResID"]),
        "maxCount": int(summoner_hero["nSummonMax"]),
        "moveSpeed": int(summon_soldier["lMoveSpeed"]),
        "modelRadius": round(summon_resource["fModelRadius"], 6),
        "attackDistance": int(summon_soldier["nAttackDistance"]),
        "seekDistance": float(summon_soldier["SeekDistance"]),
        "baseAttack": int(summon_soldier["lCUR_A(list;int)"].split(";")[0]),
        "attackInheritance": "caller-entity-attack",
        "stepOneCallAttackRatio": int(summon_step["sCallAttackRatio"]),
        "normalSkillId": summon_skill["SkillID"],
        "cooldownMs": int(summon_freeze["Time"]),
        "damageCoefficient": summon_skill["DamageCoefficient"],
        "effectRange": summon_skill["RangeValue"],
        "maxTargets": summon_skill["MaxTargets"],
        "lifeTimeSeconds": float(summon_soldier["nLifeTime"]),
        "ownerRemovalDelayMs": int(summon_soldier["nDelayDeadTime"]),
        "bornBuffs": [
            int(value)
            for value in summon_soldier["BornBuff(list;int)"].split(";")
            if value
        ],
        "spawnPointRule": "nearest-origin-road-point-within-owner-range",
    }

    decoded = {
        "sourceVersion": SOURCE_VERSION,
        "sourceContainer": {
            "file": boot_path.name,
            "sha256": BOOT_RKT_SHA256,
            "nestedEntry": "BinaryAssets/CSV.zip",
            "nestedSha256": hashlib.sha256(csv_rkt).hexdigest(),
            "tables": [
                {
                    "name": name,
                    "sha256": hashlib.sha256(table_bytes[name]).hexdigest(),
                }
                for name in table_names
            ],
        },
        "rktFormat": {
            "magic": "rkt\\0",
            "headerBytes": 8,
            "privatePrefixBytes": 8,
            "encryptedPrefixBytes": 16384,
            "tailOffsetBytes": 16392,
            "tailTransform": "xor-repeat",
            "tailXorKeyHex": "8a7ba4d2",
        },
        "dbcFormat": {
            "magic": "DBC\\n1000",
            "headerBytes": 108,
            "rowLayout": "fixed-width",
            "dictionaryValues": "indexed",
            "int64Values": "indexed",
            "listValues": "typed-variable-width-sequences",
            "stringLengths": "7-bit-encoded",
        },
        "economy": economy,
        "lord": {
            "id": "lord-sand-king",
            "sourceId": 1,
            "name": "沙王",
            "referencePower": 1178,
            "cooldownMs": 2000,
            "rangeValue": 4,
            "animation": "attack_1",
            "hitTimeSeconds": None,
        },
        "heroes": heroes,
        "summons": [summon_profile],
        "waves": waves,
    }
    path = level_root / "wave-config.json"
    path.write_text(
        json.dumps(decoded, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {**decoded, "file": output_file(path, output_root)}


def vector2(value: dict[str, Any]) -> dict[str, float]:
    return {"x": float(value["x"]), "y": float(value["y"])}


def logical_point(value: dict[str, Any]) -> dict[str, float]:
    return {
        "x": round(LOGICAL_WIDTH / 2 + float(value["x"]) * PIXELS_PER_WORLD_UNIT, 3),
        "y": round(LOGICAL_HEIGHT / 2 - float(value["y"]) * PIXELS_PER_WORLD_UNIT, 3),
    }


def sprite_metadata(tree: dict[str, Any]) -> dict[str, Any]:
    rect = tree["m_Rect"]
    pivot = tree["m_Pivot"]
    border = tree["m_Border"]
    return {
        "rect": {
            "x": float(rect["x"]),
            "y": float(rect["y"]),
            "width": float(rect["width"]),
            "height": float(rect["height"]),
        },
        "pivot": vector2(pivot),
        "border": {
            "left": float(border["x"]),
            "bottom": float(border["y"]),
            "right": float(border["z"]),
            "top": float(border["w"]),
        },
        "pixelsPerUnit": float(tree["m_PixelsToUnits"]),
    }


def object_counts(environment: Any) -> dict[str, int]:
    counts = Counter(obj.type.name for obj in environment.objects)
    return dict(sorted(counts.items()))


def bundle_record(
    key: str,
    path: Path,
    environment: Any,
    evidence: str,
) -> dict[str, Any]:
    return {
        "id": key,
        "file": path.name,
        "bytes": path.stat().st_size,
        "sha256": BUNDLES[key]["sha256"],
        "evidence": evidence,
        "objectTypes": object_counts(environment),
    }


def export_level_config(
    level_environment: Any,
    level_root: Path,
    output_root: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    _, asset = find_named_object(level_environment, "TextAsset", str(SOURCE_LEVEL_ID))
    raw = text_asset_bytes(asset.m_Script)
    config = json.loads(raw)
    config_path = level_root / "source-100101.json"
    config_path.write_bytes(raw)

    paths = []
    for index, points in enumerate(config["pathList"]):
        if not points:
            continue
        paths.append(
            {
                "index": index,
                "points": [
                    {
                        "world": vector2(point),
                        "logical": logical_point(point),
                    }
                    for point in points
                ],
            }
        )

    tower_positions = []
    for index, tower in enumerate(config["towerPosList"]):
        world = vector2(tower)
        tower_positions.append(
            {
                "index": index,
                "towerType": int(tower["towerType"]),
                "state": "locked" if int(tower["towerType"]) == 1 else "deployable",
                "priority": int(tower["priority"]),
                "world": world,
                "logical": logical_point(world),
            }
        )

    hero_position = vector2(config["heroPos"])
    crystal_position = vector2(config["diamondPointList"][0])
    scene = {
        "sourceConfig": output_file(config_path, output_root),
        "sourceBackgroundPath": config["szBgPath"],
        "mapType": int(config["mapType"]),
        "camera": {
            "orthographicSize": float(config["orthographicSize"]),
            "worldBounds": {
                "left": -LOGICAL_WIDTH / 2 / PIXELS_PER_WORLD_UNIT,
                "right": LOGICAL_WIDTH / 2 / PIXELS_PER_WORLD_UNIT,
                "bottom": -float(config["orthographicSize"]),
                "top": float(config["orthographicSize"]),
            },
        },
        "projection": {
            "logicalWidth": LOGICAL_WIDTH,
            "logicalHeight": LOGICAL_HEIGHT,
            "pixelsPerWorldUnit": PIXELS_PER_WORLD_UNIT,
            "logicalOrigin": {"x": LOGICAL_WIDTH / 2, "y": LOGICAL_HEIGHT / 2},
            "worldYAxis": "up",
            "logicalYAxis": "down",
        },
        "paths": paths,
        "spawnTips": [
            {
                "world": vector2(point),
                "logical": logical_point(point),
            }
            for point in config["spawnTipsList"]
            if point["x"] != 0 or point["y"] != 0
        ],
        "towerPositions": tower_positions,
        "playerSlot": {
            "binding": "runtime-player-loadout",
            "world": hero_position,
            "logical": logical_point(hero_position),
        },
        "crystal": {
            "world": crystal_position,
            "logical": logical_point(crystal_position),
        },
        "grid": {
            "cellCount": len(config["cellData"]),
            "nonZeroCellCount": sum(value != 0 for value in config["cellData"]),
        },
    }
    return scene, config


def export_map(
    environment: Any,
    output_root: Path,
) -> dict[str, Any]:
    _, texture = find_named_object(environment, "Texture2D", "map_01_01")
    sprite_object, _ = find_named_object(environment, "Sprite", "map_01_01")
    path = output_root / "maps" / f"{LEVEL_ID}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    texture.image.save(path)
    return {
        "sourceObject": "map_01_01",
        "width": int(texture.m_Width),
        "height": int(texture.m_Height),
        **sprite_metadata(sprite_object.read_typetree()),
        "file": output_file(path, output_root),
    }


def export_map_sprites(
    environment: Any,
    output_root: Path,
) -> list[dict[str, Any]]:
    sprite_root = output_root / "sprites" / "map-common"
    sprite_root.mkdir(parents=True, exist_ok=True)
    result = []
    for name, purpose in MAP_SPRITES:
        sprite_object, sprite = find_named_object(environment, "Sprite", name)
        path = sprite_root / f"{name}.png"
        image = sprite.image
        image.save(path)
        result.append(
            {
                "name": name,
                "purpose": purpose,
                "exportedSize": {
                    "width": image.width,
                    "height": image.height,
                },
                **sprite_metadata(sprite_object.read_typetree()),
                "file": output_file(path, output_root),
            }
        )
    return result


def export_audio(
    level_environment: Any,
    output_root: Path,
) -> dict[str, Any]:
    _, clip = find_named_object(level_environment, "AudioClip", "MainBgm_desert")
    samples = clip.samples
    if set(samples) != {"MainBgm_desert.m4a"}:
        raise RuntimeError(f"Unexpected MainBgm_desert samples: {sorted(samples)}")
    path = output_root / "audio" / "main-bgm-desert.m4a"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(samples["MainBgm_desert.m4a"])
    return {
        "sourceObject": "MainBgm_desert",
        "durationSeconds": float(clip.m_Length),
        "frequency": int(clip.m_Frequency),
        "channels": int(clip.m_Channels),
        "file": output_file(path, output_root),
    }


def export_combat_event_data(
    environments: dict[str, Any],
    level_root: Path,
    output_root: Path,
) -> list[dict[str, Any]]:
    result = []
    for bundle_key, name, owner in (
        ("heroSummoner", "Heros_xiaozhi", "hero-summoner"),
        ("heroClown", "hero_baji", "hero-clown"),
        ("heroJinx", "Heros_jinkesi", "hero-jinx"),
        ("heroLightning", "hero_pikaqiu", "hero-lightning"),
        ("lordSandKing", "Lingzhu_shawang", "lord-sand-king"),
        ("summonMinion", "Heros_xiaogenggui", "summon-little-ghost"),
    ):
        _, asset = find_named_object(
            environments[bundle_key],
            "TextAsset",
            name,
        )
        raw = text_asset_bytes(asset.m_Script)
        path = level_root / "combat-events" / f"{name}.bytes"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        records = parse_combat_event_records(raw)
        references = sorted(
            {
                match.decode("utf-8")
                for match in re.findall(rb"Assets/[A-Za-z0-9_./-]+", raw)
            }
        )
        result.append(
            {
                "owner": owner,
                "sourceObject": name,
                "assetReferences": references,
                "formatVersion": int.from_bytes(raw[:4], "little"),
                "nominalFrameRate": 30,
                "records": records,
                "file": output_file(path, output_root),
            }
        )
    return result


def parse_combat_event_records(raw: bytes) -> list[dict[str, Any]]:
    if len(raw) < 4:
        raise RuntimeError("Combat event data is missing its version header")

    offset = 4
    records = []
    while offset < len(raw):
        if offset + 6 > len(raw):
            raise RuntimeError(f"Truncated combat event record at offset {offset}")
        variant_id, name_length = struct.unpack_from("<IH", raw, offset)
        offset += 6
        animation_end = offset + name_length
        if animation_end + 22 > len(raw):
            raise RuntimeError(f"Invalid combat event name length at offset {offset}")
        animation = raw[offset:animation_end].decode("utf-8")
        offset = animation_end
        (
            trigger_frame,
            event_source_type,
            event_type,
            sound_id,
        ) = struct.unpack_from("<IIII", raw, offset)
        offset += 16
        payload_length = struct.unpack_from("<H", raw, offset)[0]
        offset += 2
        payload_end = offset + payload_length
        if payload_end + 4 > len(raw):
            raise RuntimeError(f"Invalid combat event payload length at offset {offset}")
        payload = raw[offset:payload_end].decode("utf-8")
        offset = payload_end
        record_terminator = struct.unpack_from("<I", raw, offset)[0]
        offset += 4
        if record_terminator != 15:
            raise RuntimeError(
                f"Unexpected combat event terminator {record_terminator} "
                f"after {animation}"
            )

        parameters = {}
        for entry in payload.split(";"):
            if not entry:
                continue
            key, separator, value = entry.partition("=")
            if not separator:
                raise RuntimeError(
                    f"Invalid combat event parameter {entry!r} in {animation}"
                )
            parameters[key] = value

        records.append(
            {
                "variantId": variant_id,
                "animation": animation,
                "triggerFrame": trigger_frame,
                "triggerTimeSeconds": round(trigger_frame / 30, 6),
                "eventSourceType": event_source_type,
                "eventType": event_type,
                "soundId": sound_id,
                "parameters": parameters,
            }
        )

    return records


def game_object_mono_behaviour(
    environment: Any,
    game_object_name: str,
    script_name: str,
) -> dict[str, Any]:
    objects = {obj.path_id: obj for obj in environment.objects}
    _, game_object = find_named_object(environment, "GameObject", game_object_name)
    for pair in game_object.m_Component:
        pointer = getattr(pair, "component", getattr(pair, "m_Component", None))
        component = objects.get(getattr(pointer, "path_id", 0))
        if component is None or component.type.name != "MonoBehaviour":
            continue
        tree = component.read_typetree()
        script_pointer = tree.get("m_Script", {})
        script = objects.get(int(script_pointer.get("m_PathID", 0)))
        if script is not None and getattr(script.read(), "m_Name", "") == script_name:
            return tree
    raise RuntimeError(
        f"Missing {script_name} on GameObject {game_object_name}"
    )


def export_attack_evidence(
    environments: dict[str, Any],
    summon_profile: dict[str, Any],
) -> dict[str, Any]:
    jinx_emitter = game_object_mono_behaviour(
        environments["fxJinx"],
        "Emiter_eff_heros_jinkesi_attack_zd_1",
        "EmiteBase",
    )
    jinx_projectile = game_object_mono_behaviour(
        environments["fxJinx"],
        "eff_heros_jinkesi_attack_zd_1",
        "SDEffectBullet2DTracker",
    )
    jinx_collision = game_object_mono_behaviour(
        environments["fxJinx"],
        "eff_heros_jinkesi_attack_zd_1",
        "SDEffectEntityCollision",
    )
    lightning_emitter = game_object_mono_behaviour(
        environments["fxLightning"],
        "Emiter_hero_shandianqiu_zidan1",
        "EmiteBase",
    )
    lightning_projectile = game_object_mono_behaviour(
        environments["fxLightning"],
        "eff_hero_shandianqiu_zidan1",
        "SDThunderChainTracker",
    )
    lightning_collision = game_object_mono_behaviour(
        environments["fxLightning"],
        "eff_hero_shandianqiu_zidan1",
        "SDEffectEntityCollision",
    )
    clown_emitter = game_object_mono_behaviour(
        environments["fxClown"],
        "Emiter_hero_eject_timo_zidan1",
        "EmiterFlySward",
    )
    clown_projectile = game_object_mono_behaviour(
        environments["fxClown"],
        "eff_hero_timo_zidan1",
        "SDEffectBullet2DTracker",
    )
    clown_collision = game_object_mono_behaviour(
        environments["fxClown"],
        "eff_hero_timo_zidan1",
        "SDEffectEntityCollision",
    )

    return {
        "distanceRule": {
            "source": "Client/SkillClient/Statement.lua",
            "targetingDistanceUnits": "thousandths-of-world-unit",
            "effectiveCenterDistance": "targeting-distance-plus-target-model-radius",
            "includesCasterRadius": False,
        },
        "units": [
            {
                "owner": "hero-lightning",
                "kind": "projectile",
                "targetingDistance": 2800,
                "sourceBundles": ["fxLightning"],
                "emitter": {
                    "name": "Emiter_hero_shandianqiu_zidan1",
                    "trackerPath": lightning_emitter["TrackerPath"],
                    "waveCount": int(lightning_emitter["Wave"]),
                    "bulletsPerWave": int(lightning_emitter["BulletPerWave"]),
                    "intervalMs": float(lightning_emitter["EmitInterval"]),
                },
                "projectile": {
                    "name": "eff_hero_shandianqiu_zidan1",
                    "tracker": "SDThunderChainTracker",
                    "prefabInitSpeed": float(lightning_projectile["InitSpeed"]),
                    "prefabMaxFlyDistance": float(lightning_projectile["MaxFlyDistance"]),
                    "prefabDurationMs": float(lightning_projectile["Duration"]),
                    "prefabLockTarget": bool(lightning_projectile["LockTarget"]),
                    "eventInitSpeed": 10.0,
                    "eventMaxFlyDistance": 90.0,
                    "eventMaxFlyTimeMs": 3000.0,
                    "eventLockTarget": False,
                    "collisionMaxCount": int(lightning_collision["CollisionMaxNum"]),
                    "hitEffectPath": lightning_projectile["HitEffectPath"],
                },
            },
            {
                "owner": "hero-jinx",
                "kind": "projectile",
                "targetingDistance": 3400,
                "sourceBundles": ["fxJinx"],
                "emitter": {
                    "name": "Emiter_eff_heros_jinkesi_attack_zd_1",
                    "trackerPath": jinx_emitter["TrackerPath"],
                    "waveCount": int(jinx_emitter["Wave"]),
                    "bulletsPerWave": int(jinx_emitter["BulletPerWave"]),
                    "intervalMs": float(jinx_emitter["EmitInterval"]),
                },
                "projectile": {
                    "name": "eff_heros_jinkesi_attack_zd_1",
                    "tracker": "SDEffectBullet2DTracker",
                    "prefabInitSpeed": float(jinx_projectile["InitSpeed"]),
                    "prefabMaxFlyDistance": float(jinx_projectile["MaxFlyDistance"]),
                    "prefabDurationMs": float(jinx_projectile["Duration"]),
                    "prefabLockTarget": bool(jinx_projectile["LockTarget"]),
                    "eventInitSpeed": None,
                    "eventMaxFlyDistance": None,
                    "eventMaxFlyTimeMs": None,
                    "eventLockTarget": None,
                    "collisionMaxCount": int(jinx_collision["CollisionMaxNum"]),
                    "hitEffectPath": jinx_projectile["HitEffectPath"],
                },
            },
            {
                "owner": "hero-clown",
                "kind": "projectile-then-area-effect",
                "targetingDistance": 3200,
                "sourceBundles": ["fxClown"],
                "emitter": {
                    "name": "Emiter_hero_eject_timo_zidan1",
                    "trackerPath": clown_emitter["TrackerPath"],
                    "waveCount": int(clown_emitter["Wave"]),
                    "bulletsPerWave": int(clown_emitter["BulletPerWave"]),
                    "intervalMs": float(clown_emitter["EmitInterval"]),
                },
                "projectile": {
                    "name": "eff_hero_timo_zidan1",
                    "tracker": "SDEffectBullet2DTracker",
                    "prefabInitSpeed": float(clown_projectile["InitSpeed"]),
                    "prefabMaxFlyDistance": float(clown_projectile["MaxFlyDistance"]),
                    "prefabDurationMs": float(clown_projectile["Duration"]),
                    "prefabLockTarget": bool(clown_projectile["LockTarget"]),
                    "eventInitSpeed": 10.0,
                    "eventMaxFlyDistance": 90.0,
                    "eventMaxFlyTimeMs": 3000.0,
                    "eventLockTarget": False,
                    "collisionMaxCount": int(clown_collision["CollisionMaxNum"]),
                    "hitEffectPath": clown_projectile["destroyEffectPath"],
                },
            },
            {
                "owner": "hero-summoner",
                "kind": "summon-melee-unit",
                "targetingDistance": 2100,
                "sourceBundles": ["summonMinion", "fxSummon"],
                "summon": {
                    **summon_profile,
                    "attackTriggerSeconds": 0.133333,
                    "hitTriggerSeconds": 0.233333,
                },
            },
            {
                "owner": "lord-sand-king",
                "kind": "melee",
                "targetingDistance": 400,
                "sourceBundles": ["fxLordSandKing"],
                "melee": {
                    "hitTriggerSeconds": [0.066667, 0.6],
                    "damageCoefficientPerHit": 80,
                    "effectRange": 500,
                    "hitEffectPath": "Assets/IGSoft_Resources/Projects/Prefabs/player/shawang/eff_player_shawang_sj.prefab",
                },
            },
        ],
    }


def make_actor(
    bundle_path: Path,
    output_root: Path,
    actor_id: str,
    asset_name: str,
    role: str,
    evidence: list[str],
    required_animations: list[str],
    display_name: str | None = None,
) -> dict[str, Any]:
    actor = export_spine_actor(bundle_path, output_root, asset_name, actor_id)
    actor["role"] = role
    actor["sourceName"] = asset_name
    actor["displayName"] = display_name
    actor["evidence"] = evidence
    actor["requiredAnimations"] = required_animations
    if role == "enemy":
        actor["hurtVisual"] = {
            "kind": "external-unresolved",
            "spineAnimationPresent": False,
        }
    return actor


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

    source_root = Path(args.source_root).expanduser().resolve()
    bundle_root = source_root / "bundles"
    output_root = args.output_root.resolve()
    level_root = output_root / "levels" / LEVEL_ID
    level_root.mkdir(parents=True, exist_ok=True)

    bundle_paths = {
        key: ensure_exact_bundle(bundle_root, descriptor)
        for key, descriptor in BUNDLES.items()
    }
    environments = {
        key: read_objects(path)[0]
        for key, path in bundle_paths.items()
    }

    scene, _ = export_level_config(environments["level"], level_root, output_root)
    wave_config = export_wave_config(source_root, level_root, output_root)
    scene["background"] = export_map(environments["map"], output_root)
    scene["mapSprites"] = export_map_sprites(
        environments["mapSprites"],
        output_root,
    )

    heroes = [
        make_actor(
            bundle_paths[bundle_key],
            output_root,
            actor_id,
            asset_name,
            "lineup-hero",
            [f"bundle-object:{bundle_key}", "live-observation:account-lineup"],
            ["stand", "run", "attack_1"],
            display_name,
        )
        for actor_id, asset_name, display_name, bundle_key in HEROES
    ]
    lord = make_actor(
        bundle_paths[LORD[3]],
        output_root,
        LORD[0],
        LORD[1],
        "lord",
        ["bundle-object:lordSandKing", "live-observation:account-lord"],
        ["stand", "run", "attack_1"],
        LORD[2],
    )
    enemies = [
        make_actor(
            bundle_paths[bundle_key],
            output_root,
            actor_id,
            asset_name,
            "enemy",
            [
                f"bundle-object:{bundle_key}",
                "live-observation:challenge-monster-roster",
            ],
            ["stand", "run", "attack_1", "dead"],
            display_name,
        )
        for actor_id, asset_name, display_name, bundle_key in ENEMIES
    ]
    summons = [
        make_actor(
            bundle_paths[bundle_key],
            output_root,
            actor_id,
            asset_name,
            "summon",
            [f"bundle-object:{bundle_key}", "rkt-config:soldier-52001"],
            ["stand", "run", "attack_1", "born", "dead"],
            display_name,
        )
        for actor_id, asset_name, display_name, bundle_key in SUMMONS
    ]

    manifest = {
        "schemaVersion": 1,
        "scope": "frontline-level-asset-manifest",
        "level": {
            "id": LEVEL_ID,
            "sourceId": SOURCE_LEVEL_ID,
            "chapter": 1,
            "order": 1,
            "name": "烈日沙漠1",
            "auditStatus": "blocked-by-behavior-config",
        },
        "sourceVersion": SOURCE_VERSION,
        "unityVersion": UNITY_VERSION,
        "generator": {
            "name": "scripts/frontline/audit_level_01.py",
            "unityPy": UnityPy.__version__,
            "spineRuntime": SPINE_RUNTIME_VERSION,
        },
        "evidence": [
            {
                "id": "level-config",
                "type": "bundle-object",
                "source": f"{BUNDLES['level']['file']}:TextAsset/100101",
                "facts": [
                    "map path is Assets/AssetFolder/MapData/Background/map_01_01.jpg",
                    "one non-empty route with 12 points",
                    "12 tower positions",
                    "player and crystal anchors are explicit",
                ],
            },
            {
                "id": "challenge-roster",
                "type": "live-observation",
                "source": "reference client 1-1 challenge panel",
                "facts": [
                    "four fixed hero cards",
                    "monsters: 沙甲虫, 沙漠蜥蜴, 野狗",
                    "no boss card is shown",
                ],
            },
            {
                "id": "battle-layout",
                "type": "live-observation",
                "source": "reference client 1-1 battle",
                "facts": [
                    "six waves",
                    "three-star target is 220 seconds",
                    "seven deployable platforms and five locked platforms",
                    "blue crystal is centered near the bottom",
                    "pause, speed, statistics, skills, enhance and summon controls are visible",
                    "the player unit is account-loadout driven rather than fixed by firstlv",
                ],
            },
            {
                "id": "wave-config",
                "type": "rkt-config",
                "source": f"Boot_{SOURCE_VERSION}.zip:BinaryAssets/CSV.zip",
                "facts": [
                    "RKT tail transform and nested archive structure are verified",
                    "EctypeWave contains six records for source level 100101",
                    "ectype_spawn_monster_info_c contains 18 spawn groups for source level 100101",
                    "Monster identifies four configured monster variants",
                    "ConfigResource supplies each monster model radius used by target acquisition",
                ],
            },
        ],
        "bundles": [
            bundle_record(
                key,
                bundle_paths[key],
                environments[key],
                {
                    "level": "direct-level-config-and-fixed-heroes",
                    "map": "direct-level-config-background-reference",
                    "mapSprites": "config-and-live-layout-match",
                    "monsterJiachong": "live-challenge-roster",
                    "monsterXiyi": "live-challenge-roster-and-battle",
                    "monsterZongquan": "live-challenge-roster-and-battle",
                    "fightUi": "live-battle-controls-and-prefab-object-names",
                    "fightUiTextures": "live-battle-controls-and-source-sprite-names",
                    "heroJinx": "hero-resource:30002-model:100001",
                    "heroLightning": "hero-resource:30001-model:90001",
                    "heroClown": "hero-resource:30005-model:90201",
                    "heroSummoner": "hero-resource:30004-model:120001",
                    "lordSandKing": "lord-resource:1",
                    "fxJinx": "normal-attack-emitter-projectile-and-hit-effect",
                    "fxLightning": "normal-attack-emitter-projectile-and-hit-effect",
                    "fxClown": "normal-attack-emitter-projectile-and-area-effect",
                    "fxSummon": "summoned-unit-melee-effects",
                    "summonMinion": "summoned-unit-combat-events",
                    "fxLordSandKing": "lord-normal-attack-hit-effect",
                }[key],
            )
            for key in BUNDLES
        ],
        "scene": scene,
        "battleProfile": {
            "waveCount": 6,
            "threeStarTimeSeconds": 220,
            "lineupHeroCount": 4,
            "enemyRosterCount": 3,
            "waveConfig": wave_config,
            "boss": {
                "status": "not-observed",
                "challengePanelHasBossCard": False,
            },
            "evidence": ["challenge-roster", "battle-layout"],
        },
        "actors": {
            "heroes": heroes,
            "lord": lord,
            "enemies": enemies,
            "summons": summons,
            "playerSlot": {
                "binding": "runtime-player-loadout",
                "fixedActor": "lord-sand-king",
                "evidence": ["level-config:heroPos", "live-observation:battle-layout"],
            },
        },
        "audio": {
            "backgroundMusic": export_audio(environments["level"], output_root),
            "combatAndUi": {
                "status": "unresolved",
                "reason": "Per-action clips require runtime/config attribution.",
            },
        },
        "combatEventData": export_combat_event_data(
            environments,
            level_root,
            output_root,
        ),
        "attackEvidence": export_attack_evidence(
            environments,
            wave_config["summons"][0],
        ),
        "ui": {
            "prefabBundle": BUNDLES["fightUi"]["file"],
            "textureBundle": BUNDLES["fightUiTextures"]["file"],
            "verifiedPrefabObjects": FIGHT_UI_OBJECTS,
            "verifiedSprites": FIGHT_UI_SPRITES,
        },
        "unresolved": [
            {
                "id": "summon-ai-and-lord-damage-attribution",
                "blocking": True,
                "reason": "The summoned unit lifecycle and attack inheritance are resolved, but its native C# seek/move/taunt logic and the lord's active account attack value are not.",
                "requiredEvidence": "soldier AI method bodies or focused runtime samples, plus reference-account runtime property capture",
            },
            {
                "id": "hero-projectile-and-hit-effects",
                "blocking": False,
                "reason": "Projectile and hit-effect Bundle ownership is resolved; target-death and area-effect lifetime rules remain unresolved.",
                "requiredEvidence": "tracker update implementation or focused runtime samples",
            },
            {
                "id": "hurt-feedback",
                "blocking": True,
                "reason": "Enemy skeletons have no hurt animation; original material/effect mapping is not yet attributed.",
                "requiredEvidence": "reference-frame sampling plus material/effect object match",
            },
            {
                "id": "account-loadout",
                "blocking": False,
                "reason": "The mobile lord and active skills depend on the current account loadout rather than the level asset bundle.",
                "requiredEvidence": "lock a reference loadout before first-level implementation",
            },
        ],
    }
    manifest_path = level_root / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {manifest_path}")


if __name__ == "__main__":
    main()
