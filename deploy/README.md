# Cheapshot Mods — устанавливаемый кандидат

Для выбранного общего Debian и IP `https://94.228.170.13:9443` используйте **[EXTERNAL-PROXY.md](EXTERNAL-PROXY.md)** и `env.external.example`. Инструкция ниже сохраняет standalone-режим с собственным Caddy; его не запускать на занятых80/443 общего хоста.

Один приватный комплект привязан к полному source SHA: `manifest.json` содержит версии Node/npm, Linux/amd64, переносимые config/layer proofs, native IDs builder как observations и digest полученного Caddy 2.10.2. `SHA256SUMS` проверяет содержимое, отдельный `.tar.gz.sha256` — внешний архив. Это кандидат TASK-002, не выполненная установка владельцу и не подтверждение живого Telegram.

Поддержка installer: **Debian 12/13, Linux amd64**, локальный Docker Engine **>=24** и Docker Compose **>=2.30**. Неизвестная ОС/архитектура, отсутствие зависимостей, занятые TCP-порты или менее 4 GiB свободного диска останавливают установку до загрузки образов/создания каталога/volumes. Рекомендуемый запас диска — 10 GiB плюс место для данных и нескольких backup; память runtime/нагрузка измерены отдельно, без обещания SLA. Порты 80/443 должны быть доступны хосту и направлены на него; DNS A/AAAA домена должен указывать на этот Debian. Для IPv6 требуется отдельная проверка сети; комплект публикует IPv4. Для публичной установки используйте стандартные 80/443. Нестандартные loopback-порты в тесте работают по прямому HTTPS URL; автоматический HTTP redirect Caddy при нестандартном HTTPS-порте остаётся на 443, поэтому переход через HTTP в этом режиме не проверен и не предлагается.

## Получение готового комплекта

Для выбранного сервера используйте curl с уже настроенным проектным credential-файлом `/root/.config/cheapshotmods/github.curl` (0600, каталог0700). Ни gh, ни git clone, ни новый ключ, ни сборка на сервере не нужны. Точные ARTIFACT_ID, source SHA, ZIP/tar SHA256 опубликованы в последнем разделе TASK-003 и PR. Команды выполняются от root в subshell с остановкой при первой ошибке; не применять `--location-trusted` и не печатать credential-файл.

```bash
(
  set +x
  set -euo pipefail
  umask 077
  test -r /root/.config/cheapshotmods/github.curl
  CHM_SHA=FULL_SOURCE_SHA
  CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-kit-XXXXXX)
  cd "$CHM_DOWNLOAD"
  curl --config /root/.config/cheapshotmods/github.curl --fail --silent --show-error --location --output kit.zip https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/ARTIFACT_ID/zip
  printf '%s  kit.zip\n' ZIP_SHA256 | sha256sum --check -
  python3 -m zipfile -e kit.zip .
  printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' TAR_SHA256 "$CHM_SHA" | sha256sum --check -
  tar -xzf "cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
  cd "cheapshotmods-$CHM_SHA-linux-amd64"
  sha256sum --check SHA256SUMS
  printf 'Проверенный комплект: %s\n' "$PWD"
)
```

Продолжить из напечатанного каталога по EXTERNAL-PROXY для выбранного общего хоста либо по standalone-инструкции ниже. При неожиданно существующем `/opt/cheapshotmods` не перезаписывать его: проверить сохранённую установку и выбрать update отдельно.

Формат manifest2 содержит image_proofs: SHA-256 точных bytes config и ordered SHA-256 uncompressed layers, связанные с rootfs.diff_ids. Installer сверяет архив до import, затем повторно фактически экспортированное Docker-содержимое до создания ROOT/БД/edge/app. Native `.Id` в builder_observations — наблюдение конкретного daemon, а не переносимая идентичность. Config/platform/source revision проверяются вместе; одна метка или tag доказательством не являются.

Для обновления установки с format1 запускайте **входящий новый** `bash /absolute/path/to/NEW_BUNDLE/chm.sh update /opt/cheapshotmods /absolute/path/to/NEW_BUNDLE`. Новый installer не принимает старый format1 kit как новый вход; нельзя менять ожидаемые IDs или checksums прежнего архива. Rollback использует сохранённую локальную пару image+volume и её прежний installer; повторного импорта старого архива нет. После rollback на старый installer следующее обновление опять запускается входящим новым. В новых format2 установках обычный lifecycle сохраняется.

## Зависимости чистого Debian

