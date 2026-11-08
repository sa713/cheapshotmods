# Запуск и эксплуатация

> Актуально TASK-005: новый проверенный runtime/kit **feb6a1bf82e70474c482c6a2e1fb0e77c4e20586**, [команды root/curl update/check/backup/restore/rollback](TASK-005-NEXT-STEPS.md), [валидация](TASK-005-VALIDATION.md), [review](reviews/TASK-005-review.md). Для существующей установки external-proxy обновляется только app; повторять ingress stage/apply, настройку BotFather или установку второго proxy не нужно. FBE/schema2 и19a/6dc/schema3→schema4; rollback только прежняя image+volume пара. Установку и реальный Telegram выполняет владелец. Ниже сохранены исторические маршруты первоначальной установки и прежних задач.

> Исторический отказ 2026-11-06 (устранён R6, не текущий блокер): реальный Docker29/containerd отклонил cf0 kit на непереносимой сверке image .Id. TASK-003/R6 — changes_required, ожидается новый проверенный комплект с cross-store доказательством. Не продолжать cf0 install через ручную подмену manifest/проверок. Архив и GitHub credential сохранены; повторная настройка gh/ключа или смена Docker backend не требуются.

Для выбранного Debian 13.7 amd64 и адреса **https://94.228.170.13:9443** основной маршрут — [инструкция external proxy](../deploy/EXTERNAL-PROXY.md). Версия комплекта, доступный artifact, результаты CI и независимого ревью находятся в последнем разделе [TASK-003](tasks/TASK-003.md). Устанавливается только app на отдельной сети; TLS завершает существующий `uek-radar-ip-proxy-1`. Новый listener требует краткого пересоздания только этого proxy, со всем его ordered compose stack. Реальные серверные действия и BotFather выполняет владелец после передачи.

Ниже также сохранены команды standalone-установки TASK-002. Для выбранного общего IP-прокси используйте новый комплект и `env.external.example`, не старый kit и не ручную подмену его файлов.

Кандидат TASK-002: мобильный калькулятор, один процесс Fastify, один origin, SQLite на локальном постоянном диске. Результаты и область приёмки — в карточке задачи. Живой Telegram и целевой хост проверяются после настройки владельцем. Публикация/registry upload не выполняются.

## Установка и проверка

Закреплены Node **24.22.1**, npm **11.9.0**, exact-зависимости и `package-lock.json`. Linux x64; native `better-sqlite3` требует совместимого prebuild либо Python/C++ toolchain для сборки. В Docker builder используется полный Debian Node image, runtime — slim той же версии.

```bash
npm ci
npm run build
npm start
# http://localhost:3000
npm run dev
# http://localhost:5173; Vite проксирует API на localhost:3000
bash scripts/verify.sh
npx playwright install --with-deps chromium
npm run test:browser
npm run measure
python3 .ai-development/scripts/check.py
```

`npm test` самостоятельно пересобирает TypeScript-проекты с `tsc -b --force` перед тестами: CLI/workers используют актуальный dist, в том числе после его удаления при сохранённых tsbuildinfo. Frontend для запуска/browser smoke по-прежнему собирается через `npm run build`.

`verify` выполняет чистую установку, типы, ESLint, unit/integration tests и production build; browser tests запускаются отдельно и в CI. Ни тесты, ни замеры не используют настоящие Telegram-аккаунты. Fixtures создают временные SQLite и RSA-ключи. В TASK-002 обязательны CI jobs `verify`, `container-smoke`, `debian-kit`; наличие workflow не включает branch protection. Результаты конкретной версии — в карточке/PR.

Browser suite запускает два настоящих HTTP-сервера приложения: без входа и с изолированным криптографическим Telegram/OIDC transport. Отдельный тестовый provider/controller не входит в runtime image. UI проходит S-01–S-06 на SQLite, включая ширины 360/390, ввод/правку/удаление, все 20 цен, примерку, крафт/отмены/сброс, 205 групп страницами (подготовлены API), точный 129-значный производный параметр, потерю ответа после commit, повтор после reload, конфликт, сбой SQLite и истечение сессии. Это протокольные фикстуры, не настоящие Telegram или WebView. Скриншоты и traces при отказе сохраняются приватным CI artifact `browser-SHA`.

