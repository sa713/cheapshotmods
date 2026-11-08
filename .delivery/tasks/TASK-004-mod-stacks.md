# TASK-004 — одна строка для одинаковых модов в эксперименте

Интеграция2026-11-08: результат задачи находится вmain, [PR8](https://github.com/sa713/cheapshotmods/pull/8), merge `3ffeca3f50c8950d169b928601e16aa770c96221`. Текущая сводка —[STATE](../STATE.md). Ниже сохранены исходные условия/передачи/проверенныеSHA; прежние pending-поля внешней установки относятся к тем историческим передачам. Владелец сообщил общую работоспособностьDebian, точный запущенныйSHA отдельно не установлен; новая установка радиGitHub не требуется.

- Статус: **accepted** — технический результат включён вmain черезPR8; интеграция management2026-11-08.
- Основание: сообщение владельца 2026-11-07 и screenshot Mini App: два результата 💢4.0/+27 после одинаковых крафтов отображаются отдельными строками по1; требуется одна строка с общим количеством.
- Роль: developer; исправление напрямую поручено владельцем, отдельного подтверждения не требует.
- База: `chm-003-external-proxy`, `a709f5d4dea4946373ea0e7c1f606c5b0a792a5b`; чистое дерево, upstream PR3/head проверен. Новая ветка `chm-004-mod-stacks`, [stacked PR4](https://github.com/sa713/cheapshotmods/pull/4) в chm-003-external-proxy; PR3/его отзывы и архивы не переписываются.
- Риск: повышенный — уже сохранённый инвентарь, история отмены, экипировка и SQLite migration.

## Область и критерии

1. В рабочем наборе одного игрока одинаковые тип/уровень/параметр занимают одну строку, количество суммируется точно. Разные игроки/типы/уровни/параметры не объединяются. Original batches и их редактирование сохраняют прежнюю семантику; исправляется показанный рабочий набор, без переделки исходного редактора.
2. Новый крафт добавляет ровно1 к существующему стеку результата либо создаёт новый. «Надето» показывает суммарное количество этого стека. Формулы/цены/лимит100/права аккаунтов не меняются.
3. Undo вычитает только добавленный экземпляр, восстанавливает три входа, pre-craft equipment и расход. Работают повторная цепочка крафтов, использование надетых, экипировка после крафта, повторный запрос с тем же key, reset и source edits до/после начала эксперимента.
4. Старые schema2 work duplicates автоматически объединяются в атомарной schema3 migration. Переназначаются work/history/equipment IDs, включая отсутствующие сейчас исторические группы; consumed/equipment aliases суммируются BigInt. Original rows, owner, level, experiment, spent, history seq/price сохраняются. Command receipts/payload/result/created не переписываются. Revision каждого существующего игрока увеличивается ровно1, чтобы старые несохранённые selections получили409; reopen3 не повторяет migration.
5. При malformed/missing/conflicting history refs migration отказывает атомарно без частичных изменений. Partial unique index work tuple защищает invariant. Старый app не открывает schema3; штатное обновление использует копию snapshot в новый volume, rollback возвращает прежние image+volume2.
6. Native tests на закреплённых Node24.22.1/npm11.9.0/better-sqlite3; browser на настоящем сервере/SQLite с isolated signed Telegram, включая уже созданные дубли. CI и immutable Debian kit, отдельный reviewer, исправление доказанных blockers, exact hashes/команды и конкретные ограничения.

## План developer

1. Воспроизвести две отдельные 💢4/+27 rows на исходном Store. Зафиксировать schema2 fixture реальным неизменённым старым engine: nested craft history/worn, receipts, original/work ID с разными attrs и большие количества.
2. Work-only canonicalization, schema3 migration и delta undo. Incremental work adjustment при source edits до started; reset группирует original batches. UI/API форматы остаются прежними.
3. Regression: два одинаковых результата, существующий надетый output stack, полная legacy undo chain/BigInt/scope/receipts/migration failure, настоящий browser screenshot scenario/reload/equip/craft/undo/reset.
4. Новый kit/CI/independent review и upgrade2→3/rollback на exact прежнем fbe image/данных. Сведения о текущем app=fbe/helper=b008 и дисковом guard из TASK003 сохраняются. Для owner update не ослаблять guard, не чистить Docker/чужие сервисы/данные; допустимы только конкретно проверенные воспроизводимые Cheapshot download scratch copies при необходимости, с сохранением configs/backups/операторского helper. Реальный сервер/BotFather/merge не поручены.

## Выполненное

- Прочитаны pinned standard/PROJECT/PRODUCT и код Store/API/UI. Причина: каждый craft создаёт randomUUID; undo удаляет всю output row. Произвольное объединение без изменения undo потеряет другие экземпляры.
- `tests/fixtures/v2-mod-stacks.json` получен до правок из настоящего schema2 Store, source побайтово совпадает с fbe. Это synthetic данные, не личная база владельца/не живая Telegram интеграция.

## Самопроверка реализации

- До исправления реальные assertions подтвердили две work rows вместо1 и новый createdId вместо существующего стека. Golden fixture выпущен исходным engine до правок.
- Node24.22.1/npm11.9.0 и настоящий better-sqlite3 13.0.3: typecheck/lint успешны, `npm test`41/41; build успешен. Дополнительные8 native cases проверяют перенос/полную отмену/владельцев/129digit totals/immutable receipts/stale revision/атомарный отказ, существующий worn output, sourceID collision и205 истории с64bit SQLiteseq за2^53.
- Chromium `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser`:14/14,49.6s. Настоящий HTTP app/SQLite и signed synthetic Telegram: повторные одинаковые крафты однакарточка qty1→2→3, worn/craft/undo/reload/reset; реальная schema2golden мигрируется при restart и проходит UIundochain. Скриншоты `grouped-crafted-mods.png`, `migrated-existing-mods.png` включаются в CIbrowserartifact. Это не новая живая Telegram-проверка.
- Первоначальный sandbox npmtest отказал в localhost listen/childprocess EPERM; повтор без этого инструментального ограничения41/41. Ничего не skipped, assertions/проверки не ослаблены.
- Миграция читает/пишет history ограниченными100row batches (safeIntegers seq): активный better-sqlite3 iterator не допускает writes на том же connection. При schema2ошибке transaction откатывает и schema/data/index/revisions; Store закрывает соединение перед отказом.
- Отдельный reviewer читает новый code/fixtures, не изменяет реализацию. Kit/CI/actual2→3→rollback остаются следующими проверками; старые отзывы TASK003 сохранены.

## Проверенный кандидат и передача — 2026-11-07

Source/candidate **`19a6fdde785eb90b01bd78318deeab1a539dde7b`**, PR4. После него изменяются только `.delivery` документы/отчёт/команды передачи, без изменений production/tests/packaged files. Не подменять immutable artifact новым docs HEAD.

- [Checks42383812618](https://github.com/sa713/cheapshotmods/actions/runs/42383812618), verify128436832834 + container-smoke128436833022: **success**. Настоящие pinned41/41native,14/14Chromium, build/typecheck/lint, measure pipefail negative и capacity, container-smoke — success, без skipped. [Browserartifact13578986786](https://github.com/sa713/cheapshotmods/actions/runs/42383812618/artifacts/13578986786) включает screenshot одной карточки и мигрированного инвентаря.
- [Kit42383812634](https://github.com/sa713/cheapshotmods/actions/runs/42383812634), job128436832639: **success**, все steps завершены success.4helper+14portableproof negatives, build/extract, настоящие standalone/external Debian installation, Docker29.8 classic(vfs)/containerd(native) и reverseexport →freshclassic, uploads — выполнены. Docker/backend владельца не менялся.
- [Immutable kitartifact13579575081](https://github.com/sa713/cheapshotmods/actions/runs/42383812634/artifacts/13579575081),131891973bytes, expires2026-12-07T15:09:57Z. ZIP SHA256 **`f899a858085731b4831ca631a12b7aad35256f57efff0c49eef3539287b509f2`**.
- Внутренний `cheapshotmods-19a6fdde785eb90b01bd78318deeab1a539dde7b-linux-amd64.tar.gz`: SHA256 **`dd17699a37328a877662492fc5537c745f86540a24c4a72902ed875ed8f555b6`**; images.tar.gz **`e1831a9446754508aaad021f64fb151e1c1124bd9ca307c6fc60e9c91d987333`**. ZIP/tar/все13SHA256SUMS и rawconfig+orderedlayers proof проверены после скачивания. Manifestformat2, linux/amd64, Node24.22.1/npm11.9.0, image_bytes350623744. Helperexact884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011 совпадаетb008: исправление группировки не меняет ingress.
- [Storeevidenceartifact13578849233](https://github.com/sa713/cheapshotmods/actions/runs/42383812634/artifacts/13578849233), ZIPSHA256742bc7bb9a9b13f86761aa2e115df443d5f8da1e5f3b05349093f8c420fb6dc8. App rawconfig/classicnative=`c597d1956e812da2d670353ee58d9acb37a28f7ff548eebc876e10271eaf078a`; containerd-native=`24dfc1773f8968b1bbe6419a4fd356b651e2cf40663d3fc8ca08128b577daae0`. Разные daemon-local native IDs подтверждены, rawconfig/orderedlayers/platform/source одинаковы; обратный containerdexport→classic прошёл.

### Точное обновление установленной версии и откат

Авторский настоящий изолированный Debian13-slim/linux-amd64/cloudDocker29.9.2vfs прогон с **canonical FBE kit** (не rebadged новый image) →canonical19a kit завершился успешно. Подписанные synthetic Mini данные, настоящий API/SQLite, никакого доступа к серверу владельца/живым Telegram аккаунтам.

1. СтарыйFBE app создал два одинаковых результата отдельнымиUUIDrows, надетые2, расход1188, историю, sourceedit послеstarted и receipts.
2. Штатный входящий `chm.sh update` остановил записи, получил offline snapshot старым app, создал отдельный новый volume, перенёс schema2→3. Original rows/level/experiment/spent/stats/receipts сохранены; work duplicates/equipment объединены, revision+1. Точное повторение старого key вернуло старыйreceipt без новой записи, новыйkey со старойrevision получил409. Config и отдельныйversionedoperator сохранилиexacthash.
3. Два новыхкрафта добавили по1 в тот же стек; wornкрафт+undo и все четыре legacy/newundo восстановили12исходныхworkmods/spent0. Reset использовал отредактированные original batches и сгруппировал рабочие tuples.
4. Старыйimage отказал `UNKNOWN_DATABASE_VERSION` на **отдельной SQLite Online Backup копии** schema3; активныйvolume для этого не менялся.
5. Штатный rollback вернул прежние metadata/image/volume/schema2 и exact прежние rawwork rows/equipment/level/spent/experiment/revision; повторный restart сохранил это состояние. Старые дубли при rollback ожидаемы, потому что вернулась старая версия.

Proof `/tmp/chm-task004-upgrade/proof.json`, SHA25660488921655a59d3f20960e8724f525c230b1ef66576255276dda5f1c6e1371c. Executed harness `/tmp/chm-task004-upgrade/run.executed.sh` SHA256cf5d60706845e98fcd0f3da4d43d0023ff43a214d0e1115e415b2132a140bcfd; fixture.py e12bd093f915d4b4c9485a3d0a8baa0e4cad74827036b61521cbb2bcb6751974; api.cjs58750b9e3dfd99c27f21de8b51844d9ca2009fdd8a04865c698d8cb42e18a972. Это отдельная local classic проверка schema migration; обе Docker29.8stores/HTTPSexternal проверены CI выше. Собственные containers/volumes/networks очищены по точным project labels; исходные Docker images/cache/daemon сохранены.

### Независимая проверка и ограничения

Отдельный reviewer проверил exact19a source/kit/CI и собственными запусками8newnativecases,24реальныеlegacy migrations/2400oldenginecommands/1622pairedundo,3600sourceedits и2newChromiumscenarios. Original/receipts совпали с oldengine; work/equipment/stats/spent/level совпали поtuple после каждогоundo. Дополнительно проверены ownercommandguards/optionalcleanup в изолированныхfilesystemfixtures. Заключение — [TASK-004-review.md](../reviews/TASK-004-review.md), приёмка ограничена проверенным кандидатом, установка владельцем pending. Старые TASK003reviews не изменялись.

Точные **root/curl** команды скачивания/проверки/обновления/отката — [TASK-004-NEXT-STEPS.md](../TASK-004-NEXT-STEPS.md). Новая установка поверх существующегоROOT не нужна, только штатный update. Diskreserve не снижен; optionalcleanup удаляет только exacthash/root-owned воспроизводимые scratchархивы старых двухkits, не configs/backups/helper/images/volumes/чужие данные; uid1001extractedархивы могут быть консервативно пропущены. Если места мало даже после этого, остановка и дополнительный диск/отдельное согласование освобождения, безDockerprune. NewZIP/tar удаляются только послеchecks, полныйextractednewkit сохраняется. Rollbackguard фиксирует направление new→FBE и предотвращает повторныйtoggle.

Установленный app владельца покаFBE, operatorb008; developer не входил на сервер, не устанавливал обновление, не менял BotFather, Docker daemon/рабочие сервисы, не сливал PR и не выполнял внешнюю публикацию. Screenshot владельца подтверждает открытый настоящий MiniApp с инвентарём и наблюдаемый дефект; он не заменяет полную живую проверку обоих Telegramвходов/соседнихмаршрутов/renewal. После ownerupdate требуется reload и проверка одной строки/суммы/«Надето»/craft→undo. Ни local synthetic auth, ни CI не называются живой Telegramинтеграцией.
