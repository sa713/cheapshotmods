# Независимая native-приёмка TASK-001 / PR №1

- Репозиторий: [sa713/cheapshotmods](https://github.com/sa713/cheapshotmods), [PR №1](https://github.com/sa713/cheapshotmods/pull/1), ветка `chm-001-foundation`.
- Проверяющий: отдельный Codex-reviewer в новом контексте; собственные проверки 2026-11-06, UTC.
- Base PR: `898a1bd2ae69928203f6f0a7c179787ce33cbe13`. Base корректировки G1/N1/N2: `b2cdb86607d64c8bec8625b5b628f765c9573502`.
- Проверенный HEAD: **`67e8abe3fafa04b237c7a6374574a7cb8249dff1`**, tree `c84947c1c369b41c2510f3fc6973a113ebe127b5`. Функциональный SHA: `f1406bcd364f19f87651be2b2e6ac28b0c0d1dde`.
- Область: последняя native-приёмка из [TASK-001](../tasks/TASK-001.md): G1/N1/N2, собственное исполнение прежних F1/F2 и соразмерных регрессий F3–F6, чистая проверка, минимальная мобильная оболочка, локальный контейнер, сохранность и восстановление. Риск повышенный: авторизация и данные.
- Заключение: **accepted для указанной технической области на HEAD 67e8abe3**. Обязательные native-проверки выполнены; подтверждённых блокирующих дефектов не найдено. Это не product acceptance полного приложения, не `done`, не разрешение на merge или публикацию.

## Независимость и источники

Основная сессия, организовавшая передачу этому reviewer, ранее реализовывала G1/N1/N2. Я не участвовал в реализации, самостоятельно прочитал требования, изменённый и связанный код, выбрал и выполнил проверки, сформировал вывод. Работа шла в новом отдельном контексте reviewer и чистом detached worktree `/workspace/cheapshotmods-native-review`. Исходники, тесты, зависимости, lock и CI проверяемой версии не исправлялись и не ослаблялись. Временная диагностическая правка N1 делалась только в отдельной удаляемой архивной копии.

Граница независимости: reviewer запущен основной сессией и использует общую управляемую машину; это не внешний сервис ревью. Основная сессия сообщала сведения о настройке среды, предложила вариант одноразового root-контейнера и удалила свои прежние кэши/image для освобождения диска. Эти действия не засчитываются как мои проверки. Старые результаты автора, management, Claude и зелёный CI не переименованы в собственное исполнение reviewer.

Прочитаны AGENTS, закреплённые START/WORKFLOW/roles/reviewer/QUALITY, PROJECT, PRODUCT, актуальные TASK-001 и RUNBOOK, исходный FIXES-R2 отзыв Claude и разбор G1. Применены навыки `ad-review-change` и `cloud-environment-runtime`, включая networking и Docker reference. Закреплён стандарт 1.1.0 / `2ff5fe41b5c91f539dda4fce8944007aa0eb425f`.

Собственное чтение GitHub подтвердило base/head PR, его открытое и неслитое состояние. Локальный diff от base корректировки содержит ожидаемые G1/N1/N2 и документы передачи; после f1406bc меняются только пять документов `.delivery`. PRODUCT, lock и управляемый стандарт относительно base корректировки не изменены. В конце review worktree остался чистым на том же HEAD; новый отчёт записан только в основном checkout.

## Среда

- Host: Debian 13.6, Linux x64, **Node v24.22.1 / npm 11.9.0**. Intel Xeon Platinum 8573C, 5 logical CPU, 18 008 MiB RAM по наблюдению ОС.
- Реально загружен `node_modules/better-sqlite3/prebuilds/linux-x64.node`: **better-sqlite3 13.0.3, SQLite 3.53.4**. Fastify **5.12.8**, jose **6.2.15**. Shim, Node 22, подмена зависимостей и отключение install scripts при `npm ci` не применялись.
- `cloud_environment.environment_status`: connected/running, `observations_current: true`, network policy unrestricted/enforced, secrets/runtime identities отсутствуют. Локальный `/etc/codex/network-policy.json` также unrestricted; VPN не настроен. Proxy и CA trust сохранены, TLS verification не отключалась.
- `node:os.networkInterfaces()` реально доступен: `lo`, `eth0`, `eth1`. Положительный main/HTTP тест прошёл без обхода системного вызова.
- Локальный Docker server **29.9.2**, `vfs`, `unix:///var/run/docker.sock`. Доступ к сокету потребовал sandbox escalation. Другой daemon не запускался.
- Playwright **1.64.1**, свежезагруженный Chromium / Headless Shell **156.0.8078.4**, revision **1248**, viewport **360×800**. Дополнительное чистое browser-окружение — Debian bookworm внутри одноразового контейнера, те же Node/npm/native версии.

## Собственные команды и результаты

Для host-команд npm/node-gyp использовались доступные `/tmp/chm-native-review-npm` и `/tmp/chm-native-review-cache`; браузер устанавливался в `/tmp/chm-native-review-browsers`. Сетевые команды и localhost запускались с разрешённым доступом сети.

| Проверка | Собственный наблюдаемый результат |
| --- | --- |
| `NPM_CONFIG_CACHE=/tmp/chm-native-review-npm XDG_CACHE_HOME=/tmp/chm-native-review-cache bash scripts/verify.sh` | **exit 0**: обычный clean `npm ci` из lock, 220 packages; typecheck, ESLint, **28 passed / 0 failed / 0 skipped**, production build |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-native-review-browsers npx playwright install chromium`, затем `npm run test:browser` с тем же browser path | **exit 0**, свежая загрузка браузера; **1/1 passed**, 360×800 |
| `env -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH DOCKER_HOST=unix:///var/run/docker.sock bash scripts/container-smoke.sh` | Полный повторный запуск неизменённого скрипта **exit 0**; `seed`, `check`, `http` — passed; первый неуспешный запуск раскрыт ниже |
| Чистый git archive HEAD в одноразовом root-контейнере: npm 11.9.0, build toolchain, обычный `npm ci`, `npm run build`, **`npx playwright install --with-deps chromium`**, `npm run test:browser` | Итоговая последовательность **exit 0**, 220 packages, native 13.0.3 / SQLite 3.53.4, штатная установка системных зависимостей и свежего браузера; **1/1 passed** |
| `bash /tmp/chm-native-review-n1.sh` | **exit 0**; три собственных `npm test` по **28/28**, фактический stale/fresh compiled CLI проверен |
| `bash scripts/check-measure-pipeline.sh` | **exit 0**, фактический workflow step: failure **17**, без явной защиты **0**, без workflow defaults |
| `npm run measure` | **exit 0**; реальная SQLite/HTTP выборка, отдельно от синтетического probe |
| `python3 .ai-development/scripts/check.py` | **exit 0**, `structural_check: passed`, errors 0 |

Дополнительная контейнерная browser-подготовка не меняла production image или checkout: `git archive` передавался через stdin в `/tmp` контейнера, npm и build tools устанавливались только в его удаляемый writable layer. Контейнер запускался с `--user 0`, `NODE_ENV=development`, доступными `/tmp` caches, read-only CA mount и `NODE_EXTRA_CA_CERTS`. Сам webServer штатного теста задаёт production-конфигурацию. Точные внешняя команда и внутренний скрипт сохранены в evidence как `chm-native-review-browser-invoke.sh` и `chm-native-review-browser-container.sh`.

### G1: неоднозначность пути устранена

Самостоятельное чтение установленного `better-sqlite3/lib/database.js` подтвердило `filenameGiven.trim()`. Общая `validateDatabasePath` отвергает пустоту и отличие raw от trim; Store вызывает её до mkdir/Database, main — до создания Store, CLI проверяет оба файловых аргумента до exists/open. Значения не нормализуются молча. `:memory:` разрешено Store/main и запрещено файловым аргументам backup. Ранее введённые exclusive/0600/cleanup гарантии сохранены.

В моём clean verify действительно исполнились все шесть новых тестов `database-path.test.ts`:

- Store и main: empty/all-whitespace, leading/trailing **space, tab, NBSP** — отказ, каталог/SQLite не создаются; корректные внутренние пробелы и Store `:memory:` работают.
- **12 сочетаний** SOURCE: три вида whitespace × leading/trailing × both-names/only-literal. Trimmed и literal содержат различимых владельцев 111/222. После отказа hashes и списки файлов прежние; target и отсутствовавший trimmed SOURCE не появляются. Literal проверялся байтами, не открывался через обрезающий имя драйвер.
- Неверный TARGET, включая empty/all-whitespace/`:memory:` и крайний whitespace, отклоняется до открытия существующей sentinel-БД SOURCE: её hash и список файлов неизменны, WAL/миграции не возникли. Неверные empty/whitespace/memory SOURCE также не создают target.
- Положительные Store, compiled backup CLI и **запущенный compiled main с HTTP health/401** работают с внутренними пробелами. Backup содержит нужного владельца и имеет 0600.

### N1: тесты исполняют свежий compiled код

В отдельную `mktemp`-копию распакован `git archive 67e8abe3`; выполнен собственный обычный `npm ci`. До первого `npm test` проверено отсутствие rules/server dist и server tsbuildinfo. Первый запуск прошёл 28/28.

Затем только в этой копии в исходное сообщение `database-path.ts` добавлен `NATIVE_REVIEW_FRESHNESS`. До второго `npm test` настоящий `node apps/server/dist/backup.js '' unused.sqlite` ещё выдавал прежнюю ошибку без marker. После второго запуска 28/28 тот же CLI выдал marker, exit 1, и не создал target. Наконец оба dist удалены при сохранённых rules/server tsbuildinfo; третий `npm test` прошёл 28/28 и CLI снова исполнил новый marker. Это собственное наблюдение поведения `pretest: tsc -b --force`, а не поиск строки в package.json. Копия удалена trap; проверяемое дерево не менялось.

### N2 и F6: отказ замера не скрывается tee

Сопоставлены workflow и probe: непосредственно в `Measure capacity` стоит `set -o pipefail` перед `npm run measure | tee capacity.txt`. Probe извлекает именно текущее run-тело, запускает его в отдельном каталоге через `bash --noprofile --norc -e`, без переданного `-o pipefail` и без workflow defaults/унаследованных SHELLOPTS/BASHOPTS. На временном measure exit 17 фактически получены **17 с защитой / 0 без неё**. Отрицательный контроль подтверждает чувствительность к удалению защиты. Отдельный реальный `npm run measure` успешно исполнился; синтетический probe измерением не считается.

### F1–F5 и регрессии

Все прежние 22 теста сохранились и прошли вместе с шестью G1. Мои прогоны подтверждают:

- **F1:** настоящая jose/RSA-подпись; iat −3600/0/+5/+30 приняты, −3601/+31 отклонены; exp и nbf остаются строгими. Проверены неверные подпись/issuer/audience/identity, nonce, PKCE/state/code replay, ротация сессии и общий агрегат OIDC/Mini App на подписанных синтетических фикстурах. Мокируется граница транспорта Telegram/JWKS, криптография реальная.
- **F2:** настоящий Fastify parser: malformed JSON →400 INVALID_REQUEST, XML →415 UNSUPPORTED_MEDIA_TYPE, text/plain →400 INVALID_COMMAND; сводка и commands не меняются. Сохранены 401/403/404/409/413 и безопасный 500 с откатом при сбое БД.
- **F3:** 128 цифр принимаются, 129/миллион цифр недоверенного ввода отклоняются без изменения сохранённого состояния; другой игрок продолжает работать. Производные 129-значные моды точно читаются, надеваются, крафтятся, отменяются и сбрасываются.
- **F4:** реальный native Online Backup на диске; режим **0600 уже перед вызовом драйвера при umask 022**, отказ существующему файлу/symlink, cleanup собственного target при ошибке, проверка trim aliases. История и undo переживают reopen и WAL backup.
- **F5:** два worker_threads с независимыми native SQLite connections и общей стартовой преградой дают ровно один commit и один REVISION_CONFLICT; после reopen ревизия +1, расход 84, одна history. Это не подмена конкурентности последовательным inject. Тест не доказывает конкретную длительность перекрытия потоков.
- Изоляция владельцев, точные `9007199254740993`, потеря HTTP-ответа после commit и retry после restart, rollback, повторный undo/reset, граница 100/101 надетых, все 20 цен и переходы tiers прошли штатные содержательные assertions.

## Контейнер и измерение

Самостоятельно собран и исполнен image:

```text
sha256:70dae912e8e5707b2f6187dc3d6c1a77a9d6bf353ba8ab1a60b2b046a34bf543
org.opencontainers.image.revision=67e8abe3fafa04b237c7a6374574a7cb8249dff1
runtime user=node
```

Полный smoke проверил non-root, health, точный `/version`, 401 без сессии, сохранение на volume после удаления/создания контейнера, private backup и второй volume. На восстановленном настоящем сервере через HTTP с синтетической Mini App-сессией/CSRF совпали state и original/work inventories, сохранены большой уровень и расход, затем прошли undo и craft. Это включает чтение health/version/401 после restore. Fixture/тестовые credentials передавались только одноразовым контейнерам, не в image.

Реальный собственный measure: 10 000 различных групп, отдельный миллион одинаковых экземпляров и точное количество 9007199254740993; batch setup в одной внешней транзакции **1036.1 ms**; 100 отдельных HTTP commits **330.3 ms total / p95 7.34 ms**; отказ миллиону цифр **36.47 ms**; peak RSS **134.25 MiB**, БД+WAL **14 254 960 bytes**. Во время замера шла другая локальная подготовка, жёстких лимитов 1 vCPU/512 MiB не было. Это наблюдаемая выборка, не SLA, не максимальный инвентарь и не вывод о скорости production.

## Неуспешные подготовительные запуски и восстановление среды

Ошибки не скрывались и не засчитывались как pass:

1. Host `npx playwright install --with-deps chromium` → **exit 1**: uid 1000, sudo отсутствует, `su: Authentication failure`. Обычный browser download и host smoke после него прошли, а обязательная полная canonical-команда затем успешно исполнена в изолированном root-контейнере.
2. Первый полный container-smoke → **exit 125** после успешной сборки image: vfs заполнил диск, первый docker run получил `no space left on device`. Reviewer освободил только свои использованные браузерные/npm caches; основная сессия отдельно убрала свои старые ресурсы. Повторён **весь неизменённый скрипт**, он прошёл. После build выбирались только 31 cache-record этой проверки по сверенным точным ID и CreatedAt; более старые records фильтром не выбирались. Неиспользуемый собственный cache освобождён.
3. Первая дополнительная browser-копия в production slim → **exit 1** до browser: npm/node-gyp не нашёл Python. Следующая попытка с установленным toolchain → **exit 127** на build: reviewer первоначально не переопределил унаследованный `NODE_ENV=production`, поэтому npm установил только runtime-пакеты и tsc отсутствовал. Это ошибки подготовки дополнительной среды. Финальный новый контейнер получил toolchain и `NODE_ENV=development`, затем обычные npm ci/build/canonical install/browser прошли полностью. Ни зависимости, ни install scripts, ни проверки ради этого не менялись.

Финальные `docker ps -a` и `docker volume ls` пусты; тестовые контейнеры и volumes удалены. Локальный проверенный image оставлен, upload отсутствует. Свободно около **22 GiB**. Исходный detached worktree: пустой `git status --porcelain`, оба diff пусты, HEAD прежний.

## CI и артефакты

Собственно прочитанные GitHub metadata/steps: [run 42188164939](https://github.com/sa713/cheapshotmods/actions/runs/42188164939) на проверяемом HEAD; [verify 127793380258](https://github.com/sa713/cheapshotmods/actions/runs/42188164939/job/127793380258) и [container-smoke 127793379821](https://github.com/sa713/cheapshotmods/actions/runs/42188164939/job/127793379821) completed/success. Обязательные steps, включая canonical Chromium install, browser, probe и measure, success, не skipped. Полные CI-логи в этом review не анализировались: это внешнее исполнение, собственные результаты приведены выше. Branch protection не проверена и не заявляется включённой.

Локальный evidence bundle: **`/tmp/chm-native-review-evidence.tar.gz`**, 400 552 bytes, SHA-256 **`f66bacffb2ca63479bdf543579d7868133e044b99e5c9d58d4185931e81e4760`**. В нём 29 файлов: сырые логи успешных и неуспешных запусков, N1 diagnostic script, browser scripts, сведения о среде/image/CI/cache selection, финальная чистота worktree, исходный git archive и manifest с SHA-256 каждого вложения. Это локальный временный артефакт, не публичная/постоянная ссылка. Существенные выводы и результаты также записаны здесь.

## Находки, ограничения и следующий шаг

**Подтверждённых дефектов в порученной области не обнаружено.** Новых блокирующих гипотез не осталось; устранённые ограничения среды не подменяют дефекты продукта. Отсутствие находок не доказывает отсутствие всех возможных ошибок.

Живые BotFather/OIDC callback/nonce/Telegram WebView, cookie в настоящем клиенте, внешний TLS/Debian-стенд, телефон владельца, полный мобильный UI и пользовательские S-01–S-06 не проверялись и не входят в эту техническую приёмку. Подписанные фикстуры, localhost и локальные контейнеры их не заменяют. Рабочие данные/реальные Telegram-сообщения/платные API/внешнее размещение не использовались.

Management может сохранить этот единственный отчёт documentation-only коммитом и продолжить согласованный процесс. Reviewer не менял код, не делал commit/push, merge, публикацию или изменение семантического состояния задачи. Техническое accepted относится к явно указанному HEAD; новая функциональная версия требует соразмерной актуализации проверки.
