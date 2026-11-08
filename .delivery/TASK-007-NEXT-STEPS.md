# TASK-007 — установка владельцем

Кандидат заменяет ручной смешанный массовый пул автоматическим максимумом из одной однородной группы. Runtime **f944acb6435a9671cef6db5fc500b79a71d21133**, schema5. [Доказательства](TASK-007-VALIDATION.md), [независимое ревью](reviews/TASK-007-review.md). Реальная установка, живые Telegram/телефон и product acceptance pending.

Поддержаны пять predecessors: FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` (schema2), `19a6fdde785eb90b01bd78318deeab1a539dde7b` и `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` (schema3), canonical TASK-005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` (schema4), canonical TASK-006 `d6cb0e9404f07b5573b64131281d29569a010442` (schema5). Команды не предполагают, какая из этих версий установлена у владельца.

Используются существующие `/opt/cheapshotmods` и private credential `/root/.config/cheapshotmods/github.curl`. Git/gh/npm/сборка и новый ключ на сервере не нужны. Root script проверяет текущую версию/external mode, точные ZIP/tar/13 внутренних файлов, сохраняет metadata и backup, запускает штатные update/check и сверяет config/отдельный `ingress-b008807.py`. Общий proxy и BotFather не перенастраиваются.

Дисковый guard сохранён: external reserve2GiB + две копии image_bytes + две копии данных. При отказе guard остановиться; обходить его и удалять Docker images/volumes/backups соседей нельзя. Script удаляет только проверенные скачанные ZIP/tar, оставляя полный извлечённый kit. Узкий прежний cleanup старых транспортных архивов описан в [TASK-004-SITES-NEXT-STEPS.md](TASK-004-SITES-NEXT-STEPS.md), это не общий Docker prune.

После update полностью перезагрузите сайт/Mini App. Проверьте прежний инвентарь/историю и повторный вход. Для20одинаковых🅾️1.0 по10 и цели3.0 сразу должны появиться max2, цена1008 и остаток2; уменьшение до1 даёт504/остаток11. Проверьте явное включение надетых, применение/undo, сырьевой путь1.0/2.0 и старую отмену. Неизвестный crit требует уточнения перед новой mass-командой. Одиночный смешанный фьюз доступен по прежним правилам.

Откат — только штатный возврат прежней пары **image + volume**, в том числе schema5→schema5. Записи после update остаются в новом volume и не обещаются в старой БД. Rollback ниже предназначен для непосредственного отката этого update до других restore/update и проверяет допустимую предыдущую версию.

## Неизменяемый комплект

