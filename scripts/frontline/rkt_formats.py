#!/usr/bin/env python3
"""Read the recoverable portion of Frontline RKT archives and DBC tables."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import struct
from typing import Any
from zipfile import ZipFile


RKT_MAGIC = b"rkt\0"
RKT_HEADER_SIZE = 8
RKT_PRIVATE_PREFIX_SIZE = 8
RKT_ENCRYPTED_PREFIX_SIZE = 16384
RKT_TAIL_XOR_KEY = bytes.fromhex("8a7ba4d2")
DBC_MAGIC = b"DBC\n1000"
DBC_HEADER_WORDS = 25


@dataclass(frozen=True)
class DbcField:
    name: str
    value_type: int
    flags: int
    offset: int
    width: int
    pool_index: int


def recover_rkt_tail(raw: bytes) -> tuple[bytes, int]:
    if len(raw) < RKT_HEADER_SIZE or raw[:4] != RKT_MAGIC:
        raise ValueError("Not an RKT archive")

    tail_offset = struct.unpack_from("<I", raw, 4)[0]
    payload = bytearray(raw[RKT_HEADER_SIZE:])
    if tail_offset != RKT_PRIVATE_PREFIX_SIZE + RKT_ENCRYPTED_PREFIX_SIZE:
        raise ValueError(f"Unsupported RKT tail offset: {tail_offset}")
    if tail_offset > len(payload):
        raise ValueError(f"RKT tail offset exceeds payload: {tail_offset}")

    for index in range(tail_offset, len(payload)):
        payload[index] ^= RKT_TAIL_XOR_KEY[index % len(RKT_TAIL_XOR_KEY)]
    return bytes(payload), tail_offset


def read_recoverable_rkt_entry(raw: bytes, name: str) -> bytes:
    recovered, tail_offset = recover_rkt_tail(raw)
    with ZipFile(BytesIO(recovered)) as archive:
        try:
            info = archive.getinfo(name)
        except KeyError as error:
            raise KeyError(f"RKT entry not found: {name}") from error
        if info.header_offset < tail_offset:
            raise ValueError(
                f"RKT entry {name} begins inside the protected prefix "
                f"at {info.header_offset}"
            )
        return archive.read(info)


def _read_pascal_string(raw: bytes, offset: int) -> tuple[str, int]:
    length = raw[offset]
    offset += 1
    end = offset + length
    return raw[offset:end].decode("utf-8"), end


def _read_7bit_int(raw: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while True:
        current = raw[offset]
        offset += 1
        value |= (current & 0x7F) << shift
        if current < 0x80:
            return value, offset
        shift += 7
        if shift > 28:
            raise ValueError("Invalid 7-bit encoded DBC string length")


def _read_dbc_strings(
    raw: bytes,
    offset: int,
    size: int,
    count: int,
) -> list[str]:
    end = offset + size
    values = []
    while offset < end:
        length, offset = _read_7bit_int(raw, offset)
        value_end = offset + length
        if value_end > end:
            raise ValueError("DBC string exceeds its string pool")
        values.append(raw[offset:value_end].decode("utf-8"))
        offset = value_end
    if len(values) != count:
        raise ValueError(
            f"DBC string count mismatch: expected {count}, got {len(values)}"
        )
    return values


def _read_dbc_dictionaries(
    raw: bytes,
    offset: int,
    size: int,
    count: int,
) -> list[list[int]]:
    section_end = offset + size
    actual_count = struct.unpack_from("<I", raw, offset)[0]
    offset += 4
    if actual_count != count:
        raise ValueError(
            f"DBC dictionary count mismatch: expected {count}, got {actual_count}"
        )

    descriptors = []
    for _ in range(count):
        value_offset, value_count = struct.unpack_from("<II", raw, offset)
        value_width = raw[offset + 8]
        offset += 9
        if value_width not in (1, 2, 4):
            raise ValueError(f"Unsupported DBC dictionary width: {value_width}")
        descriptors.append((value_offset, value_count, value_width))

    values_start = offset
    dictionaries = []
    for value_offset, value_count, value_width in descriptors:
        values = []
        for index in range(value_count):
            start = values_start + value_offset + index * value_width
            value = int.from_bytes(
                raw[start:start + value_width],
                "little",
                signed=value_width == 4,
            )
            values.append(value)
        dictionaries.append(values)

    if values_start + max(
        (offset + count * width for offset, count, width in descriptors),
        default=0,
    ) != section_end:
        raise ValueError("DBC dictionary section size mismatch")
    return dictionaries


def decode_dbc(raw: bytes) -> list[dict[str, Any]]:
    if len(raw) < 108 or raw[:8] != DBC_MAGIC:
        raise ValueError("Unsupported DBC header")

    header = struct.unpack_from(f"<{DBC_HEADER_WORDS}I", raw, 8)
    schema_offset = header[1]
    schema_end = schema_offset + header[2]
    data_offset = header[3]
    data_size = header[4]
    dictionary_offset = header[5]
    dictionary_size = header[6]
    string_offset = header[7]
    string_size = header[8]
    string_count = header[9]
    dictionary_count = header[10]
    field_count = header[11]
    row_count = header[12]
    row_size = header[13]

    if data_offset != schema_end or data_size != row_count * row_size:
        raise ValueError("Inconsistent DBC row layout")

    offset = schema_offset
    fields = []
    for _ in range(field_count):
        _, offset = _read_pascal_string(raw, offset)
        name, offset = _read_pascal_string(raw, offset)
        descriptor = raw[offset:offset + 8]
        offset += 8
        width = descriptor[3] // 32
        if width not in (1, 2, 4):
            raise ValueError(f"Unsupported DBC field width: {descriptor[3]}")
        fields.append(
            DbcField(
                name=name,
                value_type=descriptor[0],
                flags=descriptor[1],
                offset=descriptor[2],
                width=width,
                pool_index=int.from_bytes(descriptor[4:8], "little"),
            )
        )
    if offset != schema_end:
        raise ValueError("DBC schema size mismatch")

    dictionaries = _read_dbc_dictionaries(
        raw,
        dictionary_offset,
        dictionary_size,
        dictionary_count,
    )
    strings = _read_dbc_strings(
        raw,
        string_offset,
        string_size,
        string_count,
    )

    rows = []
    for row_index in range(row_count):
        start = data_offset + row_index * row_size
        record = raw[start:start + row_size]
        row = {}
        for field in fields:
            encoded = int.from_bytes(
                record[field.offset:field.offset + field.width],
                "little",
            )
            null_value = (1 << (field.width * 8)) - 1
            if encoded == null_value:
                value: Any = None
            elif field.flags & 0x40:
                value = dictionaries[field.pool_index][encoded]
            elif field.value_type in (4, 5):
                value = strings[encoded]
            else:
                value = encoded
            row[field.name] = value
        rows.append(row)
    return rows