В управляемой cloud-среде npm cache следует направить в доступный каталог (`NPM_CONFIG_CACHE=/tmp/chm-npm`, `XDG_CACHE_HOME=/tmp/chm-cache` для node-gyp); Chromium — `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-browsers`. Сетевым командам нужны разрешения среды. Это настройки sandbox, не зависимости приложения.

В Work-файловой системе распаковка headers самим node-gyp может завершиться EINVAL на fchown даже после переноса cache. Для этой среды допустимо отдельно получить headers ровно Node 24.22.1 и SHASUMS256.txt с nodejs.org через штатный TLS/proxy, проверить SHA-256 и распаковать `tarfile.extractall(filter="data")` без восстановления владельцев архива. Затем передать `npm_config_nodedir` на корень `node-v24.22.1` при обычном чистом verify. Это выбор подготовленных проверенных headers, не отключение install-скриптов/проверок. CI использует обычный npm ci и в этом обходном пути не нуждается. Локальная ошибка загрузки Chromium (повреждённый ZIP) не подтверждает browser smoke; результат проверяется отдельно в CI.

## Конфигурация

Store, DATABASE_PATH и оба пути backup CLI проходят общую проверку до mkdir/открытия SQLite/создания target: пустая строка, целиком пробельная строка и крайние символы, удаляемые String.trim(), отклоняются без нормализации. Внутренние пробелы допустимы. Точное `:memory:` сохранено для Store/тестового запуска сервера; SOURCE/TARGET backup должны быть путями файлов и не допускают `:memory:`. Неверный TARGET отклоняется до открытия SOURCE.

Скопировать безопасный `.env.example` в `.env` для локального запуска либо передать переменные процессу. `npm start` читает локальный `.env`, если он существует. В контейнере переменные передаются runtime-механизмом; секреты в образ не копируются.

- `PUBLIC_BASE_URL`: ровно origin без завершающего `/`; default `http://localhost:3000`. В dev origin — `http://localhost:5173`. При включённом входе production требует HTTPS.
- `DATABASE_PATH`: default `data/cheapshot.sqlite`; в контейнере `/data/cheapshot.sqlite`.
- `PORT`: default 3000; `BUILD_SHA`: полный исходный Git SHA, в локальной незаверсионированной разработке `development`.
- `SESSION_SECRET`: случайный секрет не короче 32 символов, обязателен при включении любого входа. Его замена инвалидирует сохранённые cookie. При отключённых входах сессии не дают доступа к личным API.
- `TRUST_PROXY=1`: доверять ровно одному hop перед приложением, только при закрытом прямом доступе к app. В Debian-compose наружу выходит только Caddy, который передаёт IP клиента; default прямого запуска — доверие выключено. Не выставлять app в Интернет напрямую с этим флагом.
- Mini App: `TELEGRAM_BOT_TOKEN`; OIDC: одновременно `TELEGRAM_OIDC_CLIENT_ID` и `TELEGRAM_OIDC_CLIENT_SECRET`. Без конфигурации экран честно сообщает о недоступности входа. Нет test-login или доверенного пользовательского заголовка.

Фиксированы доверенные endpoints `https://oauth.telegram.org/auth`, `/token`, `/.well-known/jwks.json`, issuer `https://oauth.telegram.org`. Scope только `openid profile`. Профильный подписанный claim `id` связывается с Mini App `user.id`; `sub` для связи не используется. Transport заменяется только импортом в тестах, переменных для произвольного issuer/JWKS в production нет.

Cookie `chm_session`: HttpOnly, SameSite=Lax, Secure при HTTPS, 12 часов. На сервере хранится HMAC идентификатора сессии. OIDC state/nonce/PKCE привязаны к начальной сессии и действуют 300 секунд, расходуются перед обменом кода; код также защищён от повторного использования. OIDC iat допускается от now−3600 до now+30 секунд включительно; exp должен быть строго позже now и iat, nbf проверяется без расширения допуска. Допуск будущего iat не продлевает exp. После входа ID сессии меняется. Mini App проверяет сырой initData: HMAC, уникальность полей, обязательные user/hash/auth_date; включены границы 300 секунд назад и 30 вперёд. Логи запросов/тел/токенов отключены; ошибки не раскрывают внутренние исключения.

