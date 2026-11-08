# TASK004 — дизайн Sites в существующем Cheapshot

Комплект `6dc8021e58daa9aa16a93a9265315bb810fe9d0a`, [PR5](https://github.com/sa713/cheapshotmods/pull/5). Оформление Sites v1 перенесено в работающий React frontend; расчёты, Telegram, API и данные сохраняются. В комплект включено завершённое исправление группировки PR4. Сам редизайн не меняет schema3. При обновлении с прежнего fbe перенос schema2→3 выполняется тем же ранее проверенным Store в копии; с19a схема остаётся3.

Текущая установка владельца после прежних команд отдельно не подтверждена, поэтому путь допускает **fbe или19a** с external proxy. После update окна/Mini App перезагрузить. Developer не устанавливает этот kit на реальный сервер.

Команды выполняются владельцем в root Bash без sudo/gh/git/сборки, с существующим проектным github.curl. Короткая недоступность будет только у Cheapshot при snapshot/переключении app. Настройки бота и отдельный b008 operator сохраняются; общий proxy/Docker backend/BotFather/Sites не перенастраиваются.

## Если мало места: только проверенные скачанные копии

Предыдущий full update остановился из-за дискового preflight. Новый update тоже сохраняет reserve2GiB+2×image_bytes+2×data. Не применяйте Docker prune, не удаляйте volumes/backups и не ослабляйте guard. Следующий необязательный блок удаляет **только** известные checksum-verified ZIP/tar/images.tar.gz старых fbe/b008 скачиваний в двух scratch prefixes. Каталоги, configs, установленный helper, releases/backups, Docker images и рабочие данные сохраняются. Архивы, распакованные с сохранённым uid1001, этот консервативный блок пропустит: он удаляет только root-owned файлы и не гарантирует определённый освобождённый объём. Старые extracted scratch kits после удаления images.tar.gz становятся неполными для повторного install/update; установленный app и штатный rollback их не используют. Эти архивы можно снова скачать из прежних immutable artifacts.

```bash
python3 -I - <<'PY'
import hashlib
import os
from pathlib import Path
import re
import stat

base = Path('/root')
known = {
    'kit.zip': {
        'fb78a81f5df989c361390c227008916c239b5ad41a5535515cfe1f0581cec062',
        '4e1fa4d7e100c8b86468d6155231620ba3cbe3cc6b4c838c1a58eae1295bce45',
    },
    'cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64.tar.gz': {
        'cd250916ed39f7594d0eea37fea6adb185eb2fe9ec2528be7e9e57ea50d8238d',
    },
    'cheapshotmods-b008807fa1873de4fd6d926be42bc6bf515d6a66-linux-amd64.tar.gz': {
        '735dc319220db69837aa3a79a6e558cc213a7dc638152288a7a9124795fd6f45',
    },
    'cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64/images.tar.gz': {
        'f5a300101c1dbc6c280dd2a13441ce3546e774d21341041034e0ece15375dc13',
    },
    'cheapshotmods-b008807fa1873de4fd6d926be42bc6bf515d6a66-linux-amd64/images.tar.gz': {
        '111d6623df63cf22f2ad66d54b8d61a88713608a7b97e65134896464ff389d02',
    },
}
def private_directory(p):
    s = p.lstat()
    return stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022

def identity(s):
    return s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_uid, s.st_nlink

assert os.geteuid() == 0 and private_directory(base)
freed = 0
for directory in sorted(base.iterdir()):
    if not re.fullmatch(r'cheapshotmods-(?:r6|ingress)-[A-Za-z0-9]+', directory.name):
        continue
    if not private_directory(directory):
        continue
    for name, hashes in known.items():
        p = directory / name
        if p.parent != directory:
            try:
                if not private_directory(p.parent):
                    continue
            except FileNotFoundError:
                continue
        try:
            before = p.lstat()
        except FileNotFoundError:
            continue
        if not stat.S_ISREG(before.st_mode) or before.st_uid != 0 or before.st_nlink != 1:
            continue
        with p.open('rb') as stream:
            if identity(os.fstat(stream.fileno())) != identity(before):
                raise SystemExit('File changed; stop')
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest not in hashes:
            print('Skipped unrecognized archive:', p)
            continue
        if identity(p.lstat()) != identity(before):
            raise SystemExit('File changed; stop')
        p.unlink()
        freed += before.st_size
        print('Removed verified download:', p)
print('Reclaimed MiB:', freed // 1048576)
PY
df -h / /opt/cheapshotmods
```

Если проверенных копий нет или места всё ещё мало, нужен дополнительный диск/другое отдельно согласованное освобождение места. Ошибка preflight не повод повторять download/install или чистить Docker. Ориентир после распаковки — не менее3GiB свободно для небольшой базы; фактический необходимый объём installer рассчитывает сам.

## Скачать и обновить

Artifact `13583903966`, source `6dc8021e58daa9aa16a93a9265315bb810fe9d0a`, expires `2026-12-07T17:51:04Z`. ZIP `b29d9ba8fe17c2c1c2e85a6fc1a385b5cd965b367e240931aadd2a50976af740`; tar `2adb57e77465cac923b6473e2c938d57e664a280203dc2fbe729fd4ad38a53e0`. Комплект скачивается из private GitHub Actions с уже настроенным проектным токеном. На owner Debian Python3/curl/sha256sum/tar уже были проверены.

```bash
(
  set +x
  set -euo pipefail
  umask 077
  test -r /root/.config/cheapshotmods/github.curl
  test -f /opt/cheapshotmods/current.env
  python3 -I - <<'PY_GUARD'
from pathlib import Path
v = dict(line.split('=', 1) for line in Path('/opt/cheapshotmods/current.env').read_text().splitlines())
assert v['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2', '19a6fdde785eb90b01bd78318deeab1a539dde7b'}, 'Unexpected installed version; stop'
assert v['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
PY_GUARD
  CHM_SHA=6dc8021e58daa9aa16a93a9265315bb810fe9d0a
  CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-mods-XXXXXX)
  printf 'Kit directory: %s\n' "$CHM_DOWNLOAD"
  cd "$CHM_DOWNLOAD"

  curl --disable --config /root/.config/cheapshotmods/github.curl \
    --fail --silent --show-error --location --output kit.zip \
    https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13583903966/zip
  printf '%s  kit.zip\n' b29d9ba8fe17c2c1c2e85a6fc1a385b5cd965b367e240931aadd2a50976af740 | sha256sum --check -
  python3 -m zipfile -e kit.zip .
  printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' 2adb57e77465cac923b6473e2c938d57e664a280203dc2fbe729fd4ad38a53e0 "$CHM_SHA" | sha256sum --check -
  tar --no-same-owner -xzf "cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
  cd "cheapshotmods-$CHM_SHA-linux-amd64"
  sha256sum --check SHA256SUMS
  # Only the verified new transport archives; keep the complete extracted kit.
  rm -- ../kit.zip "../cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"

  bash ./chm.sh update /opt/cheapshotmods "$PWD"
  bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Ожидаются все13 `OK`, portable archive/loaded image proof, offline backup pathname, healthy new version `6dc8021e58daa9aa16a93a9265315bb810fe9d0a`, затем `HTTPS health/version OK: 6dc8021e58daa9aa16a93a9265315bb810fe9d0a`. При ошибке блок сразу останавливается. При отказе disk preflight app/data ещё не переключены; не повторяйте install/apply. Извлечённый kit остаётся в напечатанном/выбранном scratch каталоге, повторно скачивать его не нужно. При иной ошибке сохраните только безопасный текст ошибки без secrets; installer при неудаче после freeze возвращает старую пару автоматически.

После успеха полностью перезагрузите Mini App/страницу. Вид должен соответствовать новому Sites оформлению: тёмные панели, лаймовый акцент, карточка персонажа/расход, три входа крафта. Проверьте исходный/рабочий набор, примерку, craft→undo и reload; одинаковые mods остаются одной строкой с общим количеством и «Надето». Проверьте новый craft→undo, reload, сохранение расхода. Исходные записи ввода остаются отдельно редактируемыми. Сохранённая история отмены переносится; при409 в старой вкладке загрузите текущее состояние; после обновления полностью перезагрузите страницу/Mini App. Живую Telegram-интеграцию локальные подписанные фикстуры не подтверждают.

## Откат

FBE app не читает schema3,19a уже поддерживает её. При любом исходном варианте штатный rollback возвращает прежние image+volume вместе; новые записи после обновления останутся в новом volume и не появятся в старом. Не подключайте старый image к новой базе вручную и не удаляйте файлы SQLite/историю.

```bash
(
  set -euo pipefail
  python3 -I - <<'PY_GUARD'
from pathlib import Path
root = Path('/opt/cheapshotmods')
def version(name):
    return dict(line.split('=', 1) for line in (root / name).read_text().splitlines())['CHM_VERSION']
assert version('current.env') == '6dc8021e58daa9aa16a93a9265315bb810fe9d0a', 'Unexpected current version; stop'
assert version('previous.env') in {'fbe82aef6008d292515c0efce2fde601c221f3d2', '19a6fdde785eb90b01bd78318deeab1a539dde7b'}, 'Unexpected rollback target; stop'
PY_GUARD
  bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
  bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Guard фиксирует направление отката new→прежняя пара и останавливает повторный запуск этого блока после успешного rollback. После отката ожидается прежний SHA из previous.env: fbe82aef6008d292515c0efce2fde601c221f3d2 либо19a6fdde785eb90b01bd78318deeab1a539dde7b. Он будет показан check; заранее не предполагается, успел ли владелец установить предыдущий комплект. Общий ingress и отдельный `ingress-b008807.py` сохраняются. Следующее обновление после rollback снова запускайте входящим новым `NEW_KIT/chm.sh`, не старым installed script. Для обычного перезапуска уже обновлённого app используйте `bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods`; он не заменяет update/schema migration.
