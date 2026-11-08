# TASK-005 — проверка устанавливаемого кандидата

Runtime source: **feb6a1bf82e70474c482c6a2e1fb0e77c4e20586**. [PR6](https://github.com/sa713/cheapshotmods/pull/6), base `chm-004-sites-design`/bd8108c. Старт6ab1fa48 подтверждён, reset/force push не применялись. Последующий HEAD передачи включает доказательства и усиление developer-only installer fixture; исполняемые apps/packages/installer от runtime source не меняются. Source комплекта и HEAD передачи различаются явно.

Автор: `bash scripts/verify.sh` — typecheck/lint/build и **58/58 native tests**, затем **25/25 Chromium** на окончательной сборке. Node24.22.1/npm11.9.0; genuine better-sqlite3 13.0.3, SQLite3.53.4, ELF native addon `prebuilds/linux-x64.node`. Тестовые HTTP-серверы и SQLite настоящие; Telegram HMAC/JWS/PKCE данные синтетические и изолированы. Ни один такой тест не объявляется живой интеграцией.

[CI checks42498204955](https://github.com/sa713/cheapshotmods/actions/runs/42498204955) — **success**, jobs verify128785033258 и container-smoke128785033515. Все шаги выполнены, включая58native/25browser, измерение и negative pipeline. Container smoke действительно собрал образ из этого SHA и проверил non-root, HTTP401, restart, backup/restore SQLite и операции по восстановленному volume; это CI Docker run, не локальная пересборка в ограниченном по диску cloud workspace. В workflow сохранён явный pipefail; negative probe получает exit17, а без защиты0.

[CI kit42498204953](https://github.com/sa713/cheapshotmods/actions/runs/42498204953) — **success**, job128785033143, ни одного skipped step. Python ingress4/4 и image-proof14/14 пройдены локально и в CI. Установка Debian, external shared ingress и оба настоящих Docker29.8 stores прошли с одним canonical kit; containerd export проверен на fresh classic. Config и ordered uncompressed layers совпадают, native IDs ожидаемо различаются. [Матрица](evidence/TASK-005/ci-image-stores.json), [original summary](evidence/TASK-005/ci-store-summary.json); raw artifact13624517467/digest18ccc8a9d7f78a8d21eb15a5288dd279ecf9afcd4fd5b25bbf7965fd4b76572a. Защиты format2/config/layers/disk guard не ослаблены.

## Критерии и доказательства

| TASK-005 | Проверка последствий |
| --- | --- |
| 1–3: количество/ступени/готовые входы/цены | `tests/batch-fuse.test.ts`, `crit-store.test.ts`, `fuse-api.test.ts`:6→2×15/168,9→23/504,27→35/2268, ready2×15+3×10→23/336, unused остаётся; browser3widths подтверждает preview/commit/undo. |
| 4: порядок и отдельные округления | Последовательные тройки10/10/11→16 и10/11/12→17; ready перед intermediate; отдельный reviewer oracle5000 детерминированных малых пулов сравнивает все ordered inputs/outputs, cost, source usage и worn. Его запуск — независимый, не самопроверка автора. |
| 5: полный отказ и границы владельца | Rules/HTTP/Store: нехватка, tier7, чужой/повтор ID, другой kind, лишние поля price/result, worn/quantity, stale revision; ни одного частичного commit. Preview требует session+Origin+CSRF+account и ничего не записывает. |
| 6: точный крит | Integer-thousandths,0.0441→45,15×3→23→69 equipped;9×15→3×23→35,2×44×3=264; unknown≠0, единицы без%. Decimal dot/comma и неканоничные формы проверены. |
| 7: группировка/экипировка | Ключkind/tier/value/crit, известные значения различаются; одинаковые суммируются; unknown/zero отдельно; partial refine split/merge сохраняет worn; суммарный лимит100. |
| 8–9: добавления и отмена | Native mixed single→batch→single→reopen→undo с поздним пополнением входов/выходов; exact retry не дублирует.6→8 adds2; decrease/delete/attrs change толькоoriginal; reset актуальногоsource. Browser после batch добавляет оба вида и сохраняет их послеundo. |
| 10: миграция и уточнение | Golden schema2 отFBE и настоящий schema3 от old6dc (backend19a/6dc один),7owners/history/equipment/largeTEXT/receipts. Outer IMMEDIATE возвращает всю старую логическую схему приlate fault; bump ровно1 и reopening безповтора. Saved crit/history unknown не угадывается. Refine output+matching additions+refine inputs+reopen+undo сохраняет происхождение. Native installer routes перечисляются отдельно ниже. |
| 11: транзакции/конкуренция/потеря ответа | Fault hooks plan/intermediate/history/receipt/migration, SQLite ошибок записи; реальные два worker/connection дляsingle иbatch дают1commit/1conflict. Browser batch lost-response использует точный payload/key; stale preview/commit даёт409. |
| 12: старые квитанции | Bytes payload/result/created/hash не переписываются. Exact old receipt безcrit принимается до новых требований; browser pending replay загружает текущий state, не рисует старую форму как новый результат. COMMAND_EXPIRED/KEY_REUSED переживают reset/reopen. |
| 13: компактность/точность | Exact CI и local capacity JSON:9×10^24→10^24 tier3, цена504×10^24,1history/1work_lot/1099bytes plan.128inputdigits и derived129+; отдельный reviewer проверил все5ступеней с131digitscrit→derived132. |
| 14: реальный браузер | Chromium360/390/1440, signed synthetic Mini/OIDC, SQLite/restart; новыеполя/preview/commit/undo/additions/unknown/icons; пагинация105/205, gear внепервойстраницы, pending/retry/409/realSQLiteerror, longnumbers, nohorizontaloverflow,44px controls, Tab/ShiftTab/Escape/inert/focus. |
| 15: прежние моды/формулы | Stable ID💚→display🌸 и🅾→🅾️; tier-health prices неизменны, в частности3.0=162; legacy level200 +10/+8/+8 damage252/health200. Frozen Sites/старыеreviews/PRODUCT не переписывались. |

Файлы тестов в [tests](../tests); новый контракт в [IMPLEMENTATION](TASK-005-IMPLEMENTATION.md). Обновления старых assertions ограничены согласованными schema4/DTOcrit/stats/icons/положительными добавлениями. Регрессии не удалены. Прежние отзывы и pinned standard не менялись; SHA256 TASK004 Sites review остаётся001736cd38c02cebcef15e2d1742bc1ca2b4c6cb3c98b86a363342b03c7f4387.

## Среда, время и память

[CI capacity](evidence/TASK-005/ci-capacity.json): Ubuntu24.04/linuxamd64, Node24.22.1, EPYC9V74/2vCPU, host7,9GiB. Huge batch preview0,999ms/commit1,371ms/undo0,763ms, heapdelta277048bytes; peak RSS всего capacity процесса сохранён в JSON. [Local capacity](evidence/TASK-005/local-capacity.json): Linuxamd64, Xeon8573C/5vCPU, host18GiB, preview2,402ms/commit3,203ms/undo1,541ms, heapdelta281744bytes. Это одни измерения в изолированных средах, не игровой предел или SLA сервера владельца. Количество объектов зависит от групп/переходов, не количестваэкземпляров.

CI browser artifact13623967978, ZIP digest `a32a4380a1e78ec5e8476f689e2d06ebdd2b1ede6a06dcb46cb1217b1ee68d15`, expires2026-11-22T16:09:18Z; capacity13623808397. В browser artifact — screenshots/HTML comparisons, включая Sites-reference state pairs и новые batch360/390/1440. Автор просмотрел360px полной страницы; отдельный reviewer повторил browser suite и свой визуальный просмотр. Локальный author archive SHA25606c9f0f3d797f819716e3efc72b139a2d7ecb56c05e340f89da0d179f2e9a130.

## Canonical комплект и настоящие обновления

Canonical private [artifact13624905831](https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13624905831/zip), expires **2026-12-08T16:19:39Z**, source exactfeb. Автор скачал его, сверил ZIP digest0d7f1c83d417cb362c345b8ab32431362377128c87fad3cfe63431293a333731, tar30d5703a59ee734b5094291bf2ae83e4b46fb5039614753309f13a7037909e50, все13SHA256SUMS и archive proof. [Полный manifest/metadata](evidence/TASK-005/kit.json). Отдельный reviewer независимо сверил те же bytes/digests с GitHub и повторил archive proof.

Исполняемый harness: `scripts/task005-upgrade/run.sh NEW_KIT OLD_KIT EVIDENCE_DIR`; Debian13-slim/linuxamd64, cloud Docker29.9.2/vfs, pinned Node/npm/genuine better-sqlite3. Используются canonical полные старые tar/kits, не заново собранные «похожие» образы. Все login/данные синтетические, owner host/публичный TLS/BotFather не вызываются.

| Предшественник | Исполнение | Доказательство |
| --- | --- | --- |
| FBE fbe82aef…/schema2 → feb/schema4 | developer: passed | [fbe-upgrade](evidence/TASK-005/fbe-upgrade.json) |
| 6dc8021e…/schema3 → feb/schema4 | developer: passed | [6dc-upgrade](evidence/TASK-005/6dc-upgrade.json) |
| 19a6fdde…/schema3 → feb/schema4 | developer: passed | [19a-upgrade](evidence/TASK-005/19a-upgrade.json) |
| FBE independent repeat | reviewer: passed, собственный run | [reviewer-fbe-upgrade](evidence/TASK-005/reviewer-fbe-upgrade.json) |

Проверены реальные app HTTP assets/state/receipts/history/worn, все old undo, new single/batch/refine/add/undo/reset, stale revision, сохранность config/отдельногоb008 helper, restart, отдельный новыйvolume, online backup/restore, возврат прежней image+volume пары и exact old state/schema/assets послеrestart. Все старые images отвергают **копию** schema4; старый app никогда не открывается на active migrated volume. Второй полный update отдельно проверяет backup→изменениеlevel777→restore snapshot→rollback с точным сравнением изменённых данных иschema4.

По замечанию reviewer этот последний data assertion добавлен в developer-only fixture (SHA256 **11a6215df246a2a429aad15a60d7f34fee5c48652f715c1543977c57343f1db3**,3добавленные строки относительноfeb). Исполняемый runtime/установщик не меняется. Первый local FBE additional second-update отказал штатным disk guard; после удаления только собственных старых npm/header caches и проверенных дубликатов ZIP весь route повторён успешно. Guard/manifest не подменялись, Docker baseline cached images сохранён, чужие ресурсы не удалялись. Это ограничение локального стенда, не выполненное обновление владельца.

## Независимая приёмка и ограничения

Отдельная сессия reviewer `/root/batch_fuse_review` повторила собственные verify/native58/browser25, независимые oracle/native probes, сверку canonical kit и полный FBE installer run на точном runtime SHA. [Заключение](reviews/TASK-005-review.md): **accepted — устанавливаемый кандидат**, открытых блокирующих находок нет. Reviewer явно разделяет собственные запуски, авторские6dc/19a и CI both-stores. Все3его замечания закрыты и сохранены в отчёте. Автор не принимает собственную работу.

Реальный Debian владельца, телефон/WebView/Telegram/OIDC с настоящими секретами, сетевой доступ извне и renewal общегоIP-TLS этим кандидатом не проверяются. Owner текущий installed SHA после прошлых команд отдельно не подтверждён; команды допускаютFBE/19a/6dc и отказывают для иных версий. Schema4 несовместима со всеми этими старыми app: rollback только старые image+volume вместе; новые записи остаются в новом volume. Реальный сервер/общийDocker/proxy/BotFather/Sites/main не менялись. Развёртывание, слияние и новые расходы не выполнялись.
