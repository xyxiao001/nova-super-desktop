#!/usr/bin/env python3
"""Audit selected types in a Tuanjie slim IL2CPP metadata/WASM pair.

The level-1 source build uses metadata version 32 with Tuanjie's slim format.
For this package, type definitions are 68 bytes and method definitions are 29
bytes. This tool deliberately validates those widths from section sizes and
token/name invariants instead of pretending the file is standard Unity v32.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
from typing import Any


METADATA_MAGIC = 0xFAB11BAF
EXPECTED_VERSION = 32
TYPE_DEFINITION_SIZE = 68
METHOD_DEFINITION_SIZE = 29
TARGET_TYPES = ("SoldierBattleState", "SoldierIdleState", "SoldierMoveState")


def read_uleb(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte & 0x80 == 0:
            return value, offset
        shift += 7
        if shift > 63:
            raise ValueError("Invalid ULEB128 value")


def read_wasm_function_names(path: Path) -> dict[str, int]:
    data = path.read_bytes()
    if data[:8] != b"\0asm\x01\0\0\0":
        raise ValueError(f"Not a WebAssembly module: {path}")

    names: dict[str, int] = {}
    offset = 8
    while offset < len(data):
        section_id = data[offset]
        section_size, payload_start = read_uleb(data, offset + 1)
        payload_end = payload_start + section_size
        if section_id != 0:
            offset = payload_end
            continue

        custom_name_size, cursor = read_uleb(data, payload_start)
        custom_name = data[cursor : cursor + custom_name_size]
        cursor += custom_name_size
        if custom_name != b"name":
            offset = payload_end
            continue

        while cursor < payload_end:
            subsection_id = data[cursor]
            subsection_size, subsection_start = read_uleb(data, cursor + 1)
            subsection_end = subsection_start + subsection_size
            if subsection_id == 1:
                count, entry = read_uleb(data, subsection_start)
                for _ in range(count):
                    function_index, entry = read_uleb(data, entry)
                    name_size, entry = read_uleb(data, entry)
                    name = data[entry : entry + name_size].decode("utf-8")
                    entry += name_size
                    names[name] = function_index
            cursor = subsection_end
        offset = payload_end
    return names


def read_c_string(data: bytes, start: int) -> str:
    end = data.index(0, start)
    return data[start:end].decode("utf-8")


def read_signed(data: bytes) -> int:
    value = int.from_bytes(data, "little")
    sign_bit = 1 << (len(data) * 8 - 1)
    return value - (sign_bit << 1) if value & sign_bit else value


def audit(metadata_path: Path, wasm_path: Path | None) -> dict[str, Any]:
    data = metadata_path.read_bytes()
    magic, version = struct.unpack_from("<II", data, 0)
    if magic != METADATA_MAGIC:
        raise ValueError(f"Invalid metadata magic: 0x{magic:08x}")
    if version != EXPECTED_VERSION:
        raise ValueError(f"Expected metadata v{EXPECTED_VERSION}, got v{version}")

    sections = [struct.unpack_from("<II", data, 8 + index * 8) for index in range(31)]
    string_offset, string_size = sections[2]
    methods_offset, methods_size = sections[5]
    types_offset, types_size = sections[19]
    if methods_size % METHOD_DEFINITION_SIZE != 0:
        raise ValueError(f"Method section is not divisible by {METHOD_DEFINITION_SIZE}")
    if types_size % TYPE_DEFINITION_SIZE != 0:
        raise ValueError(f"Type section is not divisible by {TYPE_DEFINITION_SIZE}")

    method_count = methods_size // METHOD_DEFINITION_SIZE
    type_count = types_size // TYPE_DEFINITION_SIZE
    wasm_names = read_wasm_function_names(wasm_path) if wasm_path else {}
    targets: list[dict[str, Any]] = []

    for type_index in range(type_count):
        record_start = types_offset + type_index * TYPE_DEFINITION_SIZE
        record = data[record_start : record_start + TYPE_DEFINITION_SIZE]
        name_index = struct.unpack_from("<I", record, 0)[0]
        if name_index >= string_size:
            raise ValueError(f"Invalid type name index at type {type_index}: {name_index}")
        name = read_c_string(data, string_offset + name_index)
        if name not in TARGET_TYPES:
            continue

        namespace_index = struct.unpack_from("<I", record, 4)[0]
        namespace = read_c_string(data, string_offset + namespace_index)
        method_start = int.from_bytes(record[26:29], "little")
        method_total = struct.unpack_from("<H", record, 44)[0]
        if method_start + method_total > method_count:
            raise ValueError(f"Invalid method range for {name}")

        methods: list[dict[str, Any]] = []
        for method_index in range(method_start, method_start + method_total):
            method_record_start = methods_offset + method_index * METHOD_DEFINITION_SIZE
            method = data[method_record_start : method_record_start + METHOD_DEFINITION_SIZE]
            method_name_index = struct.unpack_from("<I", method, 0)[0]
            method_name = read_c_string(data, string_offset + method_name_index)
            declaring_type = read_signed(method[4:6])
            token = (method[21] << 24) | int.from_bytes(method[18:21], "little")
            if declaring_type != type_index:
                raise ValueError(
                    f"Method {method_index} declares type {declaring_type}, expected {type_index}"
                )
            if token >> 24 != 0x06:
                raise ValueError(f"Method {method_index} has invalid token 0x{token:08x}")
            jump_name = f"j{method_index}"
            methods.append(
                {
                    "index": method_index,
                    "name": method_name,
                    "token": f"0x{token:08x}",
                    "parameterCount": method[28],
                    "wasmJumpName": jump_name if jump_name in wasm_names else None,
                    "wasmFunctionIndex": wasm_names.get(jump_name),
                }
            )
        targets.append(
            {
                "index": type_index,
                "namespace": namespace,
                "name": name,
                "methodStart": method_start,
                "methodCount": method_total,
                "methods": methods,
            }
        )

    found = {target["name"] for target in targets}
    missing = sorted(set(TARGET_TYPES) - found)
    if missing:
        raise ValueError(f"Missing target types: {', '.join(missing)}")

    return {
        "metadata": {
            "path": str(metadata_path),
            "sha256": hashlib.sha256(data).hexdigest(),
            "version": version,
            "format": "tuanjie-slim",
            "typeDefinitionSize": TYPE_DEFINITION_SIZE,
            "typeDefinitionCount": type_count,
            "methodDefinitionSize": METHOD_DEFINITION_SIZE,
            "methodDefinitionCount": method_count,
        },
        "wasm": (
            {
                "path": str(wasm_path),
                "sha256": hashlib.sha256(wasm_path.read_bytes()).hexdigest(),
                "namedFunctions": len(wasm_names),
            }
            if wasm_path
            else None
        ),
        "types": sorted(targets, key=lambda target: TARGET_TYPES.index(target["name"])),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("metadata", type=Path)
    parser.add_argument("--wasm", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit(args.metadata, args.wasm)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
