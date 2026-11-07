# TASK-004 — одна строка для одинаковых модов в эксперименте

- Статус: implementing.
- Основание: сообщение владельца 2026-11-07 и screenshot Mini App: два результата 💢4.0/+27 после одинаковых крафтов отображаются отдельными строками по1; требуется одна строка с общим количеством.
- Роль: developer; исправление напрямую поручено владельцем, отдельного подтверждения не требует.
- База: `chm-003-external-proxy`, `a709f5d4dea4946373ea0e7c1f606c5b0a792a5b`; чистое дерево, upstream PR3/head проверен. Новая ветка `chm-004-mod-stacks`, отдельный stacked PR в chm-003-external-proxy; PR3/его отзывы и архивы не переписываются.
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
