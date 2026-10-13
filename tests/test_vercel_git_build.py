import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('build', Path(__file__).resolve().parents[1] / 'scripts/build-vercel.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ReleaseIntegrity(unittest.TestCase):
    def archive(self, name='static/index.html', symlink=False):
        content = b'<html>game</html>'
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            if symlink:
                info.type = tarfile.SYMTYPE
                info.linkname = '/private/data'
            archive.addfile(info, io.BytesIO(content))
        data = stream.getvalue()
        return data, {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'files': {name: {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}}}

    def test_corrupt_download_and_changed_file_are_rejected(self):
        data, release = self.archive()
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'download'):
                build.unpack_release(data[:-1], release, Path(temp))
            release['files']['static/index.html']['sha256'] = '0' * 64
            with self.assertRaisesRegex(ValueError, 'file failed'):
                build.unpack_release(data, release, Path(temp))

    def test_traversal_and_symlink_are_rejected(self):
        for name, symlink in [('../escape', False), ('static/index.html', True)]:
            with self.subTest(name=name, symlink=symlink), tempfile.TemporaryDirectory() as temp:
                data, release = self.archive(name, symlink)
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    build.unpack_release(data, release, Path(temp))


if __name__ == '__main__':
    unittest.main()
