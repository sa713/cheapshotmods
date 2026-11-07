# TASK-003 — установка на Debian за существующим IP-прокси

- Статус: review
- Текущая передача: [исправленный комплект и update существующей установки](#передача-исправления-проверки-file-logs). App из R6 уже установлен владельцем. Предыдущие комплекты/отзывы/попытки сохранены как история; для продолжения использовать новый exact b008807 kit, повторный install не нужен.
- Риск: повышенный — TLS, граница доверия proxy и сохранение работающих сервисов общего хоста.
- Основание: решение владельца об установке без домена по IP:порту и предоставленная диагностика; [.delivery/PROJECT.md](../PROJECT.md), раздел размещения без домена. Продуктовые требования [PRODUCT.md](../../PRODUCT.md) сохраняются.
- Репозиторий: https://github.com/sa713/cheapshotmods
- База: ветка `chm-001-foundation`, полный исходный SHA `e681d0a3d42e161abf89d9e869ac1d2bd0c02e38`. Коммит постановки меняет только management-документы; безопасное продвижение базы проверить и записать, без reset/force.
- Зависимости: TASK-002 accepted как общий устанавливаемый кандидат; серверная интеграция с имеющимся IP-TLS в его приёмку не входила.
- Конфликтующие работы: на момент постановки другие активные реализации не обнаружены; перед стартом проверить GitHub и рабочее дерево.
- PR: для этой связной адаптации создать отдельную рабочую ветку от актуальной chm-001-foundation и PR с base chm-001-foundation. В main не сливать. Фактический HEAD/CI получать из GitHub.

## План developer (2026-11-06)

Исходное дерево чистое, ветка безопасно продвинута fast-forward с 8caca180 до постановки cbfe78164daebf5fed041e391f25087b303784d7: только management-документы. Создана ветка `chm-003-external-proxy`, [PR №3](https://github.com/sa713/cheapshotmods/pull/3), base `chm-001-foundation`. Reset/force push не выполнялись; PR №1 и принятая история сохранены.

1. Добавить external compose и сохраняемый режим/сеть/alias, ранние проверки конфигурации/места/сети; сохранить standalone и его lifecycle.
2. Подготовить операторскую транзакцию ingress: фактический ordered stack из running labels, private backup/diff, проверка compose против running mounts/networks/ports и полной Caddy-конфигурации в той же среде, адресное применение/восстановление только ip-proxy.
3. На изолированной Debian-модели проверить соседей/HTTP-01/все overrides, настоящий HTTPS/Secure/Origin/forwarded, lifecycle app и откат ingress; затем общие verify/browser/container/CI.
4. Новый versioned artifact и отдельный reviewer в новом контексте; исправить доказанные замечания, передать management точный комплект/команды. Реальный IP/ACME/сервер/BotFather не трогать.

## Результат, который требуется

Передать проверенный комплект и конкретную инструкцию, по которым владелец установит Cheapshot Mods на свой существующий Debian по `https://94.228.170.13:9443`, используя уже действующий Caddy с доверенным IP-сертификатом. После этой доработки остаются операторская установка, настройка выделенного Telegram-бота и реальные пользовательские проверки.

Техническое решение management: поддерживаемый режим внешнего reverse proxy; единственная точка TLS — существующий ip-proxy. Cheapshot app не публикует порт на хост и доступен proxy через отдельную Docker-сеть с уникальным alias. Сеть не даёт приложению доступ к volumes/секретам других продуктов. Сохраняется ровно один доверенный proxy hop. Собственный Caddy Cheapshot в этом режиме не запускается и не выдаёт сертификат. Действующая standalone-установка сохраняется.

Изменения ограничены комплектом/installer/compose, необходимыми проверками, CI и эксплуатационной документацией. Игровая логика, интерфейс, модель аккаунта, OIDC/initData и данные не перепроектируются. Не расширять задачу до настройки остальных продуктов. Не изменять принятый архив вручную: собрать новый полный версионированный комплект с SHA/manifest/image IDs и проверками.

## Подтверждённая среда

Диагностику на реальном сервере выполнил владелец 2026-11-06; developer/management не имеют SSH:
- Debian13.7 amd64; Docker29.8.0; Compose5.5.1.
- RAM3.8GiB, available2.4GiB; swap2GiB не используется. Корень30G, доступно4.5G. Только готовые images, без сборки на общем хосте; bounded disk preflight, без глобального prune/удаления чужих images или volumes.
- Публичный IPv4 94.228.170.13. TCP9443 отсутствовал в полном ss и выбран для Cheapshot; внешняя доступность/firewall пока не проверены.
- `photo-gallery-caddy-1` публикует80/443TCP и443UDP; его compose `/opt/photo-gallery/docker-compose.yml`, Caddyfile `/opt/photo-gallery/Caddyfile`; сети `photo-gallery_default`, `pensieve_edge`.
- `uek-radar-ip-proxy-1` — caddy:2.11.4-alpine, публикует444/713/888/8443, сети `photo-gallery_default`, `uek-radar_default`.
- Working dir ip-proxy: `/opt/uek-radar`. Полный ordered набор compose из running labels:
  1. `/opt/uek-radar/compose.yaml`
  2. `/opt/uek-radar/deploy/compose.ip.yaml`
  3. `/opt/uek-radar/deploy/compose.portfolio.yaml`
  4. `/opt/uek-radar/deploy/compose.anjie.yaml`
  5. `/opt/uek-radar/deploy/compose.gtd.yaml`
- Bind `/opt/uek-radar/deploy/Caddyfile.ip` → `/etc/caddy/Caddyfile`; сохраняются named volumes ip_caddy_data/config и mounts /run/anjie-portfolio, /srv/anjie-portfolio, /var/www/shewashere.
- Проверка владельца `openssl s_client -connect 127.0.0.1:8443 -verify_ip 94.228.170.13 -verify_return_error -CApath /etc/ssl/certs -brief` вернула TLSv1.3, Verification: OK. Это доказательство текущей цепочки и IP на8443, не проверки будущего продления или9443.
- Источники схемы: sa713/UEK-Radar deploy/Caddyfile.ip, compose.ip.yaml, README-IP.md: ACME shortlived, disable_tlsalpn_challenge, HTTP-01 через маршрутизацию фотогалереи к uek-radar-ip-proxy:80. Текущий полный host Caddyfile/содержимое overrides не получены, не подменять их исходниками репозитория.
- Pensieve/GTD/фотогалерея/портфолио и их данные сохраняются. Loopback8088/8092 уже заняты.

## Критерии приёмки

1. **Установка с внешним proxy.** На чистом изолированном Debian amd64 оператор выбирает этот режим → создаются только ресурсы Cheapshot, приложение подключено к выделенной сети с уникальным alias, собственного proxy и host port app нет. PUBLIC_BASE_URL точно HTTPS-origin IP:9443. Без Telegram-секретов интерфейс доступен и сообщает о ненастроенном входе, личные API возвращают401. Ни публичного dev-login, ни отключения Secure/CSRF/auth.
2. **Подключение общего ingress.** Комплект даёт конкретный route/snippet для9443 и добавочный compose override существующего ip-proxy с новой портовой привязкой и выделенной сетью. Сохраняются полный ordered compose-набор, все прежние порты, сети, mounts и TLS/HTTP-01. Не перезаписывать общий Caddyfile шаблоном. Операторская процедура сначала сохраняет private backup и staged diff, валидирует полный объединённый compose и Caddy-конфиг в применимой среде, только затем применяет добавление. Запуск `up` ограничен service ip-proxy без поднятия/пересоздания соседних сервисов; `compose down` общего проекта запрещён. Краткое необходимое пересоздание только ip-proxy при добавлении published port честно описать, не обещать нулевой перерыв. Повторный запуск не дублирует route/port; при отказе исходный proxy восстанавливается адресно.
3. **Одно завершение TLS.** Через изолированный Caddy и настоящий HTTP/HTTPS frontend проверить /health, точный /version и401 до входа, полноценную сессию с Secure cookie и изменение состояния с точным HTTPS Origin. Проверить ошибочный Origin/подделанные forwarded-заголовки. TRUST_PROXY не расширяется ради лишнего hop; public app port отсутствует. В тестах разрешены изолированная CA и синтетический Telegram, но это не рабочая замена публичному IP-сертификату.
4. **Сохранение соседей.** В изолированной fixture общего ingress есть дополнительные routes/ports/networks/mounts, HTTP-01 route и хотя бы один обслуживаемый сосед. Подключение Cheapshot и откат сохраняют их и исходные данные. Тест ловит потерю одного из compose overrides. Не обращаться к реальному серверу/ACME/ботам из CI и не монтировать реальные данные.
5. **Эксплуатация.** Restart, online backup, restore в новый volume, update и rollback сохраняют external-proxy режим, сетевой alias и доступность маршрута; предыдущая связка image+данные сохраняется. Смена origin/режима явно проверяется, самовольного перехода к standalone нет. Ошибки конфигурации/недостаток места/отсутствующая сеть обрабатываются до опасных изменений; вывод и аргументы не раскрывают секреты. Прежний standalone installation test остаётся зелёным.
6. **Telegram и границы доказательства.** В инструкции точные origin/callback/Mini App URL из реального кода для IP:9443; secrets вводятся локально на Debian в private config, не через чат/Git/argv. Существующие боты не перенастраиваются. Приём числового IP:порта в BotFather Allowed URLs и настоящий Login/Mini App остаются явно ожидающими действий владельца; документация не доказывает принятие этого адреса BotFather. Не менять вход на device/login widget без отдельного подтверждённого блокера.
7. **Готовая передача.** Передан новый доступный приватный artifact для linux/amd64, полный SHA, checksums, app image ID и источник proxy, CI job/step links и отдельное независимое ревью фактического кода. Владелец получает один короткий последовательный маршрут скачивания/установки/настройки/проверки без сборки на сервере. Отдельно отмечены проверки на модели и те, которые выполнить на сервере. Не выдавать старый kit8f3dd8a за уже проверенный для этой конфигурации.

## Проверка и доставка

- Выполнить `bash scripts/verify.sh`, browser suite, container-smoke, installer tests standalone/external и `python3 .ai-development/scripts/check.py`; целевой новый тест моделирует shared ingress и его откат.
- Реальные CI runs должны содержать выполненные, не skipped, обязательные шаги и новый artifact.
- Независимый reviewer — отдельная поддерживаемая сессия/контекст. Автор исправляет находки, reviewer и management принимают фактическую итоговую область. Самопроверку не называть независимой.
- Публичный ACME/реальный Telegram/телефон/существующий Debian не доступны developer. Их отсутствие не блокирует завершение изолированной адаптации; не заявлять production verified.
- Доставка разработки — полный проверенный комплект и операторская инструкция. Внешняя установка выполняется владельцем после передачи; сертификат на9443, работоспособность соседних маршрутов и реальный общий аккаунт браузер/Mini App проверяются отдельно.
- Реальные серверные команды не выполнять из cloud-сессии. Допустимы изолированные Docker/тестовые данные и необходимые приватные CI artifacts в доступной квоте. Никаких новых платных сервисов/публичного registry/merge в main.

## Передача и результаты

### Версия и доступный комплект — 2026-11-06

Передаётся неизменяемый комплект исходного SHA **`cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb`**. Последующие изменения передачи относятся к документации/отчёту и не подменяют версию архива.

- [Приватный artifact](https://github.com/sa713/cheapshotmods/actions/runs/42233523724/artifacts/13508679421), `cheapshotmods-cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb-linux-amd64`, linux/amd64, 131883353 bytes ZIP. Скачан и проверен отдельным reviewer; доступен до 2026-12-06, нужен доступ к репозиторию.
- ZIP SHA-256: `2221cebd7b53f556d17e08ae6c2f5a9662cf411b4a150b01fb5be00ab3c3b871`.
- Tar.gz SHA-256: `5b6683f43cbb11361b317011ab2ef452e25e1f2e8416533b24a1e9e72aa702d4`. Все 12 внутренних SHA256SUMS проверены reviewer, 10 операторских файлов совпадают с Git этого SHA.
- App image: `cheapshotmods:cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb`, ID `sha256:cfdcc939fdc357b5478772a5c836f35819baba1f069691e99ba3636e80095a92`.
- External proxy сохраняет image работающего контейнера владельца; точный ID фиксируется в private operator plan. Fixture: Caddy 2.11.4-alpine, digest `sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b`. Caddy 2.10.2 из архива нужен standalone и в external не запускается.

### Реализация и результаты

Приложение/игровые правила/авторизация сохранены. Добавлены external compose и постоянные mode/origin/network/alias, bounded disk preflight, операторская транзакция ingress, модель общего proxy и обязательный CI step. Общий проект не получает `down`; пересоздаётся только ip-proxy со всем ordered stack. Private resolved configs/секреты в artifact не входят.

| Критерий | Доказательство и результат |
| --- | --- |
| 1. External app | CI: единственный app без published ports/своего proxy, своя сеть/alias/data volume; точный IP:9443; API401, оба входа config=false, UI доступен. |
| 2. Shared ingress | CI: пять overrides, совпадение с running ports/mounts/networks/image/effective env/process; private backup/diff, полная compose/Caddy validation с исходными read-only mounts/env без сети; адресный recreate только ip-proxy, идемпотентные stage/apply. |
| 3. HTTPS / доверие | Настоящий локальный HTTPS с fixture CA и проверкой IP SAN; health/version/401; подписанный Mini App, Secure/HttpOnly cookie, успешная запись с точным Origin. Неверный Origin отклонён, forged XFF не обходит IP limiter. |
| 4. Соседи | Старые четыре порта/routes, networks/mounts, данные соседа и HTTP-01 через frontend сохраняются после apply/rollback. Пропущенный override, drift env/entrypoint отклонены до изменения proxy. |
| 5. Lifecycle | Restart, online backup0600, restore в новый volume, synthetic update/rollback сохраняют данные/external-привязку, не пересоздают общий proxy. Смена mode/origin, нет сети/места — ранний отказ; обычный и прерванный отказ ingress восстановлены. Standalone полный test passed. |
| 6. Telegram | Точные origin/callback/Mini App URL и private config в инструкции; тестовые HMAC/RS256 изолированы. BotFather/живые потоки проверяет владелец. |
| 7. Передача | Новый приватный artifact скачан/сверён независимо. Обязательные CI steps выполнены; отдельный reviewer повторил полный external test неизменённого cf0 комплекта, exit0. |

- [Checks](https://github.com/sa713/cheapshotmods/actions/runs/42233523620): [verify](https://github.com/sa713/cheapshotmods/actions/runs/42233523620/job/127945133631) — `bash scripts/verify.sh`, 33/33, typecheck/lint/build; полный browser suite 12/12 на HTTP/SQLite, measure pipeline/замер passed. [Container smoke](https://github.com/sa713/cheapshotmods/actions/runs/42233523620/job/127945134081) — passed.
- [Kit job](https://github.com/sa713/cheapshotmods/actions/runs/42233523724/job/127945133681): [build](https://github.com/sa713/cheapshotmods/actions/runs/42233523724/job/127945133681#step:4:1), [standalone](https://github.com/sa713/cheapshotmods/actions/runs/42233523724/job/127945133681#step:6:1), [external](https://github.com/sa713/cheapshotmods/actions/runs/42233523724/job/127945133681#step:7:1), [upload](https://github.com/sa713/cheapshotmods/actions/runs/42233523724/job/127945133681#step:8:1) — все success, не skipped.
- Node 24.22.1/npm 11.9.0, native better-sqlite3 13.0.3; модель Debian13 amd64 с настоящими Docker/Caddy. `python3 .ai-development/scripts/check.py`: passed, errors=0; bash/Python syntax и `git diff --check` passed. PRODUCT/45 управляемых файлов стандарта не менялись.
- Промежуточные ошибки не скрываются: installed() возвращал false при `set -e`, Compose добавлял пустой IPAM, fixture учитывала регистр HTTP-заголовков. Исправлены, успешный CI полного нового кандидата получен. Первичные находки отдельного reviewer и их закрытие сохраняются в его отчёте.
- Независимо подтверждённая R5: в f1e37945479c9dbf7af68c62b25a53eb1722c954 откат мог потерять добавленный позже сторонний override. Этот прежний artifact отозван из рекомендации несмотря на зелёный исходный CI. В cf0a793 исправлены проверки текущего ordered stack/env/context/identity и runtime до любых записей при manual/automatic/interrupted recovery. Регрессии с поздним дополнительным портом и переименованным контейнером проверяют отказ без изменения Caddyfile/owned override/container/соседа, затем штатное восстановление. Reviewer отдельно выполнил 11/11 положительных/отрицательных случаев guard.
- Локальная пересборка e8cc032 остановилась на ENOSPC в vfs Docker; canonical kit успешно собран CI. Удалялся только новый build cache этой задачи по точным ID. Локальные диагностические комплекты с ec5/f1 runtime и новыми operator-файлами не передаются владельцу и не выдаются за canonical cf0 artifact. Полный авторский external-прогон после R5 — exit0; проверка именно неизменённого нового архива выполнена отдельно reviewer.
- Независимый native-повтор cf0: `bash scripts/test-external.sh /tmp/chm-task003-review-artifact-cf0/cheapshotmods-cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb-linux-amd64` — **exit0**, включая новые R5-регрессии и весь lifecycle. Docker image ID/revision/platform совпали с manifest; containers/volumes0→0, исходные три сети и baseline images сохранены, cache54→54. Лог reviewer `/tmp/chm-task003-review-external-cf0.log`. Отдельное [заключение](../reviews/TASK-003-code-review.md) сохраняет R1–R5, свои проверки, CI/artifact и ограничения.
- Публичный TLS-block отдельно адаптирован/валидирован reviewer на закреплённом Caddy2.11.4 без сети/выдачи сертификата: shortlived принят, apps.tls до/после совпал. Issuer policy совпадает с прочитанным исходником Radar; actual host config/renewal этим не подтверждаются.
- Итог отдельного reviewer: **accepted** для exact cf0 кода/неизменяемого комплекта в изолированной области TASK-003; открытых находок нет. [Отчёт](../reviews/TASK-003-code-review.md) перенесён побайтово, SHA-256 `590cbe220ad765c5f4ae37ee4b24cdd2b96951edc339dc11f9cb72d6be2d1d20`. Это заключение reviewer, статус задачи остаётся review для management.

### Один маршрут владельца на выбранном Debian

При наличии `gh` и авторизации в GitHub (подготовка описана в README комплекта), из нового каталога:

```bash
gh run download 42233523724 --repo sa713/cheapshotmods --name cheapshotmods-cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb-linux-amd64 --dir kit
cd kit
sha256sum --check cheapshotmods-cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb-linux-amd64.tar.gz.sha256
tar -xzf cheapshotmods-cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb-linux-amd64.tar.gz
cd cheapshotmods-cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb-linux-amd64
sha256sum --check SHA256SUMS
umask 077
cp env.external.example config.env
chmod 600 config.env
nano config.env
sudo bash ./chm.sh install /opt/cheapshotmods "$PWD/config.env"
sudo python3 /opt/cheapshotmods/ingress.py stage /opt/cheapshotmods
sudo less /opt/cheapshotmods/ingress/changes.diff
sudo python3 /opt/cheapshotmods/ingress.py apply /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
openssl s_client -connect 127.0.0.1:9443 -verify_ip 94.228.170.13 -verify_return_error -CApath /etc/ssl/certs -brief
```

Не менять `CHM_PROXY_MODE=external` / `PUBLIC_BASE_URL=https://94.228.170.13:9443`. До настройки бота Telegram-поля пустые; SESSION_SECRET генерируется приватно. После apply проверить снаружи9443 и прежние маршруты444/713/888/8443/фотогалереи/HTTP-01: health200, полный SHA в version, state401 до входа. Краткий перерыв только маршрутов ip-proxy при recreate возможен. При отказе читать private diagnostics локально, не публиковать resolved config/секреты.

Telegram настраивает владелец в **выделенном** боте: Allowed origin `https://94.228.170.13:9443`, callback `https://94.228.170.13:9443/auth/oidc/callback`, Main Mini App/menu button `https://94.228.170.13:9443/`. Три Telegram secret вводятся только в `/opt/cheapshotmods/config.env` (0600), затем `sudo bash /opt/cheapshotmods/chm.sh restart /opt/cheapshotmods` и `check`. Принятие числового адреса BotFather пока не подтверждено; при отказе передать management обезличенную причину, не менять механизм входа/HTTPS.

Эксплуатация и восстановление — [EXTERNAL-PROXY.md](../../deploy/EXTERNAL-PROXY.md). Адресный откат подключения:

```bash
sudo python3 /opt/cheapshotmods/ingress.py rollback /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh stop /opt/cheapshotmods
```

App/data/certificate volumes и соседи сохраняются. Backup — `sudo bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods`; возвращённый файл0600 передаётся `restore /opt/cheapshotmods /absolute/path/to/backup.sqlite`. Update получает каталог нового проверенного комплекта, rollback возвращает сохранённую пару image+volume. Images не собирать и глобальный prune на общем хосте не выполнять.

### Границы передачи management

Реальный Debian, внешний firewall/NAT, публичная цепочка9443, будущее продление IP-сертификата, BotFather Allowed URLs и живой общий аккаунт сайта/Mini App/WebView cloud-сессией не проверены. Ни запросов к реальному IP/ACME, ни изменения бота не выполнялось. Private CA/синтетический Telegram этих проверок не заменяют.

Developer передаёт **review**; technical acceptance остаётся management после отдельного заключения. External installation и пользовательское принятие продукта остаются pending. PR не слит, сервис не размещён, новые платные ресурсы не подключались.

- product_acceptance: not_applicable — установка сохраняет согласованный функционал; пользовательское принятие продукта остаётся pending.
- delivery: verified — приватный комплект скачан независимо, checksums/manifest/source проверены; установка на реальном сервере pending.
- Последнее подтверждение: 2026-11-06; developer по actual CI, отдельный reviewer по скачанному комплекту; management принимает итоговую область.

## Приёмка management и первый запуск владельца — 2026-11-06

Management прочитал полный отдельный отчёт TASK-003-code-review: verdict accepted на cf0a793, R1–R5 закрыты, собственный native external reviewer выполнен из точного скачанного kit. Проверены actual cf0 checks (verify/container-smoke), kit run42233523724/job127945133681 и выполненные standalone/external/upload steps; artifact13508679421 доступен, SHA/срок совпали. Diff cf0a793..30090a2 содержит только шесть management/review документов, без изменений runtime/installer. Принят именно неизменяемый комплект cf0a793 в области изолированной адаптации, не реальный выпуск.

Владелец сообщил первую попытку запуска: gh: command not found; затем cd/checksum/tar/cp/install/stage/apply/check завершились отсутствием файлов. Из показанного вывода комплект не скачан и установщик не запускался; в /opt/cheapshotmods отсутствуют файлы. Ошибка передачи — предварительные условия gh/авторизация остались в ссылке на README, команды можно было продолжить после первого отказа. Не считать это отказом работавшего сервиса или поводом отката/очистки.

Исправленная последовательность: установить gh из Debian13, интерактивно gh auth login --hostname github.com --git-protocol https --web под аккаунтом с доступом к репозиторию; выполнять последующие команды в subshell с set -euo pipefail и umask077. Скачать run42233523724 в новый приватный mktemp-каталог; сверить tar с закреплённым SHA256 5b6683f43cbb11361b317011ab2ef452e25e1f2e8416533b24a1e9e72aa702d4 и внутренний SHA256SUMS. Скопировать env.external.example (Telegram пока пустой), install → stage → локальный diff → apply → check. При первой ошибке прекратить зависимые шаги, сохранить только обезличенный диагностический вывод. Общий ip-proxy при apply кратко пересоздаётся; остальные сервисы не пересоздаются.

Следующий исполнитель — владелец на Debian; management разбирает возвращённый вывод. Сертификат9443, внешние маршруты/соседи, BotFather и реальные пользователи остаются pending. Комплект/история reviewer не изменены, main/PR не слиты.

## Уточнение владельца: доступ GitHub без CLI — 2026-11-06

Владелец отклонил установку gh и повторную авторизацию CLI: на сервере уже используется доступ к GitHub по ключам, для Cheapshot нужен отдельный проектный ключ. Требование gh не является зависимостью продукта и снимается из операторского маршрута. Ранее предложенные CLI-команды остаются историей передачи, не текущим следующим шагом.

Выбран fine-grained GitHub PAT: owner sa713, Only select repositories → cheapshotmods, Actions Read-only для готового Actions-архива, Contents Read-only для чтения репозитория, Metadata автоматически. Срок90 дней. Это credential GitHub, не Telegram/ключ приложения. Создание выполняется владельцем на https://github.com/settings/personal-access-tokens/new; management не имеет инструмента выдачи личного PAT. Новый ключ ещё не выдан/проверен в этой сессии, существующие токены/SSH других проектов не читать и не переносить.

Постоянный локальный credential-файл: /root/.config/cheapshotmods/github.curl, каталог0700, файл0600; ключ вводится скрытым read, не через argv/history/chat. Скачать выбранный artifact можно штатным curl --config PATH --fail --location по https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13508679421/zip; --location-trusted не использовать. Сверить закреплённый ZIP hash2221cebd7b53f556d17e08ae6c2f5a9662cf411b4a150b01fb5be00ab3c3b871, извлечь ZIP через python3 -m zipfile, затем tar/internal checksums как в принятом комплекте. Release/CI/kit не меняются.

Первый операторский шаг после создания PAT — локально сохранить credential и проверить доступ без вывода ответов/секретов:

```bash
(
  set +x
  set -euo pipefail
  umask 077
  install -d -m 700 /root/.config/cheapshotmods
  read -r -s -p 'Вставь GitHub token: ' CHM_GITHUB_TOKEN
  printf '\n'
  test -n "$CHM_GITHUB_TOKEN"
  printf 'header = "Authorization: Bearer %s"\n' "$CHM_GITHUB_TOKEN" \
    > /root/.config/cheapshotmods/github.curl
  chmod 600 /root/.config/cheapshotmods/github.curl
  unset CHM_GITHUB_TOKEN

  curl --fail --silent --show-error \
    --config /root/.config/cheapshotmods/github.curl \
    --output /dev/null \
    https://api.github.com/repos/sa713/cheapshotmods/actions/runs/42233523724/artifacts

  printf 'Доступ к комплекту Cheapshot подтверждён\n'
)
```

Следующий шаг после подтверждения доступа — curl-скачивание принятого архива в новый private каталог и продолжение install/stage/apply/check. gh/git clone/сборка на сервере для скачивания готового artifact не требуются. Источники: GitHub REST Actions artifacts / Download an artifact (Actions read), документация fine-grained PAT.

## Операторская попытка: сверка Docker image IDs — 2026-11-06

Владелец предоставил результат curl-маршрута: kit.zip OK, tar.gz OK, все12 внутренних entries OK; затем `Cheapshot Mods: loaded image IDs differ from manifest`. Это новый доказанный отказ installer на целевом Debian. Он находится в load_images после docker image load, до mkdir ROOT/создания тома/сети и запуска app/изменения ingress. Могли загрузиться/переназначиться image tags; пересоздание работающих контейнеров этой веткой не выполнялось. Внешняя установка failed до запуска; прежняя изолированная приёмка сохраняется как история, фактическая совместимость с хостом не подтверждена.

Management прочитал exact cf0 deploy/chm.sh и scripts/bundle.sh: manifest app_image_id/proxy_image_id берутся из builder docker inspect .Id, затем напрямую сравниваются с target .Id. Обе проверки выполняются и в external-режиме. Docker/Moby maintainer подтверждает, что classic image store использует config digest, containerd — manifest/index digest, поэтому .Id не является переносимым межэтими stores: https://github.com/moby/moby/issues/51934. Это обоснованная гипотеза для данного отказа, не уже прочитанный backend владельца.

Следующий операторский шаг read-only: docker info Driver/DriverStatus, выбранные docker image inspect поля (Id/Os/Architecture/org.opencontainers.image.revision и RepoTags) только для cheapshotmods:cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb и caddy:2.10.2-alpine. По выводу подтвердить конкретное расхождение и подготовить developer-исправление переносимой проверки без отключения идентичности/подмены manifest или смены общего Docker storage. Продуктовый код management не меняет. Секреты/полный inspect/env не выводить; повторно скачивать и очищать images/volumes сейчас не требуется.

## R6 — переносимая проверка Docker-образов: текущее допзадание

- Статус исправления: review; задача TASK-003 ранее возвращена в changes_required после отказа на целевом хосте. Изолированная приёмка cf0a793 сохранена как историческое доказательство, не приёмка нового кода.
- База исправления: ветка `chm-003-external-proxy`, полный SHA `d4eabf608d8a9e86bc2c3f38accce95401069597`; её runtime/installer совпадают с cf0a793, последующие изменения — management-документы. Текущая постановка также doc-only, безопасное продвижение проверить без reset/force. Продолжать в том же PR №3 с base chm-001-foundation, без параллельной реализации/слияния в main.
- Цель: новый неизменяемый комплект проходит установку на существующем Docker29/containerd владельца и сохраняет надёжную проверку содержимого образов; сервер не подстраивается под установщик.

### Подтверждённое воспроизведение

Владелец выполнил принятый curl-маршрут: ZIP, tar и все12 внутренних entries OK; install отказал `loaded image IDs differ from manifest`. Загрузка образов прошла, до mkdir ROOT/БД/сети/app/ingress код не дошёл. Последующая read-only диагностика:

```text
DRIVER=overlayfs
DriverStatus=[["driver-type","io.containerd.snapshotter.v1"]]
app tag=cheapshotmods:cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb
actual .Id=sha256:224b715b65e63febfde0a3934f864440a824d9a8dacbf7ce4c9a206abcd6d425
platform=linux/amd64
revision=cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb
packaged proxy tag=caddy:2.10.2-alpine
actual .Id=sha256:5bf74fd0ea8316ea9934240b594242392bcc0e4f2678d4e06d5c5d3fb9f5932d
platform=linux/amd64
proxy revision label отсутствует
```

Принятый cf0 manifest ожидал app_id `sha256:cfdcc939fdc357b5478772a5c836f35819baba1f069691e99ba3636e80095a92`, proxy_id `sha256:aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510`.

В `scripts/bundle.sh` оба ID берутся из builder `docker image inspect .Id`; `deploy/chm.sh:load_images` прямо сравнивает с target .Id. Такая проверка непереносима: classic store идентифицирует image по config digest, containerd — по manifest/index digest. Источник maintainer: https://github.com/moby/moby/issues/51934, описание backend: https://docs.docker.com/engine/storage/containerd/. Platform/revision совпадают, но сами по себе не доказывают тождество содержимого — защиту требуется исправить, а не убрать.

### Объём и критерии исправления

1. **Переносимая идентичность.** Проверить алгоритм на фактическом cf0 архиве и исправить bundle/manifest/load/проверки версии там, где ошибочно смешаны builder и target ID. Определять и проверять точный ожидаемый linux/amd64 image по криптографически связанному содержимому config/слоёв или эквивалентному переносимому доказательству. Mutable tag, одна revision label, совпавший platform или разрешение любых IDs на containerd недостаточны. Runtime-native ID можно сохранять отдельно как наблюдение этого daemon, не универсальную идентичность. Способ и формат выбирает developer; совместимость schema/update/rollback объяснить и проверить. Shared ingress guards для actual running image/env/process не ослаблять.
2. **Реальная матрица двух stores.** В изолированной среде воспроизвести старый отказ на одном и том же kit при переносе classic → containerd. Новый точный kit проходит проверку и install на обоих реальных stores, в том числе Docker29/containerd; проверить и обратный перенос containerd → classic. Совпадение ожидаемого содержимого и различие native .Id отразить в доказательствах. Две независимые сборки каждая в своём backend или mocks не заменяют перенос одного архива между разными stores. Для daemon использовать только выделенные тестовые среды; не переключать backend/не перезапускать Docker на общем сервере владельца.
3. **Отрицательные сценарии.** Подменённый image при том же tag/platform/revision отклоняется; неверные config/слои/platform и повреждённый kit отклоняются. Ошибки дают понятный вывод с безопасными метаданными ожидаемого/фактического значения и типа идентификатора, без env/secrets. До верификации не создавать app/БД/edge и не менять ingress. Проверку нельзя обходить редактированием ожидаемых IDs, пересчётом SHA256SUMS старого архива или отключением guard.
4. **Регрессии доставки.** Профиль external запускает app без публичного порта/своего proxy, через прежний один hop. Standalone, external shared-ingress, сохранение соседей/HTTP-01 и restart/backup/restore/update/rollback остаются работоспособны. Просмотреть обращения к image ID/digest во всех связанных production/installer/test местах, но исправлять только необходимую для R6 область. Полный PRODUCT/авторизация/UI не меняются.
5. **Проверки и комплект.** Обязательные verify/browser/container-smoke, standalone и external installation checks проходят на фактическом новом SHA; добавить реальную cross-store регрессию в CI. Собрать новый полный приватный kit с SHA/manifest/image proof/checksums. Старый cf0 архив сохраняется неизменным, его code review/CI нельзя перенести на новый код автоматически. Отдельный reviewer в новом контексте проверяет R6, отрицательные случаи и доказательство двух stores на exact kit; findings исправляет автор.
6. **Маршрут владельца.** Передать точные source SHA/run/artifact ID/ZIP и tar hashes и команды через curl с уже имеющимся `/root/.config/cheapshotmods/github.curl`. Никаких обязательных gh/повторного выпуска ключа/git clone/сборки на Debian. Для новой попытки извлекать новый kit в отдельный private каталог и запускать install/stage/apply/check. Учитывать, что старые cf0 images уже загружены, но ROOT по выполненному пути не создавался. Не чистить общие images/cache/volumes, не менять Docker daemon/storage и рабочие конфигурации соседей ради этого отказа. При обнаружении неожиданной существующей установки не перезаписывать её.

### Полномочия, результат и граница

Это исправление внутри TASK-003 и согласованной цели готовой установки, нового бизнес-сбора/нового отдельного проекта не требуется. Developer продолжает самостоятельно до нового проверенного комплекта и независимого заключения. Изолированные Docker/CI/private artifacts в доступной квоте разрешены. Management не реализует код. Merge/main, реальный сервер/ACME/BotFather и новые расходы не делегируются. Реальная установка/Telegram остаются у владельца после приёмки комплекта.

Передать описание причины/исправления, exact SHA/kit, CI и native cross-store proof, независимый verdict, команды скачивания/продолжения через curl и точные внешние ограничения. Актуализировать TASK-003/STATE/TASKS/RUNBOOK, не переписывая старые доказательства под новый SHA. При недостатке среды для реальной матрицы честно сохранить конкретный блокер; самопроверку/моки не называть выполненной cross-store проверкой.

### План developer R6 — 2026-11-06

Локальное дерево на30090a2 было чистым; safe fast-forward доe3d44fa2211d38f27aa85edb900e831daebec58a меняет только пять management-документов. Продолжается PR3/та же ветка, без reset/force.

1. На неизменённом cf0 архиве проверить config SHA256 и ordered layer diff_ids; воспроизвести .Id mismatch на отдельных Docker29 classic/containerd fixtures, не менять основной daemon/сервер владельца.
2. Добавить явное переносимое image proof, проверяемое по архиву до import и по фактически загруженному содержимому до ROOT/data/edge/app. Native ID оставить наблюдением daemon; ingress same-daemon guard сохранить. Обновить совместимые bundle/installer/test генераторы и диагностику.
3. Негативные случаи с теми же tag/revision/platform, неверными config/layers/platform/kit; один canonical kit в обоих stores и обратный export. Обязательная CI cross-store регрессия, остальные checks и lifecycle не ослаблять.
4. Новый immutable artifact, отдельный reviewer в новом контексте, исправления доказанных находок, docs/карточка/PR и curl-команды с уже настроенным credential-файлом. Старые отзывы/артефакты не переписывать.

### Причина и реализация R6

В `format2` переносимая идентичность — SHA-256 точных bytes config плюс ordered SHA-256 uncompressed layers, сверяемые с `rootfs.diff_ids`. Native `.Id` сохраняется только как `builder_observations`; совпадения tag/platform/revision недостаточно. `image-proof.py` сначала проверяет содержимое архива до import, затем фактический Docker export загруженных images до ROOT/data/edge/app. После export повторно сверяется привязка tags к daemon-local IDs, чтобы не принять изменение во время проверки. Диагностика содержит тип proof и digests, не Env/secret values.

Формат manifest2 намеренно не принимается старым installer как format1. Для обновления существующей format1 установки используется входящий новый `NEW_BUNDLE/chm.sh update ROOT NEW_BUNDLE`; новый installer не загружает старый format1 kit как новый вход. Rollback возвращает сохранённые локальные image+volume/старый installer без повторного импорта старого архива. В dedicated classic fixture это проверено exact cf0 installer с явно synthetic predecessor, обновлением в2, записью и возвратом состояния300/старой пары. В2→2 lifecycle проверяется на обоих stores. SQLite/schema/игровые правила/OIDC/UI не изменялись; same-daemon ingress image/env/process guard сохранён побайтово.

Локальное исследование неизменённого cf0 (это не новый handoff kit): Docker29.8.0 в двух отдельных DinD контейнерах, classic/vfs и containerd/native с DriverStatus `io.containerd.snapshotter.v1`. Exact старое тело load_images даёт classic exit0 и containerd exit1; containerd native IDs224b715.../5bf74fd... совпали с выводом владельца. Universal config digests cfdcc939.../aac61abc... и8+5 ordered layer hashes одинаковы. Actual containerd export импортирован в пустой dedicated classic без rebuild/правки ожидаемой идентичности, повторный proof exit0. Исходный tar SHA5b6683...702d4/старый отчёт сохранены. Основной cloud daemon не переключался/не перезапускался; default DinD bootstrap здесь ограничен readonly cgroup, поэтому локальная матрица относится к identity/import/export, полноценная установка выполняется в rootful CI fixtures.

Новые негативные проверки охватывают wrong config/layer/order/platform, malformed config, повреждённый kit, лишний tag, duplicate member, gzip больше decoder chunk, усечённый и trailing gzip. Actual installer получает подменённый загруженный image при тех же tag/platform/revision/rootfs: изменённый runtime config отклоняется до ROOT/БД/edge/app, secret-marker не печатается. Неповреждённый архив и expected proof при этом не меняются; это отдельная синтетическая fixture, а не обход старого cf0 guard.

История проверки нового кода сохраняется:4d CI standalone/external passed, matrix failed до запуска из-за скрытого DinD tmpfs config; исправлено переносом inputs в/r6. Независимый reviewer нашёл gzip trailing-stream loop (R6-F3), исправлен bounded decode/progress и regression;14/14 offline, собственный повтор reviewer valid0/truncated1/trailing1. Наe37 external old25-attempt rate probe пересёк fixed-minute boundary и не получил429: исправлен только тест на41unique forgedXFF (<global100) в bounded burst, production limiter/proxy не менялись. 6f прошёл full CI matrix и upload, но не рекомендуется из-за ещё не исправленного там F3. Предыдущие runs не выдаются за приёмку нового источника.

### Итоговая передача R6

Неизменяемый комплект **fbe82aef6008d292515c0efce2fde601c221f3d2**, `cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64`, linux/amd64, manifest format2. [Artifact13522083303](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/artifacts/13522083303), ZIP131881374 bytes, доступен до2026-12-06. Reviewer независимо скачал/сверил13/13 SHA256SUMS,11/11 packaged source и отдельным streaming parser без импорта авторского helper проверил оба config и8+5 слоёв. Старыйcf0 и промежуточные4d/6f/e37 не рекомендуются для новой попытки. Последующие документы/отчёт не подменяют этот source SHA/архив.

| Доказательство | SHA-256 |
| --- | --- |
| ZIP | `fb78a81f5df989c361390c227008916c239b5ad41a5535515cfe1f0581cec062` |
| Tar.gz | `cd250916ed39f7594d0eea37fea6adb185eb2fe9ec2528be7e9e57ea50d8238d` |
| images.tar.gz | `f5a300101c1dbc6c280dd2a13441ce3546e774d21341041034e0ece15375dc13` |
| App config, переносимая идентичность | `c312b0b3470fb7edbadfbe8cf462d647a45efae9d466d9e1b9ca4f79da8758d4` |
| Packaged Caddy config, переносимая идентичность | `aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510` |

[Checks42253960150](https://github.com/sa713/cheapshotmods/actions/runs/42253960150) — verify33/33,0skipped, browser12/12, container-smoke, measure pipeline/capacity success. [Kit42253960168/job128016036465](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465) — [14 proof tests](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465#step:4:1), [build/extract](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465#step:5:1), [standalone](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465#step:7:1), [external](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465#step:8:1), [real cross-store matrix](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465#step:9:1), [evidence/kit uploads](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465#step:10:1) — все success, обязательные проверки не skipped. Node24.22.1/npm11.9.0/native better-sqlite3 13.0.3 сохранены. Локально verify33/33 и browser12/12 exit0; structural checker0errors; PRODUCT/45managed files/app/auth/UI/ingress unchanged относительноe3d44fa.

Матрица использует один exact images.tar.gz выше в реальных Docker29.8.0 classic(vfs) и containerd(native snapshotter, DriverStatusio.containerd.snapshotter.v1); это различие image store, не смена backend на сервере. App native ID classic=`sha256:c312b0b3470fb7edbadfbe8cf462d647a45efae9d466d9e1b9ca4f79da8758d4`, containerd=`sha256:0217f2634f59e04f4a5b51697507adaa78ebeb80dad0b138d56f82cf8ac3b24a`; packaged Caddy classic=`sha256:aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510`, containerd=`sha256:5bf74fd0ea8316ea9934240b594242392bcc0e4f2678d4e06d5c5d3fb9f5932d`. Config/layers совпадают. Reverse containerd export SHA `127faecebfb86cf10457b963a2f04da4829e254b1fc6a7c6a3a1467d77e9d803` без rebuild импортирован в fresh classic, исходный expected proof сохранён, classic IDs вернулись. Обе полные external/lifecycle/negative матрицы и schema1→incoming2→old pair rollback с данными300 прошли. Это не две независимые сборки вместо переноса.

[Evidence13523361428](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/artifacts/13523361428), ZIP SHA `dcebd78d18dbcd24d7cc00bfb585bf9b7cd4ddf9a53c408ceb6f6a228bd606b1`: три observations JSON, summary и daemon logs; reviewer независимо сверил API/bytes и полные job logs. Для будущего воспроизведения — exact checkout source SHA, `bash scripts/bundle.sh artifacts` и `bash scripts/test-image-stores.sh EXTRACTED_KIT EVIDENCE_DIR` в выделенной среде с privileged DinD; не на общем сервере владельца. После истечения retention новый CI artifact собирает developer, сборка на Debian владельца не требуется.

Команды для владельца, от **root**, с уже настроенным `/root/.config/cheapshotmods/github.curl`. Новый private каталог, без sudo/gh/newtoken/git/build/очистки общих images. Сначала download/install/stage; при любой ошибке subshell останавливается:

```bash
(
  set +x
  set -euo pipefail
  umask 077
  test -r /root/.config/cheapshotmods/github.curl
  test ! -e /opt/cheapshotmods
  CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-r6-XXXXXX)
  cd "$CHM_DOWNLOAD"
  curl --disable --config /root/.config/cheapshotmods/github.curl --fail --silent --show-error --location --output kit.zip https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13522083303/zip
  printf '%s  kit.zip\n' fb78a81f5df989c361390c227008916c239b5ad41a5535515cfe1f0581cec062 | sha256sum --check -
  python3 -m zipfile -e kit.zip .
  printf '%s  cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64.tar.gz\n' cd250916ed39f7594d0eea37fea6adb185eb2fe9ec2528be7e9e57ea50d8238d | sha256sum --check -
  tar -xzf cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64.tar.gz
  cd cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64
  sha256sum --check SHA256SUMS
  cp env.external.example config.env
  chmod 600 config.env
  bash ./chm.sh install /opt/cheapshotmods "$PWD/config.env"
  python3 /opt/cheapshotmods/ingress.py stage /opt/cheapshotmods
  cat /opt/cheapshotmods/ingress/changes.diff
)
```

Diff просмотреть локально и не отправлять resolved configs/секреты в чат. Если stage прошёл и diff соответствует подключению, применить отдельно:

```bash
(
  set -euo pipefail
  python3 /opt/cheapshotmods/ingress.py apply /opt/cheapshotmods
  bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
  openssl s_client -connect 127.0.0.1:9443 -verify_ip 94.228.170.13 -verify_return_error -CApath /etc/ssl/certs -brief
)
```

`PUBLIC_BASE_URL=https://94.228.170.13:9443`/external уже в env example. Telegram пока пустой, SESSION_SECRET installer генерирует приватно. Expected version — exact fbe82aef6008d292515c0efce2fde601c221f3d2. App не имеет public port/своего Caddy. Stage/apply сохраняют все пять оригинальных overrides плюс шестой Cheapshot; краткое пересоздание только ip-proxy остаётся необходимым. Если `/opt/cheapshotmods` неожиданно существует, install не перезапускают поверх него и ничего не удаляют: сначала проверить его metadata/процессы. Old cf0 tags оставляются, daemon/storage/working services ради R6 не перенастраиваются.

Backup/restart/restore/update/rollback и точные Telegram origin/callback/Mini App URL — [EXTERNAL-PROXY](../../deploy/EXTERNAL-PROXY.md). Rollback ingress: `python3 /opt/cheapshotmods/ingress.py rollback /opt/cheapshotmods`, затем `bash /opt/cheapshotmods/chm.sh stop /opt/cheapshotmods` при необходимости; volumes сохраняются. Реальная новая установка, публичный9443/firewall/цепочка/renewal/HTTP-01/живые соседи, BotFather и живые пользователи по-прежнему проверяются владельцем. Из development/CI к реальному хосту/ACME/Telegram не обращались, production verified не заявляется.

Независимое [R6 заключение](../reviews/TASK-003-R6-review.md): **accepted** exact fbe82aef6008d292515c0efce2fde601c221f3d2 и artifact13522083303; F1–F4 закрыты. Отчёт перенесён побайтово, SHA256 `d2a507b375e5d8a56b121adfb3f3936da8987b36cd236ac939e7d2dc1965093d`; прежнийcf0 отчёт SHA590cbe...1d20 сохранён. Reviewer собственным независимым parser проверил13слоёв, импортировал один unmodified fbearchive на оба real local Docker29.8stores, проверил packaged archive/loaded proof и фактическую ENV-подмену при same tag/platform/revision/rootfs на обоих; правильные tags восстановлены и повторный proof прошёл. Inner containers/volumes0→0, exact networks/oldcf0 images сохранены; outer resources во время reviewer не менялись. Own full local app/ingress не заявляются: они действительно выполнены на обоих stores в CI, отдельный reviewer прочитал полные logs/JSON evidence.

После освобождения review-окна developer сохранил daemon logs и удалил только два созданных R6 контейнера и их маркированные data volumes, без global prune; основной cloud daemon/backend/исходные images/default networks сохранены. Реальный сервер не затрагивался. Карточка/STATE/TASKS/RUNBOOK актуализированы, PR3 продолжается, reset/force/main merge не выполнялись. Developer возвращает management **review**, delivery нового kit **verified**, новая external_installation и живой Telegram **pending**; management принимает область по отдельному заключению, автор не присваивает себе accepted/done.

### Продолжение установки владельцем — 2026-11-07

Владелец выполнил опубликованные root/curl-команды с exact kit fbe82aef6008d292515c0efce2fde601c221f3d2/artifact13522083303. ZIP/tar и13 SHA256SUMS entries OK. Archive config/ordered layers и фактически загруженные images подтверждены; app/proxy native IDs0217f263.../5bf74fd0... совпали с containerd наблюдениями независимой матрицы. Собственный app запущен, installer сообщил running candidate. Таким образом, прежний R6 отказ на владельческом Docker устранён и в этой реальной попытке.

Далее `ingress.py stage` отказал с `command failed; inspect private ingress/diagnostics.log locally (do not send secrets)`. Последующий `apply` отказал с `invalid/missing transaction input`; check/openssl в set-e блоке не исполнились. Свежий stage сохраняет plan.json только после успешного Compose/Caddy validation, а shared Caddyfile/override записывает только apply после чтения плана. Это отдельный нерасшифрованный subprocess-отказ, не доказательство конкретной ошибки Compose/Caddy и не повторный image-proof mismatch. Из общего сообщения причину установить нельзя; доступа к реальному серверу/private diagnostics у developer нет.

Текущее продолжение: получить от владельца read-only сводку наличия checkpoint-файлов и фиксированных категорий private stderr, без вывода raw log/resolved config/env; затем воспроизвести подтверждённую причину в изолированной fixture и при необходимости исправить/проверить/передать новый комплект. Повторный install поверх существующего ROOT, apply без успешного stage, удаление ROOT/volumes, перенастройка Docker или рабочих соседей не требуются. Code/kit и независимое R6 заключение не изменены; задача остаётся review по передаче R6, новая external_installation blocked на ingress, публичный HTTPS/Telegram не проверены.

Вторая передача владельца: before.compose.json/before.Caddyfile/override.json/staged.compose.json/staged.Caddyfile/before.validation.json присутствуют; staged.validation.json/plan.json отсутствуют; единственный фиксированный сигнал stderr — permission_or_readonly. Отказ локализован в baseline validation (adapt либо validate), до staged validation. Наличие этой категории не устанавливает ни путь, ни операцию, ни точную причину; разрешать запись в чужие volumes или менять running user на этом основании нельзя.

Developer проверил локально закреплённый Caddy2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b: синтетический IP/ACME shortlived/disable_tlsalpn_challenge Caddyfile, network=none, /data и /config отдельные tmpfs ro/rw, adapt и validate — 4/4 exit0. Контейнеры одноразовые, без опубликованных портов/чужих volumes; общая конфигурация Docker и реальный сервер не менялись. Это опровергает предположение, что сам такой ACME block неизбежно требует writable /data при validate; actual baseline Caddyfile/ошибка доступа этим не воспроизведены. Подготовлен read-only reader, выводящий только фиксированные resource/operation categories; на synthetic denied/log errors проверено отсутствие raw paths/secret markers в выводе. Следующее необходимое доказательство — эта сводка denial и user/read-only flags владельческого proxy. Code/kit/предыдущие отзывы сохранены; исправление причины и новый комплект до её установления не заявляются.

### Исправление изолированной проверки file logs — 2026-11-07

Третья безопасная сводка владельца локализовала отказ: denied resources=data/log_writer, operations=open/read, read_only=true; validate_started=true. Running proxy user пустой (image default root), ReadonlyRootfs=false, UsernsMode пустой. Первопричина — наш validation принудительно делает `/data` read-only, а полный Caddy validate открывает также настроенный file writer. Это не ошибка владельческого certificate storage/пользователя и не повод менять работающие volumes/daemon.

На actual pinned Caddy2.11.4 без сети воспроизведено: исходный synthetic IP/ACME/Caddyfile с `output file /data/logs/access.log`, существующими log/cert sentinels и RO bind `/data`: adapt exit0, validate exit1 (`log writer`/read-only filesystem). Полный adapted JSON с единственным filename, перенаправленным в bounded1MiB tmpfs, проходит validate через stdin exit0; исходные sentinels неизменны. Это воспроизведение класса подтверждённого отказа, не чтение настоящего Caddyfile/данных владельца.

План и граница исправления: адаптировать оригинальный Caddyfile с фактическими image/env и RO mounts; provision/validate копию всего JSON, перенаправляя только стандартные file-writer filenames в disposable bounded tmpfs, сохраняя shared filename mapping и все остальные options/modules/credentials/пути сертификатов. Для TLS comparison возвращается оригинальный adapted JSON; ни рабочий Caddyfile, ни compose, ни log/certificate volumes эта проверка не пишет/не копирует. Нативные регрессии: действующий file access logger, неизменность оригинальных логов/sentinel и RO mounts; missing certificate и invalid writer option по-прежнему отказ до plan/shared writes. Сохраняются R1–R6 guards и существующие lifecycle/CI/store tests. После exact SHA/kit — отдельный reviewer, исправления замечаний, новый artifact и команды `update` существующей установки, затем stage/diff/apply; повторный install/удаление ROOT не нужны. Реальный сервер и BotFather developer не меняет.


### Передача исправления проверки file logs

Developer возвращает management **review**. Независимый [новый отчёт](../reviews/TASK-003-ingress-log-review.md) — **accepted** exact code/kit **b008807fa1873de4fd6d926be42bc6bf515d6a66**, без открытых blocking findings. SHA256 перенесённого побайтово отчёта `31026de349485145a7421bcfd1a391eef9a14b01196bc3818c2cd8b7ed481c09`. Это отдельная актуальная приёмка; прежние cf0/R6 отзывы и требования не переписаны, их hashes590cbe...1d20/d2a507...5093d сохранены.

| Передаваемый объект | Значение |
| --- | --- |
| Версия | `b008807fa1873de4fd6d926be42bc6bf515d6a66`, linux/amd64, manifest format2 |
| Kit CI | [42368926383/job128392801611](https://github.com/sa713/cheapshotmods/actions/runs/42368926383/job/128392801611) — все обязательные steps success, не skipped |
| Artifact | [13572814453](https://github.com/sa713/cheapshotmods/actions/runs/42368926383/artifacts/13572814453), ZIP131891605bytes; доступен до2026-12-07T11:52:12Z |
| ZIP SHA256 | `4e1fa4d7e100c8b86468d6155231620ba3cbe3cc6b4c838c1a58eae1295bce45` |
| Tar.gz SHA256 | `735dc319220db69837aa3a79a6e558cc213a7dc638152288a7a9124795fd6f45` |
| images.tar.gz SHA256 | `111d6623df63cf22f2ad66d54b8d61a88713608a7b97e65134896464ff389d02` |
| Store evidence | [13573128033](https://github.com/sa713/cheapshotmods/actions/runs/42368926383/artifacts/13573128033), ZIP35599bytes, SHA256 `fb7cb87d9611fd66c7bb9a23783e0f9a2956a8d2dd3c4639da47e35866424bd4` |

Изменение ограничено изолированной validation, её регрессиями/CI и operator/delivery документацией. App/game/UI/auth/PRODUCT/Node/npm/lock-файл, pinned standard45files, `chm.sh`, builder и переносимый image checker не изменены этим исправлением. Source/reviewer проверили, что возвращается оригинальный adapted JSON для TLS comparison, одноимённые file writers сохраняют общую scratch цель, остальные writer options/modules/certificate paths остаются. Writable только уникальный disposable tmpfs1MiB, исходные mounts RO, network none, ports отсутствуют. Содержимое чужих log/certificate volumes не копируется; доступность исходного log path по записи намеренно не утверждается изолированной проверкой. Фиксированная фаза ошибки не выводит private stderr/конфиг.

Проверки exact b008807:

- [Checks42368926414](https://github.com/sa713/cheapshotmods/actions/runs/42368926414): verify33/33, skipped0; browser12/12 на настоящем сервере/SQLite с изолированными подписанными данными; container-smoke/backup/restored volume; явный measure pipefail и capacity — success. Node24.22.1/npm11.9.0/native better-sqlite3 13.0.3.
- Kit CI:4helper+14proof negatives, build/extract/13checksums, standalone Debian и внешний ingress — success. Внешняя fixture теперь включает настоящий file access logger, неизменность исходного log/sentinel, RO mounts/1MiB tmpfs, missing TLS certificate и invalid writer mode отказ до plan/shared writes; остальные R1–R6/lifecycle/соседи/HTTP-01/drift/idempotence/rollback/recovery не ослаблены.
- Тот же exact images archive без rebuild прошёл полный external/lifecycle/negative сценарий в обоих настоящих Docker29.8.0 stores — classic/vfs и containerd/native (`io.containerd.snapshotter.v1`). Config/8+5orderedlayers совпали; app native ID classic=`sha256:9157e5b795f7249150522e3484e88109a6c0da2e3383ceb26e5f78e08722780a`, containerd=`sha256:fa5e443abd8fa8e2255f802ba9490b57e59d702a5e67948a110eb0aa95e16290`. Packaged Caddy2.10.2 portable config/IDs прежниеaac61.../5bf74...; внешний Caddy не заменяется. Containerd export SHA `abefb0e84168f58a698256faf1a2c56c1d69583c5eaba4d81430648600a0b349` импортирован в fresh classic без переписывания proof, native IDs вернулись. Legacy format1→incoming2→old pair rollback также passed.
- Автор и reviewer отдельно выполнили native regression на actual pinned Caddy2.11.4: исходная source validation exit1 (file writer/RO), новый production helper exit0, исходные cfg/adapted/log/cert hashes сохранены; missing TLS и malformed writer mode нативно отказаны. Reviewer независимо проверил env literal$, shared loggers и полное совпадение outer resource IDs до/после.
- Reviewer самостоятельно скачал ZIP/evidence, проверил API digests/bytes, tar/13sums/11packaged source и собственным streaming parser без импорта author checker — raw config SHA/13orderedlayers. Автор повторно сверил эти же bytes с exact Git blobs.
- Дополнительный author execution на **неизменённых exact** fbe и b008 CI kits: isolated Debian, normal install fbe, synthetic signed Mini auth и SQLite level300, входящий b008 `chm.sh update`, данные300 и новый helper сохранены; запись400, штатный rollback вернул fbehelper+300, restart300. Proof `/tmp/chm-fbe-update-proof/proof.json`, script/log рядом, reviewer прочитал и явно отделил от own execution. Это проверенный путь продолжения владельческой установки, не synthetic predecessor image. Fixture удалена; baseline images/tags восстановлены, containers/volumes0→0.

Локальная полная пересборка остановилась на ENOSPC в cloud vfs на COPY, не служит выдаваемым комплектом/доказательством. Канонический архив выше успешно построен CI и проверен отдельно. После неудачи очищены только собственные новые build-cache IDs по времени/явному фильтру (54baseline IDs сохранены;4новых internal refs остались), generated reverse-export scratch предыдущего теста удалён с сохранением hash/proof/logs/исходного cf0 archive. Daemon/backend/рабочие образы/сервисы владельца не перенастраивались, global prune не выполнялся.

Команды продолжения для **текущей уже установленной fbe** от root. Существующие credential/config используются как есть; новый ключ/gh/build/clone/повторный install не нужны. Preguards останавливают блок при неожиданной версии или уже существующем плане. Сначала проверяется весь новый kit, затем обычное обновление только Cheapshot с backup/новой парой image+volume; его app кратко перезапустится, shared proxy этим шагом не меняется. При любой ошибке остановиться:

```bash
(
  set +x
  set -euo pipefail
  umask 077
  test -r /root/.config/cheapshotmods/github.curl
  test -f /opt/cheapshotmods/.cheapshotmods
  test ! -e /opt/cheapshotmods/ingress/plan.json
  test "$(sed -n 's/^CHM_VERSION=//p' /opt/cheapshotmods/current.env)" = fbe82aef6008d292515c0efce2fde601c221f3d2

  CHM_SHA=b008807fa1873de4fd6d926be42bc6bf515d6a66
  CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-ingress-XXXXXX)
  cd "$CHM_DOWNLOAD"
  curl --disable --config /root/.config/cheapshotmods/github.curl \
    --fail --silent --show-error --location --output kit.zip \
    https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13572814453/zip
  printf '%s  kit.zip\n' 4e1fa4d7e100c8b86468d6155231620ba3cbe3cc6b4c838c1a58eae1295bce45 | sha256sum --check -
  python3 -m zipfile -e kit.zip .
  printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' 735dc319220db69837aa3a79a6e558cc213a7dc638152288a7a9124795fd6f45 "$CHM_SHA" | sha256sum --check -
  tar -xzf "cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
  CHM_BUNDLE="$CHM_DOWNLOAD/cheapshotmods-$CHM_SHA-linux-amd64"
  cd "$CHM_BUNDLE"
  sha256sum --check SHA256SUMS

  bash ./chm.sh update /opt/cheapshotmods "$CHM_BUNDLE"
  python3 /opt/cheapshotmods/ingress.py stage /opt/cheapshotmods
  cat /opt/cheapshotmods/ingress/changes.diff
)
```

Если stage успешно завершился, просмотрите diff **локально**. Не присылайте resolved configs/raw diagnostics. При ожидаемом добавлении только маршрута/порта/выделенной сети применить отдельно (краткое пересоздание только ip-proxy и перерыв его маршрутов):

```bash
(
  set -euo pipefail
  python3 /opt/cheapshotmods/ingress.py apply /opt/cheapshotmods
  bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
  openssl s_client -connect 127.0.0.1:9443 \
    -verify_ip 94.228.170.13 -verify_return_error \
    -CApath /etc/ssl/certs -brief </dev/null
)
```

Ожидаемая app version — полный **b008807fa1873de4fd6d926be42bc6bf515d6a66**, `/health` ok, до входа `/api/state`401 и системная TLS-цепочка/IP verification OK. Публичную доступность9443 и действующие соседние маршруты/HTTP-01 дополнительно проверяет владелец снаружи; cloud этого не утверждает.

Штатное восстановление после успешно применённого ingress: сначала `python3 /opt/cheapshotmods/ingress.py rollback /opt/cheapshotmods`, затем при необходимости `bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods` для прежней app/data пары. Второй шаг возвращает состояние до update, новые записи остаются в сохранённом новом volume; автоматического слияния данных нет. Если stage не создал plan, откатывать shared ingress нечего — сохранить private diagnostics, не удалять ROOT/данные. Полные backup/restore/stop и Telegram origin/callback/Mini App/секреты — [EXTERNAL-PROXY](../../deploy/EXTERNAL-PROXY.md), [RUNBOOK](../RUNBOOK.md). Настоящие BotFather/Login/Mini App/телефон, новый real stage/apply и production verified остаются pending у владельца. delivery нового **комплекта verified**, external_installation **pending (операторский update/new stage/apply)**, product_acceptance pending. Merge/внешнее размещение/новые расходы не выполнялись и не делегированы.
