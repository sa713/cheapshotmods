# TASK-006 — проверка устанавливаемого кандидата

Runtime source: **d6cb0e9404f07b5573b64131281d29569a010442**. [PR7](https://github.com/sa713/cheapshotmods/pull/7) направлен в `chm-005-batch-fuse`. Финальные документы передачи добавляются после runtime; состав этого отличия указан в карточке. Сервер владельца, main, BotFather и рабочие данные не изменялись. Product acceptance и delivery остаются pending.

## Проверки автора и отдельного reviewer

- `bash scripts/verify.sh`: **70/70 native**, typecheck, lint, production build. Reviewer отдельно повторил 70/70; области и версии зафиксированы в его отчёте.
- `npm run test:browser`: **29/29 Chromium**, настоящий HTTP, better-sqlite3/SQLite, ширины 360/390/1440. Четыре новых сценария отдельно повторены после исправлений R1/R2. Подписанные Mini/OIDC fixtures проверяют протокол, это не живые Telegram/WebView.
- `bash scripts/check-measure-pipeline.sh`: ошибка измерения в actual workflow step возвращает 17; negative control без `pipefail` возвращает 0. Таким образом CI не скрывает ошибку за `tee`.
- `python3 scripts/test-image-proof.py`: **14** проверок; `python3 scripts/test-ingress-config.py`: **4**.
- `npm run measure`: 729 × 10²⁴ зелёных → 10²⁴ результатов 6.0, шесть переходов, точная цена 40824 × 10²⁴. Локально preview 1,27 мс / commit 1,71 мс / undo 0,90 мс; план 2409 байт, один lot, одна запись истории, heap delta 345936 байт. Node 24.22.1, Linux x64, 5 vCPU. Это измерение тестовой среды, не SLA сервера владельца. [Полный JSON](evidence/TASK-006/local-capacity.json); exact CI capacity сохраняется отдельно.
- Отдельный reviewer сравнил 2500 случайных смешанных пулов с простой поэкземплярной моделью: результаты, цены, расход по ID и отказы при нехватке совпали. Он также создал собственную schema4 БД старым Store, отдельно проверил сохранность всех строк, receipts, restart/undo/reset и отказ старой версии читать schema5. Это отдельная проверка, а не пересказ авторского fixture.

## Соответствие критериям

| Критерии TASK-006 | Доказательство |
| --- | --- |
| 1–3: рецепты, цены, смешанные значения, путь до 6.0 | `raw-mods.test.ts`: три рецепта; все 125 зелёных троек и значения 9–15; пакеты из девяти; готовые обычные + сырьё за 96; 729 зелёных по 10 → 120 за 40824; независимая последовательность с округлением на каждом переходе. Отдельный reviewer oracle расширяет смешанные пулы. |
| 4–6: характеристики, лимит, явная надетая часть и отмена | Точные примеры L200/101, общий лимит 100/101, unknown legacy crit, снятие расходуемых входов, ненадетый выход, сохранение текущего уровня и восстановление экипировки. Наблюдаемые сценарии повторены в Chromium. |
| 7: история и позднее пополнение | Single → mixed batch → single, объединение с существующим результатом, положительная дельта исходника, правка атрибутов/удаление/reset. Все undo сохраняют поздние lots ровно один раз. Schema4 fixture содержит старые ledgers, refinement и объединения. |
| 8–9: отказ и повтор команды | Неверные fixed fields/зелёные дроби/tier/семьи/ID/worn/stock отвергаются атомарно. Retry/KEY_REUSED/expired receipt/conflict/owner сохраняют прежний контракт. Два независимых SQLite worker connections проверяют raw single/batch. Fault injection покрывает plan/intermediate/history/receipt. |
| 10: совместимость | `v4-raw-history.json` создан неизменённым canonical Store TASK-005 из принятого schema3 fixture и настоящих schema4 команд. Migration сравнивает все строки, payloads и receipts; повторное открытие не переносит заново; fault откатывает marker и таблицы. Старые schema2/3 тесты сохранены. Настоящие Debian installer runs перечислены отдельно ниже. |
| 11: большой пул и технические отказы | 10²⁴ результатов через шесть переходов остаются компактными; input/pool/plan bounds сохранены. Capacity и отрицательный pipeline проверены. |
| 12: интерфейс | Три ширины, редактор всех сырьевых видов, fixed fields, исходные пиктограммы, смешанная экипировка, single/batch 1/2/6, undo/reset/reload, фильтры, 103 группы, 128-значные количества, retry/conflict, focus/modal, цели ≥44px и отсутствие overflow. Screenshot просмотрен автором; reviewer отдельно проверил исправленные crop и доступные подписи. |

## Найденные и исправленные ошибки

Первый runtime `09227d3` прошёл checks [42506810909](https://github.com/sa713/cheapshotmods/actions/runs/42506810909), но kit [42506810941](https://github.com/sa713/cheapshotmods/actions/runs/42506810941) остановился на новом harness: `cp` использовал `$work` до его создания при `set -u`. Reviewer независимо обнаружил R1; исправление перенесло copy после создания каталога и регистрации cleanup. Предварительный canonical installer с этим исправлением полностью прошёл, но его `092` kit не является итоговой поставкой.

Визуальная самопроверка исправила наследуемый flex-basis и letterboxing маленьких raw filter icons. Reviewer R2 выявил отсутствие названия типа в доступной подписи craft slots; тип добавлен в `aria-label`, browser assertions различают фиолетовый/красный. Окончательный runtime `d6cb0e9` включает оба исправления. Промежуточная kit-сборка `938` отменена как заменённая новым runtime; её частичные результаты не выдаются за итоговую приёмку. Старые TASK-005 архивы и отчёты сохранены.

## Exact CI

[Checks 42507713626](https://github.com/sa713/cheapshotmods/actions/runs/42507713626) относятся к runtime `d6cb0e9`:

| Job | Результат |
| --- | --- |
| [verify / 128813868245](https://github.com/sa713/cheapshotmods/actions/runs/42507713626/job/128813868245) | success: npm ci, typecheck/lint/build, 70 native, 29 Chromium, pipeline negatives и capacity |
| [container-smoke / 128813868574](https://github.com/sa713/cheapshotmods/actions/runs/42507713626/job/128813868574) | success: реальный image, persistence, backup и restored volume |

Browser artifact [13628660726](https://github.com/sa713/cheapshotmods/actions/runs/42507713626/artifacts/13628660726), до 2026-11-22T18:02:51Z, ZIP SHA256 `119883d4632f9eb17e021a558ba760dd8736d79aaeff2b595ba86d3c01cabebd`. Capacity artifact [13628152339](https://github.com/sa713/cheapshotmods/actions/runs/42507713626/artifacts/13628152339), до 2027-02-06T17:59:56Z, ZIP SHA256 `0bf6be60c295fc138dd42e80d817889ffface5d293242d052834a5740459c095`. Измерение дополнительно сохранено из decoded job log в [ci-capacity.json](evidence/TASK-006/ci-capacity.json): preview 1,31 мс / commit 1,91 мс / undo 0,67 мс, 2 vCPU AMD EPYC, план 2409 байт, один lot и одна запись истории.

## Четыре настоящих Debian upgrade-маршрута

[Kit workflow 42507713711](https://github.com/sa713/cheapshotmods/actions/runs/42507713711), step `Test schema4 and all supported predecessors on isolated Debian`, исполнил настоящий installer каждого immutable predecessor. Это отдельные Debian13-slim/linux-amd64 контейнеры с настоящим Docker28.0.4/overlay2, pinned Node/better-sqlite3; данные и подписанный вход синтетические. Это не unit migration fixture и не сервер владельца.

| Старый kit | Схема | Доказательство |
| --- | --- | --- |
| canonical TASK-005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` | 4 → 5 | [feb-upgrade.json](evidence/TASK-006/feb-upgrade.json): state/receipts сохранены, raw/equipment/single/batch/all old undo/late stock/reset прошли |
| FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` | 2 → 5 | [fbe-upgrade.json](evidence/TASK-006/fbe-upgrade.json) |
| `19a6fdde785eb90b01bd78318deeab1a539dde7b` | 3 → 5 | [19a-upgrade.json](evidence/TASK-006/19a-upgrade.json) |
| Sites `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` | 3 → 5 | [6dc-upgrade.json](evidence/TASK-006/6dc-upgrade.json) |

Во всех четырёх случаях: новый отдельный volume; старый binary отвергает копию schema5; прежние config и отдельный operator неизменны; новые операции/отмены, restart, backup/restore и rollback прежних image+volume прошли. Повторный restart после отката сохраняет точное прежнее состояние. Backup/restore проверен отдельно от rollback к predecessor.

Общий evidence artifact [13628022398](https://github.com/sa713/cheapshotmods/actions/runs/42507713711/artifacts/13628022398), ZIP SHA256 `50c712e6510b8f1602f828446bc48ed1fbf06b500a5a1a090faec865d0931106`, до **2026-12-08T18:08:18Z**. Автор скачал bytes, сверил digest и все четыре incoming SHA/схемы/результаты; reviewer независимо сверил metadata/ZIP/proofs и compiled assets со своей exact сборкой. Реальная Docker29.8 classic/containerd матрица выделена отдельно и не приписывается этим Docker28 runs.

## Новый kit и Docker stores

[Debian job 128813868395](https://github.com/sa713/cheapshotmods/actions/runs/42507713711/job/128813868395) — **success**, все обязательные шаги исполнены, не skipped. Помимо четырёх predecessor routes прошли standalone installer, внешний shared ingress, disk/drift/network/credential negatives и штатные lifecycle/rollback.

Финальный private artifact **[13628229576](https://github.com/sa713/cheapshotmods/actions/runs/42507713711/artifacts/13628229576)**, 131987880 байт, до **2026-12-08T18:19:24Z**:

- ZIP SHA256: `ee1b0eb98d48d46de6ee94e33eda5aa1d4a93e1aa1f23ab7817bfe90e2c521d7`.
- tar SHA256: `11b211873794fcb13386ad2d97dce97d23521cb00835dcb466d04a196fb98beb`.
- Manifest SHA256: `c90a41b568d049dae4d37851575c3f1329e82886b8ff5e297b6e214bddd7d247`.
- SHA256SUMS SHA256: `6df9fab63120d2965374d793c83be6d0f0722fd217948c6c858c3dd7ad2fbc6b`.
- Images archive SHA256: `d307b188d9a45aa9c1693158cdf4fe4f5e86df42b0f544f64c33c9da8953a841`.
- [Полный паспорт/manifest](evidence/TASK-006/kit.json), включая image config digest и ordered diff IDs. Source SHA — полный `d6cb0e9404f07b5573b64131281d29569a010442`, platform linux/amd64. Автор сверил скачанные bytes с API digest, tar, все 13 checksums, 11 packaged deploy files с exact Git source и archive config/layer proof. Reviewer отдельно выполнил свою проверку.

[Store evidence 13628259422](https://github.com/sa713/cheapshotmods/actions/runs/42507713711/artifacts/13628259422), до 2026-12-08T18:19:23Z, ZIP SHA256 `8d55c03d7bdcfbc329c84986404749727f764dcf2ba855b536b88d6b1c5ad4b8`:

- Настоящие Docker29.8.0 classic/vfs и containerd/native импортировали **тот же** archive. Config digest и ordered layer IDs совпали; native image IDs различаются по модели store.
- В обоих stores выполнены external installer lifecycle и отрицательные сценарии. Classic дополнительно проверил incoming format2 update и rollback legacy format1 installer.
- Настоящий export из containerd импортирован в свежий пустой classic без rebuild/подмены proof. [Summary](evidence/TASK-006/ci-store-summary.json), [classic](evidence/TASK-006/ci-store-classic.json), [containerd](evidence/TASK-006/ci-store-containerd.json), [обратный импорт](evidence/TASK-006/ci-store-containerd-to-classic.json).

Автор скачал store ZIP, сверил API digest и каждый config/layer proof с manifest финального kit. Reviewer прочитал полные CI logs и самостоятельно сверил metadata/bytes/observations. Этот CI run относится к exact указанному archive, прежние TASK-005 store результаты сюда не переносились.

## Передача и ограничения

[Готовые root/curl update/check/rollback команды](TASK-006-NEXT-STEPS.md) и отдельные scripts проверяют четыре поддержанные прежние версии, используют существующий private credential, сохраняют backup/metadata и неизменность config/отдельного operator. Исходные installer, disk guard и ingress protections не ослаблены.

Новая схема несовместима со старым app: откат только прежней пары image+volume. Записи после обновления сохраняются в новом volume и не обещаются в старой БД. Установка на реальный Debian, живые Telegram/телефон, внешний TLS/соседние сервисы после этого update остаются проверками владельца. Synthetic fixtures этого не заменяют. Main/слияние/сервер/общий proxy/BotFather developer не менял.

## Итог независимой приёмки

[Независимый reviewer](reviews/TASK-006-review.md) подтвердил устанавливаемый кандидат `d6cb0e9` после собственных проверок кода/UI, metadata/ZIP/tar/13 checksums/11 deploy sources/config+ordered layers, полных CI logs/четырёх upgrade proofs/обоих stores и сравнения **30 compiled runtime files** со своей exact сборкой. [Compiled proof](evidence/TASK-006/reviewer-compiled-proof.json).

Он повторил **на этом final CI archive** canonical TASK-005/schema4 → d6/schema5 на настоящем isolated Debian13/Node24.22.1/Docker29.9.2/vfs: byte-exact state/receipts, сырьё/экипировка/single/batch/старые undo/late stock/reset, old binary reject5, restart, backup/restore и rollback прежних image+volume+assets; config и отдельный operator неизменны. [Отдельный installer proof reviewer](evidence/TASK-006/reviewer-feb-upgrade.json). Это независимый installer run; in-process migration/oracle и CI результаты обозначены отдельно в отчёте.

Заполненные owner scripts и их inline blocks дополнительно проверены reviewer; `bash -n` проходит, SHA/ID/hashes соответствуют опубликованному artifact. Последующий commit содержит только `.delivery` передачу/evidence/review/operator scripts. Apps/packages/deploy/tests/workflows остаются exact runtime source `d6cb0e9`; CI и выпускаемый kit закреплены именно на нём. Документы передачи не требуют пересборки принятого runtime, их commit отмечен `[skip ci]`.