В Mini App имеющийся initData всегда проверяется до чтения личных данных, даже при существующей cookie. Свежий контекст выдаёт/ротирует SID подтверждённого Telegram ID. Для reload со старым initData допустима только привязка **уже действующей авторизованной сессии к тому же подписанному ID**: проверяется HMAC, допуск в будущее остаётся 30 секунд, нет Set-Cookie, создания SID, изменения csrf или продления server expires. Без действующего SID, с чужим ID, неверной подписью или будущим временем данные не загружаются; нужен новый запуск Mini App. Это не вход по просроченному initData: новая сессия всегда требует свежести не старше 5 минут.

Личные запросы UI передают `X-CHM-Account` (account HMAC из `/api/session`) как условие совпадения текущей учётной записи. Это не доказательство личности: владельца по-прежнему определяет только cookie-сессия. При смене общей cookie другим Mini-аккаунтом старое окно получает 401 SESSION_CHANGED и показывает вход, не читая другой инвентарь. Перед POST UI обновляет csrf только для того же account; ротация SID того же игрока в соседнем окне не ломает сохранение. Logout-флаг показывает вход без чтения существующей cookie-личности.

## Эксплуатационные политики TASK-002

- Начало OIDC, callback и Mini App-вход совместно ограничены 20 попытками/IP/минуту и 100/минуту на процесс, ответ 429 + Retry-After:60. Считаются также неуспешные попытки. Один сервер; память limiter ограничена 100 записями окна, очищается каждую минуту. Перезапуск сбрасывает окно. Выбрано с запасом для ручного входа небольшой группы, без обещания массовой нагрузки. При общем NAT возможен 429; ожидать минуту, не убирать защиту. За reverse proxy нужен корректный TRUST_PROXY.
- Анонимная OIDC-сессия живёт 5 минут, а не 12 часов. В худшем случае на границах шести фиксированных минутных окон возможно до 600 неистёкших анонимных сессий. Истёкшие sessions/oidc_codes удаляются при старте процесса, каждую минуту и при создании сессии. Приложение не требует cron для этой очистки.
- Результат команды и канонический payload хранятся 30 дней. Затем пакетами до 500/минуту заменяются постоянной квитанцией: owner/key, SHA-256 payload, пустой result. Старый идентичный повтор получает 410 COMMAND_EXPIRED без применения, другой payload того же key — 409 KEY_REUSED. Не удалять квитанции вручную: их сохранность запрещает повторное применение старой команды. История текущего эксперимента сохраняется до reset. Объём квитанций растёт с числом завершённых действий; мониторить диск и резервировать всю БД.
- Миграция user_version 1→2 транзакционно добавляет время команд/index, существующим результатам даётся 30 дней от миграции. Старый app со схемой 1 не открывает новую 2; откат — только на сохранённую до обновления пару image+volume, а не запуск старого binary на новой БД.
- HTTP 500 возвращает только SERVER_ERROR. В stderr — JSON event, локальный requestId, шаблон route и status; нет URL/query/body/owner/IP/токенов/исключения/stack. Ошибка maintenance имеет только фиксированное событие. Для диагностики сохранять `/health`, `/version`, эти обезличенные события и свободное место; не включать логирование сырых auth-запросов.
- Callback допускает дополнительные поля, scalar `iss` проверяется при наличии. Отказ с правильным state расходует flow и ведёт на понятный экран; ошибки в браузере получают безопасную страницу с новым входом, без отражения текста провайдера. Проверки nonce/state/PKCE/подписей не отключаются.

В UI нет общего ручного «сохранить эксперимент»: завершённая форма/примерка/крафт сразу отправляют серверную команду. Подтверждение показывается после commit; при потере ответа блокируются новые изменения и предлагается тот же key. Незавершённая команда хранится в sessionStorage под непрозрачным account HMAC, чтобы повтор пережил reload/истечение сессии. Это не анонимный инвентарь; подтверждённое состояние читается с сервера. Logout удаляет квитанцию клиента, а выход из Mini App не вызывает немедленный автоматический повтор входа. После 409 пользователь явно загружает сохранённую версию; устаревшие данные не перезаписываются.

## API технической основы

`GET /health` проверяет доступность SQLite и возвращает 200/503 без личных данных; `GET /version` — версию сборки. `GET /api/config` — только доступность способов входа. `GET /auth/oidc/start`, callback `/auth/oidc/callback`. `POST /auth/mini` принимает `{ "initData": "..." }` с Origin, выдаёт cookie и csrf при свежем входе; при same-ID resume сохраняет текущую сессию без Set-Cookie.

