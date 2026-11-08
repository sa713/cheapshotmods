# TASK-008 — установка владельцем

Runtime **0f2cd90c5b672d67409c2687e4e90a8ce9797482**, schema6. Кандидат добавляет постоянный зафиксированный исходный набор и отдельный полный возврат; обычный сброс эксперимента сохраняется. [Доказательства](TASK-008-VALIDATION.md), [независимое review](reviews/TASK-008-review.md). Интеграцию PR9 вmain после приёмки завершает management; реальный сервер обновляет владелец. Product acceptance/delivery и живые Telegram/телефон отдельно pending.

Команды поддерживают шесть predecessors: FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` (schema2), `19a6fdde785eb90b01bd78318deeab1a539dde7b` и `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` (schema3), TASK-005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` (schema4), TASK-006 `d6cb0e9404f07b5573b64131281d29569a010442` и canonical TASK-007 `f944acb6435a9671cef6db5fc500b79a71d21133` (schema5). Текущий owner SHA не предполагается; неизвестная версия остановит script.

Нужны существующие `/opt/cheapshotmods` и private credential `/root/.config/cheapshotmods/github.curl`. Новый ключ/git/gh/npm/сборка на сервере не нужны. Root script сверяет external mode и точные ZIP/tar/13files, сохраняет current metadata и свежий backup, вызывает штатные update/check и проверяет config/отдельный `ingress-b008807.py`. Общий proxy/BotFather не перенастраиваются.

Дисковый guard сохранён: external reserve2GiB + две копии image_bytes + две копии данных. При отказе остановиться; guard не обходить, images/volumes/backups соседей не удалять. Удаляются только проверенные скачанные ZIP/tar, извлечённый kit сохраняется. Прежний узкий cleanup транспортных архивов — в [TASK-004-SITES-NEXT-STEPS.md](TASK-004-SITES-NEXT-STEPS.md), он не является Docker prune.

После update полностью перезагрузите сайт/Mini App. Прежние данные, история и расход должны сохраниться; исходный набор ещё не зафиксирован автоматически. Проверьте введённый инвентарь и явно нажмите «Зафиксировать исходный набор модов»: появятся время/объём. Фьюзы и правки его не меняют. «Сбросить эксперимент» возвращает рабочие моды к введённому сейчас инвентарю. «Сбросить набор модов к исходному» после подтверждения возвращает оба набора к снимку, удаляя поздние добавления/правки и обнуляя фьюзы/экипировку/расход; уровень сохраняется. Повторная фиксация заменяет точку возврата только после подтверждения. Снимок общий для сайта/Mini App, включая незагруженные страницы; после reload он сохраняется.

Старый app5 не открывает schema6. Откат — только штатная прежняя пара **image + volume**; новые записи после update остаются в новом volume и не переносятся в старую БД автоматически. Отдельный rollback ниже рассчитан на непосредственный откат этого update до других restore/update и проверяет допустимую предыдущую версию.

## Неизменяемый комплект

- Private immutable artifact **[13637904971](https://github.com/sa713/cheapshotmods/actions/runs/42532270571/artifacts/13637904971)**, [CI42532270571](https://github.com/sa713/cheapshotmods/actions/runs/42532270571), до **2026-12-08T23:11:21Z**.
- ZIP: 131996431байт, SHA256 `137d70277d444e5466af98b31f9c060e137b46cea59a09d64ab330f97cba5537`.
- tar SHA256: `ff10cb999695d0ef35b01b755abcb5f9adceb216f373a48ac659fc793a2a2c7c`.
- [Паспорт/manifest](evidence/TASK-008/kit.json): exact sourceSHA/platform/config digest/ordered layers/image_bytes/внутренние хеши. Все13 checksums/11packaged deploy sources и format2 archive proof проверены. После expiry developer выпускает новый доступный CI artifact с новыми ID/хешами/доказательствами; другой архив под прежние команды не подставлять.

## Обновление и проверка

Весь блок выполняется от root и совпадает с [TASK-008-update.sh](TASK-008-update.sh). Developer эти команды на реальном сервере не выполнял.

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
assert v['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133'}, 'Unexpected installed version; stop'
assert v['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
PY_GUARD
CHM_SHA=0f2cd90c5b672d67409c2687e4e90a8ce9797482
CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-task008-XXXXXX)
printf 'Kit directory: %s\n' "$CHM_DOWNLOAD"
cd "$CHM_DOWNLOAD"
curl --disable --config /root/.config/cheapshotmods/github.curl \
  --fail --silent --show-error --location --output kit.zip \
  https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13637904971/zip
printf '%s  kit.zip\n' 137d70277d444e5466af98b31f9c060e137b46cea59a09d64ab330f97cba5537 | sha256sum --check -
python3 -m zipfile -e kit.zip .
printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' ff10cb999695d0ef35b01b755abcb5f9adceb216f373a48ac659fc793a2a2c7c "$CHM_SHA" | sha256sum --check -
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

Блок совпадает с [TASK-008-rollback.sh](TASK-008-rollback.sh); при неожиданной текущей/предыдущей версии он откажет.

```bash
(
#!/usr/bin/env bash
# Restore only the previous image+volume pair. Restore image and volume together, Never attach a schema5 binary to schema6.
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
assert current['CHM_VERSION'] == '0f2cd90c5b672d67409c2687e4e90a8ce9797482', 'Unexpected current version; stop'
assert previous['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133'}, 'Unexpected rollback target; stop'
assert current['CHM_PROXY_MODE'] == previous['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
print('Rollback target:', previous['CHM_VERSION'])
PY_GUARD
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods

)
```

## Внешняя проверка и backup

Владелец проверяет реальный HTTPS endpoint, `/version` должен показать **0f2cd90c5b672d67409c2687e4e90a8ce9797482**:

```bash
curl --fail --silent --show-error https://94.228.170.13:9443/health
curl --fail --silent --show-error https://94.228.170.13:9443/version
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Backup печатает конкретный private `.sqlite` путь; он включает зафиксированный набор и текущий эксперимент целиком. Pre-update backup записан также в `Kit directory/pre-update-backup.path`. Для восстановления выбранной точки задайте существующий путь в `CHM_BACKUP`:

```bash
(
set -euo pipefail
: "${CHM_BACKUP:?Укажите конкретный путь из вывода backup}"
test -f "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods "$CHM_BACKUP"
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
)
```

Restore создаёт отдельный volume для текущего image. Новый backup возвращает snapshot и experiment выбранной точки; старый schema2–5 backup мигрируется в6 без автоматического snapshot. Для отмены только что сделанного restore штатный rollback вернёт предыдущую пару той же текущей сборки; отдельный guard отката к predecessor намеренно откажет. `previous.env` вручную не менять. Данные после выбранной точки автоматически не переносятся.
