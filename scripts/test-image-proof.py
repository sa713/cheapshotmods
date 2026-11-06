"""Offline negative archive regressions; real store transfers run separately."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1]/'deploy'/'image-proof.py'
SHA = 'a'*40
APP = 'cheapshotmods:'+SHA
PROXY = 'caddy:2.10.2-alpine'


def hashed(raw):
    return 'sha256:'+hashlib.sha256(raw).hexdigest()


def layer(value):
    target = io.BytesIO()
    with tarfile.open(fileobj=target, mode='w') as archive:
        member = tarfile.TarInfo('fixture.txt')
        member.size = len(value)
        archive.addfile(member, io.BytesIO(value))
    return target.getvalue()


def fixture():
    files = {}
    entries = []
    proofs = {}
    for role, tag, values in [('app', APP, [b'first', b'second']), ('proxy', PROXY, [b'proxy'])]:
        layers = [layer(v) for v in values]
        diff_ids = [hashed(raw) for raw in layers]
        cfg = {'os': 'linux', 'architecture': 'amd64', 'rootfs': {'type': 'layers', 'diff_ids': diff_ids},
               'config': {'Labels': {'org.opencontainers.image.revision': SHA} if role == 'app' else {}, 'Env': ['SAFE=value']}}
        raw = json.dumps(cfg).encode()
        cfg_path = role+'.json'
        paths = [role+str(i)+'.tar' for i in range(len(layers))]
        files[cfg_path] = raw
        files.update(zip(paths, layers))
        entries.append({'Config': cfg_path, 'RepoTags': [tag], 'Layers': paths})
        proofs[role] = {'config_digest': hashed(raw), 'diff_ids': diff_ids, 'platform': 'linux/amd64', 'revision': SHA if role == 'app' else None}
    files['manifest.json'] = json.dumps(entries).encode()
    m = {'format': 2, 'platform': 'linux/amd64', 'source_sha': SHA, 'app_image': APP, 'proxy_image': PROXY, 'image_proofs': proofs}
    return files, m


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.files, self.manifest = fixture()

    def tearDown(self):
        self.temp.cleanup()

    def run_proof(self, files=None, manifest=None, duplicate=False):
        archive = self.root/'images.tar'
        with tarfile.open(archive, 'w') as target:
            for path, raw in (files or self.files).items():
                entry = tarfile.TarInfo(path)
                entry.size = len(raw)
                target.addfile(entry, io.BytesIO(raw))
            if duplicate:
                entry = tarfile.TarInfo('app.json')
                entry.size = len(self.files['app.json'])
                target.addfile(entry, io.BytesIO(self.files['app.json']))
        meta = self.root/'manifest.json'
        meta.write_text(json.dumps(manifest or self.manifest))
        return subprocess.run(['python3', str(SCRIPT), 'archive', str(meta), str(archive)], capture_output=True, text=True)

    def test_valid(self):
        self.assertEqual(self.run_proof().returncode, 0)

    def test_same_tag_platform_revision_and_layers_changed_runtime_config(self):
        cfg = json.loads(self.files['app.json'])
        cfg['config']['Env'] = ['SECRET=NEVER_ECHO_THIS_VALUE']
        self.files['app.json'] = json.dumps(cfg).encode()
        result = self.run_proof()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('type=config_sha256', result.stderr)
        self.assertNotIn('NEVER_ECHO_THIS_VALUE', result.stdout+result.stderr)

    def test_wrong_layer_bytes(self):
        self.files['app0.tar'] = layer(b'substitution')
        result = self.run_proof()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('layer SHA-256 mismatch', result.stderr)

    def test_wrong_layer_order(self):
        entries = json.loads(self.files['manifest.json'])
        entries[0]['Layers'].reverse()
        self.files['manifest.json'] = json.dumps(entries).encode()
        self.assertNotEqual(self.run_proof().returncode, 0)

    def test_wrong_platform(self):
        cfg = json.loads(self.files['app.json'])
        cfg['architecture'] = 'arm64'
        self.files['app.json'] = json.dumps(cfg).encode()
        self.assertNotEqual(self.run_proof().returncode, 0)

    def test_null_config_has_controlled_error(self):
        cfg = json.loads(self.files['app.json'])
        cfg['config'] = None
        self.files['app.json'] = json.dumps(cfg).encode()
        result = self.run_proof()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('invalid image config object', result.stderr)
        self.assertNotIn('Traceback', result.stderr)

    def test_wrong_expected_config(self):
        self.manifest['image_proofs']['app']['config_digest'] = 'sha256:'+'b'*64
        self.assertNotEqual(self.run_proof().returncode, 0)

    def test_extra_tag(self):
        entries = json.loads(self.files['manifest.json'])
        entries[0]['RepoTags'].append('unrelated:latest')
        self.files['manifest.json'] = json.dumps(entries).encode()
        self.assertNotEqual(self.run_proof().returncode, 0)

    def test_duplicate_member(self):
        self.assertNotEqual(self.run_proof(duplicate=True).returncode, 0)

    def test_truncated_kit(self):
        self.run_proof()
        archive = self.root/'images.tar'
        archive.write_bytes(archive.read_bytes()[:2000])
        result = subprocess.run(['python3', str(SCRIPT), 'archive', str(self.root/'manifest.json'), str(archive)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)

    def test_legacy_manifest_requires_incoming_installer(self):
        self.manifest['format'] = 1
        result = self.run_proof()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('format-2 installer', result.stderr)


if __name__ == '__main__':
    unittest.main()