Остальные API требуют серверную сессию. `GET /api/session` возвращает csrf и непрозрачный account HMAC. Необязательный `X-CHM-Account` проверяет совпадение аккаунта, никогда не заменяет cookie; mismatch — 401 SESSION_CHANGED. `POST /auth/logout` инвалидирует сессию. Все изменяющие cookie-запросы требуют точный `Origin: PUBLIC_BASE_URL` и `X-CSRF-Token` из текущей сессии. CORS не включён.

`GET /api/state` возвращает ревизию, уровень, ID текущего эксперимента, started, расход, экипировку, equippedMods с полными параметрами, точные характеристики и последний крафт. `GET /api/inventory?scope=original|work&after=ID&limit=100` возвращает items в порядке ID и revision страницы; `after` — последний полученный ID, максимум страницы 200. Для согласованного многостраничного чтения сверять ревизию до и после; при её изменении перечитать. Размер страницы не является лимитом инвентаря.

`POST /api/commands`:

```json
{"key":"уникальный-key-не-короче-16-ASCII-символов","revision":"0","experiment":"ID из state","action":{"type":"level","value":"200"}}
```

Ключ соответствует `[A-Za-z0-9_-]{16,128}`; практический выбор — UUID. Telegram ID/owner из тела не принимается. Владелец всегда берётся из сессии. Ревизия, игровой параметр, количество, уровень игрока, расход и характеристики — канонические десятичные **строки**, обрабатываются BigInt; тип мода — emoji, tier — малое целое 1–6. Не отправлять игровые числа как JSON Number. Недоверенные числовые поля команды (включая revision, value, quantity и worn) ограничены 128 цифрами до BigInt; превышение — 400 INTEGER_TOO_LONG без записи команды/изменения состояния. Это технический размер поля, не игровой максимум и не число модов в инвентаре. Корректный результат крафта может иметь 129 цифр и продолжает точно храниться, экипироваться, крафтиться и отменяться.

| action.type | Поля action помимо type |
| --- | --- |
| `original.put` | `kind,tier,value,quantity`; опциональный `id` существующей своей группы для редактирования; новый ID возвращается как `createdId` |
| `original.delete` | `id` своей исходной группы |
| `level` | `value` — положительная целая строка |
| `reset` | нет; берёт актуальный исходный набор, меняет ID эксперимента, очищает экипировку/историю/расход, сохраняет уровень |
| `equip` | `items:[{id,quantity}]`, полная желаемая экипировка; `[]` снимает всё |
| `craft` | `items:[{id,quantity,worn}]`, в сумме ровно 3; worn — сколько выбранных экземпляров были надеты, может быть `"0"` |
| `undo` | нет; отменяет последний крафт и восстанавливает экипировку непосредственно перед ним |

Одна строка selection на группу; повтор ID отклоняется. `worn <= quantity`, выбранных ненадетых не больше имеющихся ненадетых, выбранных надетых не больше надетых. Это однозначная модель взаимозаменяемых экземпляров без миллиона отдельных объектов. Каждый результат крафта получает новый ID, поэтому происхождение сохраняется. История содержит обратимые изменения трёх экземпляров и максимум 100 надетых; полных снимков инвентаря на каждый шаг нет.

Пока эксперимент не начат (`started=false`), правки исходного набора отражаются в начальной рабочей копии. Первые equip/craft либо reset начинают эксперимент. После этого правки исходного набора применяются только следующим reset. У каждого игрока ровно один текущий эксперимент.

Команда возвращает сохранённую сводку и при необходимости `createdId` только после commit. В одной IMMEDIATE-транзакции находятся проверка ревизии, моды, экипировка, история, расход и сохранённый результат команды. Тот же key и идентичное содержимое возвращают прежний результат **до** проверки ревизии, в том числе после restart/reset. Нельзя повторно применять такой ответ как новый локальный state без сверки актуальной ревизии. Тот же key с другим содержимым — 409 KEY_REUSED; устаревшая ревизия/эксперимент — 409 REVISION_CONFLICT. После конфликта перечитать состояние, после потери ответа повторить неизменённую команду с тем же key. Не создавать новый key для неизвестного результата.

