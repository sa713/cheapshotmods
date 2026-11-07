# Существующий Debian и IP-прокси — TASK-003

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
