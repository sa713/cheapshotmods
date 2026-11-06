# Существующий Debian и IP-прокси — TASK-003

Цель владельца: **https://94.228.170.13:9443**. Здесь одна точка TLS — существующий `uek-radar-ip-proxy-1`, Caddy2.11.4. App не имеет host port, не получает чужие volumes/секреты и подключается только к своей выделенной Docker-сети. Собственный Caddy Cheapshot не запускается. `TRUST_PROXY=1` означает ровно один hop; перед app не добавляется ещё один proxy.

Проверки изолированной модели и конкретный принятый SHA/CI/artifact — в TASK-003/PR. Это не наблюдение сервера владельца. На реальном хосте пока не подтверждены9443/firewall, сертификат этого listener, продление IP-сертификата, BotFather и живой Telegram. Доверенная цепочка на8443 была проверена владельцем, её не подменяем private CA. Не используйте `--internal-tls` на реальном сервере.

## Получить комплект без сборки на сервере

Скачать приватный artifact для принятого SHA по ссылке в передаче TASK-003. ZIP содержит tar.gz и его checksum. При использовании gh (команды установки/авторизации — вREADME):

```bash
gh run download RUN_ID --repo sa713/cheapshotmods --name cheapshotmods-SHA-linux-amd64 --dir kit
cd kit
sha256sum --check cheapshotmods-SHA-linux-amd64.tar.gz.sha256
tar -xzf cheapshotmods-SHA-linux-amd64.tar.gz
cd cheapshotmods-SHA-linux-amd64
sha256sum --check SHA256SUMS
```

Используйте полные RUN_ID/SHA из передачи, не старый8f3dd8a. Готовые app/standalone-proxy images уже в архиве; Docker build на общем хосте не выполнять. Дополнительный proxy image в архиве нужен только для standalone-режима и не запускается во внешнем режиме. Фактический общий proxy сохраняет свой установленный image; его источник и ID записываются операторской транзакцией, не заменяются образом из комплекта.

## Установка и подготовка ingress

На выбранном Debian13.7 amd64 уже Docker29.8.0/Compose5.5.1. Требуются python3, openssl, curl, iproute2/ss и coreutils, доступны root/sudo и локальный Docker socket. Около4.5G свободно: сначала проверьте `df -h / /var/lib/docker`; скрипт выполняет ограниченную проверку запаса, ничего глобально не чистит. Если места мало — остановитесь, сохраните свои backups на отдельный носитель; не удаляйте чужие images/volumes/cache. Порты80/443,444/713/888/8443 и loopback8088/8092 заняты другими сервисами и не переназначаются.

Из каталога извлечённого комплекта:

```bash
umask 077
cp env.external.example config.env
chmod 600 config.env
nano config.env
sudo bash ./chm.sh install /opt/cheapshotmods "$PWD/config.env"
sudo python3 /opt/cheapshotmods/ingress.py stage /opt/cheapshotmods
```

В config уже выбран `CHM_PROXY_MODE=external` и точный PUBLIC_BASE_URL. Telegram-поля можно оставить пустыми до создания **выделенного** бота. Пустой SESSION_SECRET installer приватно сгенерирует; не передавайте его через argv/чат/Git. На этом шаге app доступен только внутри своей сети, личные API закрыты, публичный маршрут ещё не изменён.

`stage` читает фактические running labels целевого контейнера, не заменяет конфигурацию источниками Radar. Ожидаемый stack в этом порядке:

1. `/opt/uek-radar/compose.yaml`
2. `/opt/uek-radar/deploy/compose.ip.yaml`
3. `/opt/uek-radar/deploy/compose.portfolio.yaml`
4. `/opt/uek-radar/deploy/compose.anjie.yaml`
5. `/opt/uek-radar/deploy/compose.gtd.yaml`

Скрипт сверяет полный resolved compose с реальными ports/mounts/networks/image/command. При пропущенном override, неожиданном drift или другой TLS-политике он останавливается до изменения общего проекта. В приватном `/opt/cheapshotmods/ingress/` сохраняются исходный Caddyfile, полный compose, staged версии, diff и diagnostics. Файлы0600, каталог0700; resolved compose может содержать секреты соседей — не публикуйте его и не отправляйте в чат. Diff можно просмотреть локально в редакторе; это добавление нового listener/alias, не замена старых маршрутов.

