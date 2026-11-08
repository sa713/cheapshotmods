# TASK-005 — обновление существующего Cheapshot на Debian

Новый runtime/kit: **feb6a1bf82e70474c482c6a2e1fb0e77c4e20586**, [PR6](https://github.com/sa713/cheapshotmods/pull/6). Пакетный и многоступенчатый фьюз, пополнение текущего эксперимента, крит 🧿/💢 и правильные 🅾️/💢/🧿/🌸. Проверки — [VALIDATION](TASK-005-VALIDATION.md), отдельное заключение — [review](reviews/TASK-005-review.md).

Команды исполняет владелец в **root Bash** на выбранном Debian13 amd64. Используется уже настроенный `/root/.config/cheapshotmods/github.curl` с project Actions+Contents Read; повторная настройка токена не нужна. Нет sudo/gh/git/сборки на сервере. Текущий installed SHA после прошлых передач отдельно не подтверждён, поэтому guard допускает только FBE/19a/6dc в external режиме. Если версия иная — команда остановится до изменения приложения.

Обновляется только Cheapshot: короткая пауза app при snapshot/переключении. Общий IP-прокси, Docker daemon/backend, соседние сервисы, BotFather и отдельный `ingress-b008807.py` не перенастраиваются. Stage/apply ingress для этого обновления не запускать. Настоящую установку developer не выполнял.

## Комплект и место

- Private artifact **13624905831**, [CI42498204953](https://github.com/sa713/cheapshotmods/actions/runs/42498204953), source exactfeb. Доступен до **2026-12-08T16:19:39Z**.
- ZIP:131913069bytes, SHA256 `0d7f1c83d417cb362c345b8ab32431362377128c87fad3cfe63431293a333731`.
- Tar SHA256 `30d5703a59ee734b5094291bf2ae83e4b46fb5039614753309f13a7037909e50`.
- Format2 config+ordered layer proof сохранён; app config SHA256 `525a862a4f228ffdf526a1f326b70f7d58e3ec91912ead682c0621465379c084`, image archive SHA256 `56bf824798f60583c083d738ddd0d8eeea0c92bf4199b718731daf40d7da429d`. Native image ID может отличаться между classic/containerd — никаких ручных обходов сравнения не требуется.

Guard установщика остаётся2GiB+2×image_bytes+2×data, здесь image_bytes350712320: примерно2,65GiB+две копии данных свободного места **после распаковки**, плюс временный overhead Docker/доставки. Не ориентируйтесь только на общий размер gzip. Скрипт удаляет лишь два проверенных транспортных ZIP/tar текущего скачивания; полный extracted kit остаётся. При отказе preflight приложение и рабочий volume не переключены. Не обходите guard, не делайте Docker prune/удаление volumes/backups. Для прежних checksum-known scratch ZIP/tar сохранён отдельный необязательный cleanup в [старой инструкции](TASK-004-SITES-NEXT-STEPS.md#если-мало-места-только-проверенные-скачанные-копии); он не трогает Docker и не гарантирует нужный объём. В локальном native стенде такой отказ также был получен и исправлен освобождением собственных воспроизводимых caches, без ослабления guard.

## Обновление

Ниже команды [TASK-005-update.sh](TASK-005-update.sh), SHA256 `04d94cdd1a5cded979213be21bd520f8fb715a1588718d311fc41e63847cc31c`. При скачивании самого скрипта через GitHub Contents используйте SHA финального HEAD передачи из ответа developer и этот checksum. Скрипт не загружает код по плавающей ветке. Inline блок дополнительно заключён в subshell, чтобы его shell options не меняли интерактивную root-сессию.

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
assert v['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a'}, 'Unexpected installed version; stop'
assert v['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
PY_GUARD
CHM_SHA=feb6a1bf82e70474c482c6a2e1fb0e77c4e20586
CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-task005-XXXXXX)
printf 'Kit directory: %s\n' "$CHM_DOWNLOAD"
cd "$CHM_DOWNLOAD"
curl --disable --config /root/.config/cheapshotmods/github.curl \
  --fail --silent --show-error --location --output kit.zip \
  https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13624905831/zip
printf '%s  kit.zip\n' 0d7f1c83d417cb362c345b8ab32431362377128c87fad3cfe63431293a333731 | sha256sum --check -
python3 -m zipfile -e kit.zip .
printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' 30d5703a59ee734b5094291bf2ae83e4b46fb5039614753309f13a7037909e50 "$CHM_SHA" | sha256sum --check -
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

Ожидаются ZIP/tar OK, все13 файлов OK, archive/loaded config+ordered-layer proof, пути online/offline backup, здоровая новая версия и **`HTTPS health/version OK: feb6a1bf82e70474c482c6a2e1fb0e77c4e20586`**, затем preserved config/helper OK. Private каталог комплекта, прежняя metadata и `pre-update-backup.path` сохраняются в напечатанном `Kit directory`. Не отправляйте содержимое credential/config/private diagnostics в чат.

Если disk guard отказал, повторно скачивать kit не нужно: после достаточного освобождения места можно вызвать **тот же** `bash NEW_KIT/chm.sh update /opt/cheapshotmods NEW_KIT` из полного извлечённого каталога, затем installed check. Не используйте install или ingress apply вместо update. При иной ошибке не удаляйте данные ради запуска: сохраните safe error и локальные private diagnostics. После freeze установщик при неудаче возвращает прежнюю пару автоматически; check всё равно нужен.

Полностью перезагрузите сайт/Mini App. У старых 🧿/💢 крит будет «неизвестен»; при таких надетых итог явно неполный, это сохранённые данные, а не ноль. Крит можно уточнить бесплатно в исходном или текущем наборе, включая часть группы/надетых. Старый открытый frontend после миграции revision может получить409 — загрузите актуальные данные. Проверьте batch preview→применить→одна отмена, новые добавления после крафта, уточнение крита, экипировку, spent и reload. Живые OIDC/Mini App/телефон и реальный сервер этим synthetic тестированием не объявляются проверенными.

## Откат к версии до обновления

Все прежние FBE/19a/6dc приложения **не читают schema4**. Штатный rollback возвращает прежние image+volume **вместе**. Новые записи после update останутся в новом volume и не появятся в прежнем. Не подключайте старый app к новой базе вручную. Этот блок рассчитан на откат сразу после update; restore и другие последующие переключения меняют previous.env.

Команды [TASK-005-rollback.sh](TASK-005-rollback.sh), SHA256 `2196c1e655b02e25a4f364ba4d4d450bc38e42583447f7e0ba42b675646c1438`:

```bash
(
#!/usr/bin/env bash
# Restore only the previous image+volume pair. Never attach an old image to schema4.
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
assert current['CHM_VERSION'] == 'feb6a1bf82e70474c482c6a2e1fb0e77c4e20586', 'Unexpected current version; stop'
assert previous['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a'}, 'Unexpected rollback target; stop'
assert current['CHM_PROXY_MODE'] == previous['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
print('Rollback target:', previous['CHM_VERSION'])
PY_GUARD
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Guard запрещает повторный запуск после успешного возврата и неожиданный target. Check должен показать ровно напечатанный `Rollback target`. General ingress/helper/config сохраняются. Для повторного update после rollback снова используйте incoming NEW_KIT/chm.sh; restart не выполняет обновление/миграцию.

## Проверка, backup и восстановление

Эти команды уже доступны установленному комплекту:

```bash
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Backup печатает конкретный private путь `/opt/cheapshotmods/backups/backup-...sqlite`; предварительный backup записан также в `Kit directory/pre-update-backup.path`. Для **осознанного восстановления выбранной точки**, задайте `CHM_BACKUP` ровно напечатанным существующим путём, затем:

```bash
(
set -euo pipefail
: "${CHM_BACKUP:?Укажите конкретный путь из вывода backup}"
test -f "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Restore создаёт отдельный volume для текущего image, сохраняя прежний volume; записи позже выбранной точки не переносятся автоматически. Для старого backup новый app мигрирует его копию в schema4. Для отмены только что сделанного restore обычный `bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods` вернёт предыдущую пару **текущей сборки**; version-guard блока «Откат к версии до обновления» в этой ситуации намеренно откажет. Не подменяйте previous.env вручную. Все эти переходы проверены на отдельных synthetic volumes; никаких обещаний переноса новых записей в старую schema не даётся.
