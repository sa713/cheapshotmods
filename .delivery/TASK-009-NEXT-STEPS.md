# TASK-009 — передача и установка владельцем

[PR10 → main](https://github.com/sa713/cheapshotmods/pull/10), runtime/source **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**, schema6. Меню, глобальный порядок и фиксированные зелёные рецепты реализованы. [Авторские доказательства](TASK-009-VALIDATION.md). Management организует независимое ревью, устраняет blockers и завершает разрешённую интеграцию. Настоящий сервер обновляет владелец после приёмки.

## Статус комплекта

Публикация CI artifact пока блокирована квотой. После отдельного разрешения владельца удалён ровно 21 согласованный неканонический artifact; сохранность всех остальных 168 проверена. Attempt2 на том же source завершён: все вычислительные проверки снова прошли, upload вновь отклонён квотой. [Итог CI](evidence/TASK-009/ci-jobs.json); активных прогонов нет. Готовые команды скачивания через существующий private credential будут привязаны к реально опубликованному artifact ID и его ZIP/tar SHA256; до этого серверную установку не начинать.

Для воспроизведения самопроверки подготовлен отдельный local immutable kit source eb655846:132005139 байт tar, SHA256 `1487bedc2d7c1cf18b4b1d336ca87a72a2fe1d3b007e9a39c86b29ecf81e08c6`, app config `sha256:ccc2ffc10c50c9968433243e23ed652e610dc7a42a84642459cb1622a29ac520`. [Паспорт](evidence/TASK-009/local-kit.json), [30 compiled/11 deploy сверка](evidence/TASK-009/author-local-compiled-proof.json), [canonical lifecycle](evidence/TASK-009/author-local-canonical-upgrade.json). Это локальный архив; его hashes не подставлять для другого CI artifact.

## Предшествующие версии и данные

Поддерживаются FBE `fbe82aef6008d292515c0efce2fde601c221f3d2` (schema2), `19a6fdde785eb90b01bd78318deeab1a539dde7b` и `6dc8021e58daa9aa16a93a9265315bb810fe9d0a` (schema3), TASK005 `feb6a1bf82e70474c482c6a2e1fb0e77c4e20586` (schema4), TASK006 `d6cb0e9404f07b5573b64131281d29569a010442` и TASK007 `f944acb6435a9671cef6db5fc500b79a71d21133` (schema5), TASK-008 `0f2cd90c5b672d67409c2687e4e90a8ce9797482` (schema6). Неизвестный установленный SHA требует отдельной проверки; он не предполагается по сообщению о работоспособности сервера. Промежуточно устанавливать TASK-008 не нужно.

Сохраняются original/work/история/расход/экипировка/permanent receipts/исходный snapshot. На schema2–5 действуют прежние миграции в 6, без автоматической фиксации снимка; schema6→6 не переписывает данные. Старые mixed exact retries/undo сохранены. Новый craft меняет только work/lots/history/расход. Старый TASK-008 binary проверенно читает generic green ledger/undo на копии schema6, но новый recipe API ему не приписывается; binaries2–5 отвергают 6.

Обновление использует отдельную копию volume. Штатный rollback всегда возвращает предыдущую пару **image + volume**; новые записи остаются в новом volume и не переносятся в старую БД автоматически. Config/секреты и отдельный ingress-b008807.py сохраняются. Общий proxy, BotFather и Docker backend ради этого обновления не перенастраивать.

Дисковый guard сохранён: external reserve2GiB + две копии image_bytes + две копии данных. При отказе остановиться, не обходить guard и не удалять Docker images/volumes/backups соседей. Owner script использует существующий `/root/.config/cheapshotmods/github.curl` без вывода credentials, выполняется от root, без sudo/gh/npm/build на сервере. Повторный update не требуется после успеха; перед любым повтором проверить current/previous/version и причину отказа.

## Пользовательская проверка после разрешённого обновления

1. Полностью перезагрузить сайт/Mini App. Проверить прежние данные/историю/экипировку/уровень/зафиксированный набор. Открыть меню добавления/редактирования на телефоне: закрытое/раскрытое состояния читаемы, список прокручивается, клавиатура/Escape/Tab/касание работают.
2. Проверить порядок типов 🅾→💢→🌸→🧿→raw-purple→raw-red→raw-green, затем tier/value/crit по убыванию; unknown crit после известных. Догрузить следующую страницу, проверить фильтры и список источника массового фьюза.
3. На своих проверочных свободных количествах Q6=10/Q7=6/Q8=8 открыть «Зелёные рецепты»: максимумы 5/4. Первый n5 даёт 5🅾1.0/10 за 140, второй максимум становится 1. Отменить: исходные количества/расход возвращаются. Затем второй n4 даёт 4🅾1.0/12 за 112; отменить. Выход не надевается автоматически, original/snapshot не меняются.
4. Уменьшить количество, проверить явное разрешение надетого сырья, недостаток и прежний однородный/single крафт. Повторить reload. Два сброса и замена снимка остаются отдельными подтверждаемыми действиями: полный возврат намеренно удаляет поздние правки/историю/экипировку, сохраняя уровень.

Изолированные developer/CI проверки не подтверждают живой Telegram, внешнюю доступность и product acceptance владельца. После установки нужны фактический `/version`, check, результат пользовательской проверки и решение по приёмке.

## Подготовленная проверка и парный откат

Команды ниже предназначены владельцу после отдельно разрешённой установки runtime eb655846. Developer их на настоящем сервере не выполнял. Они не разрешают начинать установку при текущем blocker публикации.

```bash
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
curl --fail --silent --show-error https://94.228.170.13:9443/health
curl --fail --silent --show-error https://94.228.170.13:9443/version
bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods
```

Ожидаемый `/version`: `eb655846db16f3dbc6afdb8ca9f9ad4d710848b0`. Backup печатает конкретный private SQLite путь и включает snapshot вместе с экспериментом. Прямой откат только этого update, до других update/restore, подготовлен в [TASK-009-rollback.sh](TASK-009-rollback.sh). Скрипт от root проверяет current eb655846, предыдущий source из семи поддерживаемых predecessors и external mode, затем вызывает штатные rollback/check; при неожиданной версии останавливается. Встроенный guard не обходит installer и не подменяет previous.env.

```bash
#!/usr/bin/env bash
# Restore only the previous image+volume pair; post-update writes remain in the new volume.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run this command as root.' >&2; exit 1; }
python3 -I - <<'PY_GUARD'
from pathlib import Path
root = Path('/opt/cheapshotmods')
def metadata(name):
    return dict(line.split('=', 1) for line in (root / name).read_text().splitlines())
current, previous = metadata('current.env'), metadata('previous.env')
assert current['CHM_VERSION'] == 'eb655846db16f3dbc6afdb8ca9f9ad4d710848b0', 'Unexpected current version; stop'
assert previous['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133','0f2cd90c5b672d67409c2687e4e90a8ce9797482'}, 'Unexpected rollback target; stop'
assert current['CHM_PROXY_MODE'] == previous['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
print('Rollback target:', previous['CHM_VERSION'])
PY_GUARD
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Для продолжения после пересчёта квоты developer проверяет [checks42992435585](https://github.com/sa713/cheapshotmods/actions/runs/42992435585) и [kit42992435564](https://github.com/sa713/cheapshotmods/actions/runs/42992435564), повторяет только необходимые failed jobs на exact source eb655846. Новая публикация/ID/expiry/ZIP+tar hashes должны быть сверены заново; archives разных сборок не подменяются. После этого завершаются curl update script через прежний private credential, проверка опубликованного kit и передача management. До этого TASK-009 не объявляется готовым устанавливаемым кандидатом.
