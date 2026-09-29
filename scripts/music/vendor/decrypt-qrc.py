# SPDX-License-Identifier: GPL-3.0-only
# CLI bridge for LDDC's modified Triple DES decoder; original notices in tripledes.py.
import re
import sys
import zlib
from tripledes import DECRYPT, tripledes_crypt, tripledes_key_setup

encrypted = bytearray.fromhex(sys.stdin.read())
schedule = tripledes_key_setup(b"!@#)(*$%123ZXC!@!@#)(NHL", DECRYPT)
raw = bytearray()
for offset in range(0, len(encrypted), 8):
    raw.extend(tripledes_crypt(encrypted[offset:offset + 8], schedule))
xml = zlib.decompress(raw).decode("utf-8")
content = re.search(r'LyricContent="([\s\S]*?)"\s*/>', xml).group(1)
sys.stdout.write(content)
