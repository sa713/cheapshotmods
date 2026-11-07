# Существующий Debian и IP-прокси — TASK-003

Для существующего app **fbe82ae**, у которого полный update остановился на проверке свободного места, актуален [отдельный helper](#отдельная-установка-helper-для-существующего-fbe). Эта проверенная компонентная пара — app fbe + helper b008; используйте её отдельный путь во всех ingress-командах.

Цель владельца: **https://94.228.170.13:9443**. Здесь одна точка TLS — существующий `uek-radar-ip-proxy-1`, Caddy2.11.4. App не имеет host port, не получает чужие volumes/секреты и подключается только к своей выделенной Docker-сети. Собственный Caddy Cheapshot не запускается. `TRUST_PROXY=1` означает ровно один hop; перед app не добавляется ещё один proxy.

Проверки изолированной модели и конкретный принятый SHA/CI/artifact — в TASK-003/PR. Это не наблюдение сервера владельца. На реальном хосте пока не подтверждены9443/firewall, сертификат этого listener, продление IP-сертификата, BotFather и живой Telegram. Доверенная цепочка на8443 была проверена владельцем, её не подменяем private CA. Не используйте `--internal-tls` на реальном сервере.

## Получить комплект без сборки на сервере

Скачать новый приватный artifact принятого SHA по curl-маршруту [README комплекта](README.md#получение-готового-комплекта), с уже существующим `/root/.config/cheapshotmods/github.curl`. Конкретные source SHA/artifact ID/ZIP и tar hashes — в текущей передаче R6 TASK-003/PR. Выполнять от root, в отдельном private каталоге, с `set -euo pipefail`; при первой ошибке зависимые шаги не продолжать. gh, новый ключ, clone и build не требуются.

Старые8f3dd8a/cf0 не использовать для новой попытки на containerd: прежняя изолированная приёмка сохранена как история. Образы cf0 уже могли загрузиться, но по диагностике ROOT ещё не создавался; ничего общего не чистить. Если ROOT неожиданно существует, install его не перезапишет — сначала проверить состояние.

Формат2 проверяет exact config SHA256 и ordered uncompressed layer SHA256 как до import, так и на фактическом Docker-export после load. Native ID может различаться между classic и containerd без различия содержимого. Править manifest/checksums или отключать guard нельзя. App/standalone-proxy images уже в архиве; Docker build на общем хосте не выполнять. Дополнительный proxy image в архиве нужен standalone и не запускается в external. Общий proxy сохраняет actual image и same-daemon running guard, не заменяется образом из комплекта.

## Установка и подготовка ingress

На выбранном Debian 13.7 amd64 уже Docker 29.8.0/Compose 5.5.1. Требуются python3, openssl, curl, iproute2/ss и coreutils, нужны права root и локальный Docker socket. Около 4.5G свободно: сначала проверьте `df -h / /var/lib/docker`; скрипт требует 2 GiB запаса плюс два размера images из manifest и два размера данных (при restore учитывает и backup). Проверяется файловая система установки и локальное Docker storage. Ничего глобально не чистится. Если места мало — остановитесь, сохраните свои backups на отдельный носитель; не удаляйте чужие images/volumes/cache. Порты 80/443,444/713/888/8443 и loopback 8088/8092 заняты другими сервисами и не переназначаются.

Из каталога извлечённого комплекта:

```bash
umask 077
cp env.external.example config.env
chmod 600 config.env
nano config.env
bash ./chm.sh install /opt/cheapshotmods "$PWD/config.env"
python3 /opt/cheapshotmods/ingress.py stage /opt/cheapshotmods
```

В config уже выбран `CHM_PROXY_MODE=external` и точный PUBLIC_BASE_URL. Telegram-поля можно оставить пустыми до создания **выделенного** бота. Пустой SESSION_SECRET installer приватно сгенерирует; не передавайте его через argv/чат/Git. На этом шаге app доступен только внутри своей сети, личные API закрыты, публичный маршрут ещё не изменён.

`stage` читает фактические running labels целевого контейнера, не заменяет конфигурацию источниками Radar. Ожидаемый stack в этом порядке:

1. `/opt/uek-radar/compose.yaml`
2. `/opt/uek-radar/deploy/compose.ip.yaml`
3. `/opt/uek-radar/deploy/compose.portfolio.yaml`
4. `/opt/uek-radar/deploy/compose.anjie.yaml`
5. `/opt/uek-radar/deploy/compose.gtd.yaml`

Скрипт сверяет полный resolved compose с реальными ports/mounts/networks/image, итоговыми environment/entrypoint/command/user/working directory. Файлы окружения из running labels также сохраняют порядок. Если для воспроизводимости не хватает исходных локальных env-file/shell inputs, он откажется применять изменение; восстановите их локально, не передавайте значения в чат или аргументы команд. При пропущенном override, неожиданном drift или другой TLS-политике он останавливается до изменения общего проекта. В приватном `/opt/cheapshotmods/ingress/` сохраняются исходный Caddyfile, полный compose, staged версии, diff и diagnostics. Файлы 0600, каталог 0700; resolved compose может содержать секреты соседей — не публикуйте его и не отправляйте в чат. Diff можно просмотреть локально в редакторе; это добавление нового listener/alias, не замена старых маршрутов.

Проверяются объединённый compose и весь Caddyfile на фактическом установленном image, с исходными env/mounts в read-only validation-контейнере без сети. Caddy при `validate` открывает также файлы журналов. Поэтому после исходного `adapt` проверяется копия полного JSON, в которой только `filename` стандартных `logging.logs.*.writer.output=file` перенаправлены в отдельный одноразовый tmpfs1MiB; общие файлы сохраняют одну общую временную цель. Остальные writer options, модули, сертификаты и их пути проверяются полностью. Исходный adapted JSON и Caddyfile не изменяются, проверки TLS используют оригинал; доступность рабочего log path по записи этой изолированной проверкой не доказывается. В рабочие logs/certificate volumes проверка не пишет, их содержимое не копирует; tmpfs удаляется вместе с `run --rm`. TLS automation должна совпасть до/после; новый listener использует существующую ACME shortlived/IP/HTTP-01 политику с отключённым TLS-ALPN. HTTP-01 через фотогалерею, действующие certificate volumes, mounts и сети не изменяются. Private CA не является fallback для реального хоста.

Если app уже установлен, а прежний helper отказал при открытии file log writer на read-only `/data`, повторный `install` не нужен. Скачайте и проверьте новый принятый комплект по его exact SHA/checksums, затем выполните `bash NEW_KIT/chm.sh update /opt/cheapshotmods NEW_KIT` (NEW_KIT — абсолютный путь). Это обычное обновление только Cheapshot с backup и новой парой image/volume; оно установит исправленный helper. После успеха снова выполните `stage`, просмотрите private diff и лишь затем отдельный `apply`. Не открывайте рабочие volumes на запись ради validation, не удаляйте ROOT/данные и не перенастраивайте Docker. Неприменённый неудачный stage без plan.json можно повторить; при существующем плане действуют обычные apply/rollback guards.

## Применить и проверить

```bash
python3 /opt/cheapshotmods/ingress.py apply /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
openssl s_client -connect 127.0.0.1:9443 -verify_ip 94.228.170.13 -verify_return_error -CApath /etc/ssl/certs -brief
curl --fail --silent --show-error https://94.228.170.13:9443/health
curl --fail --silent --show-error https://94.228.170.13:9443/version
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://94.228.170.13:9443/api/state
```

До входа последний запрос должен вернуть `401`; `/health` — `status: ok`, `/version` — полный SHA выбранного комплекта. TLS проверяется системным CA, без `-k`.

Добавляется `/opt/uek-radar/deploy/compose.cheapshotmods.yaml`: только TCP9443 и выделенная сеть. В существующий Caddyfile добавляется маркированный site block с единственным upstream alias:3000. Для публикации порта Docker должен пересоздать **только ip-proxy**: используется весь исходный ordered stack плюс новый override, `up -d --no-deps --force-recreate --pull never --no-build ip-proxy`. Возможен короткий перерыв маршрутов этого proxy, нулевой downtime не обещается. Фотогалерея/соседи не пересоздаются. Общий `compose down` запрещён.

При последующем обслуживании общего ip-proxy сохраняйте все пять исходных compose-файлов и новый шестой override последним. Скрипты размещения других продуктов автоматически не менялись; пересоздание proxy по прежнему списку без нового override удалит привязку9443/сеть Cheapshot. Собственные restart/update/restore/rollback Cheapshot общий proxy не меняют.

Повторные stage/apply не дублируют route/port. Drift после stage отклоняется. При неудаче применения исходный Caddyfile/stack восстанавливаются адресно; все данные сохраняются. До завершения проверок держите private backup. После apply проверить снаружи доступность9443, текущие маршруты444/713/888/8443, фотогалерею и HTTP-01. `check` должен вернуть точный SHA комплекта. Это действия владельца, они не выполнены cloud developer.

## Telegram

В новом боте @BotFather → Login Widget → Allowed URLs:

- origin: `https://94.228.170.13:9443`
- redirect/callback: `https://94.228.170.13:9443/auth/oidc/callback`

Main Mini App URL и `/setmenubutton`: `https://94.228.170.13:9443/`. Алгоритм RS256, scope приложения `openid profile`; nonce/state/PKCE не отключать. Заполнить **TELEGRAM_BOT_TOKEN**, **TELEGRAM_OIDC_CLIENT_ID**, **TELEGRAM_OIDC_CLIENT_SECRET** только в `/opt/cheapshotmods/config.env`, chmod600, затем `bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods` и `check`.

Принятие числового IP:порта самим BotFather и живые Login/Mini App ещё не подтверждены. Если интерфейс Telegram отвергает точный URL, сохраните обезличенную причину и передайте management; не меняйте способ входа, не выключайте HTTPS/Secure/CSRF. Существующие боты/интеграции не перенастраивать. После настройки проверить сайт/Mini App одного ID, двух реальных пользователей и cookie на телефоне.

## Эксплуатация и откат

```bash
bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods /opt/cheapshotmods/backups/backup-FULL_NAME.sqlite
bash /absolute/path/to/NEW_BUNDLE/chm.sh update /opt/cheapshotmods /absolute/path/to/NEW_BUNDLE
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Это только Cheapshot lifecycle. Режим/origin/сеть/alias сохраняются; их изменение требует отдельной миграции и отклоняется. Update останавливает только свой app до snapshot, старый image+volume сохраняется. Во время app-перехода его маршрут временно недоступен; соседи продолжают обслуживаться. Restore/rollback возвращают согласованную точку данных, последующие изменения остаются в отложенном volume.

Для удаления только добавления ingress:

```bash
python3 /opt/cheapshotmods/ingress.py rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh stop /opt/cheapshotmods
```

Восстанавливается исходный полный stack только для ip-proxy, новый override удаляется только при совпадении своего hash. Если после подключения кто-то изменил общий конфиг, автоматический rollback откажется его затирать; сначала согласовать drift. Ни volumes, ни certificate stores, ни чужие ресурсы автоматически не удаляются. Снимок private operator-транзакции не включать в Git/CI artifact.


## Отдельная установка helper для существующего fbe

Этот маршрут предназначен для текущей установки: app/source **fbe82aef6008d292515c0efce2fde601c221f3d2**, helper/source **b008807fa1873de4fd6d926be42bc6bf515d6a66**, отдельный файл `/opt/cheapshotmods/ingress-b008807.py`. App/game/auth/UI/package/Dockerfile между этими SHA побайтово одинаковы; изменился только необходимый operator и связанные tests/docs. Полный app update остановился до load_images/release_copy/stop/SQLite writes на корректном reserve preflight. Этот отдельный operator route не вызывает app update, не меняет/не обходит его disk guard.

Helper берётся из уже скачанного и проверенного b008 kit/artifact13572814453; его точный SHA256 `884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011`. Новые images не импортируются, новая app/data пара не создаётся, app не перезапускается. Managed `ingress.py`, `current.env`, releases/config и SQLite сохраняются. Установка helper/private snapshots/diagnostics/Docker metadata всё же использует небольшой объём диска, validation logs — bounded tmpfs1MiB. Никакой shared очистки/prune или открытия чужих volumes RW нет.

От root выполните следующий блок. Он проверяет существующий fbe/external ROOT без плана, находит authentic helper в уже извлечённых каталогах скачивания, атомарно создаёт **отдельный** root-owned файл0600 через temp+fsync+no-clobber link, затем выполняет stage. При существующем целевом файле разрешено только повторное использование точных bytes/mode/owner, symlink/другая версия отвергаются. Python `-I` обязателен: inherited PYTHONOPTIMIZE не должен отключать inline guards. Повторное скачивание/распаковка/полный install/update не нужны:

```bash
(
  set +x
  set -euo pipefail
  umask 077
  python3 -I - <<'PY_SETUP'
from pathlib import Path
import hashlib
import os
import tempfile

root = Path('/opt/cheapshotmods')
assert root.is_dir() and root.resolve() == root
assert root.stat().st_uid == os.geteuid() and root.stat().st_mode & 0o022 == 0
assert (root / '.cheapshotmods').is_file()
meta = dict(line.split('=', 1) for line in (root / 'current.env').read_text().splitlines())
assert meta['CHM_VERSION'] == 'fbe82aef6008d292515c0efce2fde601c221f3d2'
assert meta['CHM_PROXY_MODE'] == 'external'
assert not (root / 'ingress/plan.json').exists()
expected = '884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011'
target = root / 'ingress-b008807.py'
if target.exists() or target.is_symlink():
    assert not target.is_symlink() and target.is_file()
    assert target.stat().st_uid == os.geteuid() and target.stat().st_mode & 0o777 == 0o600
    assert hashlib.sha256(target.read_bytes()).hexdigest() == expected
else:
    pattern = 'cheapshotmods-ingress-*/cheapshotmods-b008807fa1873de4fd6d926be42bc6bf515d6a66-linux-amd64/ingress.py'
    source = next((p for p in Path('/root').glob(pattern) if p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest() == expected), None)
    assert source is not None, 'Verified downloaded helper not found; nothing installed'
    fd, temporary = tempfile.mkstemp(prefix='.ingress-b008807-', dir=root)
    try:
        with os.fdopen(fd, 'wb') as out:
            out.write(source.read_bytes())
            out.flush()
            os.fchmod(out.fileno(), 0o600)
            os.fsync(out.fileno())
        assert hashlib.sha256(Path(temporary).read_bytes()).hexdigest() == expected
        os.link(temporary, target)
    finally:
        os.unlink(temporary)
print('Operator b008807 installed and verified; app remains fbe82ae')
PY_SETUP
  python3 -I /opt/cheapshotmods/ingress-b008807.py stage /opt/cheapshotmods
)
```

При успешном stage просмотрите `changes.diff` **локально**. Для применения используйте новый helper; не используйте прежний `/opt/cheapshotmods/ingress.py` в этой компонентной установке. Apply кратко пересоздаёт только shared ip-proxy, со всеми исходными ordered overrides; рабочие соседи не пересоздаются:

```bash
(
  set -euo pipefail
  test "$(sed -n 's/^CHM_VERSION=//p' /opt/cheapshotmods/current.env)" = fbe82aef6008d292515c0efce2fde601c221f3d2
  CHM_HELPER=/opt/cheapshotmods/ingress-b008807.py
  test -f "$CHM_HELPER" && test ! -L "$CHM_HELPER"
  test "$(stat -c '%u:%a' "$CHM_HELPER")" = 0:600
  printf '%s  %s\n' 884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011 "$CHM_HELPER" | sha256sum --check -
  python3 -I "$CHM_HELPER" apply /opt/cheapshotmods
  bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
  openssl s_client -connect 127.0.0.1:9443 \
    -verify_ip 94.228.170.13 -verify_return_error \
    -CApath /etc/ssl/certs -brief </dev/null
)
```

Ожидаемая **app version остаётся fbe82aef6008d292515c0efce2fde601c221f3d2**. Это установленная пара app=fbe/helper=b008, а не выполненное обновление app до b008. `chm.sh check` сверяет app с его собственной текущей metadata; success требует health/version/401 и TLS. Публичную доступность/renewal/HTTP-01/соседей и живой Telegram проверяет владелец отдельно.

Откат применённого shared ingress выполняется тем же отдельным helper:

```bash
(
  set -euo pipefail
  CHM_HELPER=/opt/cheapshotmods/ingress-b008807.py
  test -f "$CHM_HELPER" && test ! -L "$CHM_HELPER"
  test "$(stat -c '%u:%a' "$CHM_HELPER")" = 0:600
  printf '%s  %s\n' 884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011 "$CHM_HELPER" | sha256sum --check -
  python3 -I "$CHM_HELPER" rollback /opt/cheapshotmods
)
```

App/data в этом маршруте не переключались, поэтому app rollback ради отдельного helper не нужен. Файл `ingress-b008807.py` сохраняйте для дальнейших stage/apply/rollback; обычные app restart/restore/update/rollback перезаписывают только managed `ingress.py`, а отдельный operator остаётся. При отсутствующем плане rollback применять нечего; сохраняйте private diagnostics, не удаляйте ROOT/данные.

Изолированная совместимость проверена exact fbe kit + exact b008 helper: full HTTPS/CA/signed SQLite, file logger/RO sentinels, guards/negatives, stage/apply/rollback/recovery, restart/restore/update/rollback и сохранение отдельного operator. Этот дополнительный полный pairing-run — local classic Docker29.9.2/vfs и Caddy2.11.4. Сам b008 helper/immutable kit ранее проверен полным CI на обоих real Docker29.8 stores; новый pairing-run не выдаётся за новый собственный containerd run. Для воспроизведения developer в выделенном Docker: `python3 -I scripts/test-operator-compat.py OLD_FBE_KIT NEW_B008_KIT NEW_EVIDENCE_DIR`. Скрипт не запускать на общем сервере владельца.
