# Cheapshot Mods — устанавливаемый кандидат

Один приватный комплект привязан к полному source SHA: `manifest.json` содержит версии Node/npm, Linux/amd64, image IDs и digest полученного Caddy 2.10.2. `SHA256SUMS` проверяет содержимое, отдельный `.tar.gz.sha256` — внешний архив. Это кандидат TASK-002, не выполненная установка владельцу и не подтверждение живого Telegram.

Поддержка installer: **Debian 12/13, Linux amd64**, локальный Docker Engine **>=24** и Docker Compose **>=2.30**. Неизвестная ОС/архитектура, отсутствие зависимостей, занятые TCP-порты или менее 4 GiB свободного диска останавливают установку до загрузки образов/создания каталога/volumes. Рекомендуемый запас диска — 10 GiB плюс место для данных и нескольких backup; память runtime/нагрузка измерены отдельно, без обещания SLA. Порты 80/443 должны быть доступны хосту и направлены на него; DNS A/AAAA домена должен указывать на этот Debian. Для IPv6 требуется отдельная проверка сети; комплект публикует IPv4.

## Получение

В приватном репозитории откройте Actions → **TASK-002 Debian kit** → успешный run для нужного SHA → artifact `cheapshotmods-<SHA>-linux-amd64`. Скачайте ZIP, распакуйте его и находящийся внутри `.tar.gz` на Debian. Или используйте GitHub CLI с доступом к этому приватному репозиторию:

```bash
gh run download RUN_ID --repo sa713/cheapshotmods --name cheapshotmods-SHA-linux-amd64 --dir kit
cd kit
sha256sum --check cheapshotmods-SHA-linux-amd64.tar.gz.sha256
tar -xzf cheapshotmods-SHA-linux-amd64.tar.gz
cd cheapshotmods-SHA-linux-amd64
sha256sum --check SHA256SUMS
```

Подставьте полный SHA и run ID из передачи TASK-002, не буквальные `SHA`/`RUN_ID`. Artifact хранится 30 дней; исходники и workflow остаются в Git. После истечения срока доступно точное воспроизведение из приватного Git (нужны Git/GitHub CLI с доступом к репозиторию, Docker и зависимости ниже; Node/npm на хосте не нужны — сборка внутри закреплённого Docker builder):

```bash
source_sha=FULL_ACCEPTED_SOURCE_SHA
# При отсутствии авторизации: gh auth login --hostname github.com --web
gh repo clone sa713/cheapshotmods cheapshotmods-src
cd cheapshotmods-src
git fetch origin "$source_sha"
git checkout --detach "$source_sha"
bash scripts/bundle.sh "$PWD/artifacts"
```

`workflow_dispatch` с полем `source_sha` также предусмотрен, но кнопка **Run workflow** становится доступна только после регистрации файла workflow в default branch. Этот PR не слит, поэтому такой способ сейчас не гарантируется. Основная передача — готовый скачиваемый CI artifact; Git-сборка выше остаётся доступной независимо от его retention. Повторная сборка использует исходный SHA, pinned lock-файл и Node/Caddy digests; побайтовое равенство image archives не обещается. Образы не публикуются в registry.

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

Backup содержит инвентари, историю, идемпотентные результаты и серверные сессии; храните приватно, шифруйте при передаче, выносите копии на отдельный носитель. SQLite Online Backup API включает WAL; копирование одного живого `.sqlite` файла не является резервированием. Текущий installer не удаляет backups автоматически: оператор назначает retention и мониторинг диска. Рекомендуется ежедневная копия, хранить минимум 7 дневных/4 недельных и проверять восстановление в отдельной установке. Результаты команд/история не очищаются удалением файлов SQLite.

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