Валидация — 400 (доменный код), битый JSON — 400 INVALID_REQUEST, неподдерживаемый media type (например application/xml) — 415 UNSUPPORTED_MEDIA_TYPE, остальные клиентские ошибки Fastify — исходный 4xx с INVALID_REQUEST. text/plain поддерживается парсером, но строка вместо команды отклоняется как 400 INVALID_COMMAND. Отсутствие сессии — 401, CSRF/Origin — 403, чужая/отсутствующая группа — 404, конфликт — 409, запрос больше 1 MiB — 413 REQUEST_TOO_LARGE, ошибка сохранения — 500 SERVER_ERROR. Ошибки не подтверждают сохранение; при сетевом обрыве commit мог состояться. Ограничение размера HTTP не задаёт игрового верхнего предела: вводить большой инвентарь последовательными командами, читать страницами.

## Контейнер, данные и восстановление

```bash
export BUILD_SHA="$(git rev-parse HEAD)"
docker compose build
docker compose up -d
curl --fail http://localhost:3000/health
curl --fail http://localhost:3000/version
bash scripts/container-smoke.sh
```

Запуск compose привязан только к loopback и является локальным аналогом, не HTTPS-стендом. Image label `org.opencontainers.image.revision`, tag и `/version` используют полный SHA. Runtime — пользователь node (UID 1000), volume `/data` создаётся с его владельцем. Для bind mount права каталога готовятся отдельно. Один сервер, WAL, `foreign_keys=ON`, `busy_timeout=5000`, транзакционные versioned migrations (`user_version=1`); повторное открытие безопасно, неизвестная версия БД отклоняется. Не удалять volume для перезапуска.

В managed cloud build передаёт CA через `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"`; переменные proxy наследуются, проверка TLS включена. Обычный CI не требует session-specific CA. Если Docker socket ограничен sandbox, использовать разрешённый доступ к локальному daemon, не запускать второй daemon.

Backup использует SQLite Online Backup API, включает согласованное состояние WAL. Не копировать только основной файл живой БД. Новая копия не должна существовать: target эксклюзивно создаётся с правами 0600 до открытия SQLite, в том числе при umask 022; существующий файл или symlink не перезаписывается. Использовать приватный родительский каталог/volume, доступный владельцу процесса (для нового каталога — 0700); права чужих существующих каталогов скрипт не меняет. При ошибке удаляется только созданный этой операцией target. Путь назначения с пробельными символами по краям отклоняется до создания файла: better-sqlite3 обрезает такие символы и иначе может обратиться к другому, уже существующему файлу. Пробелы внутри пути допустимы. Резервируются также история, результаты команд и сессии.

```bash
npm run backup -- data/cheapshot.sqlite /tmp/new-backup.sqlite
# Контейнер: /backup — заранее подготовленный доступный UID 1000 каталог/volume
docker compose exec app node apps/server/dist/backup.js /data/cheapshot.sqlite /backup/new-backup.sqlite
```

Для восстановления остановить запись целевого **тестового** процесса, создать новый каталог/volume, поместить backup как `cheapshot.sqlite`, назначить UID 1000 и запустить тот же image с новым volume. Никогда не восстанавливать поверх production. `container-smoke.sh` автоматически создаёт два изолированных volume, сохраняет исходный/рабочий набор, экипировку, большой уровень, историю/расход/ревизию, выполняет Online Backup, удаляет/создаёт контейнер с первым volume, затем запускает тот же серверный образ на втором volume с восстановленной БД. Проверяет health/version, сравнивает все данные и выполняет undo/craft через настоящий HTTP с синтетической Mini App-сессией и CSRF. Внутренний HTTP до контейнера моделирует hop от reverse proxy; PUBLIC_BASE_URL и cookie-policy остаются HTTPS. Это не проверка внешнего TLS/Telegram WebView. В исходной копии дополнительно проверяет операции Store. Тестовые контейнеры/volume удаляются trap после проверки. Fixture передаётся через stdin; в production image нет тестового входа/ключа или seed endpoint.