Если Docker/Compose уже установлены и обслуживают другие продукты, сначала проверьте `docker version` и `docker compose version`; не удаляйте пакеты, контейнеры или volumes других проектов. Ни installer, ни команды ниже ничего не очищают глобально. Для **чистого** Debian 12/13 официальная установка Docker:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl openssl python3 iproute2
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'Types: deb\nURIs: https://download.docker.com/linux/debian\nSuites: %s\nComponents: stable\nArchitectures: amd64\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$VERSION_CODENAME" | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker version
sudo docker compose version
```

Сервисами хоста управляет оператор; чужие ресурсы не считаются выделенными приложению. Установка пакетов требует root и сети к Debian/Docker; installer не выполняет эти изменения автоматически.

## Секреты и Telegram

На Debian, вне checkout Git, подготовьте `config.env`. Строки — буквальные `KEY=value`, без shell-кавычек и подстановок. Секреты не передаются аргументами команд, не печатаются и не публикуются. Права файла обязательно 0600. Пустой `SESSION_SECRET` installer заменит случайным 256-bit значением; его повторная генерация инвалидирует сессии.

```bash
umask 077
cp env.example config.env
chmod 600 config.env
nano config.env
```

Заполните:

| Поле | Значение |
| --- | --- |
| `PUBLIC_BASE_URL` | ваш ровный HTTPS origin, например `https://mods.example.com`, без завершающего `/` |
| `CADDY_EMAIL` | email оператора для сертификата ACME |
| `TELEGRAM_BOT_TOKEN` | токен **нового выделенного** бота |
| `TELEGRAM_OIDC_CLIENT_ID` | Client ID из Login Widget у BotFather |
| `TELEGRAM_OIDC_CLIENT_SECRET` | Client Secret из того же раздела |
| `CHM_HTTP_PORT`, `CHM_HTTPS_PORT` | обычно 80 и 443; при другом HTTPS-порте он должен присутствовать в PUBLIC_BASE_URL |

Создание и изменение бота выполняет владелец после передачи кандидата:

1. В официальном **@BotFather** выполнить `/newbot`, задать имя и свободный username для Cheapshot Mods; сохранить выданный API token только в `TELEGRAM_BOT_TOKEN`. Не использовать ботов других продуктов. Приложению не нужны polling, webhook, рассылки, phone или разрешение отправлять сообщения.
2. Открыть mini app **@BotFather**, выбрать этого бота → **Login Widget** → **Allowed URLs**. Добавить **оба** значения: `PUBLIC_BASE_URL` и `PUBLIC_BASE_URL/auth/oidc/callback`. Для примера это `https://mods.example.com` и `https://mods.example.com/auth/oidc/callback`.
3. В этом разделе получить **Client ID** и **Client Secret**, записать в соответствующие env-поля. В **Login Widget → Advanced → Algorithm** оставить **RS256**. Используется scope `openid profile`, профильный подписанный `id`; EdDSA/ES256K в текущей документации несовместимы с profile. `nonce`, state и PKCE оставлены обязательными; если живой провайдер их не возвращает, не отключать защиту для обхода, сохранить обезличенный факт и передать management.
4. В mini app **@BotFather** выбрать бота и настроить **Main Mini App**: включить основной Mini App и указать его Web App URL `PUBLIC_BASE_URL/`. Официальная документация называет эту функцию **Main Mini App**; расположение экрана зависит от версии клиента BotFather. Для кнопки меню: `/setmenubutton` → этот бот → URL `PUBLIC_BASE_URL/`, подпись «Cheapshot Mods». Ссылку `https://t.me/<bot_username>?startapp` можно использовать после включения Main Mini App.
5. После DNS/сертификата проверить вход сайта, отказ пользователя, затем Mini App с телефона и тот же Telegram ID. Убедиться в общих данных, Secure cookie, повторном входе и изоляции другого настоящего игрока. Эти наблюдения **не выполнены** в изолированных тестах и остаются операторской приёмкой.

Источники: https://core.telegram.org/bots/telegram-login и https://core.telegram.org/bots/webapps. Публичный origin, callback и URL Mini App должны совпадать с настройками. Не отправляйте bot/client/session secrets и сырые initData в чат или отчёт.

## Установка, проверка и повседневные команды

Из извлечённого проверенного комплекта (с заполненным приватным config.env):

