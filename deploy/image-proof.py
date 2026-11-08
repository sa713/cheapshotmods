#!/usr/bin/env python3
"""Portable Docker-save config and uncompressed layer proof; no secret output."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile
import zlib


class ProofError(Exception):
    pass


def require(ok, message):
    if not ok:
        raise ProofError(message)


def digest(value):
    return isinstance(value, str) and re.fullmatch(r'sha256:[a-f0-9]{64}', value)


def json_value(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'duplicate JSON key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique)


def archive_proofs(stream):
    """One bounded-memory pass; never extract archive paths onto the host."""
    files = {}
    documents = {}
    json_bytes = 0
    with tarfile.open(fileobj=stream, mode='r|*') as archive:
        for member in archive:
            name = member.name
            require(len(name) <= 4096 and not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts, 'unsafe archive path')
            if member.isdir():
                continue
            require(member.isfile() and name not in files and len(files) < 10000, 'unsupported or duplicate archive member')
            source = archive.extractfile(member)
            raw_hash = hashlib.sha256()
            layer_hash = hashlib.sha256()
            decoder = None
            document = None
            raw_size = 0
            layer_size = 0
            first = True
            while True:
                chunk = source.read(1024*1024)
                if not chunk:
                    break
                if first:
                    decoder = zlib.decompressobj(31) if chunk.startswith(b'\x1f\x8b') else None
                    document = bytearray() if member.size <= 4*1024*1024 and chunk[:1] in (b'{', b'[') else None
                    first = False
                raw_hash.update(chunk)
                raw_size += len(chunk)
                if document is not None:
                    document.extend(chunk)
                if decoder:
                    while chunk:
                        require(not decoder.eof, 'trailing compressed layer data')
                        unpacked = decoder.decompress(chunk, 1024*1024)
                        layer_hash.update(unpacked)
                        layer_size += len(unpacked)
                        tail = decoder.unconsumed_tail
                        if decoder.eof:
                            require(not decoder.unused_data and not tail, 'trailing compressed layer data')
                        require(len(tail) < len(chunk) or unpacked, 'compressed layer decoder made no progress')
                        chunk = tail
                else:
                    layer_hash.update(chunk)
                    layer_size += len(chunk)
            if decoder:
                require(decoder.eof and not decoder.unused_data, 'invalid compressed layer')
            require(raw_size == member.size, 'truncated archive member')
            raw_digest = 'sha256:'+raw_hash.hexdigest()
            if name.startswith('blobs/sha256/'):
                require(name == 'blobs/sha256/'+raw_hash.hexdigest(), 'archive blob path differs from its SHA-256')
            files[name] = (raw_digest, 'sha256:'+layer_hash.hexdigest(), layer_size)
            if document is not None:
                json_bytes += len(document)
                require(json_bytes <= 64*1024*1024, 'archive metadata too large')
                documents[name] = json_value(document)
    manifest = documents.get('manifest.json')
    require(isinstance(manifest, list) and 1 <= len(manifest) <= 16, 'Docker-save manifest missing or ambiguous')
    result = {}
    for item in manifest:
        require(isinstance(item, dict), 'invalid Docker-save manifest entry')
        config_path = item['Config']
        cfg = documents[config_path]
        require(isinstance(cfg, dict) and isinstance(cfg.get('config'), dict) and isinstance(cfg.get('rootfs'), dict), 'invalid image config object')
        require(cfg['config'].get('Labels') is None or isinstance(cfg['config']['Labels'], dict), 'invalid image labels object')
        layers = item['Layers']
        rootfs = cfg['rootfs']
        diff_ids = rootfs['diff_ids']
        require(rootfs['type'] == 'layers' and isinstance(layers, list) and isinstance(diff_ids, list) and len(layers) == len(diff_ids) and all(digest(d) for d in diff_ids), 'invalid ordered rootfs proof')
        for index, (path, expected) in enumerate(zip(layers, diff_ids)):
            actual = files[path][1]
            require(actual == expected, f'layer SHA-256 mismatch index={index} expected={expected} actual={actual}')
        platform = cfg['os']+'/'+cfg['architecture']
        require(re.fullmatch(r'[a-z0-9]+/[a-z0-9]+', platform), 'invalid platform metadata')
        proof = {'config_digest': files[config_path][0], 'diff_ids': diff_ids, 'platform': platform,
                 'revision': (cfg.get('config', {}).get('Labels') or {}).get('org.opencontainers.image.revision')}
        tags = item['RepoTags']
        require(isinstance(tags, list) and tags, 'untagged or ambiguous Docker-save image')
        for tag in tags:
            require(isinstance(tag, str) and tag not in result, 'duplicate archive tag')
            result[tag] = proof
    return result, sum(value[2] for name, value in files.items() if any(name in item['Layers'] for item in manifest))


def manifest_input(path):
    m = json_value(Path(path).read_bytes())
    require(isinstance(m, dict), 'invalid kit manifest object')
    require(m['format'] == 2 and m['platform'] == 'linux/amd64' and re.fullmatch(r'[a-f0-9]{40}', m['source_sha']), 'unsupported kit manifest; use the incoming format-2 installer')
    require(m['app_image'] == 'cheapshotmods:'+m['source_sha'], 'invalid source/image binding')
    require(re.fullmatch(r'[A-Za-z0-9:._/@-]+', m['proxy_image']), 'invalid proxy tag')
    return m


def compare(m, actual):
    require(set(actual) == {m['app_image'], m['proxy_image']}, 'archive contains unexpected image tags')
    for role in ('app', 'proxy'):
        expected = m['image_proofs'][role]
        current = actual[m[role+'_image']]
        require(digest(expected['config_digest']) and all(digest(d) for d in expected['diff_ids']), 'invalid expected image proof')
        require(expected['platform'] == 'linux/amd64' and (role != 'app' or expected['revision'] == m['source_sha']), 'invalid expected platform/revision proof')
        require(current['config_digest'] == expected['config_digest'], f'image proof mismatch role={role} type=config_sha256 expected={expected["config_digest"]} actual={current["config_digest"]}')
        require(current == expected, f'image proof mismatch role={role} type=ordered_rootfs_or_platform')


def inspect_images(m):
    result = {}
    for role in ('app', 'proxy'):
        raw = subprocess.check_output(['docker', 'image', 'inspect', m[role+'_image']], stderr=subprocess.DEVNULL)
        items = json_value(raw)
        require(isinstance(items, list) and len(items) == 1 and isinstance(items[0], dict), 'invalid Docker inspect result')
        item = items[0]
        require(digest(item['Id']), 'invalid daemon-native image identifier')
        proof = m['image_proofs'][role]
        require(item['Os']+'/'+item['Architecture'] == proof['platform'], f'image proof mismatch role={role} type=platform')
        require(item['RootFS']['Layers'] == proof['diff_ids'], f'image proof mismatch role={role} type=ordered_rootfs')
        result[role] = item['Id']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('record', 'archive', 'loaded'))
    parser.add_argument('manifest')
    parser.add_argument('archive', nargs='?')
    args = parser.parse_args()
    m = manifest_input(args.manifest)
    if args.action in ('record', 'archive'):
        require(args.archive is not None, 'archive path required')
        with open(args.archive, 'rb') as source:
            actual, image_bytes = archive_proofs(source)
        if args.action == 'record':
            m['image_proofs'] = {role: actual[m[role+'_image']] for role in ('app', 'proxy')}
            m['image_bytes'] = image_bytes
            compare(m, actual)
            Path(args.manifest).write_text(json.dumps(m, indent=2)+'\n')
        else:
            compare(m, actual)
        print('Archive config SHA-256 and ordered layer SHA-256 verified (format 2).')
        return
    before = inspect_images(m)
    process = subprocess.Popen(['docker', 'image', 'save', m['app_image'], m['proxy_image']], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        actual, _ = archive_proofs(process.stdout)
        require(process.wait() == 0, 'Docker export failed')
        compare(m, actual)
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.terminate()
        process.wait()
    require(inspect_images(m) == before, 'image tags changed during verification')
    for role in ('app', 'proxy'):
        print(f'Verified {role}: config_sha256={m["image_proofs"][role]["config_digest"]} native_id={before[role]} (daemon-local) platform=linux/amd64')


if __name__ == '__main__':
    try:
        main()
    except ProofError as error:
        print('Cheapshot image proof refused: '+str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, TypeError, IndexError, AttributeError, tarfile.TarError, EOFError, zlib.error, subprocess.SubprocessError):
        print('Cheapshot image proof refused: invalid archive/metadata or Docker export; no environment values printed', file=sys.stderr)
        sys.exit(1)
