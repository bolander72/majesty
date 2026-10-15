import importlib.util
from pathlib import Path
import unittest
from dataclasses import replace

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('level_labels', ROOT/'scripts/label-alchemist-native-levels.py')
labels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(labels)
from majesty_cam.cam import CamArchive, CamSection, CamEntry, read_cam
from majesty_cam.strt import StrtTable, StrtRecord, parse_strt


class LaboratoryLabels(unittest.TestCase):
    def test_only_three_display_labels_change(self):
        table = StrtTable(b'\x00\x00', tuple(StrtRecord(key,b'Alchemy Lab') for key in labels.LABELS)
                          + (StrtRecord(123,b'Original stock name'),))
        entry = CamEntry(name=b'UNTN'+bytes(16), data=table.to_bytes())
        archive = CamArchive((CamSection(extension=b'STRT',entries=(entry,)),))
        result = read_cam(labels.label_archive(archive.to_bytes()))
        after = parse_strt(result.sections[0].entries[0].data)
        self.assertEqual([r.string_id for r in after.records],[r.string_id for r in table.records])
        self.assertEqual([r.text for r in after.records],list(labels.LABELS.values())+[b'Original stock name'])

    def test_missing_or_already_modified_labels_are_refused(self):
        table=StrtTable(b'\x00\x00',(StrtRecord(next(iter(labels.LABELS)),b'Alchemy Lab'),))
        archive=CamArchive((CamSection(extension=b'STRT',entries=(CamEntry(name=b'UNTN'+bytes(16),data=table.to_bytes()),)),))
        with self.assertRaisesRegex(ValueError,'three original'):labels.label_archive(archive.to_bytes())
