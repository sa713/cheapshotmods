# Независимое ревью TASK-002

- Репозиторий: `sa713/cheapshotmods`, PR [№1](https://github.com/sa713/cheapshotmods/pull/1).
- Проверяющий: отдельная сессия Codex reviewer; код и критерии не изменял. Проверка не является самопроверкой автора.
- Дата: 2026-11-06.
- Исходная техническая основа: `bc7d01304093c1be90a912ab6f147b10934537b9`; документная база задания: `bd133a0c21896ca7c89aeb702d06626d16e89f13`.
- Принятый код и комплект: `8f3dd8a13040daf4b00abd9c8e1eff5aa2815aab`. Первоначальный HEAD: `fedb417a7031ec9a2861f71126e684d8cfd1e63f`. Проверки выполнялись в отдельном detached worktree `/workspace/cheapshotmods-task002-review`.
- Область: PRODUCT S-01–S-06, мобильный UI, настоящие HTTP/SQLite, точные числа, подписанные Mini App-данные, криптографический OIDC, повтор/конфликт/сохранность, эксплуатационные ограничения, Docker/installer/CI-передача. Риск повышенный: авторизация и личные данные.
- Прочитаны AGENTS.md, закреплённые START/WORKFLOW/reviewer/QUALITY, PROJECT, PRODUCT, TASK-002, TECHNICAL, RUNBOOK, deploy/README и связанный код вне diff. PRODUCT и закреплённый стандарт сохранены; `bc7d013..bd133a0` меняет только шесть документов.
- Заключение: **accepted** для `8f3dd8a13040daf4b00abd9c8e1eff5aa2815aab` в границах TASK-002 — реализованный и проверенный кандидат для установки. Открытых блокирующих находок нет; R1/R2/N1/N2 закрыты независимой повторной проверкой ниже. Живая интеграция Telegram и внешний production не приняты этим отчётом.
- История: первоначальный `fedb417` требовал исправления R1; промежуточный `1d17a64128968c417197d81fe412ac59c089fafe` требовал исправления R2. Оба старых комплекта заменены финальным `8f3dd8a` и не рекомендуются для установки.

## Первоначальные независимые проверки

Среда: Linux x86_64 managed cloud, Node 24.22.1, npm 11.9.0, Playwright 1.64.1/Chromium. Настоящий native `better-sqlite3` 13.0.3. Команды выполнялись в отдельном worktree на указанном HEAD; production-код не менялся.

| Проверка | Команда / способ | Результат |
| --- | --- | --- |
| Чистая установка, типы, lint, тесты, production build | `npm_config_cache=/tmp/chm-task002-review-npm npm_config_devdir=/tmp/chm-task002-review-gyp bash scripts/verify.sh` | exit 0; 31/31 тест, 0 skipped, build success. npm предупреждает, что `devdir` неизвестен; установка native SQLite прошла без обхода install scripts. |
| Полные браузерные сценарии | `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser` | exit 0; 9/9, 0 skipped, около 1,1 минуты. |
| Мобильные экраны | Собственные полученные Playwright screenshots 360/390, визуальный просмотр 360; DOM overflow assertions на обеих ширинах | Основные действия доступны; горизонтального переполнения нет. Проверены длинные точные числа. |
| Смысл S-01–S-06 | Браузерный suite на настоящем HTTP/SQLite; изучена оснастка | Вход/выход, два пользователя, общий ID двух способов входа, редактирование/удаление, 205 групп страницами, 100 из >100, все 20 цен, крафт/экипировка/undo/reset, reload и перезапуск сервера, потерянный ответ/тот же key, конфликт, настоящий отказ SQLite и восстановление после истечения сессии на записи прошли. |
| Подписи/защита входа | Native auth/API tests и browser fixture | Реальные HMAC и RS256/JWKS; PKCE/state/nonce/claims/time/rotation, Origin/CSRF и изоляция. Подменён только transport провайдера в тестовой оснастке, это не живой Telegram. |
| Миграция v1→v2, дополнительная диагностика | `/tmp/chm-task002-review-diagnostics.mjs`: временная SQLite с настоящими командами/крафтом/экипировкой/большими числами; команды приведены к точной схеме TASK-001, `user_version=1`, повторное открытие текущим Store | version 2, полное совпадение state/original/work до/после, undo сохраняет уровень/экипировку, integrity_check=ok. Файл диагностики находится вне репозитория; это отдельно от продуктовых тестов. |
| Структура стандарта | `python3 .ai-development/scripts/check.py` | passed, errors=0. |
| Ошибка measure pipeline | `bash scripts/check-measure-pipeline.sh` | фактический workflow возвращает 17 при ошибке measure, контроль без pipefail — 0. |
| CI первоначального SHA | Независимо прочитаны GitHub runs/jobs/лог | [42203325983](https://github.com/sa713/cheapshotmods/actions/runs/42203325983): verify и container-smoke success, существенные шаги success. [42203326111](https://github.com/sa713/cheapshotmods/actions/runs/42203326111): debian-kit failure на Extract kit, установка/upload skipped. |
| Исправление пути checksum | Реальный текст шага Extract kit из обоих git-коммитов выполнен под bash -euo pipefail в отдельном временном каталоге с маленьким tar.gz/checksum fixture | `fedb417`: exit 1, нет извлечения. `466b7a7a562fec4043f7a6eb217f078b21ee7f3b`: exit 0, файл извлечён. Это подтверждает локальное исправление R1, но не заменяет полный kit CI/артефакт. |

Полные локальные логи этого прогона: `/tmp/chm-task002-review-verify.log`, `/tmp/chm-task002-review-browser.log`. Они временные, не являются передачей установочного комплекта. Существенные результаты сохранены в таблице; CI даёт постоянные ссылки в пределах срока хранения GitHub.

## Находки

### R1 — закрыта; первоначально блокирующая: workflow не доходит до установки и передачи комплекта

- Место первоначального HEAD: `.github/workflows/bundle.yml:30`, связанный `scripts/bundle.sh:43`.
- Условие: обычный pull_request/dispatch job с артефактами в `artifacts/`.
- Причина: builder формирует SHA256-файл изнутри output-каталога, запись содержит только basename архива. Workflow выполняет `sha256sum --check artifacts/<name>.sha256` из корня checkout; sha256sum ищет `<name>.tar.gz` относительно текущего каталога, а не каталога SHA256-файла.
- Последствие: `debian-kit` падает, installer не исполняется, приватный комплект не загружен. Нарушены TASK-002 D/E; существование локального `/tmp`-архива это не закрывает.
- Доказательство: [job 127843729124](https://github.com/sa713/cheapshotmods/actions/runs/42203326111/job/127843729124), `sha256sum: cheapshotmods-fedb417...tar.gz: No such file or directory`, exit 1; следующие два шага skipped. Независимый минимальный прогон фактического шага дал тот же результат.
- Направление: выполнять проверку checksum в каталоге архива, затем подтвердить полный успешный kit job и наличие скачиваемого артефакта на исправленном SHA.
- Исправление `466b7a7a562fec4043f7a6eb217f078b21ee7f3b` рассмотрено и изолированно воспроизведено. Успешные полные kit jobs, скачивание обоих последующих комплектов и собственная установка `1d17a64` закрывают R1.

### R2 — закрыта; первоначально блокирующая: свежий подписанный Mini ID не проверяется при существующей cookie-сессии

- Место: `apps/web/src/main.tsx`, startup effect: `if (!s && initData && c.mini ...)`. Успешный `/api/session` исключает вызов `/auth/mini` и проверку имеющегося Mini initData.
- Требование: TASK-002 A/C и PRODUCT S-01 — Mini App привязан к подтверждённой Telegram-личности; личные данные игроков изолированы.
- Этот сценарий предложен автором и затем независимо воспроизведён reviewer на проверенном коде.
- Доказательство: собственный `/tmp/chm-task002-review-mini-context.mjs`, настоящий fixture HTTP/SQLite и две pages одного browser context. A входит с подписанным свежим ID `880004`, сохраняет уровень 200. B открывается с отдельно криптографически проверенным свежим ID `880005`, но общей cookie A. Результат: B показывает уровень 200; account HMAC B равен A; запросов `/auth/mini` от B — 0. Ни сырые initData, ни секреты в вывод не попадали.
- Последствие: после смены Telegram-личности в том же cookie-контексте Mini App показывает работу прежнего игрока. Это нарушение привязки идентичности и изоляции, а не только сообщение интерфейса.
- Направление: проверять имеющееся initData до чтения личных данных всегда. Свежий валидный proof должен создавать/ротировать сессию к подтверждённому ID. Для старого initData допустимо только криптографически проверенное совпадение ID с уже действующей сессией без создания/продления; invalid/mismatch/future не должны возвращать прежние данные. Сохранить пяти минутную свежесть для новых сессий. Нужны API и browser проверки свежей смены ID, stale same-ID, stale other-ID и invalid signature.
- Исправление `8f3dd8a` проверено по исходникам, собственным HTTP/SQLite и browser-матрицам, полным тестам и готовому образу финального комплекта. Mini proof проверяется до личных чтений; свежий другой ID ротирует сессию. Stale допускается только для того же ID с действующей сессией, без Set-Cookie и изменения expiry; неверная подпись/ID/будущая дата отклоняются. Дополнительный `x-chm-account` лишь запрещает соседнему окну принять сменившуюся cookie-личность и не является credential. R2 **закрыта**.

### N1 — закрыта; первоначально неблокирующая: после 401 на чтении нет предложенного входа

- Место: `apps/web/src/main.tsx:113` (`refresh`), аналогично `nextPage`.
- Воспроизведение на настоящем HTTP/SQLite: войти подписанным Mini App; истечь серверную сессию в изолированной БД; нажать «Загрузить сохранённые данные».
- Наблюдение: alert «Сессия завершилась. Войдите через Telegram заново», но мастерская остаётся, ссылки OIDC и кнопки Mini App отсутствуют (обе count=0). Чтения обрабатывают только problem, в отличие от send/401. Полный browser reload восстанавливает подписанный Mini-вход; сохранённые данные не потеряны.
- Направление: общий переход в состояние входа для 401 при чтениях/выходе либо явное действие восстановления на экране. Ограничение не блокирует первоначальную приёмку само по себе благодаря рабочему reload и отсутствию потери данных; автор решил исправить его в текущем задании.

### N2 — закрыта; первоначально неблокирующая: installer принимает неканонический origin, отклоняемый сервером

- Место: `deploy/chm.sh`, `config_check`, относительно `apps/server/src/main.ts` (`url.origin===baseUrl`).
- Дополнительный граничный случай был предложен автором; reviewer независимо воспроизвёл его, не приняв предположение за готовый вывод.
- Проверка точной функции config_check из проверенного Git и настоящего compiled main: `https://example.com`, `https://EXAMPLE.com`, `https://example.com:443` проходят config_check (exit 0). Последние два затем дают exit 1 / INVALID_BASE_URL в main до создания SQLite.
- Последствие: неканоническая конфигурация может пройти preflight, создать неполную установку и закончиться таймаутом ожидания app. Документированный канонический URL работает; потери существующих данных не обнаружено. Поэтому это эксплуатационное улучшение, не блокер поддержанной корректной установки.
- Исправления `bbb192783f0e78f050602f921076fa85d35f1511` и `7446a62bb53ba965b03b54fafa6e6bdd74b39a22` рассмотрены. Дополнительно reviewer обнаружил и воспроизвёл несовпадение numeric IPv4 aliases (`127.1`, целое/hex/octal), которое закрывает второй коммит. Точная функция config_check из финального скачанного архива отдельно выполнена на восьми отрицательных и пяти положительных примерах и сверена с Node WHATWG origin; все результаты совпали. Восемь отрицательных: uppercase host, явный :443, `127.1`, `2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1.`, `127.0.0.1.`. Положительные: canonical DNS, поддомен, IPv4 и :8443. Проверка стоит до load_images/root/volume; финальный CI installation фактически проверил отказы до изменений. N2 **закрыта**.

## Повторная проверка 1d17a64

Новый HEAD: `1d17a64128968c417197d81fe412ac59c089fafe`. От `fedb417` изменены только checksum cwd в workflow, Dockerfile, обработка UI 401 и её браузерная регрессия. Изменения просмотрены независимо. Dockerfile собирает тот же runtime-набор в один каталог/слой; версии/lock/runtime-user/volume и проверки TLS сохранены. Это устраняет лишние vfs snapshots, не заменяя native зависимости заглушками.

- `npm run typecheck`, `npm run lint`, `npm run build` — exit 0 на новом HEAD.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser -- --grep 'expired session|response lost'` — 3/3 pass, около 8 секунд; включён новый read/logout-401 и прежние unknown outcome/SQLite failure/pending-session сценарии.
- Дополнительная собственная Playwright-диагностика `/tmp/chm-task002-review-session-rereview.mjs` проверила ещё два пути: настоящий commit команды с истечением сессии перед последующим GET и 401 при загрузке следующей страницы. Оба предлагают повторный вход. После входа commit виден точно один раз, лишней pending-команды нет. N1 **закрыта**.
- Независимо прочитаны финальные jobs и логи [checks 42204271349](https://github.com/sa713/cheapshotmods/actions/runs/42204271349) и [kit 42204272323](https://github.com/sa713/cheapshotmods/actions/runs/42204272323): verify/container-smoke/debian-kit success; все применимые содержательные шаги success. В verify 10 браузерных сценариев passed. В kit фактически исполнены installation, restart, backup/restore, synthetic update/freeze/failure recovery/rollback, internal HTTPS, native SQLite и сохранение чужого volume.
- Приватный [artifact 13496575547](https://github.com/sa713/cheapshotmods/actions/runs/42204272323/artifacts/13496575547) действительно существует и независимо скачан через GitHub connector: `cheapshotmods-1d17a64128968c417197d81fe412ac59c089fafe-linux-amd64`, 131869341 bytes, expires 2026-12-06. ZIP SHA-256 `bdc096c53477510e36323d32c548bb44e7ea1a0fecc3a9f247a49c49aed540af` совпал с GitHub digest. Внешний `.tar.gz.sha256` и все восемь записей SHA256SUMS прошли. Manifest source SHA совпал с новым HEAD; app image ID `sha256:114bb0c5ef46a214f49d71512f5191c81c468c76388a79765cb4d59f6ff0526a`, Caddy ID `sha256:aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510`. R1 **закрыта** в финальном workflow и передаче артефакта.
- Внешний tar.gz SHA-256 `5724002c38e605c99616bc066ae21e28cb2b601d9a9d0da151ba05d2b425e874`. Все шесть operator-файлов побайтно совпали с deploy/ этого Git SHA. Прочитаны конфигурации образов непосредственно из Docker save archive: их SHA-256 совпали с image IDs manifest, app label/BUILD_SHA точны, Node 24.22.1, USER=node, оба образа Linux/amd64.

Собственные Docker-проверки скачанного точного артефакта `1d17a64` завершены:

- `env -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH DOCKER_HOST=unix:///var/run/docker.sock bash scripts/test-install.sh /tmp/chm-task002-review-artifact/cheapshotmods-1d17a64128968c417197d81fe412ac59c089fafe-linux-amd64` — **exit 0**, Debian 13 x86_64. Настоящие Docker/SQLite/Caddy internal HTTPS, preflight unsupported arch/OS/private config/occupied ports, создание своей установки, restart и точное состояние, backup/restore, synthetic update, helper failure/recovery, last-commit freeze regression, rollback, undo, чужой sentinel volume сохранён. Автоматический cleanup собственных контейнеров/volumes отработал. Лог `/tmp/chm-task002-review-install.log`.
- `BUILD_SHA=1d17a64128968c417197d81fe412ac59c089fafe bash /tmp/chm-task002-review-container-smoke.sh` с тем же явным local Docker selector — **exit 0**. Это фактический `scripts/container-smoke.sh` данного HEAD, в отдельной диагностической копии только build заменён проверкой точного уже скачанного image ID и выбран его tag; lifecycle/fixtures/assertions не менялись. Образ продукта не модифицировался. Native SQLite seed/check и signed Mini App login/CSRF/read/undo/craft прошли через настоящий HTTP в восстановленном volume. Финальный вывод image ID `sha256:114bb0c5ef46a214f49d71512f5191c81c468c76388a79765cb4d59f6ff0526a` / source SHA совпал с manifest. Лог `/tmp/chm-task002-review-container-smoke.log`.

Этот полный собственный installation прогон относится именно к `1d17a64`. Последующий delta ограничен Mini/account-привязкой и installer preflight; его приёмка приведена ниже. Проверка старой установки сама по себе не принимала старую авторизацию и не заменяет доказательства финального комплекта.

## Финальная повторная проверка 8f3dd8a

Проверены фактические изменения `1d17a64..8f3dd8a` и связанный код: HMAC/date/ID parser, fresh/stale session policy, startup/выход, account precondition на личных API, CSRF при same-ID rotation соседней вкладки и canonical URL preflight. Производственных обходов входа не добавлено; cookie остаётся credential. Свежесть новой сессии 300 секунд и допустимые будущие 30 секунд сохранены. Старые данные не могут создать или продлить сессию.

| Независимая проверка финального кода | Результат |
| --- | --- |
| `npm_config_cache=/tmp/chm-task002-review-npm XDG_CACHE_HOME=/tmp/chm-task002-review-cache bash scripts/verify.sh` | exit 0; clean install, typecheck, lint, **33/33 native tests**, 0 skipped, production build. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser` | exit 0; **12/12**, 0 skipped, 46,4 секунды. Включает S-01–S-06, точные числа и обе Mini/account регрессии. |
| `node --import tsx /tmp/chm-task002-review-mini-api-matrix.mjs` — собственная HTTP/SQLite оснастка с отдельными HMAC proof и фиксированным временем | exit 0. Fresh другой ID ротирует SID и удаляет старый; stale same-ID не меняет ни session row, ни expiry, ни cookie. Stale other/no/expired session, неверные fresh/stale подписи и future+31 отвергаются. Возраст 300 секунд создаёт сессию, 301 — только использует подходящую существующую. Mismatch account блокирует GET/POST, account без cookie не аутентифицирует, старый CSRF отвергается, корректный работает; отказы не меняют работу. |
| `node --import tsx /tmp/chm-task002-review-mini-browser-matrix.mjs` — собственные browser pages одного context, настоящий сервер/SQLite | exit 0; шесть случаев: fresh другой ID показывает его уровень 1; stale same-ID сохраняет уровень 200 после проверки proof; stale другой ID, invalid signature, future+60 и logged_out показывают вход без чтения личного state. |
| Точная config_check из финального скачанного комплекта | exit 0; 8 отрицательных / 5 положительных URL совпали с Node canonical origin, без Docker и persistent изменений. |
| `python3 .ai-development/scripts/check.py` | passed, errors=0. |

Логи: `/tmp/chm-task002-review-r2-verify.log`, `/tmp/chm-task002-review-r2-browser.log`, `/tmp/chm-task002-review-r2-api-matrix.log`, `/tmp/chm-task002-review-r2-browser-matrix.log`. Это временные диагностические файлы; передача пользователю — приватный CI artifact ниже.

Независимо прочитаны завершённые [checks 42207656769](https://github.com/sa713/cheapshotmods/actions/runs/42207656769) и [kit 42207656789](https://github.com/sa713/cheapshotmods/actions/runs/42207656789) для точного `8f3dd8a`: verify (`127858212139`), container-smoke (`127858212651`) и debian-kit (`127858212368`) — success; все применимые содержательные шаги success, включая полную сборку, installation и upload. Финальный installer с N2 реально испытан этим CI. Собственный полный локальный installation не повторялся после узкого delta; собственные затронутые проверки выполнены выше, включая готовый финальный runtime ниже.

Приватный [artifact 13497906207](https://github.com/sa713/cheapshotmods/actions/runs/42207656789/artifacts/13497906207) независимо скачан и проверен:

- Имя: `cheapshotmods-8f3dd8a13040daf4b00abd9c8e1eff5aa2815aab-linux-amd64`; ZIP 131863144 bytes; GitHub expiry **2026-12-06**.
- ZIP SHA-256 совпал с GitHub digest: `7d8962bf92cab5be20ade275c1a2aaab6c1906b40b316ab9ca8f1409f11f826b`.
- Внешний tar.gz SHA-256: `35ff50ae4c789e18dabdaa1d63416e8ae1328cb934e883674fa9537f7e207877`; внешний checksum и все восемь записей внутренних SHA256SUMS прошли. Все шесть operator-файлов побайтно совпали с точным Git SHA; manifest source — `8f3dd8a13040daf4b00abd9c8e1eff5aa2815aab`.
- App image ID: `sha256:b47f03720279c85070da3899032f5ef0eb5ab7847ac65106ccbd6cda5995196d`. Caddy ID: `sha256:aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510`, digest `caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d`.

Из этого архива собственноручно загружен точный app image в local Docker. Селекторы окружения очищены, daemon — `unix:///var/run/docker.sock`; tag/image ID сверены. В `docker run --rm -i ... node --input-type=module -` выполнена собственная `/tmp/chm-task002-review-final-image-auth.mjs` — **exit 0**. Она импортирует уже собранные Store/Auth/app из `/app/apps/server/dist`, проверяет Node **24.22.1**, UID **1000**, точный BUILD_SHA и выполняет ту же real-HTTP/native-SQLite криптографическую матрицу свежести/ID/account/CSRF. Это диагностический entrypoint готового образа, а не повторный запуск его default main; default main/Compose/HTTPS/lifecycle покрыты container-smoke/installation. Образ не изменялся, test-login в runtime отсутствует, собственный контейнер удалён. Лог `/tmp/chm-task002-review-final-image-auth.log`.

Дополнительный test-only коммит `2d88c954ccf998d3c25c78dfe41e6bb2b3f08e87` поверх принятого runtime просмотрен отдельно: только три assert в `tests/operations.test.ts`, runtime/installer не меняются. Собственный `node --import tsx --test tests/operations.test.ts` на этом SHA — **5/5**, 0 skipped, exit 0. Он подтверждает, что account header без cookie не аутентифицирует, а корректный cookie+account видит только своего игрока. Это не меняет source SHA передаваемого архива `8f3dd8a`.

## Ограничения и следующий шаг

Первоначальная холодная сборка автора на vfs исчерпала 32 GiB общий диск; после его адресной очистки новых cache IDs место восстановлено. Reviewer не запускал конкурирующую app-сборку и ничего не очищал глобально; использовал скачанный CI-образ. Это устранённое ограничение среды, не оставшаяся непроверенная установка.

Отсутствие внешнего Debian-хоста/домена/секретов/бота — согласованная в TASK-002 граница. Не проверены настоящий Telegram OIDC/nonce, BotFather, публичный DNS/ACME, физический телефон и cookies в реальном Telegram WebView. Фикстуры и internal TLS не заменяют эту операторскую приёмку и не доказывают production-выпуск.

Следующий шаг владельца после передачи — получить именно финальный `8f3dd8a` artifact, заполнить реальные параметры и установить по RUNBOOK, затем проверить перечисленные живые интеграции. Последующие документные/test-only коммиты не переименовывают уже проверенный image; их обязательный CI должен завершиться перед конечной передачей. Новые runtime/installer изменения требуют проверки затронутой области. Код не исправлялся, merge/push/внешнее размещение reviewer не выполнял.
