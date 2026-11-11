# TASK-009 — разрешённый маршрут вне Actions

Разовое прямое поручение владельца от 2026-11-11 заменяет для TASK-009 обязательные Actions jobs соответствующими проверками Codex и публикацию Actions artifact доступной приватной передачей. Новые Actions не запускались, ожидание quota прекращено, платные услуги/публичность/стандарт/workflows/постоянная инфраструктура не менялись. [Карточка](tasks/TASK-009.md#разовый-маршрут-по-прямому-разрешению-владельца--2026-11-11).

## Неизменные версии

Runtime/source **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**. Текущий PR проверен: до продолжения HEAD3d196a308c46c8a78800035d7271ab72e9694ccf; относительно eb655846 там только README/.delivery. Новые изменения также относятся только к доставке/её тестам/доказательствам и состоянию. App/rules/deploy/workflows/lock/стандарт 1.1.0 не меняются; архив не пересобирался.

Сохранённый tar132005139 байт: SHA256 `1487bedc2d7c1cf18b4b1d336ca87a72a2fe1d3b007e9a39c86b29ecf81e08c6`, app config `sha256:ccc2ffc10c50c9968433243e23ed652e610dc7a42a84642459cb1622a29ac520`. [Повторная целостность 13 checksums/11 deploy/source](evidence/TASK-009/resumed-archive-integrity.json), format2 ordered-layer proof passed; [30 compiled-files сравнение](evidence/TASK-009/author-local-compiled-proof.json) остаётся действительным.

## Исполнение проверок и повторное использование

| Контроль | Свидетельство и текущая область |
| --- | --- |
| verify/typecheck/lint/build111 native | Существующий локальный успешный прогон при реализации и exact source eb655846 в прежних успешных вычислительных CI steps. [Сохранённый авторский log](evidence/TASK-009/existing-author-verify.log), [provenance](evidence/TASK-009/existing-author-logs.json). Новый suite без изменения app не запускался. |
| Chromium58/360/390/1440/touch/keyboard/modal | Существующий локальный exact eb65584658/58, [log](evidence/TASK-009/existing-author-browser-eb.log) и 7 просмотренных снимков. Не новый запуск. |
| capacity/negative pipeline/image-proof/ingress negatives | Существующие локальные результаты, [capacity](evidence/TASK-009/local-capacity.json),17vs0pipeline,14/4negative checks. Реальный parser config/layers сохранённого архива повторно проверен как целостность. |
| container-smoke | Тот же compiled app уже запускался в canonical local lifecycle и новом owner integration с настоящим better-sqlite3/HTTP/HTTPS/schema 6. Исторический source eb CI container-smoke/success отдельно сохранён. Новый image для позднего HEAD не строился. |
| build/extract/packaging | Сохранённый local kit; внешний hash, все 13 внутренних,11 deploy и format2 сверены; [приватный roundtrip](evidence/TASK-009/private-transfer.json) восстановил исходные 132005139 байт. |
| supported predecessor routes | Предыдущие 7 реальных Debian CI routes того же source остаются успешными вычислительными проверками иных архивов; собственный exact local CCC canonicalTASK-008 lifecycle уже прошёл. Они не переименованы в новые запуски Codex. |
| новый owner update/check/rollback | Новый реальный Codex Debian13/TLS/private-download test, только ради нового operator. [SQL/table hashes/защиты/рецепты/два отката](evidence/TASK-009/owner-helper-integration.json). [Тест](tests/TASK-009-operator.sh), fixture рядом. |
| private transport / bootstrap | [Четыре негативных транспортных случая](evidence/TASK-009/delivery-negatives.json), реальный download/reassembly, [bootstrap из private Git blob](evidence/TASK-009/bootstrap-integration.json): pin до исполнения, повтор без credential/download, tamper refusal. |
| exact local archive classic/containerd/reverse | Полный harness попытался стартовать одноразовый DinD и остановился на read-only cgroup **до image import**. Rootless bootstrap также запрещён UID-map. [Ограничение](evidence/TASK-009/codex-store-bootstrap-limitation.json). Прежние real Docker 29.8 CI proof для того же source, но иных config bytes, сохраняются отдельно. Сама local CCC версия реально проверена на managed classic/vfs; target loaded-image crypto proof до stop/data обязателен. |

CI source eb: verify/debian-kit **failure**, upload quota, kit skipped/отсутствует; container-smoke success. [Attempt1](evidence/TASK-009/ci-jobs-attempt1.json), [attempt2](evidence/TASK-009/ci-jobs.json) и протоколы не изменены и не выдаются за зелёный CI. Это исторические прочитанные результаты, не новые Actions.

## Реальная приватная передача

Release upload endpoint отказал HTTP400 на 140 байт checksum; исправление documented headers/Content-Length не помогло. Assets не появились. После успешной альтернативы удалён только собственный пустой draft441646215/HTTP204. Не Actions quota failure; не подменялся другим archive hash.

В приватном существующем repo создан отдельный **delivery-only** commit `1a15be22d1e00d50542090786c47e15a76151d18`, ref `delivery/task-009-eb655846-1487bedc`:32 части по 4 MiB иманифест. Application source по-прежнему eb655846. Ref не предназначен для main. Скачивание API source tarball проверено реально; все part hashes и исходный tar hash/длина совпали. [Receipt](evidence/TASK-009/private-transfer.json). Нужен прежний Contents Read-only, без нового ключа. Нет зависимости от Actions artifact quota или временного локального пути.

Этот разовый ref добавляет около132MB бинарных Git objects; полные clones репозитория могут стать больше. Это не новый общий процесс. Ref не сливается вmain и не удаляется автоматически: он нужен для доступности принятого комплекта; срок хранения после установки решает владелец.

Приёмка относится к **исходному tar SHA256**, source/config и этому delivery manifest. После принятия эти bytes не заменяются. Wrapper tarball GitHub может иначе сжиматься; его наблюдённый hash в receipt не является обязательным immutable identity. Для owner команды закреплены delivery commit и manifest/tar/operator hashes.

## Новая операторская проверка

[Helper](TASK-009-install.py), SHA256 `89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e`, private Git blob `c3828438fab992b6cd84b5ddf7392a358a378349`. [Bootstrap](TASK-009-update.sh) проверяет hash/owner/mode до исполнения; существующий иной файл не перезаписывается. Check/rollback после подготовки работают без GitHub key/download.

В новом реальном изолированном сценарии canonical0f/schema 6→CCC/schema 6 проверены штатный HTTPS endpoint с CA/IP SAN, приватное скачивание, бюджет диска, online backup, стандартные offline backup/newvolume/loaded proofs, полный fingerprint всех строк `players/groups/history/commands/work_lots/baselines/baseline_groups`, config/отдельный b008 и proxy ID/image/mounts, оба recipe и undo. Все семь таблиц буквально совпали после update, обычного rollback и после rollback при инъекции post-check failure. Неподдерживаемый source, unsafe credential и injected low-space остановили подготовку до download/backup/stop; повтор на уже установленном eb655846 не менял app.

Повтор нового owner integration был обоснован добавлением полного SQL fingerprint после первого положительного сценария. При подготовке fixture были исправлены собственные ошибки: внешний config не принимает CHM_HTTPS_PORT (берёт порт из URL), IP-TLS fixture нуждался в default_sni. App/installer archive не менялись, TLS/CA/guards не отключались. Число native/browser не расширялось новым запуском.

Для недостающей матрицы потребовалось место: удалены только 6 точных unshared/reclaimable RUN/COPY cache records предыдущих Cheapshot сборок в **Codex**; images/volumes сохранены. [Метаданные](evidence/TASK-009/cloud-cache-cleanup.json). Managed daemon/backend не перенастраивался; тестовые объекты имели отдельные имена/labels и очищены. На сервере владельца ничего не очищалось.

## Передача и ограничения

Это авторская проверка, не независимая приёмка. Management должен оценить код, сохраняемый exact kit, новый operator и честную границу Docker-store evidence. Прежний successful CI matrix нельзя считать новым exact local-archive matrix. На целевом Debian unchanged installer обязательно сверит imported config/ordered layers до остановки app/копирования данных; если import/proof не проходит, текущая версия и её данные остаются рабочими.

Действующий SSH-доступ к Debian не предоставлен: нет выбранной SSH identity/agent/config в среде. HTTPS read probe через Cloud дал hostname mismatch с сертификатом на другое имя; серверный source этим не установлен, причина на сервер не приписана. Owner preflight проверяет настоящий installedsource/HTTPS/место. Установка/живой Telegram/product acceptance не выполнены.

[Готовый root-блок переноса/update/check/rollback](TASK-009-NEXT-STEPS.md). После независимой приёмки его выполняет владелец. Developer PR не сливает. Если management интегрирует PR без Actions, merge/squash commit должен сохранить **[skip ci]**; workflows/protection/settings не отключать. Изменение маршрута разовое, не новый общий процесс.