`npm run measure` создаёт 10 000 различных групп, отдельную группу миллиона модов и число 9007199254740993. Поле batchSetup явно обозначает загрузку внутри одной внешней транзакции и не является скоростью ввода через API. Отдельно sequentialHttp измеряет 100 реальных последовательных HTTP-команд с отдельным commit (total/p95), oversizedInteger — отказ на миллионе цифр до BigInt. Также выводятся время чтения страниц, 10 запросов одной ревизии через inject (проверка устаревшей ревизии, не межпоточная конкуренция), RSS/peak RSS и БД+WAL. Независимые SQLite-соединения в разных worker_threads проверяются отдельным integration test с общей стартовой преградой. Метод и машина выводятся JSON; это выборка, не SLA или предел инвентаря.

Шаг CI `Measure capacity` содержит собственный `set -o pipefail` перед pipeline и не зависит от workflow defaults. `bash scripts/check-measure-pipeline.sh` извлекает фактическое тело этого шага из workflow и исполняет его в изолированном каталоге под bash -e без defaults/унаследованного pipefail. Только временный measure завершается с ошибкой 17: шаг возвращает 17. Контрольная копия без явной защиты возвращает 0 и показывает, что отказ скрывает tee. Проверка выводит оба наблюдаемых кода и удаляет свой временный каталог; синтетическая команда не меняет приложение и не выдаётся за реальный замер.

## Лицензии и живая интеграция

Прямые runtime-зависимости Fastify 5.12.8, better-sqlite3 13.0.3, jose 6.2.15, React/React DOM 19.3.1, @fastify/cookie 11.1.5, @fastify/static 10.1.10 — MIT; прочитаны LICENSE из установленных exact-пакетов. TypeScript 5.9.3 и Playwright 1.64.1 — Apache-2.0; Vite 8.3.6 — MIT. LICENSE/NOTICE сохраняются в node_modules образа; Vite включает copyright-комментарии bundled зависимостей. Покупка API/сервиса для этого стека не требуется; это не полный юридический аудит транзитивных зависимостей.

BotFather, настоящий браузерный Telegram Login и Telegram WebView не проверены. До живого стенда management назначает выделенного бота, origin/callback/Mini App URL, хост, канал секретов и полномочия размещения. Ресурсы других продуктов не использовать. Реальный общий аккаунт сайта/Mini App и работа cookie на телефоне проверяются отдельно; подписанные фикстуры этих наблюдений не заменяют.

## Комплект Debian — standalone

Авторитетная операторская инструкция и точные команды: [deploy/README.md](../deploy/README.md). Комплект содержит app image полного исходного SHA, Caddy 2.10.2 с закреплённым manifest digest, compose, HTTPS-конфигурацию, installer, безопасный env, manifest/image IDs и SHA-256. Публичный registry не используется. CI workflow **Debian installation kit**, job **debian-kit**, проверяет standalone и external в изолированном Debian и отдаёт приватный artifact `cheapshotmods-<full-SHA>-linux-amd64` с retention 30 дней. Фактический run/artifact указан в соответствующей карточке/PR. Истёкший artifact воспроизводится checkout принятого исходного SHA и `scripts/bundle.sh` по точным командам README; исходники/lock-файл/скрипты остаются в Git. `workflow_dispatch` предусмотрен условно после регистрации workflow в default branch; до слияния кнопка Run workflow может быть недоступна.

Проверяемая installer-платформа — Debian 12/13 amd64; фактически испытанный вариант указан в карточке и CI. Неизвестный хост останавливается до изменений. Зависимости: локальный Docker >=24, Compose >=2.30 (literal/raw env), Python3, openssl, curl, iproute2/ss, стандартные coreutils/tar/gzip. Installer не устанавливает пакеты и не трогает чужие контейнеры, volumes и каталоги. Должны быть свободны выбранные TCP-порты и минимум 4 GiB диска; рекомендуемый запас выше и зависит от backup. Только reverse proxy имеет публичные порты; app доверяет ровно одному proxy hop.

