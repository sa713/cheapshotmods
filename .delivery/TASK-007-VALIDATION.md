# TASK-007 — проверка устанавливаемого кандидата

Runtime source: **f944acb6435a9671cef6db5fc500b79a71d21133**. [PR8](https://github.com/sa713/cheapshotmods/pull/8) направлен в `chm-006-raw-mods`. Массовый сценарий теперь использует одну существующую однородную группу и автоматически считает максимум. Schema остаётся5; сохранённые данные, история, undo и permanent receipts не переписываются. Product acceptance и delivery остаются pending до действий владельца.

## Проверки автора и отдельного reviewer

- `bash scripts/verify.sh`: **80/80 native**, typecheck, lint, production build. Reviewer отдельно повторил80/80 на этом runtime.
- `npm run test:browser`: **38/38 Chromium**, настоящий HTTP и better-sqlite3/SQLite, ширины360/390/1440. Reviewer отдельно повторил38/38. После полного авторского suite изменён только текст сообщения readonly500; соответствующий browser case повторён успешно. CI и отдельный reviewer проверили окончательный runtime.
- `bash scripts/check-measure-pipeline.sh`: actual workflow step при ошибке measure возвращает17, negative control без pipefail возвращает0. `python3 scripts/test-image-proof.py` —14 проверок; `python3 scripts/test-ingress-config.py` —4.
- `npm run measure`:729×10²⁴ зелёных →10²⁴ результатов6.0, шесть переходов, цена40824×10²⁴; один lot и одна запись истории, план2795байт. Локально preview1,99мс/commit2,59мс/undo1,09мс, heap delta369480байт. Четыре128-значных добавления дают129-значный максимум: preview+commit+undo2,32мс, план2504байт. [Локальные измерения](evidence/TASK-007/local-capacity.json); это тестовая среда, не SLA сервера владельца.
- [Отдельный reviewer](reviews/TASK-007-review.md) использовал собственный физический reducer троек и literal prices: **2102 сценария**, все ordinary/raw типы/ступени, округления, остатки и17/128/129/200/256-значные количества совпали. Он отдельно скомпилировал canonical TASK-006 Store, создал три свежих mixed batch (разныеvalue, разныеcrit, raw+ordinary), проверил новый Store, exact replay при отсутствующих consumed IDs, новый mixed отказ, KEY_REUSED/expired/owner и последовательные undo с worn/поздним stock/уровнем307.

## Соответствие критериям

| Критерии TASK-007 | Доказательство |
| --- | --- |
| 1–3: максимум, max0, raw/ordinary рецепты | `batch-max.test.ts`:20→3 даёт2по23 за1008 с остатком2; уменьшение до1;17→2;8/9/100; raw фиолетовые/зелёные/health и промежуточные округления. Все допустимые source/target сверены с последовательностью одиночных рецептов. |
| 4–5: одна группа и надетые | Сервер выбирает work ID с owner scope, не включает другие value/crit/tier/family/intermediate группы, отвергает mixed создание и посторонние поля. Старый mixed single сохранён.20/надето3 дают max1 без разрешения либо max2 с ним;17free+1worn расход, undo восстанавливает3worn и сохраняет уровень. |
| 6–7: auto UI и актуальность | `max.spec.ts`: исходный максимум, количество/cap/clamp на blur/Enter и видимое пояснение, invalid inputs, max0,500/retry, обратный порядок HTTP-ответов при смене source и target,409 с новым подтверждением. Commit фиксирует показанные count/quantity/revision. |
| 8: атомарность и повторы | Native HTTP/Store/concurrency/fault tests: count>Nmax, чужой owner, неверные goal/limits, unknown crit, stale revision/experiment без мутаций; plan/intermediate/history/receipt faults полностью откатывают транзакцию. Потерянный ответ max-команды после reload повторяется прежним key/payload, даже когда оставшегося stock уже недостаточно для нового действия. |
| 9: настоящая прежняя история | `v5-mixed-history.json` создан неизменённым canonical source `d6cb0e9` и содержит mixed/single/unknown-crit/expired receipts, историю и consumed IDs, которых уже нет. Проверены byte-exact state/receipts при открытии, replay старой команды до новых ограничений, новый mixed отказ, refinement/late merge и последовательные old/new undo после restart. |
| 10: точные большие числа и компактность | BigInt/TEXT без Number количества.129-значный производный максимум проходит preview/commit/undo и настоящий UI; DOM/план не растут поNmax. Capacity и отдельный reviewer oracle подтверждают расход/цену/остаток. |
| 11–12: интерфейс и регрессии | Все38 browser tests:360/390/1440, группы после100, raw1/2/6, equipment/crit/refinement, pagination/reset/reload, modal/focus/keyboard, controls≥44px и отсутствие overflow. Просмотрены screenshots. Прежние auth/Telegram protocol/owners/ordinary/raw правила и100-slot лимит проходят native/browser; synthetic подписанный вход не заменяет живой Telegram. |

Старые mixed-creation assertions изменены в соответствии с новым продуктовым контрактом; историческая mixed арифметика и настоящие fixtures/replay/undo сохранены. Legacy DTO синтаксически читается перед receipt lookup; новый gate выполняется после lookup. Поэтому новый mixed batch закрыт, а завершённая старая команда возвращает exact результат без нового расчёта. Переходы доставки вынесены в `task007-upgrade`; прежние task006 scripts и evidence не менялись.

## Exact CI

[Checks42516633556](https://github.com/sa713/cheapshotmods/actions/runs/42516633556) на полном runtime SHA:

| Job | Результат |
| --- | --- |
| [verify/128840969609](https://github.com/sa713/cheapshotmods/actions/runs/42516633556/job/128840969609) | success: npm ci, typecheck/lint/build,80native/38Chromium, отрицательный pipeline и capacity |
| [container-smoke/128840969387](https://github.com/sa713/cheapshotmods/actions/runs/42516633556/job/128840969387) | success: реальный image, persistence, backup и restored volume |

[CI capacity](evidence/TASK-007/ci-capacity.json): preview1,29мс/commit1,85мс/undo0,73мс, план2795байт/один lot/одна history row;129-значный maximum preview+commit+undo1,83мс. Данные сохранены из decoded exact job log с source/run/job привязкой.

Browser artifact [13631367625](https://github.com/sa713/cheapshotmods/actions/runs/42516633556/artifacts/13631367625), до2026-11-22T19:48:35Z, ZIP SHA256 `880fb0c395c65b79b62dc3a2598dd2ba397ceb83e2227cebfd4170aef6c53e2a`. Capacity artifact [13630934281](https://github.com/sa713/cheapshotmods/actions/runs/42516633556/artifacts/13630934281), до2027-02-06T19:45:34Z, ZIP SHA256 `52d810c233f12e7de3e9af35ff65ddfb724043a52bcee72c307ebe8fd9b7c95d`. Metadata получены из GitHub API на exact runtime; capacity JSON дополнительно сохранён в репозитории, а browser screenshots/report доступны в private artifact.

## Пять настоящих Debian upgrade-маршрутов

[Kit42516633521](https://github.com/sa713/cheapshotmods/actions/runs/42516633521), step `Test canonical schema5 and all supported predecessors on isolated Debian`, исполнил настоящий installer каждого immutable predecessor. Это Debian13-slim/linux-amd64 с Docker28.0.4/overlay2 и Node24.22.1/better-sqlite3; данные и подписанный вход синтетические. Эти installer runs отделены от unit migration и от Docker29.8 store matrix.

| Старый kit | Схема | Доказательство |
| --- | --- | --- |
| canonical TASK-006 `d6cb0e9404f07b5573b64131281d29569a010442` | 5→5 | [d6c-upgrade.json](evidence/TASK-007/d6c-upgrade.json): byte-exact state/receipts, old mixed replay/new mixed reject, новые homogeneous операции/worn/count, old undo/late stock/reset |
| canonical TASK-005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` | 4→5 | [feb-upgrade.json](evidence/TASK-007/feb-upgrade.json) |
| FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` | 2→5 | [fbe-upgrade.json](evidence/TASK-007/fbe-upgrade.json) |
| `19a6fdde785eb90b01bd78318deeab1a539dde7b` | 3→5 | [19a-upgrade.json](evidence/TASK-007/19a-upgrade.json) |
| Sites `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` | 3→5 | [6dc-upgrade.json](evidence/TASK-007/6dc-upgrade.json) |

Все пять: отдельный новый volume, config/отдельный operator неизменны, restart, backup/restore и rollback прежних image+volume+assets прошли; повторный restart после rollback вернул точное старое состояние. Schema2/3/4 binary отвергают копию новой schema5. Canonical TASK-006 binary читает совместимую schema5-копию, что честно отражено в proof; это не разрешение подключать прежний image к рабочему новому volume при откате.

Evidence artifact **[13631708673](https://github.com/sa713/cheapshotmods/actions/runs/42516633521/artifacts/13631708673)**, expires **2026-12-08T19:55:33Z**, ZIP SHA256 `764e9cc8f12f2390285fbb56d38e1e2b876a92f83112316b72bbb1b19128bf9a`. Автор скачал bytes, сверил API digest и source/platform/результаты всех пяти JSON; сохранённые копии указывают CI executor/run/job. Локально автор дополнительно исполнил canonical TASK-0065→5 и TASK-0054→5 на Docker29.9.2/vfs; эти запуски использовали локально собранный kit и не выдаются за independent final CI archive lifecycle.

## Debian-комплект и независимая приёмка

[Debian job128840968927](https://github.com/sa713/cheapshotmods/actions/runs/42516633521/job/128840968927) — **success**. Все обязательные steps выполнены, не skipped: standalone/external installer, disk/drift/network/credential negatives, lifecycle/rollback, пять predecessors и настоящие Docker stores.

Финальный private artifact **[13631764817](https://github.com/sa713/cheapshotmods/actions/runs/42516633521/artifacts/13631764817)**, 131995030байт, до **2026-12-08T20:04:25Z**:

- ZIP SHA256: `225cf1d60f0f179c18fcc7a776c98deff32448dd2f5fe74601ff6e354f4613eb`.
- tar SHA256: `e0fef732af099f91f18810954fb48c1e89b19a44c30c7947828f3250ccd4596b`.
- Manifest SHA256: `6f765bf91896c386027d0424dfbe383720c9f7f2bce5e74913b89df3299a66eb`.
- SHA256SUMS SHA256: `24a7a9522f740524f819f69dff2643c64cc723de8fd9529813721fca91e9ed7c`.
- Images archive SHA256: `4898646a91eef2edc1f6e0b7084a1b2b4a5e635bd59491b2797cfa80edae9de0`.
- [Полный паспорт/manifest](evidence/TASK-007/kit.json), sourceSHA **f944acb6435a9671cef6db5fc500b79a71d21133**, platform linux/amd64. Автор сверил скачанные bytes с API digest/размером/source, tar, все13 checksums,11 packaged deploy files с exact Git source и archive config/ordered-layer proof. [Metadata всех CI artifacts](evidence/TASK-007/ci-artifacts.json).

[Store evidence13632645237](https://github.com/sa713/cheapshotmods/actions/runs/42516633521/artifacts/13632645237), до **2026-12-08T20:04:24Z**, ZIP SHA256 `e92028996681bde19e2e174146f444304c9e748b3738ea2d5c10485baab93c4e`:

- Настоящие Docker29.8.0 classic/vfs и containerd/native импортировали **один exact archive**. Config digest, ordered diff IDs и platform совпадают с manifest; store-native image IDs ожидаемо различаются.
- В обоих stores прошли external installer lifecycle/negatives; classic дополнительно выполнил incoming format2 update и rollback legacy format1 installer.
- Export из containerd импортирован в свежий пустой classic без rebuild/подмены proof. [Summary](evidence/TASK-007/ci-store-summary.json), [classic](evidence/TASK-007/ci-store-classic.json), [containerd](evidence/TASK-007/ci-store-containerd.json), [обратный импорт](evidence/TASK-007/ci-store-containerd-to-classic.json).

Автор скачал store ZIP, сверил API digest и каждый config/layer/platform proof с manifest финального kit; прочитал полный CI job log. [Отдельный reviewer](reviews/TASK-007-review.md) независимо подтвердил официальные CI metadata/logs, bytes/digest и результаты всех пяти routes и трёх store observations; его собственные проверки перечислены ниже.

## Ограничения передачи

[Готовые root/curl update/check/rollback](TASK-007-NEXT-STEPS.md) по существующему credential проверяют пять допустимых predecessors/external mode, точные ZIP/tar/files, сохраняют backup/metadata и config/отдельный operator. Скрипты заполнены exact artifact ID/хешами; bash syntax и byte equality inline blocks проверены. Disk/ingress guards сохраняются. Откат выполняется штатно прежней парой image+volume, даже для schema5→schema5; новые записи остаются в новом volume. Реальный сервер, внешний HTTPS/соседние сервисы, живые Telegram/телефон и product acceptance после установки остаются владельцу. Main/слияние/сервер/общий proxy/BotFather developer не менял.


## Итог независимой приёмки и передача

Отдельный reviewer **accepted** устанавливаемый кандидат **f944acb6435a9671cef6db5fc500b79a71d21133**, exact artifact **13631764817**. Подтверждённых дефектов не найдено. Его [runtime proof](evidence/TASK-007/reviewer-runtime-proof.json) сохраняет собственные80native/38browser/oracle2102/три fresh mixed histories; [archive proof](evidence/TASK-007/reviewer-archive-proof.json) — independently verified metadata/ZIP/tar/13checksums/11sources/config+ordered layers. Все **30 compiled rules/server/web files** exact CI image совпали с собственной сборкой reviewer; Node/SQLite также сверены: [compiled proof](evidence/TASK-007/reviewer-compiled-proof.json). Образ читался без сети и без изменения содержимого.

На **этом final CI archive** reviewer отдельно исполнил canonical TASK-006/schema5→кандидат5 на actual isolated Debian13/Node24.22.1/Docker29.9.2/vfs: byte-exact state/receipts, old mixed replay/new mixed reject, raw/equipment/single/homogeneous/max/count/worn, все старые undo/late stock/reset, restart/backup/restore, rollback прежних image+volume+assets и повторный restart. Config и отдельный operator неизменны. [Собственный lifecycle proof](evidence/TASK-007/reviewer-lifecycle-proof.json). Это самостоятельный installer run, отдельно от unit fixture и CI.

Reviewer также проверил [CI/stores/five routes](evidence/TASK-007/reviewer-ci-proof.json) и [заполненные owner scripts/guide](evidence/TASK-007/reviewer-owner-proof.json), включая bash/embedded Python syntax, exact bindings и inline byte equality. Эти команды на реальном сервере не исполнялись.

Последующий handoff commit содержит только `.delivery` документы, evidence, независимый отчёт и owner scripts. Apps/packages/deploy/tests/scripts/workflows/Dockerfile/lockfile остаются exact runtime **f944acb6435a9671cef6db5fc500b79a71d21133**. Полный SHA передачи читается в GitHub/PR; CI и kit относятся к указанному runtime, documents-only commit помечен `[skip ci]`. Установка владельцем/живые Telegram/телефон и продуктовая приёмка остаются pending; техническая приёмка устанавливаемого кандидата их не заменяет.