- Artifact **[13631764817](https://github.com/sa713/cheapshotmods/actions/runs/42516633521/artifacts/13631764817)**, [CI42516633521](https://github.com/sa713/cheapshotmods/actions/runs/42516633521), доступен до **2026-12-08T20:04:25Z**.
- ZIP: 131995030байт, SHA256 `225cf1d60f0f179c18fcc7a776c98deff32448dd2f5fe74601ff6e354f4613eb`.
- tar SHA256: `e0fef732af099f91f18810954fb48c1e89b19a44c30c7947828f3250ccd4596b`.
- [Паспорт и полный manifest](evidence/TASK-007/kit.json): sourceSHA/platform/config digest/ordered layers/image_bytes и хеши. Все13 checksums,11 packaged deploy sources и format2 archive proof сверены с exact Git source. После expiry требуется новый CI-комплект и новая передача ID/хешей; прежние команды не подменяются другим архивом.

## Обновление и проверка

Скопируйте **весь блок** в root shell. Он совпадает с [TASK-007-update.sh](TASK-007-update.sh). Реальный сервер developer не менял.

```bash
(
#!/usr/bin/env bash
# Owner-operated Debian update. Run as root; no sudo, gh, build or proxy changes.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run this command as root.' >&2; exit 1; }
test -r /root/.config/cheapshotmods/github.curl
test -f /opt/cheapshotmods/current.env
python3 -I - <<'PY_GUARD'
from pathlib import Path
v = dict(line.split('=', 1) for line in Path('/opt/cheapshotmods/current.env').read_text().splitlines())
assert v['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442'}, 'Unexpected installed version; stop'
assert v['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
PY_GUARD
CHM_SHA=f944acb6435a9671cef6db5fc500b79a71d21133
CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-task007-XXXXXX)
printf 'Kit directory: %s\n' "$CHM_DOWNLOAD"
cd "$CHM_DOWNLOAD"
curl --disable --config /root/.config/cheapshotmods/github.curl \
  --fail --silent --show-error --location --output kit.zip \
  https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13631764817/zip
printf '%s  kit.zip\n' 225cf1d60f0f179c18fcc7a776c98deff32448dd2f5fe74601ff6e354f4613eb | sha256sum --check -
python3 -m zipfile -e kit.zip .
printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' e0fef732af099f91f18810954fb48c1e89b19a44c30c7947828f3250ccd4596b "$CHM_SHA" | sha256sum --check -
tar --no-same-owner -xzf "cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
cd "cheapshotmods-$CHM_SHA-linux-amd64"
sha256sum --check SHA256SUMS
# Remove only these verified transport duplicates. Keep the complete extracted kit.
rm -- ../kit.zip "../cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
cp /opt/cheapshotmods/current.env "$CHM_DOWNLOAD/before-update.env"
sha256sum /opt/cheapshotmods/config.env > "$CHM_DOWNLOAD/preserved.sha256"
if [[ -f /opt/cheapshotmods/ingress-b008807.py ]]; then
  sha256sum /opt/cheapshotmods/ingress-b008807.py >> "$CHM_DOWNLOAD/preserved.sha256"
fi
CHM_BACKUP=$(bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods)
printf '%s\n' "$CHM_BACKUP" > "$CHM_DOWNLOAD/pre-update-backup.path"
printf 'Pre-update backup: %s\n' "$CHM_BACKUP"
bash ./chm.sh update /opt/cheapshotmods "$PWD"
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
sha256sum --check "$CHM_DOWNLOAD/preserved.sha256"
printf 'Updated: %s\nReload the website/Mini App completely.\n' "$CHM_SHA"

)
```

## Непосредственный откат этого обновления

Блок совпадает с [TASK-007-rollback.sh](TASK-007-rollback.sh). При неожиданной версии он откажет. Новые записи останутся в новом volume.

```bash
(
#!/usr/bin/env bash
# Restore only the previous image+volume pair. Restore image and volume together, even when both use schema5.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run this command as root.' >&2; exit 1; }
python3 -I - <<'PY_GUARD'
from pathlib import Path
root = Path('/opt/cheapshotmods')
def metadata(name):
    return dict(line.split('=', 1) for line in (root / name).read_text().splitlines())
current, previous = metadata('current.env'), metadata('previous.env')
assert current['CHM_VERSION'] == 'f944acb6435a9671cef6db5fc500b79a71d21133', 'Unexpected current version; stop'
assert previous['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442'}, 'Unexpected rollback target; stop'
assert current['CHM_PROXY_MODE'] == previous['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
print('Rollback target:', previous['CHM_VERSION'])
PY_GUARD
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods

)
```

## Проверка извне и резервная копия

После update владелец проверяет фактический HTTPS endpoint; `/version` должен вернуть `f944acb6435a9671cef6db5fc500b79a71d21133`:

```bash
curl --fail --silent --show-error https://94.228.170.13:9443/health
curl --fail --silent --show-error https://94.228.170.13:9443/version
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Backup печатает конкретный private `.sqlite` путь. Предварительный backup записан в `Kit directory/pre-update-backup.path`. Для восстановления выбранной точки укажите именно существующий путь в `CHM_BACKUP`:

```bash
(
set -euo pipefail
: "${CHM_BACKUP:?Укажите конкретный путь из вывода backup}"
test -f "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Restore создаёт отдельный volume для текущего image; старый backup мигрируется в schema5 в новой копии. Для отмены только что сделанного restore штатный `rollback` возвращает предыдущую пару той же текущей сборки; отдельный guard отката к predecessor намеренно откажет. `previous.env` вручную не менять. Записи после выбранной точки автоматически не переносятся.