```bash
# В извлечённом комплекте, значения SHA/RUN_ID взять из передачи:
gh run download RUN_ID --repo sa713/cheapshotmods --name cheapshotmods-SHA-linux-amd64 --dir kit
cd kit
sha256sum --check cheapshotmods-SHA-linux-amd64.tar.gz.sha256
tar -xzf cheapshotmods-SHA-linux-amd64.tar.gz
cd cheapshotmods-SHA-linux-amd64
umask 077
cp env.example config.env
chmod 600 config.env
nano config.env
sudo bash ./chm.sh install /opt/cheapshotmods "$PWD/config.env"
sudo bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
sudo bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Заполняются `PUBLIC_BASE_URL`, email ACME, выделенный `TELEGRAM_BOT_TOKEN`, OIDC Client ID/Secret; `SESSION_SECRET` генерируется при install, если оставлен пустым. Секреты вводятся на Debian вне Git и командных аргументов. Compose читает значения буквально, без интерполяции `$`. Команды установки Docker, BotFather/Allowed URLs/Main Mini App/Menu Button, restart/update/backup/restore/rollback полностью приведены в [README комплекта](../deploy/README.md). Restore/обновление используют новый volume, предыдущая пара image+volume остаётся для отката. Утилизация и retention — отдельное адресное действие оператора, глобальный prune недопустим.

Локальное воспроизведение сборки и installation test:

```bash
bash scripts/bundle.sh artifacts
# Извлечь построенный архив, затем:
bash scripts/test-install.sh artifacts/cheapshotmods-FULL_SHA-linux-amd64
bash scripts/test-external.sh artifacts/cheapshotmods-FULL_SHA-linux-amd64
```

Test-install использует чистый Debian 13 amd64, настоящий Docker/SQLite, loopback HTTPS и отдельную internal CA Caddy, проверяет restart, согласованный backup, restore в новый volume, синтетическую вторую версию для механики update и rollback. Он не является внешним размещением, ACME или живым Telegram; test fixture image не передаётся владельцу. Результаты конкретной исходной версии сохраняются в TASK-002. Реальные DNS/ACME/HTTPS, OIDC/nonce/отказ/дополнительные callback поля и Secure cookie в Telegram WebView остаются явно непроверенными до операторской настройки.

## Текущая передача: отдельный ingress helper при дисковом отказе app update

**Текущее состояние владельца:** отдельный helper b008 установлен, stage/apply/check прошли; app SHA fbe82aef6008d292515c0efce2fde601c221f3d2 и TLS1.3/IP+chain Verification:OK подтверждены из самого сервера. [Receipt](tasks/TASK-003.md#фактическое-применение-владельцем--2026-11-07). Повторные setup/install/update/apply не нужны. Сейчас owner проверяет URL с внешнего телефона и привычные соседние сервисы, затем настраивает BotFather/private Telegram fields и делает обычный app restart/check. Инструкции ниже описывают уже выполненную установку и дальнейшее обслуживание; внешняя доступность/renewal/живые входы остаются pending.

Владелец подтвердил app **fbe82aef6008d292515c0efce2fde601c221f3d2**, старый managed helper и отсутствие plan. Новый b008 kit/artifact13572814453 скачан, ZIP/tar/13checksums OK, но полный update остановился на reserve disk preflight **до** image import/app stop/data writes. Этот отказ сохраняется как факт; guard не ослабляется, чужие Docker images/volumes/cache/рабочие сервисы не чистятся.

Актуальный путь — [компонентная установка helper](../deploy/EXTERNAL-PROXY.md#отдельная-установка-helper-для-существующего-fbe): app остаётся **fbe**, exact b008 helper с SHA256884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011 атомарно устанавливается отдельным root-owned0600 файлом **`/opt/cheapshotmods/ingress-b008807.py`** из уже проверенного извлечённого kit. Скачивание/распаковку/images/app update/новый data volume повторять не нужно. Setup uses isolated Python `-I`, existingfbe/external/no-plan и hash/owner/mode/no-symlink/no-clobber guards. Stage использует private disk snapshots/diagnostics и bounded tmpfs1MiB, а не нулевой объём диска.

Все актуальные **stage/apply/rollback** этой установки запускаются через отдельный `ingress-b008807.py`, с повторной проверкой hash/root600 перед apply/rollback. Managed `/opt/cheapshotmods/ingress.py` остаётся старым и не является командой этого маршрута; обычный app restart/restore/update/rollback может его перезаписать, но не отдельный operator. App `/version` и `chm.sh check` ожидают **fbe82aef6008d292515c0efce2fde601c221f3d2**. Owner уже выполнил setup+stage → локальный private diff → отдельный apply/check/openssl; для дальнейшего обслуживания сохраняется тот же отдельный helper. Apply кратко пересоздаёт только shared ip-proxy со всем ordered stack; app не перезапускается. Для отката применённого shared ingress используйте тот же отдельный helper; app/data здесь не переключались и app rollback для этого пути не нужен.

[Карточка](tasks/TASK-003.md#продолжение-при-недостатке-места-для-update) содержит доказательства: full native exactfbe+отдельныйb008 на local classicDocker29.9.2/Caddy2.11.4, signedfixture/SQLite/HTTPS, неизменные appID/image/mounts/current.env/managedhelper при stage/apply, полноценные negatives/lifecycle/rollback/recovery и устойчивость отдельного helper после app lifecycle. [Supplement reviewer](reviews/TASK-003-operator-only-review.md) — отдельная область к прежнему acceptedb008 review; старые отчёты не менялись. Прежний full b008 kit/portable proof/весь CI и обе real Docker29.8stores/reverseexport остаются действительными для этого exact artifact, но localpairingrun не называется новым containerd прогоном. Воспроизведение pairing: `python3 -I scripts/test-operator-compat.py OLD_FBE_KIT NEW_B008_KIT NEW_EVIDENCE_DIR` только в выделенной тестовой среде.

Реальный setup/stage/apply и host-side health/version/TLS владелец уже подтвердил. Внешний9443/firewall/renewal/HTTP-01/соседей и живой Telegram/телефон он проверяет отдельно. Изолированные signed fixtures не называют живой интеграцией. Developer не подключался к серверу/BotFather и не выполнял merge/внешний выпуск. Полное app update остаётся отдельной штатной возможностью после появления его собственного бюджета диска; его preflight и backup/rollback semantics сохранены.

## TASK004 — объединение существующих и новых результатов крафта

Историческое исправление группировки — [сохранённая карточка](tasks/TASK-004-mod-stacks.md). Для него требуется новый app, одного operator helper недостаточно. Штатный app `update` переносит копию schema2 в schema3 и сохраняет старую пару image+volume для `rollback`; подробности включены в [README комплекта](../deploy/README.md#группировка-модов-и-схема-sqlite3-task004). Общий IP-прокси, Docker backend, BotFather и конфигурацию бота ради группировки не менять. После update старые окна перезагрузить, проверить одну строку/общее количество/«Надето», craft→undo и reload. Копии исходных записей в редакторе намеренно остаются раздельными.

Полный app update снова использует исходный reserve:2GiB+две копии image_bytes+две копии data. До загрузки нового kit можно удалить только сверенные по известному SHA256 воспроизводимые scratch ZIP/tar/images.tar.gz прежних Cheapshot скачиваний, сохранив configs, snapshots/backups и установленный operator. Удаление Docker images/cache, рабочих volumes и чужих данных не поручено. Если места недостаточно, installer останавливается: не повторять его и не обходить guard. Exact artifact/hashes/проверки сохранены в [карточке](tasks/TASK-004-mod-stacks.md#проверенный-кандидат-и-передача--2026-11-07), root/curl команды — [TASK-004-NEXT-STEPS.md](TASK-004-NEXT-STEPS.md).

## TASK004 Sites — текущий кандидат оформления

Основное приложение с одобренным Sites v1: [TASK004](tasks/TASK-004.md), [визуальное сравнение/снимки](design/TASK-004-VISUAL-COMPARISON.md), [точные root/curl update/check/rollback команды](TASK-004-SITES-NEXT-STEPS.md). Этот kit включает завершённую группировку PR4; старый TASK-004-NEXT-STEPS.md/19a kit остаётся историческим маршрутом только группировки. Отзывы и исходные receipts сохранены.

Source6dc8021e58daa9aa16a93a9265315bb810fe9d0a: все41native/20browser/container/installer/bothstores CI success. Дизайн не меняет сервер/схему/данные, именаAPI иauth остаются прежними. Входящий штатный installer допускает подтверждённыеfbe или19a/external; currentownerstate после выданных ранее команд неизвестен, поэтому его не угадывают. Изfbe применяется сохранённая schema2→3 migration в копии; из19a копируется schema3 безбумпа revision. Rollback возвращает предыдущую пару image+volume/еёданные и прежниеassets; новые записи остаются в новомvolume.

Сохранены config/bot secrets и отдельный b008 helper, общий ip-proxy/daemon/BotFather не перенастраивать ради оформления. Diskguard не ослаблен; при недостатке места stop, безDockerprune. Реальный сервер/телефон/живойTelegram новогоfrontend проверяет владелец после update, developer его не выполняет.
