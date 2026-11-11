# TASK-009 — авторская проверка

**Актуальный маршрут от2026-11-11:** владелец разрешил TASK009 без новых Actions/Actions artifacts. [Приватная доставка и сопоставление проверок](TASK-009-PRIVATE-DELIVERY.md), [готовые owner-команды](TASK-009-NEXT-STEPS.md), [пакет management](TASK-009-MANAGEMENT-HANDOFF.md). Сохранённый local archive стал передаваемым кандидатом через проверенный private Git snapshot; требование зелёного Actions/нового Actions artifact заменено только для этой задачи. Самопроверка/независимая приёмка/установка различаются. Ниже сохранены результаты и история прежнего маршрута; его quota не является текущим каналом доставки.

Реализация в [PR10 → main](https://github.com/sa713/cheapshotmods/pull/10), ветка `chm-009-dropdowns-green-recipes`. Ожидаемый стартовый HEAD `23430c6873f02c6709ff68c47e2e6fbaf0907e8e` подтверждён до изменений. Runtime/source комплекта **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**. Закреплённый стандарт **1.1.0**, source `2ff5fe41b5c91f539dda4fce8944007aa0eb425f`, не изменён.

Это самопроверка developer. Независимую техническую приёмку организует management; technical_acceptance/product_acceptance/delivery остаются pending. PR не слит; настоящий сервер, БД, proxy и BotFather не изменялись.

## Поведение и доказательства

| Критерии карточки | Реализация и проверка |
| --- | --- |
| 1–2: закрытые/открытые меню, телефон и modal | `apps/web/src/select.tsx`: общий combobox/listbox, оформленные варианты внутри настоящего dialog/top layer; активное и выбранное состояния разделены. `tests/browser/task009.spec.ts`:360/390/1440, стрелки/Home/End/Enter/Space/Escape/Tab, реальный touch context, outside/focus/disabled, theme/scroll/viewport. Прежние UI-сценарии используют реальные role=option вместо native selectOption. |
| 3: глобальный порядок | `compareGroups`, SQL keyset tuple type/tier/value/known-crit/crit/id до LIMIT; decimal TEXT сравнивается точно по длине/цифрам. `tests/inventory-order.test.ts`: буквальный эталон, большие значения, unknown/0/known crit, обе области, все типы и размеры страниц 1/37/100/200, revision409 без записи. Browser проверяет >100 групп, догрузку/фильтр/списки выбора/изменение revision. [Исходное воспроизведение](evidence/TASK-009/before-order.json). |
| 4–5: оба рецепта, доля и границы | `planGreenFuse`: только 6+6+7→🅾1.0/10 и 7+8+8→🅾1.0/12, цена 28×n; Q7 общий. `tests/green-recipes.test.ts`: оба примера 5/4, расход/результаты/undo,1458 малых пулов против скалярного эталона, invalid DTO/count/max и 129 значные количества. Browser: defaultmax, уменьшение, clamp, zero/нехватка и пересчёт обоих максимумов. |
| 6–7: надетые и весь work | Сервер выбирает подходящие 6/7/8 из полного owner work, независимо от переданных/загруженных карточек. Свободные сначала, надетые только по includeWorn. Native/API/browser доказывают остатки/экипировку/undo, сырьё вне страницы, партии/объединённые группы и сохранность посторонних значений/типов/owner. |
| 8: атомарность и повтор | `tests/green-api.test.ts`: реальные HTTP Origin/CSRF/account/owner, потеря TCP-ответа/restart/exact retry, две worker SQLite connections с разными и одинаковым ключами. Native: KEY_REUSED/stale/expired, инъекция после частичного списания и SQL trigger failure, неизменные rows/lots/history/receipts после отказа. Browser: обратный порядок ответов, stale preview, lost response/reload с точным payload. |
| 9: прежняя функциональность и снимок | Старые single/homogeneous/raw/mixed receipts/undo/reset сохранены. Green craft не меняет original, baseline или уровень. Полный набор 111 native и 58 browser включает прежние и новые сценарии и проверяет сохранённые гарантии. Реальный Debian lifecycle: история, старые retries/undo, новый craft/undo, snapshot, backup/restore/restart и откат. |
| 10: доставка точного source | Новый локальный immutable kit source eb655846, все 13 checksums/format2/11 deploy и 30 compiled-files comparison. Canonical TASK-008→TASK-009 lifecycle выполнен автором. Exact CI отдельно ниже; публикация CI artifact блокируется квотой, поэтому готовая доставка ещё не подтверждена. |

Количество 111/58 относится ко всему набору, включая новые 15 native/11 browser; это не 111/58 старых тестов плюс новые.

## Авторские проверки

`bash scripts/verify.sh`:111/111 native, typecheck, lint и production build на Node24.22.1/npm11.9.0 с настоящим better-sqlite3/SQLite/HTTP. Прогон выполнялся при реализации до последнего commit; последующий production build совпал с local kit по всем 30 файлам. Exact CI eb655846 повторил 111 native/typecheck/lint/build успешно. После source commit собственный полный `npm run test:browser` прошёл **58/58**, без retries,3.5 мин. [Сводка автора и снимки](evidence/TASK-009/author-checks.json); developer просмотрел все 7 снимков реального modal/open recipe/long source на 360/390/1440.

`bash scripts/check-measure-pipeline.sh`: actual workflow сохраняет exit17 при ошибке measure, negative control без pipefail возвращает 0. `python3 scripts/test-image-proof.py`:14; `python3 scripts/test-ingress-config.py`:4. Существующие safeguards сохранены.

[Локальная capacity](evidence/TASK-009/local-capacity.json) и [изученная CI capacity](evidence/TASK-009/ci-capacity.json) разделены. Новый зелёный максимум 5×10²⁴ — один ledger row,3 физических lots,1665 байт preview; старые raw→6.0/129 значный maximum и baseline10002 записи/9007199255750993 сохраняются. Время — наблюдение изолированной среды, не SLA реального Debian.

## Найденное при самопроверке и исправления

- Собственная регрессия: фоновый preview нового зелёного раздела получал 409 и глобально блокировал несвязанный modal. Теперь read conflict отображается локально в recipe preview; command conflicts и 401 сохраняют прежнюю защиту. Полные browser-сценарии продолжают проверять stale/retry/modal.
- Общий button:hover давал открытому выбору светло-зелёный фон со светлым текстом. Добавлено оформление hover самого выбора; browser проверяет вычисленные цвета и геометрию.
- Старый command-session-expiry test стал гоняться с новым фоновым чтением. Fixture ждёт завершения начального preview перед искусственным expiry, затем проверяет именно command401 и сохранённый payload; отдельный read401 сценарий сохранён. Production auth не ослаблена.
- Изменения UI tests обоснованы заменой native select: helper открывает настоящий combobox и нажимает настоящий option; нет скрытого select/прямой подмены значения. Locator больших чисел привязан к полю уровня, перехват ошибки старого homogeneous preview — к нужному DTO. Новые тестовые ожидания outside/refresh/selected✓ приведены к фактической доступной разметке.
- Снимок длинных чисел один раз превысил 15s при полном suite; только screenshot получил 30s и animations=disabled, числовые/overflow assertions сохранены. Целевой повтор прошёл.
- Первый Debian CI 57aef126 прошёл build/install/external и новый green/old-binary этап, но поздняя проверка полного возврата ошибочно ожидала текущий original с добавленным после capture сырьём. eb655846 сравнивает с реально сохранёнными baseline_groups, корректно требуя удаления поздних добавлений. Новый полный 7predecessor CI прошёл этот шаг; [извлечённый canonical proof](evidence/TASK-009/ci-upgrade-0f2.json). Это ошибка авторского harness; первый job не объявляется успешным.

## Совместимость и реальный локальный Debian lifecycle

Schema остаётся 6: новые recipes хранятся в существующем generic batch ledger. [Собственный canonical TASK-008→local TASK-009 proof](evidence/TASK-009/author-local-canonical-upgrade.json): exact old source0f2cd90c/schema6 и новый eb655846; Debian13-slim/linux-amd64/Docker29.9.2vfs. Старый binary0f2cd90c на отдельной backup-копии принял 6 и отменил новую green batch запись с восстановлением work/equipment/расхода и сохранением original/baseline/уровня. Старые 2–5 binaries отвергают 6. Это не проверка поддержки нового recipe API старой версией.

Пройдены update в отдельную копию volume, оба recipe/общий 7/worn/undo, история/receipts, два сброса/снимок, restart/backup/restore, точный rollback старых image+volume+assets и restart. Config и отдельный b008 operator сохранены. Применялись только синтетические изолированные аккаунты.

[Локальный паспорт kit](evidence/TASK-009/local-kit.json), [сравнение compiled/deploy](evidence/TASK-009/author-local-compiled-proof.json). Это собственная local build; её config digest/архив не выдаются за опубликованный CI kit. Повторная сборка одного source не обязана давать те же archive/config bytes: для установки нужны метаданные конкретного архива.

Откат на сервере выполняется только штатной предыдущей парой image+volume. Новые записи остаются в новом volume. Предварительно ставить TASK-008 ради перехода не требуется: поддерживаемые старые маршруты сохранены.

## Exact CI и блокер публикации — история прежнего маршрута

На source eb655846:

- [Checks42992435585](https://github.com/sa713/cheapshotmods/actions/runs/42992435585), verify job130428308413:111 native/typecheck/lint/build,58 Chromium, negative-pipeline и capacity — success; upload browser — failure: `Artifact storage quota has been hit`; capacity upload skipped. container-smoke job130428308178 — success. Весь verify job не зелёный.
- [Kit42992435564](https://github.com/sa713/cheapshotmods/actions/runs/42992435564), job130428308278: build/extract/fresh Debian/external и все 7 predecessors — success. Classic/containerd/reverse-export — success. Оба upload proofs — quota failure; upload kit skipped. Job failure, опубликованного kit нет. [Метаданные всех шагов](evidence/TASK-009/ci-jobs-attempt1.json).
- Предыдущий source57aef126: checks42990291876 —111/58 прошли, quota upload failure; kit42990291856 — описанный harness failure. Они не заменяют проверку eb655846.

Developer не выключал обязательные upload/checks и не превращал quota failure в success. Upload шаги перенесены после вычислительных проверок, чтобы квота не скрывала результат capacity/store. Независимый reviewer ещё не назначен developer.

Квота — внешний блокер кандидата. Владелец отдельно разрешил конкретный план удаления 21 неканонического архива с повторяющимся production code,2,77 GB. [Удаление выполнено ровно по списку,21 HTTP204; все остальные 168 artifacts сохранены](evidence/TASK-009/storage-cleanup-approved.json), включая канонические predecessors и все proof artifacts. После очистки перезапущены только два failed jobs (attempt2) на том же eb655846; запрос использовал endpoint rerun-failed-jobs. Метаданные attempt2 также содержат container-smoke job130440744981/success. Достаточность очистки не предполагается; GitHub сообщает пересчёт 6–12 ч. Дополнительные расходы/registry/публичность не поручены. Attempt2 verify job130440743126 снова прошёл 111 native/58 Chromium/negative/capacity, но upload09:38:07Z снова отклонён той же quota error; cleanup не обещает немедленного результата. Kit job130440796592 завершился: все вычислительные шаги, семь переходов и real classic/containerd/reverse-export прошли; оба proof uploads 10:00:37Z/10:00:38Z снова отклонены той же quota error, kit upload skipped, job failure. [Окончательные job/step статусы](evidence/TASK-009/ci-jobs.json), [извлечённые протоколы attempt2](evidence/TASK-009/ci-attempt2-reports.json); опубликованных kit artifacts нет. Активных проверок не осталось. После очистки дополнительно проверено отсутствие удалённых artifact ID в scripts/deploy/workflows; требуемые прежние комплекты сохранены. До пересчёта не запускать новые повторные сборки без нового основания.

## Ограничения прежнего маршрута

До нового поручения отсутствие успешных обязательных CI jobs и Actions artifact блокировало delivery. Разовый маршрут владельца заменил только исполнителя проверок/канал публикации: текущие evidence, private transfer и owner-команды находятся в [PRIVATE-DELIVERY](TASK-009-PRIVATE-DELIVERY.md) и [NEXT-STEPS](TASK-009-NEXT-STEPS.md). Исторический CI остаётся failure. Нельзя подставлять local archive bytes в команды другого CI artifact; новый маршрут закрепляет именно local tar SHA256 и operator SHA256.

Live Telegram/телефон владельца, реальный HTTPS/внешняя доступность/текущий serverSHA и установка TASK-009 не проверялись. Chromium360/390/1440 и synthetic signed Mini App не объявляются живой интеграцией или product acceptance.
