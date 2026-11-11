# TASK-009 — приватный комплект и готовое обновление Debian

Runtime **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**, schema 6. Пересборки не было: передаётся сохранённый и повторно сверенный установочный архив. [PR10](https://github.com/sa713/cheapshotmods/pull/10), [авторские проверки](TASK-009-VALIDATION.md), [новый маршрут и его границы](TASK-009-PRIVATE-DELIVERY.md), [пакет управляющему](TASK-009-MANAGEMENT-HANDOFF.md).

Владелец отдельно разрешил TASK-009 без новых Actions runs/Actions artifacts/ожидания квоты и платных услуг. Этот маршрут не меняет стандарт 1.1.0/workflows/постоянную инфраструктуру. Исторические CI jobs остаются failure из-за upload quota; их успешные вычислительные шаги не выдаются за зелёный CI.

Независимая техническая приёмка management пока **pending**. Команду установки ниже выполнять после этой приёмки. У developer нет предоставленного SSH identity/agent для Debian, поэтому реальное обновление не выполнялось. Точный установленный SHA, место и рабочий HTTPS проверяет команда на самом сервере. Не требуется предварительно ставить TASK-008.

## Реально доступная приватная передача

- [Delivery snapshot](https://github.com/sa713/cheapshotmods/tree/1a15be22d1e00d50542090786c47e15a76151d18), отдельная ветка `delivery/task-009-eb655846-1487bedc` в существующем **приватном** репозитории. Это транспортные данные, не новая реализация и не ветка для слияния в main.
- Закреплённый delivery commit: `1a15be22d1e00d50542090786c47e15a76151d18`. [Authenticated download](https://api.github.com/repos/sa713/cheapshotmods/tarball/1a15be22d1e00d50542090786c47e15a76151d18). Нужен доступ к репозиторию; прежнего PAT с Contents Read-only достаточно. Владелец использует существующий `/root/.config/cheapshotmods/github.curl`, без gh/git/npm/нового ключа.
- Исходный tar: **132005139**байт; SHA256 **1487bedc2d7c1cf18b4b1d336ca87a72a2fe1d3b007e9a39c86b29ecf81e08c6**. App config: `sha256:ccc2ffc10c50c9968433243e23ed652e610dc7a42a84642459cb1622a29ac520`.
- Манифест 32 частей: SHA256 `b1138a4772cb0b268c1c164e1d4ff8122ce2d26247120fce5582f096ad62c86a`. Части восстанавливают исходный tar побайтно; новый runtime из позднего HEAD не собирается.
- GitHub генерирует внешний source tarball: его gzip-байты могут меняться. Проверяются неизменный commit, закреплённый manifest, все part SHA256, исходный tar SHA256,13 внутренних checksums и config/ordered layers. Внешний source tarball не является непосредственно установочным tar.
- [Receipt реального скачивания с GitHub и проверки всех байтов](evidence/TASK-009/private-transfer.json). Локальный путь Codex передачей не считается. У Git delivery нет 30 дневного срока Actions; доступ сохраняется пока существуют репозиторий/ref. Delivery ref не удалять до приёмки, установки и окончания необходимого хранения комплекта.

Release asset endpoint вернул HTTP400 даже для 140 байт checksum; пустой собственный draft удалён после проверки Git-передачи. Поэтому используется этот разовый delivery snapshot, а не Release upload. История ошибки сохранена; публичность и права не менялись.

## Что делает команда

Проверяет root/Debian/amd64, существующую установку/external mode, приватные 0600config/credential и фактически работающий HTTPS `/version`. Разрешены только семь проверенных predecessors: FBE `fbe82aef6008d292515c0efce2fde601c221f3d2`, `19a6fdde785eb90b01bd78318deeab1a539dde7b`, `6dc8021e58daa9aa16a93a9265315bb810fe9d0a`, TASK005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586`, TASK006 `d6cb0e9404f07b5573b64131281d29569a010442`, TASK007 `f944acb6435a9671cef6db5fc500b79a71d21133`, TASK-008 `0f2cd90c5b672d67409c2687e4e90a8ce9797482`. Неизвестный SHA останавливает выполнение. Повтор update при уже установленном eb655846 также останавливается до загрузки/backup/переключения; для него использовать check.

До большой загрузки измеряет текущие данные через read-only mount и свободное место у установки, загрузки и Docker. Консервативный бюджет: **2 GiB + 2×image_bytes + 3×текущие данные + 3×tar_bytes + 8 MiB** (включает отдельный online backup и peak транспорта). Затем неизменный installer дополнительно выполняет собственный disk guard **2 GiB + 2×image_bytes + 2×данные**. При недостатке места — stop, без обхода или очистки images/volumes/cache/данных соседних сервисов.

После загрузки проверяет все хеши, создаёт свежий SQLite backup, сохраняет before-update metadata и hashes config/отдельного `ingress-b008807.py`. Штатный installer проверяет импортированные image config/layers **до остановки app и миграции**, замораживает записи, делает отдельный offline backup и новую копию volume. После update проверяет HTTPS/source, schema 6/integrity/foreign keys, отдельный новый volume, точную предыдущую пару и неизменные config/helper. Ошибка post-check вызывает парный rollback только при подтверждённой прежней паре. Shared proxy не пересоздаётся и не перенастраивается.

Печатаются приватные пути `Private delivery directory`, `Pre-update backup`, `Receipt`. Там сохраняются metadata, log, backup path и receipt; config/секреты в вывод не попадают. Удаляются только проверенные транспортные дубликаты текущего скачивания. Извлечённый kit, backup, старые image+volume сохраняются. При ошибке не запускать команды циклом: прочитать сообщение и приватный log, сохраняя guard.

## Скачать проверенный operator и обновить

Весь блок выполнять от **root** после независимой приёмки management. Он совпадает с [TASK-009-update.sh](TASK-009-update.sh). Загружается только 17 KBoperator как JSON Git blob; SHA256 проверяется **до исполнения**. Затем operator сам скачивает и проверяет весь комплект. Его source — [TASK-009-install.py](TASK-009-install.py), SHA256 `89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e`.

```bash
bash -s -- update <<'CHM_TASK009_COMMAND'
#!/usr/bin/env bash
# Owner-operated bootstrap; the verified Python helper performs all host checks.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
CHM_OPERATION=${1:-update}
case "$CHM_OPERATION" in fetch|preflight|prepare|update|check|rollback) ;; *) echo 'Unknown operation.' >&2; exit 2;; esac
CHM_OPERATOR=/root/cheapshotmods-task009-89d1f3296b0c.py
if [[ ! -e "$CHM_OPERATOR" && ! -L "$CHM_OPERATOR" ]]; then
  python3 -I - <<'PY_CREDENTIAL'
from pathlib import Path
import stat
p=Path('/root/.config/cheapshotmods/github.curl')
assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Existing root-owned0600 GitHub curl credential required'
PY_CREDENTIAL
  CHM_BOOTSTRAP_TEMP=$(mktemp -d /root/cheapshotmods-task009-command-XXXXXX)
  trap 'rm -rf -- "$CHM_BOOTSTRAP_TEMP"' EXIT
  curl --disable --config /root/.config/cheapshotmods/github.curl \
    --fail --silent --show-error --location --connect-timeout 15 --max-time 60 --max-filesize 65536 \
    --output "$CHM_BOOTSTRAP_TEMP/operator.json" \
    https://api.github.com/repos/sa713/cheapshotmods/git/blobs/c3828438fab992b6cd84b5ddf7392a358a378349
  python3 -I - "$CHM_BOOTSTRAP_TEMP/operator.json" "$CHM_OPERATOR" <<'PY_FETCH'
import base64,hashlib,json,os,sys
from pathlib import Path
value=json.loads(Path(sys.argv[1]).read_text())
assert value['encoding']=='base64'
data=base64.b64decode(''.join(value['content'].split()),validate=True)
assert len(data)==17659 and hashlib.sha256(data).hexdigest()=='89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e', 'Operator checksum mismatch'
with os.fdopen(os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as output: output.write(data)
PY_FETCH
fi
python3 -I - "$CHM_OPERATOR" <<'PY_VERIFY'
from pathlib import Path
import hashlib,stat,sys
p=Path(sys.argv[1]);assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Unexpected local operator file'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e', 'Local operator checksum mismatch; stop without overwriting'
PY_VERIFY
printf 'Verified operator: %s\n' "$CHM_OPERATOR"
if [[ "$CHM_OPERATION" != fetch ]]; then python3 -I "$CHM_OPERATOR" "$CHM_OPERATION"; fi
CHM_TASK009_COMMAND
```

Для предварительной проверки без обновления можно выполнить этот же блок с `preflight` вместо `update` **только в первой строке**. `fetch` только сохраняет проверенный operator; `prepare` выполняет preflight и подготавливает комплект без переключения app. Основной update всё равно повторяет свои необходимые актуальные preflight перед изменениями.

## Проверка и непосредственный откат

После успешного блока operator доступен локально, GitHub для check/rollback больше не нужен:

```bash
python3 -I /root/cheapshotmods-task009-89d1f3296b0c.py check
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Check должен подтвердить runtime **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**, schema 6, SQLite integrityOK и 0foreign-key errors. Backup печатает конкретный private SQLite путь; он включает snapshot и текущий эксперимент.

Непосредственный откат **только этого update**, до других update/restore:

```bash
python3 -I /root/cheapshotmods-task009-89d1f3296b0c.py rollback
```

Проверяются current eb655846, supported previous source и external mode; штатный rollback возвращает прежние **image + volume** вместе и проверяет HTTPS прежнего source. `previous.env` вручную не менять. Новые записи после update остаются в новом volume; они не переносятся в прежнюю БД автоматически. После другого restore/update этот guard намеренно откажет — требуется проверка новой пары.

## Короткая пользовательская проверка

Полностью перезагрузите сайт/Mini App; проверьте свои прежние original/work, историю, экипировку, уровень и сохранённый снимок. Откройте меню в редакторе и крафте на телефоне: фон/варианты читаемы, есть прокрутка, Escape/Tab/касание работают. Догрузите группы и проверьте тип→уровень→параметр→крит; unknown крит после известных.

В разделе зелёных рецептов максимум берётся из всего work. Если доступны Q6=10/Q7=6/Q8=8, максимумы 5/4: первый n5 даёт 5🅾1.0/10 за 140, второй максимум становится 1; undo возвращает запас/расход. Второй n4 от исходного состояния даёт 4🅾1.0/12 за 112; undo возвращает состав. На вашем фактическом запасе проверяйте соответствующие значения; не заменяйте сохранённый snapshot ради теста. Прежние single/homogeneous/raw craft и два разных сброса сохраняются.

## Границы доказательств

Новый operator проверен на изолированном Debian13 / Docker 29.9.2 rootless/vfs с реальным приватным скачиванием и HTTPS CA/IP SAN, полными SQL rows/hashes всех 7 игровых таблиц после update и обоих rollback, защитами и обоими рецептами. Это самопроверка автора. [Proof](evidence/TASK-009/owner-helper-integration.json).

Полная новая classic/containerd матрица для local CCC archive в Codex не запустилась из-за read-only cgroup и запрещённого вложенного UID map. Прежние успешные real Docker 29.8 CI-матрицы того же source сохранены как отдельные code-level доказательства **других build bytes**. Они не называются новым прогоном этого архива. [Ограничение](evidence/TASK-009/codex-store-bootstrap-limitation.json) передано management; обязательный portable loaded-image proof на фактическом Docker Debian остаётся до остановки/миграции. HTTPS probe из Cloud не установил серверный SHA (получен TLS hostname mismatch); это не диагноз сертификата настоящего сервера. Его состояние проверяет preflight на Debian.

Независимая приёмка, integration/main, фактическая установка и живые Telegram/телефон остаются отдельными подтверждениями. Developer PR не сливал и сервер не изменял.
