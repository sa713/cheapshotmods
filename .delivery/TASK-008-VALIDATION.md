# TASK-008 — проверка устанавливаемого кандидата

Runtime source: **0f2cd90c5b672d67409c2687e4e90a8ce9797482**. [PR9](https://github.com/sa713/cheapshotmods/pull/9) направлен вmain от ожидаемого стартового HEAD **260d370638b2ea5bdd826614108078e85e60b10e**. Schema6 добавляет независимый постоянный снимок всего original, явную замену и отдельный полный возврат обоих наборов. Прежний reset и командные гарантии сохранены. Интеграцию после приёмки завершает management; сервер обновляет владелец.

## Самопроверка автора

- [До изменения кода](evidence/TASK-008/before.json) на изолированной SQLite проверены20🅾1.0→mass3.0→reset. Буквальное попадание результатов в original не воспроизвелось: original20, work2исходных+2результата/расход1008, reset возвращает20/0. Это не диагностика сервера владельца. Новый постоянный снимок реализован по контракту независимо от этого результата.
- `bash scripts/verify.sh`: **96/96 native**, typecheck/lint/production build. Настоящий better-sqlite3/SQLite, HTTP sockets и независимые worker connections; новые тесты проверяют snapshot/capture/restore/fault/concurrency/migration/backup.
- `npm run test:browser`: **47/47 Chromium**,360/390/1440, настоящий HTTP/SQLite. Новые9 и прежние38 случаев проходят. Первый новый browser-прогон обнаружил ошибку test locator для select-полей; он исправлен на доступную роль combobox. После этого новые9 и весь suite прошли. Это не продуктовый сбой; требования не ослаблялись.
- `bash scripts/check-measure-pipeline.sh`: actual workflow step возвращает17 при ошибке measure, negative control без защиты возвращает0. `python3 scripts/test-image-proof.py` —14, `python3 scripts/test-ingress-config.py` —4.
- [Capacity](evidence/TASK-008/local-capacity.json): capture/restore **10002** исходных записей и точного количества **9007199255750993** — около36/289мс локально; после restore10002work groups/10002lots, без объекта на каждый экземпляр. Capture сохраняет активный lastCraft/spent, restore удаляет позднее добавление и возвращает миллионную/большую группы. Прежние10²⁴ результатов/129-значный maximum также проходят. Node24.22.1, Linuxx64; это выборка тестовой среды, не SLA сервера.
- Новые API-фазы installer harness4/5→6 предварительно прошли на настоящем локальном HTTP/SQLite: прежние receipts/undo, baselineA/two resets, изменениеB, возвратA/undo. Эти проверки отделены от actual Debian installer runs ниже.

## Соответствие критериям

| Критерии TASK-008 | Доказательство |
| --- | --- |
| 1–2: исходные20, два результата3.0, два разных сброса | `baseline.test.ts` и `baseline.spec.ts`: original/snapshot20 без результатов, work2+2/1008; lateadd/edit/delete, обычный reset по текущему original, полный возврат20/0/history empty/equipment empty/level307/new experiment. |
| 3: замена снимка без изменения активной работы | Native сравнивает groups/history/work_lots и player state до/после capture, кроме revision/metadata; сервер требует explicit replace permission. UI показывает подтверждение/отмену, отказ ничего не меняет. Старый captureA receipt после captureB не заменяетB. |
| 4: все страницы/отдельные исходные строки/точные числа | Native>100 rows всех видов/уровней, duplicate attributes с разными ID,128-digit value/quantity, unknown/null и известный ноль. Original ID/строки восстанавливаются отдельно, work группируется с сохранением сумм. Browser фиксирует105групп при загруженных100, затем возвращает их целиком. |
| 5: отсутствие и пустой снимок | Нет implicit snapshot после новой регистрации/миграции; restore до capture отклоняется без мутаций. Пустой capture имеет metadata0/0 и восстанавливает пустые наборы после добавлений/фьюза; повторный возврат не дублирует данные. |
| 6–7: неизменность/повторы/изоляция | Snapshot неизменен после single/batch/undo/reset/appendStock/original+work crit/level/equip. Старый experiment/preview отклоняется; новый auto-max работает по восстановленному work. HTTP/session/Origin/CSRF/account/owner, KEY_REUSED/expired receipt/stale revision и lost-response/restart retries сохраняются. Старые mixed receipts/undo проходят до явного reset. |
| 8: атомарность и конкуренция | Fault injection: snapshot clear/copy, original delete/copy, work delete/save, history clear, receipt. Все таблицы/метаданные/receipt откатываются побайтно. Independent SQLite workers: capture vs edit, restore vs edit, одинаковый key; один commit либо exact replay без смешанного состояния. |
| 9: миграция и старые данные | Настоящий schema5 mixed-history fixture: все старые rows/lots/equipment/unknown crit/payloads/hash receipts сохранены, новые tables пусты, повторный restart стабилен, старые undo работают. Migration fault откатывает marker/DDL/rows; schema7 отвергается текущим6. Прежние2/3/4 assertions сохранены с ожидаемым marker6 и явными пустыми новыми tables. Старый binary reject6 проверяется actual installer ниже. |
| 10: восстановление backup | Online SQLite backup после captureA и активного craft/equipment; последующие captureB/restore; открытие backup возвращает exact snapshotA/state/rows/undo. После restart полный возвратA работает. Actual chm backup/restore проверяется отдельно ниже. |
| 11–12: интерфейс и регрессии |47cases:360/390/1440, оба reset, capture/replace/cancel/empty, pagination/huge values, site+Mini owner,500/409/lost-response/reload/old shape. Просмотр screenshot360, сохранены Sites, modal/inert/focus/Escape, controls≥44px и отсутствие overflow. Прежние raw/ordinary/max/crit/equipment100/пополнения/undo/auth проходят. |

Код не копирует клиентские карточки: snapshot создаётся SQL-copy всего original с BigInt metadata внутри immediate transaction. Baseline rows не ссылаются на изменяемые group IDs. Capture исключён из saveLots; restore отдельно очищает work и пересоздаёт lots из восстановленного original. Permanent receipts проверяются до новых semantics, их старый JSON не переписывается. Новый state добавляет nullable metadata, UI допускает старый shape.

## Exact CI и Debian routes

[Checks42532270563](https://github.com/sa713/cheapshotmods/actions/runs/42532270563) на exact runtime завершён success:

| Job | Результат |
| --- | --- |
| [verify128888846212](https://github.com/sa713/cheapshotmods/actions/runs/42532270563/job/128888846212) | success:96native/47Chromium/npm ci/typecheck/lint/build/negative pipeline/capacity |
| [container-smoke128888845941](https://github.com/sa713/cheapshotmods/actions/runs/42532270563/job/128888845941) | success: image/persistence/backup и настоящий HTTP на restored volume |

[CI capacity](evidence/TASK-008/ci-capacity.json) сохранён из decoded exact job log: capture10002rows19,37мс/restore317,93мс, quantity9007199255750993,10002work groups/lots. Browser artifact [13637931423](https://github.com/sa713/cheapshotmods/actions/runs/42532270563/artifacts/13637931423), expires2026-11-22T22:54:38Z, ZIP SHA256 `824618f72eed22829f994a74bd83bf1c56828d3f929b30991127bda3afe2a27f`. Capacity [13637592828](https://github.com/sa713/cheapshotmods/actions/runs/42532270563/artifacts/13637592828), expires2027-02-06T22:51:02Z, ZIP SHA256 `cc61df6cbc14b9a5f31ac0d5669d29e9e0d842ee6230a6bf5c91d348e10fdf71`. Metadata получены из GitHub API, sourceSHA сверён.

[Kit42532270571](https://github.com/sa713/cheapshotmods/actions/runs/42532270571), [debian-kit128888846094](https://github.com/sa713/cheapshotmods/actions/runs/42532270571/job/128888846094) — **completed/success**. Все обязательные steps выполнены: standalone/external installer, portable proof/ingress/disk/drift/network/credential negatives, шесть routes и настоящие обе stores/reverse. [Полные job/steps metadata](evidence/TASK-008/ci-jobs.json), [metadata artifacts](evidence/TASK-008/ci-artifacts.json). Это новые exact-source CI, прежние TASK-007 результаты сюда не перенесены.

Шесть новых настоящих Debian installer routes завершены success. Среда: isolated Debian13-slim/linux-amd64, Docker28.0.4/overlay2, Node24.22.1/better-sqlite3, синтетический подписанный Mini-вход. Это отдельные исполнившиеся installer runs, не unit fixtures и не Docker29.8 store matrix.

| Immutable predecessor | Схема | Доказательство |
| --- | --- | --- |
| canonical TASK-007 `f944acb6435a9671cef6db5fc500b79a71d21133` | 5→6 | [f94-upgrade.json](evidence/TASK-008/f94-upgrade.json): сам старый runtime создал homogeneous receipt перед update; новый вернул exact результат и отменил его, прежний mixed replay/undo тоже сохранён |
| TASK-006 `d6cb0e9404f07b5573b64131281d29569a010442` | 5→6 | [d6c-upgrade.json](evidence/TASK-008/d6c-upgrade.json) |
| TASK-005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` | 4→6 | [feb-upgrade.json](evidence/TASK-008/feb-upgrade.json) |
| FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` | 2→6 | [fbe-upgrade.json](evidence/TASK-008/fbe-upgrade.json) |
| `19a6fdde785eb90b01bd78318deeab1a539dde7b` | 3→6 | [19a-upgrade.json](evidence/TASK-008/19a-upgrade.json) |
| Sites `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` | 3→6 | [6dc-upgrade.json](evidence/TASK-008/6dc-upgrade.json) |

Во всех шести: новый отдельный volume, старый binary отвергает migrated6 COPY, config и отдельный operator неизменны; snapshotA/эксперименты/обычный reset/full return, exact capture/restore retries после новых действий, restart/backup/изменение snapshotB/restoreA с undo/full return и rollback старых image+volume+assets прошли. Повторный restart после rollback сохраняет старое состояние. В proof отдельно обозначены восстановление backup текущего image и возврат predecessor пары.

Evidence artifact **[13638301938](https://github.com/sa713/cheapshotmods/actions/runs/42532270571/artifacts/13638301938)**, до **2026-12-08T23:00:46Z**, ZIP SHA256 `baab4b2cab3323943004f2588c28bf44a1a8f0377dd13a10444266bb2321170f`. Автор скачал ZIP, сверил API digest/source/platform и все шесть proofs. Сохранённые JSON указывают CI executor/run/job, а не приписывают эти запуски автору.

Первый дополнительный локальный installer run дошёл до restore backup и остановился на неизменённом disk guard из-за свободного места в managed среде. Удалены только наши старые transport duplicates/copied dependencies, ни guard, ни runtime не изменялись. Локальный повтор завершён success на Docker29.9.2/vfs: [author-local-f94-upgrade.json](evidence/TASK-008/author-local-f94-upgrade.json). Source тот же, bytes локальной сборки отличаются от будущего CI archive; это не final-archive independent run. Подтверждены reject6 старым binary, все capture/reset/restore/backup/undo/rollback и asset/config/operator invariants. Независимый final-archive run фиксируется отдельно после завершения; шесть CI routes не подменяют его.

## Финальный immutable kit и Docker stores

Artifact **[13637904971](https://github.com/sa713/cheapshotmods/actions/runs/42532270571/artifacts/13637904971)**, **131996431байт**, до **2026-12-08T23:11:21Z**:

- Source SHA: **0f2cd90c5b672d67409c2687e4e90a8ce9797482**, linux/amd64, Node24.22.1/npm11.9.0, format2.
- ZIP SHA256: `137d70277d444e5466af98b31f9c060e137b46cea59a09d64ab330f97cba5537`.
- tar SHA256: `ff10cb999695d0ef35b01b755abcb5f9adceb216f373a48ac659fc793a2a2c7c`.
- Manifest SHA256: `2403f725db664771c08e79e4c50451e9d04c5403a89b9e666dae81b5a65be0e9`.
- SHA256SUMS SHA256: `e5fa62508172f709a2c26ab76b629610e2e12fdf774c035da7339545215726b7`.
- Images archive SHA256: `efeffa174f33884ccd9e25d1759e0008ad8e1b43f7d7a1f1b65452b5f8fa81df`.

[Полный паспорт/manifest](evidence/TASK-008/kit.json). Автор сверил API digest/size/source/expiry с downloaded bytes, tar, все13 checksums,11packaged deploy files с exact Git blobs и config+ordered layer archive proof. Локально собранный archive не подменяет этот CI kit.

[Store evidence13638915400](https://github.com/sa713/cheapshotmods/actions/runs/42532270571/artifacts/13638915400), до **2026-12-08T23:11:20Z**, ZIP SHA256 `d8a24304f72f59bd5d29eb90d4e9d3880896be8131af41380ca5482d923eb50f`:

- Настоящие Docker29.8.0 classic/vfs и containerd/native импортировали один exact images archive. Config digest, ordered diff IDs и platform совпадают с kit manifest; store-native IDs различаются.
- External installer lifecycle/negatives прошли на обоих stores; classic также проверил format1→format2 update и legacy rollback.
- Export из containerd импортирован в свежий пустой classic без rebuild либо подмены portable proof.

[Summary](evidence/TASK-008/ci-store-summary.json), [classic](evidence/TASK-008/ci-store-classic.json), [containerd](evidence/TASK-008/ci-store-containerd.json), [reverse](evidence/TASK-008/ci-store-containerd-to-classic.json). Автор скачал store ZIP, сверил API digest и все три observation config/layers/platform с final manifest; полный decoded job log доступен по CI-ссылке. Это CI matrix, отдельно от собственных local runs.

## Независимая техническая приёмка

[Отдельный reviewer](reviews/TASK-008-review.md) **accepted** runtime **0f2cd90c5b672d67409c2687e4e90a8ce9797482** и exact immutable artifact **13637904971**; подтверждённых дефектов не найдено. Он самостоятельно прошёл96native/47Chromium, дополнительные146source rows/128-digit/duplicates, SQL-trigger aborts, настоящий TCP HTTP, owner/Origin, migration/undo/online backup и capacity. [Runtime proof](evidence/TASK-008/reviewer-runtime-proof.json).

Его собственная проверка exact downloaded bytes/ZIP/tar/14files/13checksums/11Gitdeploy/config+ordered layers — [archive proof](evidence/TASK-008/reviewer-archive-proof.json). Загруженный CI image и все **30 compiled rules/server/web files** совпали с его самостоятельной проверенной сборкой; Node24.22.1/SQLite3.53.4 сверены: [compiled proof](evidence/TASK-008/reviewer-compiled-proof.json). Старый canonical TASK-007 ZIP/tar/13files/11sources также independently verified: [predecessor proof](evidence/TASK-008/reviewer-predecessor-proof.json).

На **этом final CI kit** reviewer исполнил собственный actual isolated Debian13/linux-amd64/Docker29.9.2/vfs canonical f944/schema5→new6 lifecycle, exit0. Сохранены старые state/receipts, fresh TASK007 homogeneous replay/undo и old mixed replay/undo; проверены snapshotA, новые raw/homogeneous операции, оба reset, late edits, restart, backup→snapshotB→restoreA с undo/full return и rollback старых image+volume+assets. Config/отдельный operator неизменны, старый binary5 отвергает migrated6 COPY. [Собственный lifecycle proof](evidence/TASK-008/reviewer-lifecycle-proof.json). Это собственный installer run, не пересказ CI либо авторского прогона.

[CI/stores proof](evidence/TASK-008/reviewer-ci-proof.json) и [six-route proof](evidence/TASK-008/reviewer-ci-upgrades-proof.json) явно обозначают independently reviewed external CI results. [Final owner scripts proof](evidence/TASK-008/reviewer-owner-proof.json) подтверждает shell/embeddedPython/inline equality/exact artifact+hashes/version guards. Архивы transport и временные дубли удалялись только после hash/source проверки ради сохранения disk guard; полный final kit и old canonical kit оставались доступны для lifecycle. Реальный сервер эти проверки не затрагивали.

## Граница передачи

[Готовые root/curl update/check/rollback](TASK-008-NEXT-STEPS.md) по существующему credential поддерживают шесть допустимых predecessors, exact hashes, backup/metadata/config/operator checks. Bash/embedded Python syntax и inline byte equality проверены; поля соответствуют final artifact. Disk/ingress/credential guards не ослабляются. Старый app5 не работает с schema6: rollback только прежней image+volume парой, поздние записи остаются в новом volume.

PR предназначен для integration management вmain после технической приёмки и применимых CI. Реальная установка/живые Telegram/телефон/product acceptance/delivery остаются владельцу; синтетические подписи и isolated Debian их не заменяют. Реальные сервер/БД/proxy/BotFather/Sites developer не менял.


## Передача management

Последующий handoff commit меняет только `.delivery`: документы/evidence/отдельное review/готовые owner scripts. Apps/packages/deploy/tests/scripts/workflows/Dockerfile/lockfile побайтно соответствуют runtime **0f2cd90c5b672d67409c2687e4e90a8ce9797482**. CI и immutable kit закреплены на runtime, documents-only handoff помечен `[skip ci]`; полный HEAD передачи читается в PR/GitHub.

Следующее действие management — принять эту передачу, завершить разрешённую интеграцию PR9 вmain и проверить результат интеграции/применимые main CI, сохранив связь main tree с accepted runtime/kit. Developer не заявляет выполненное слияние. Владелец отдельно обновляет реальный сервер и проверяет живые сценарии; product acceptance/delivery pending.
