# TASK-005 — независимая проверка

- Репозиторий: `sa713/cheapshotmods`, [PR6](https://github.com/sa713/cheapshotmods/pull/6), [задание](../tasks/TASK-005.md), PRODUCT, патч 2026-11-08.
- PR base: `bd8108c8333bac821bbf27d19a249ecb41d02e82`. Проверенный runtime HEAD и source immutable kit: **`feb6a1bf82e70474c482c6a2e1fb0e77c4e20586`**. Стартовый `6ab1fa48a2187d15523a9c7a567f61c73a584862` подтверждён до реализации.
- Проверяющий: отдельная сессия Codex `/root/batch_fuse_review`, 2026-11-08. Production-код и продуктовые тесты reviewer не писал и не исправлял. Прочитаны AGENTS, закреплённый ai-development 1.1.0, START/WORKFLOW/reviewer/QUALITY, PROJECT, PRODUCT и TASK-005 целиком.
- Область: требования, rules/planner, Store/SQLite schema4/history/receipts, UI, изменённые проверки, canonical kit, installer и команды владельцу. Риск повышенный.
- Заключение: **accepted — устанавливаемый кандидат на указанном runtime SHA**. Подтверждённых незакрытых блокирующих находок нет. Установка и продуктовое принятие на сервере владельца остаются отдельным следующим шагом.

Позднейшее дополнение меняет только документы, evidence и developer-only fixture: после restore→rollback добавлены сравнение возвращённых данных и schema4. Принятый вариант `scripts/task005-upgrade/fixture.py` имеет SHA256 **`11a6215df246a2a429aad15a60d7f34fee5c48652f715c1543977c57343f1db3`** и действительно исполнен reviewer. Apps/packages/Dockerfile/исполняемые файлы deploy остаются идентичны runtime HEAD. HEAD передачи нельзя выдавать за source нового image.

## Собственные проверки reviewer

Среда общая с developer, исполнение отдельное: Linux amd64, Node 24.22.1/npm 11.9.0, настоящий better-sqlite3; Chromium и изолированный Debian 13-slim на локальном Docker 29.9.2/vfs. Реальные данные владельца не использовались. Итоги и hashes локальных логов сохранены в [reviewer evidence](../evidence/TASK-005/reviewer-fbe-upgrade.json).

| Проверка | Фактический результат |
| --- | --- |
| `bash scripts/verify.sh` | Typecheck/lint/build и **58/58 native tests** прошли. Отдельный native-прогон также 58/58. Проверены реальные SQLite connections/конкуренция, HTTP, fault injection, auth/Origin/CSRF/account, receipts и старые регрессии. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser -- --reporter=line` | **25/25** прошли за 1,8 мин: реальные HTTP/SQLite, 360/390/1440, batch preview/commit/undo, пополнение, unknown/refine, долгие числа, пагинация, pending/retry/409/server error и modal keyboard/inert/focus. Собственные PNG360/390/1440 просмотрены; важные числа и действия доступны без горизонтального overflow. |
| Независимый поэкземплярный oracle вне продуктовой ветки | **5000** детерминированных малых пулов: 4832 успешных плана и 168 отказов нехватки совпали с `planFuse`. Сравнивались ordered inputs/outputs каждого перехода, финальные результаты, полная цена, расход/остаток каждого source ID и фактически снятые надетые. Оракул не использует production craft/compression/grouping. |
| Дополнительные native-пробы | Schema2→3→4 и 3→4, поздний сбой миграции, однократный revision bump, неизменные receipts и replay безcrit; все retained undo для нескольких owners; partial refine output/input, совпадающие поздние добавления, wear, single/batch и reopen/undo прошли. Проверены сохранённые атрибуты входов и отсутствие угадывания unknown. |
| Огромные количества и все 5 ступеней | `9×10^24` входов → `10^24` tier3: точная цена,1 history/1 work_lot, commit+undo≈2 ms. Отдельно `243×10^125` 🧿tier1 → `10^125` tier6:128 цифр quantity,132 цифры производного crit и130 цифр цены; preview/commit/equip/undo≈11 ms, точные отдельные округления. Это отдельные замеры этой среды, не SLA владельца. |
| Canonical artifact | Самостоятельно сверены ZIP/tar и все 13 SHA256SUMS. `python3 image-proof.py archive manifest.json images.tar.gz` подтвердил config SHA256 и ordered uncompressed layers, format2. CSS/JS опубликованного image совпадают по SHA256 с файлами собственного browser-прогона. |
| Настоящий FBE→new installer lifecycle | Собственный запуск `scripts/task005-upgrade/run.sh NEW_KIT OLD_FBE_KIT /tmp/task005-independent-fbe-upgrade` завершился exit0. Выполнены schema2→4, новые craft/batch/refine/add/undo, receipts/stale revision, restart, exact rollback прежних image+volume/assets/state, второй update, backup/restore и final rollback с exact changed state/schema4. Старый image отверг мигрированную копию. |

После собственного installer run контейнеры и volumes вернулись к 0, список cached image IDs совпал с baseline, остались только сети bridge/host/none. Daemon/backend не менялись. FBE proof/log SHA256: `4abab9905b276152de7765ce2ee53ebdcb244adf9887e77bce87f7b993cef08c`.

Первоначальные локальные запуски без разрешения на listen и без `PLAYWRIGHT_BROWSERS_PATH` не считались проверкой продукта; после настройки собственного запуска все перечисленные проверки выполнены успешно.

## Проверенные внешние доказательства

GitHub прочитан reviewer непосредственно, а не только со слов автора:

- [Checks42498204955](https://github.com/sa713/cheapshotmods/actions/runs/42498204955): jobs `verify` 128785033258 и `container-smoke` 128785033515 — success, необходимые шаги выполнены, без skipped. Отдельно изучены сохранённые capacity/pipeline результаты и изменения старых assertions: они ограничены согласованными crit/schema/icons/положительным пополнением; удаления регрессий и ослабления CI не выявлено.
- [Kit42498204953](https://github.com/sa713/cheapshotmods/actions/runs/42498204953), job 128785033143 — success: Debian install, external ingress, реальные classic/containerd и reverse export. Reviewer прочитал три JSON наблюдения и самостоятельно сравнил config/ordered diff_ids с manifest: все совпали, native IDs между stores различаются ожидаемо. См. [матрицу](../evidence/TASK-005/ci-image-stores.json) и [summary](../evidence/TASK-005/ci-store-summary.json). Саму отдельную cross-store матрицу исполнял CI.
- Авторские полные canonical маршруты [FBE](../evidence/TASK-005/fbe-upgrade.json), [6dc](../evidence/TASK-005/6dc-upgrade.json) и [19a](../evidence/TASK-005/19a-upgrade.json) изучены с кодом fixed harness. Это настоящие installer runs, не только migration fixtures. Reviewer самостоятельно повторил FBE; 6dc/19a исполнены developer. Первый FBE-проход автора был честно остановлен disk guard до дополнительного второго update; accepted относится к полному успешному повторению, защита не ослаблялась.

Canonical private artifact **13624905831**, source exactfeb, expires **2026-12-08T16:19:39Z**. ZIP SHA256 `0d7f1c83d417cb362c345b8ab32431362377128c87fad3cfe63431293a333731`; tar SHA256 `30d5703a59ee734b5094291bf2ae83e4b46fb5039614753309f13a7037909e50`. Manifest/platform/config proof и остальные данные — в [kit evidence](../evidence/TASK-005/kit.json). Подтверждена идентичность скачанного canonical архива, локальный replacement image не использовался.

## Замечания и исправления

1. **Закрыто до runtime HEAD:** одиночные выбранные входы не показывали крит. В `apps/web/src/main.tsx` каждый critical input теперь показывает `formatCrit`, включая unknown. Изменённый UI включён в собственные browser/code проверки.
2. **Закрыто до runtime HEAD:** пакетный preview показывал результаты перехода, но не упорядоченные входы и цену одного перехода. `apps/web/src/batch.tsx` теперь раскрывает inputs, outputs и unitPrice по каждому переходу; данные согласованы с серверным планом.
3. **Закрыто в supplementary fixture:** последний restore→rollback проверял только metadata. Добавлены snapshot после изменения level до 777, exact comparison восстановленного state/inventory и schema4; fixed SHA приведён выше. Именно этот вариант реально прошёл собственный FBE installer run. Это усиление доказательства, не изменение runtime.

Подтверждённых открытых дефектов в проверенной области не осталось. Новые пожелания или неподтверждённые гипотезы блокерами не объявлялись.

## Команды владельцу и границы принятия

[NEXT-STEPS](../TASK-005-NEXT-STEPS.md), update/rollback scripts и все inline блоки прочитаны. `bash -n` обоих scripts прошёл. Проверены source/version/mode guards, existing private curl credential, artifact/checksums, удаление только проверенных транспортных копий, backup→update→HTTPS check, сохранность config/helper и возврат прежней пары.

- Update script SHA256: `04d94cdd1a5cded979213be21bd520f8fb715a1588718d311fc41e63847cc31c`.
- Rollback script SHA256: `2196c1e655b02e25a4f364ba4d4d450bc38e42583447f7e0ba42b675646c1438`.

Реальный owner-host, телефон/Telegram WebView, живые OIDC/Mini App, внешний HTTPS/renewal общего IP-TLS не исполнялись reviewer и остаются послеустановочными проверками владельца. Root/curl wrappers на настоящем сервере не запускались. Текущая установленная версия отдельно не подтверждена; подготовленные guards допускают только FBE/19a/6dc external и останавливают другие варианты.

Schema4 несовместима со старыми приложениями. Принятый rollback возвращает старые image+volume вместе; новые записи сохраняются в новом volume и не появляются в прежнем. Merge/main, deployment владельца, BotFather, публикация Sites и новые расходы этой проверкой не разрешаются. Следующий шаг — management передаёт проверенный кандидат и pinned команды владельцу; product acceptance/delivery на его сервере ещё pending.