```bash
sudo bash ./chm.sh install /opt/cheapshotmods "$PWD/config.env"
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Installer загрузит локальные image archives, создаст **свой** compose project и новый именованный volume БД, скопирует приватную конфигурацию в `/opt/cheapshotmods/config.env`, запустит приложение и Caddy. App наружу не публикуется: только Caddy 80/443, private network, доверие ровно одному proxy hop (`TRUST_PROXY=1`). Caddy сохраняет сертификаты в своих volumes. По умолчанию automatic HTTPS использует публичный ACME; первый сертификат может требовать ожидания DNS/доступности 80/443. `/health` и `/version` через HTTPS проверяются командой `check`; app health/version/401 проверяются самим installer. Не добавляйте login-исключения из-за отсутствия сертификата/настроек.

```bash
# Остановить / повторно запустить с сохранением volumes:
sudo bash /opt/cheapshotmods/chm.sh stop /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh start /opt/cheapshotmods
# После правки bot/client secrets в существующем config.env:
sudo nano /opt/cheapshotmods/config.env
sudo chmod 600 /opt/cheapshotmods/config.env
sudo bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods
# Согласованный online backup (выводит только путь, mode 0600):
sudo bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

`PUBLIC_BASE_URL`, bind и порты фиксируются при установке; смена домена/портов требует отдельной миграции proxy/DNS и Telegram Allowed URLs, `restart` не делает её неявно. Секреты редактируйте в установленном файле, не в архиве; config не копируется поверх при update. Никогда не используйте `docker compose down --volumes` и не удаляйте volume для перезапуска.

Backup содержит инвентари, историю, идемпотентные результаты и серверные сессии; храните приватно, шифруйте при передаче, выносите копии на отдельный носитель. Отдельно сохраните config.env в защищённом хранилище секретов: файл не входит в DB backup или комплект. При потере хоста сначала установите ту же версию по командам выше с восстановленным config.env, перенесите SQLite backup с правами 0600 и выполните restore/check ниже. Новый SESSION_SECRET потребует повторного входа, но не удалит инвентари, связанные с подтверждённым Telegram ID. SQLite Online Backup API включает WAL; копирование одного живого `.sqlite` файла не является резервированием. Текущий installer не удаляет backups автоматически: оператор назначает retention и мониторинг диска. Рекомендуется ежедневная копия, хранить минимум 7 дневных/4 недельных и проверять восстановление в отдельной установке. Результаты команд/история не очищаются удалением файлов SQLite.

## Обновление, восстановление, откат

Сначала скачайте и проверьте новый комплект так же, как первоначальный. Подставьте реальный путь к нему:

```bash
sudo bash /opt/cheapshotmods/chm.sh update /opt/cheapshotmods /absolute/path/cheapshotmods-NEW_SHA-linux-amd64
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Обновление загружает/проверяет новые images, закрывает ingress, останавливает app, делает согласованный offline backup отдельным helper того же image и переносит **копию** в новый volume; старая версия с прежним volume остаётся для отката. Текущий config с секретами сохраняется. После остановки app новые записи не принимаются: snapshot включает все завершённые commit до freeze. На время backup/переключения будет недоступность. При ошибке update восстанавливает прежнюю metadata и запрашивает запуск старой пары image+volume; обязательно выполните `check`. Не удаляйте volumes; если нужно, выполните `start`/`rollback` и сохраните обезличенные health/CI-факты. Откат возвращает состояние **до** обновления/restore; изменения после него остаются в отложенном volume, но не переносятся автоматически.

```bash
# Restore всегда в новый volume, никогда поверх текущей БД:
sudo bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods /opt/cheapshotmods/backups/backup-FULL_NAME.sqlite
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
# Вернуть предыдущую пару image+volume (и можно переключиться обратно той же командой):
sudo bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Проверяются SQLite integrity/schema перед переключением. Старые volumes/images никогда автоматически не удаляются: отдельную утилизацию оператор делает только после успешного restore/проверки retention, адресно по именам своей установки. Нельзя делать глобальный prune на общем хосте.

## Что проверено изолированно

`scripts/test-install.sh BUNDLE_DIR` запускает installer в чистом Debian 13 amd64 с предоставленным Docker CLI/socket. Проверяет preflight, приватные config/backup, HTTPS через Caddy internal CA, health/version/401, сохранность настоящей SQLite после restart, backup/restore/rollback и update на второй версионированный образ. Отдельные регрессии доказывают восстановление старой пары после ошибки helper и сохранение последнего commit на границе freeze. Его TLS internal — только изолированный тест, **не публичный ACME** и не Telegram. Для этого installer имеет явный `--internal-tls`; в обычной установке флаг не указывать. Конкретный SHA/результаты/ограничения — в TASK-002 и CI.
