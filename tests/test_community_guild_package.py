"""Boundary checks for exact Workshop acquisition, without game/media fixtures."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('guild_inspection',
    Path(__file__).resolve().parents[1] / 'scripts/inspect-community-guild-package.py')
POLICY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(POLICY)


def cam(kind, names):
    start = 36 + len(names) * 28
    directory = b''.join(struct.pack('<20sII', name, start + i, 1)
                         for i, name in enumerate(names))
    return (POLICY.PRIMITIVES.CAM_MAGIC + struct.pack('<II', 1, 8 + len(directory))
            + struct.pack('<4sI', kind, 28) + struct.pack('<II', len(names), 0)
            + directory + b'x' * len(names))


class GuildPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.package = Path(self.temp.name)
        self.contract = dict(id='bards-hall', fullPackageAcquired=True,
            canonicalGuid='{fixture}', internalName='GuildFixture', workshopManifest='fixture',
            manifestFilename='Fixture.mmxml', compiledGameplay='Data/Bards.bcd',
            requiredMedia=[f'Data/bards_{suffix}.cam' for suffix in
                           ('maindata', 'interfacedata', 'voices', 'sounddesc')],
            expectedArt=['BDT1Fixture'], expectedActorCosts={'BDT1': '500'})
        files = {
            'Data/bards_maindata.cam': cam(b'IMAG', [b'BDT1Fixture']),
            'Data/bards_interfacedata.cam': cam(b'TILE', [b'0']),
            'Data/bards_voices.cam': cam(b'WAVE', [b'fixture']),
            'Data/bards_sounddesc.cam': cam(b'DSND', [b'fixture']),
            'Data/bards_units.xml': b'<Majesty><Description ID="BDT1"><Game>'
                                    b'<Cost value="500"/></Game></Description></Majesty>',
            'Data/Bards.bcd': struct.pack('<III', 1020, 1020, 0xffffffff) + b'\0' * 1012,
        }
        # Include both required IMAG and TILE records in a minimal two-section CAM.
        first = cam(b'IMAG', [b'BDT1Fixture'])
        names = [(b'IMAG', b'BDT1Fixture'), (b'TILE', b'0')]
        start = 20 + 16 + 72
        files['Data/bards_maindata.cam'] = (first[:12] + struct.pack('<II', 2, 72)
            + struct.pack('<4sI4sI', b'IMAG', 36, b'TILE', 72)
            + b''.join(struct.pack('<II20sII', 1, 0, name, start + i, 1)
                       for i, (_, name) in enumerate(names)) + b'xx')
        references = ''.join(f'<CAM>{name}</CAM>' for name in self.contract['requiredMedia'])
        files['Fixture.mmxml'] = (f'<Majesty><Mod id="{{fixture}}"><Name>GuildFixture</Name>'
            f'<DataConfiguration><Dataset><Load>{references}'
            '<Descriptions>Data/bards_units.xml</Descriptions>'
            '<GPL><Target>Data/Bards.bcd</Target></GPL>'
            '</Load></Dataset></DataConfiguration></Mod></Majesty>').encode()
        for name, raw in files.items():
            path = self.package / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        self.bind()

    def bind(self):
        records = {p.relative_to(self.package).as_posix(): dict(bytes=p.stat().st_size,
            sha256=hashlib.sha256(p.read_bytes()).hexdigest())
            for p in sorted(self.package.rglob('*')) if p.is_file()}
        self.contract['workshopPackageFiles'] = records
        self.contract['packageInventorySha256'] = hashlib.sha256(json.dumps(
            records, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    def test_complete_package_is_not_claimed_playable(self):
        result = POLICY.inspect(self.package, self.contract)
        self.assertTrue(result['originalMediaPresent'])
        self.assertFalse(result['browserPlayable'])
        self.assertFalse(result['nativeHooksQualified'])

    def test_changed_media_is_rejected(self):
        (self.package / 'Data/bards_voices.cam').write_bytes(b'replaced')
        with self.assertRaisesRegex(ValueError, 'Acquired resource changed'):
            POLICY.inspect(self.package, self.contract)

    def test_missing_or_additional_files_are_rejected(self):
        (self.package / 'unexpected.txt').write_text('extra')
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            POLICY.inspect(self.package, self.contract)

    def test_links_are_rejected(self):
        (self.package / 'link').symlink_to(self.package / 'Fixture.mmxml')
        with self.assertRaisesRegex(ValueError, 'Linked package'):
            POLICY.inspect(self.package, self.contract)

    def test_wrong_guid_is_rejected_even_with_matching_inventory(self):
        path = self.package / 'Fixture.mmxml'
        path.write_bytes(path.read_bytes().replace(b'{fixture}', b'{other}'))
        self.bind()
        with self.assertRaisesRegex(ValueError, 'manifest identity'):
            POLICY.inspect(self.package, self.contract)

    def test_invalid_bytecode_header_is_rejected(self):
        (self.package / 'Data/Bards.bcd').write_bytes(b'x' * 1024)
        self.bind()
        with self.assertRaisesRegex(ValueError, 'gameplay container'):
            POLICY.inspect(self.package, self.contract)

    def test_missing_actor_art_is_rejected(self):
        self.contract['expectedArt'] = ['NOT_THE_GUILD']
        with self.assertRaisesRegex(ValueError, 'original guild artwork'):
            POLICY.inspect(self.package, self.contract)

    def test_entity_declarations_are_rejected(self):
        path = self.package / 'Fixture.mmxml'
        path.write_bytes(b'<!DOCTYPE Majesty [<!ENTITY test "fixture">]>' + path.read_bytes())
        self.bind()
        with self.assertRaisesRegex(ValueError, 'declare entities'):
            POLICY.inspect(self.package, self.contract)

    def test_inventory_digest_is_checked(self):
        contract = copy.deepcopy(self.contract)
        contract['workshopPackageFiles']['Fixture.mmxml']['bytes'] += 1
        with self.assertRaisesRegex(ValueError, 'inventory digest'):
            POLICY.inspect(self.package, contract)


if __name__ == '__main__':
    unittest.main()
