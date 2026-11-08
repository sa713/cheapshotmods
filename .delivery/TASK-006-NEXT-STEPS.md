# TASK-006 — установка владельцем

Кандидат добавляет три сырьевых вида, их экипировку и одиночный/пакетный путь до 6.0. Runtime **d6cb0e9404f07b5573b64131281d29569a010442**, schema5. Полные [доказательства](TASK-006-VALIDATION.md) и [независимое ревью](reviews/TASK-006-review.md) относятся к указанной версии; установка на сервере владельца и реальные Telegram/телефон ещё не проверены.

Поддержанные предшественники: FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` (schema2), `19a6fdde785eb90b01bd78318deeab1a539dde7b` и `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` (schema3), canonical TASK-005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` (schema4). Команды не предполагают, что TASK-005 уже установлен. Используются существующие `/opt/cheapshotmods` и private credential `/root/.config/cheapshotmods/github.curl`. Новый ключ, git, gh, npm и сборка на сервере не нужны.

Загрузка выполняется от root. Script проверяет текущую версию и external mode, сверяет ZIP/tar/внутренние файлы, сохраняет metadata и backup, затем вызывает штатные update/check. Отдельный `ingress-b008807.py` и config проверяются по хешам. Общий proxy и BotFather не перенастраиваются.

Дисковый guard сохранён: external reserve 2 GiB + две копии image_bytes + две копии данных. При его отказе установка останавливается; guard не обходить, Docker images/volumes/backups соседних сервисов не удалять. Из скачанного нового kit script убирает только проверенные ZIP/tar, сохраняя извлечённый комплект. Прежний узкий cleanup известных старых транспортных архивов остаётся в [TASK-004-SITES-NEXT-STEPS.md](TASK-004-SITES-NEXT-STEPS.md); он не является общим Docker prune.

После обновления полностью перезагрузите сайт/Mini App. Проверьте прежний инвентарь и историю, добавьте по три фиолетовых/красных и три зелёных, примерьте их, проверьте цену и результат single, затем undo. Проверьте пакет в 1.0/2.0 и состояние после повторного входа.

Для отката используйте только штатный rollback прежней пары **image + volume**. Старый image не открывает schema5. Записи после обновления остаются в новом volume; они не обещаются в старой БД. Rollback script предназначен для непосредственного отката этого update до других restore/update операций и проверяет допустимую предыдущую версию.


## Неизменяемый комплект

- Artifact **[13628229576](https://github.com/sa713/cheapshotmods/actions/runs/42507713711/artifacts/13628229576)**, [CI 42507713711](https://github.com/sa713/cheapshotmods/actions/runs/42507713711). Доступен до **2026-12-08T18:19:24Z**.
- ZIP: 131987880 байт, SHA256 `ee1b0eb98d48d46de6ee94e33eda5aa1d4a93e1aa1f23ab7817bfe90e2c521d7`.
- tar: SHA256 `11b211873794fcb13386ad2d97dce97d23521cb00835dcb466d04a196fb98beb`.
- [Manifest и полный паспорт kit](evidence/TASK-006/kit.json): source SHA, config digest, ordered layers, image_bytes и внутренние хеши. Archive proof, все 13 SHA256SUMS и 11 packaged deploy sources сверены с exact Git source. После expiry developer должен восстановить/пересобрать комплект в CI и выпустить новые ID/хеши; прежние команды не подменяются другим архивом.

## Обновление и проверка

Скопируйте **весь блок** в root shell. Он совпадает с [TASK-006-update.sh](TASK-006-update.sh). Реальный сервер командами developer не менялся.

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
assert v['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586'}, 'Unexpected installed version; stop'
assert v['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
PY_GUARD
CHM_SHA=d6cb0e9404f07b5573b64131281d29569a010442
CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-task006-XXXXXX)
printf 'Kit directory: %s\n' "$CHM_DOWNLOAD"
cd "$CHM_DOWNLOAD"
curl --disable --config /root/.config/cheapshotmods/github.curl \
  --fail --silent --show-error --location --output kit.zip \
  https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13628229576/zip
printf '%s  kit.zip\n' ee1b0eb98d48d46de6ee94e33eda5aa1d4a93e1aa1f23ab7817bfe90e2c521d7 | sha256sum --check -
python3 -m zipfile -e kit.zip .
printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' 11b211873794fcb13386ad2d97dce97d23521cb00835dcb466d04a196fb98beb "$CHM_SHA" | sha256sum --check -
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

Блок совпадает с [TASK-006-rollback.sh](TASK-006-rollback.sh). Он откажет при неожиданной текущей/предыдущей версии. Новые записи останутся в новом volume.

```bash
(
#!/usr/bin/env bash
# Restore only the previous image+volume pair. Never attach an old image to schema5.
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
assert current['CHM_VERSION'] == 'd6cb0e9404f07b5573b64131281d29569a010442', 'Unexpected current version; stop'
assert previous['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586'}, 'Unexpected rollback target; stop'
assert current['CHM_PROXY_MODE'] == previous['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
print('Rollback target:', previous['CHM_VERSION'])
PY_GUARD
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

## Проверка извне и резервная копия

После успешного update владелец проверяет фактический HTTPS endpoint; `/version` должен показать `d6cb0e9404f07b5573b64131281d29569a010442`:

```bash
curl --fail --silent --show-error https://94.228.170.13:9443/health
curl --fail --silent --show-error https://94.228.170.13:9443/version
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Backup печатает конкретный private `.sqlite` путь. Предварительный backup указан также в `Kit directory/pre-update-backup.path`. Для восстановления выбранной точки укажите именно существующий путь в `CHM_BACKUP`:

```bash
(
set -euo pipefail
: "${CHM_BACKUP:?Укажите конкретный путь из вывода backup}"
test -f "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Restore создаёт отдельный volume для текущего image; старый backup мигрируется в schema5 в новой копии. Для отмены только что сделанного restore штатный `rollback` вернёт предыдущую пару той же текущей сборки; guard отдельного блока отката к predecessor намеренно откажет. `previous.env` вручную не менять. Новые записи после выбранной точки не переносятся автоматически.