Проверяются объединённый compose и весь Caddyfile на фактическом установленном image, с исходными env/mounts в read-only validation-контейнере без сети. TLS automation должна совпасть до/после; новый listener использует существующую ACME shortlived/IP/HTTP-01 политику с отключённым TLS-ALPN. HTTP-01 через фотогалерею, действующие certificate volumes, mounts и сети не изменяются. Private CA не является fallback для реального хоста.

## Применить и проверить

```bash
sudo python3 /opt/cheapshotmods/ingress.py apply /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
openssl s_client -connect 127.0.0.1:9443 -verify_ip 94.228.170.13 -verify_return_error -CApath /etc/ssl/certs -brief
```

Добавляется `/opt/uek-radar/deploy/compose.cheapshotmods.yaml`: только TCP9443 и выделенная сеть. В существующий Caddyfile добавляется маркированный site block с единственным upstream alias:3000. Для публикации порта Docker должен пересоздать **только ip-proxy**: используется весь исходный ordered stack плюс новый override, `up -d --no-deps --force-recreate --pull never --no-build ip-proxy`. Возможен короткий перерыв маршрутов этого proxy, нулевой downtime не обещается. Фотогалерея/соседи не пересоздаются. Общий `compose down` запрещён.

Повторные stage/apply не дублируют route/port. Drift после stage отклоняется. При неудаче применения исходный Caddyfile/stack восстанавливаются адресно; все данные сохраняются. До завершения проверок держите private backup. После apply проверить снаружи доступность9443, текущие маршруты444/713/888/8443, фотогалерею и HTTP-01. `check` должен вернуть точный SHA комплекта. Это действия владельца, они не выполнены cloud developer.

## Telegram

В новом боте @BotFather → Login Widget → Allowed URLs:

- origin: `https://94.228.170.13:9443`
- redirect/callback: `https://94.228.170.13:9443/auth/oidc/callback`

Main Mini App URL и `/setmenubutton`: `https://94.228.170.13:9443/`. Алгоритм RS256, scope приложения `openid profile`; nonce/state/PKCE не отключать. Заполнить **TELEGRAM_BOT_TOKEN**, **TELEGRAM_OIDC_CLIENT_ID**, **TELEGRAM_OIDC_CLIENT_SECRET** только в `/opt/cheapshotmods/config.env`, chmod600, затем `sudo bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods` и `check`.

Принятие числового IP:порта самим BotFather и живые Login/Mini App ещё не подтверждены. Если интерфейс Telegram отвергает точный URL, сохраните обезличенную причину и передайте management; не меняйте способ входа, не выключайте HTTPS/Secure/CSRF. Существующие боты/интеграции не перенастраивать. После настройки проверить сайт/Mini App одного ID, двух реальных пользователей и cookie на телефоне.

## Эксплуатация и откат

```bash
sudo bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh restore /opt/cheapshotmods /opt/cheapshotmods/backups/backup-FULL_NAME.sqlite
sudo bash /opt/cheapshotmods/chm.sh update /opt/cheapshotmods /absolute/path/to/NEW_BUNDLE
sudo bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Это только Cheapshot lifecycle. Режим/origin/сеть/alias сохраняются; их изменение требует отдельной миграции и отклоняется. Update останавливает только свой app до snapshot, старый image+volume сохраняется. Во время app-перехода его маршрут временно недоступен; соседи продолжают обслуживаться. Restore/rollback возвращают согласованную точку данных, последующие изменения остаются в отложенном volume.

Для удаления только добавления ingress:

```bash
sudo python3 /opt/cheapshotmods/ingress.py rollback /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh stop /opt/cheapshotmods
```

Восстанавливается исходный полный stack только для ip-proxy, новый override удаляется только при совпадении своего hash. Если после подключения кто-то изменил общий конфиг, автоматический rollback откажется его затирать; сначала согласовать drift. Ни volumes, ни certificate stores, ни чужие ресурсы автоматически не удаляются. Снимок private operator-транзакции не включать в Git/CI artifact.
