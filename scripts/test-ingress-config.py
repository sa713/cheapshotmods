"""Guard the exact validation-only exception for standard Caddy file writers."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('ingress', Path(__file__).resolve().parents[1]/'deploy'/'ingress.py')
ingress = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingress)


class ValidationConfigTest(unittest.TestCase):
    def test_only_filenames_change_and_shared_writers_stay_shared(self):
        original = {
            'logging': {'logs': {
                'access': {'writer': {'output': 'file', 'filename': '/data/access.log', 'roll_size_mb': 2, 'roll_keep': 3, 'mode': '0600'}, 'encoder': {'format': 'json'}},
                'same': {'writer': {'output': 'file', 'filename': '/data/access.log', 'roll_size_mb': 2, 'roll_keep': 3, 'mode': '0600'}},
                'other': {'writer': {'output': 'file', 'filename': 'relative.log', 'roll': False}},
                'network': {'writer': {'output': 'net', 'address': 'unix//private/log.socket'}},
                'default': {'writer': {'output': 'stderr'}},
            }},
            'apps': {'tls': {'certificates': {'load_files': [{'certificate': '/data/site.crt', 'key': '/data/site.key'}]}}, 'http': {'servers': {'original': {'routes': [{'handle': [{'handler': 'static_response', 'body': 'literal-$-value'}]}]}}}},
        }
        before = copy.deepcopy(original)
        result = ingress.validation_config(original, '/tmp/scratch')
        self.assertEqual(original, before)
        logs = result['logging']['logs']
        self.assertEqual(logs['access']['writer']['filename'], logs['same']['writer']['filename'])
        self.assertNotEqual(logs['access']['writer']['filename'], logs['other']['writer']['filename'])
        for name in ('access', 'same', 'other'):
            self.assertTrue(logs[name]['writer']['filename'].startswith('/tmp/scratch/'))
            logs[name]['writer']['filename'] = original['logging']['logs'][name]['writer']['filename']
        self.assertEqual(result, original)

    def test_missing_or_invalid_filename_is_not_invented(self):
        for filename in (None, '', 123, ['not-a-path']):
            with self.subTest(filename=filename):
                with self.assertRaisesRegex(RuntimeError, '^file log writer requires a filename$'):
                    ingress.validation_config({'logging': {'logs': {'bad': {'writer': {'output': 'file', 'filename': filename}}}}}, '/tmp/scratch')

    def test_other_invalid_options_remain_for_native_provisioning(self):
        original = {'logging': {'logs': {'bad': {'writer': {'output': 'file', 'filename': '/data/access.log', 'mode': 'invalid-mode'}}}}}
        result = ingress.validation_config(original, '/tmp/scratch')
        self.assertEqual(result['logging']['logs']['bad']['writer']['mode'], 'invalid-mode')

    def test_config_without_file_writers_is_unchanged(self):
        for original in ({'apps': {'http': {}}}, {'logging': {'logs': {'default': {'writer': {'output': 'stderr'}}}}}):
            self.assertEqual(ingress.validation_config(original, '/tmp/scratch'), original)


if __name__ == '__main__':
    unittest.main()
