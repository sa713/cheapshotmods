# TASK-009 — пакет для независимой приёмки management

Поручение developer выполнено до передаваемого установочного шага. Это **авторский handoff**, не независимое review и не подтверждение server update. Reviewer/решение о технической приёмке остаются у management.

## Точные объекты

- PR: [10 → main](https://github.com/sa713/cheapshotmods/pull/10), существующая ветка `chm-009-dropdowns-green-recipes`.
- Runtime/source: **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**. Исполняемые app/rules/deploy/root tests/workflows/lock/пакет стандарта после него не менялись. Поздний HEAD содержит README/.delivery: owner operator, его тесты, документы и доказательства.
- Исходный сохранённый kit:132005139 байт, tar SHA256 **1487bedc2d7c1cf18b4b1d336ca87a72a2fe1d3b007e9a39c86b29ecf81e08c6**. App config **sha256:ccc2ffc10c50c9968433243e23ed652e610dc7a42a84642459cb1622a29ac520**; пересборки не было.
- [Приватный delivery snapshot](https://github.com/sa713/cheapshotmods/tree/1a15be22d1e00d50542090786c47e15a76151d18): commit **1a15be22d1e00d50542090786c47e15a76151d18**, ref `delivery/task-009-eb655846-1487bedc`, manifest SHA256 **b1138a4772cb0b268c1c164e1d4ff8122ce2d26247120fce5582f096ad62c86a**. Это транспортные данные; не merge в main.
- Новый [owner operator](TASK-009-install.py): SHA256 **89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e**, Git blob **c3828438fab992b6cd84b5ddf7392a358a378349**,17659 байт. Он отдельно проверен;111 native/58 browser не выдаются за тесты этого нового Python-кода.

## Маршрут и реальные результаты

Владелец прямо разрешил TASK-009 без новых Actions/Actions artifacts/ожидания квоты/платных услуг. [Разовое решение в карточке](tasks/TASK-009.md#разовый-маршрут-по-прямому-разрешению-владельца--2026-11-11). Стандарт 1.1.0 не обновлён, workflows не отключались. Исторические jobs verify/debian-kit остаются **failure** на upload quota, несмотря на успешные вычислительные шаги. Это не зелёный CI.

[Матрица provenance](TASK-009-PRIVATE-DELIVERY.md): прежние локальные 111 native/58 Chromium/typecheck/lint/build/capacity/negative и exact source CI steps переиспользованы без бессмысленного повторения. Новые проверки относятся к сохранности/реальному download/reassembly exact kit и новому owner route.

Скачивание private Git snapshot реально выполнено, все 32partSHA иисходные tarbytes совпали: [receipt](evidence/TASK-009/private-transfer.json). Новый bootstrap реально скачал private Git blob и проверил hash до исполнения; повтор с локальным correct helper работал без credential/download, изменённый локальный файл отвергнут: [proof](evidence/TASK-009/bootstrap-integration.json).

На настоящем изолированном Debian13/rootless Docker 29.9.2vfs проверен новый operator canonicalTASK-008/schema 6→TASK-009/schema 6 через реальное private download и HTTPSCA/IP SAN. Все строки семи игровых таблиц совпали после update, обычного rollback и аварийного rollback; config, отдельный b008 и proxyID/image/mounts сохранены. Проверены backup/newvolume, оба рецепта/undo, отказы unknownSHA/unsafecredential/lowspace/alreadyinstalled. [Proof с SQL hashes](evidence/TASK-009/owner-helper-integration.json), [reproducer](tests/TASK-009-operator.sh). Негативы нового транспорта — [4 случая](evidence/TASK-009/delivery-negatives.json).

## Существенная граница Docker-store evidence

Полный exact local CCC classic/containerd/reverse harness в Codex остановился **до image import**, потому что managed rootless environment не разрешает cgroup init ивложенный UID map. [Отчёт](evidence/TASK-009/codex-store-bootstrap-limitation.json). Он не считается успешным прогоном. Прежние полные real Docker 29.8 CI матрицы этого source относятся к **другим config/archive bytes**; сохранить это различие при приёмке. Собственный exact CCC canonical lifecycle, format2 crypto,11 deploy/30 compiled comparison иновый real owner lifecycle прошли на classic/vfs.

Management/reviewer должен явно оценить эту границу. Штатный unchanged installer на фактическом Docker Debian проверяет loaded config/ordered layers **до app stop/копирования данных**; не отключать этот gate. При неподдерживаемом import/proof он откажет, сохранив рабочий source/данные. Нельзя записать новый successful containerd run без фактического исполнения.

## Как получить и независимо проверить без сервера владельца

Для reviewer Codex с обычным разрешённым GitHub connection:

```bash
curl --disable --fail --silent --show-error --location \
  --output /tmp/task009-private-snapshot.tar.gz \
  https://api.github.com/repos/sa713/cheapshotmods/tarball/1a15be22d1e00d50542090786c47e15a76151d18
mkdir -m 700 /tmp/task009-review-verified
python3 -I .delivery/TASK-009-install.py verify-delivery \
  /tmp/task009-private-snapshot.tar.gz /tmp/task009-review-verified
```

Вне broker-среды нужен существующий private curl credential с Contents Read-only; значения не помещать в чат/argv. Проверка reassembly не требует root иничего не устанавливает. Внешний GitHubsourcearchive нельзя передавать напрямую chm.sh: сначала восстановить и сверить исходный установочный tar. При своём изолированном Docker reviewer может воспроизвести новые operator tests с canonicalTASK-008 kit и проверить compiled bytes относительно source eb.

## Решение и следующий шаг

После независимой приёмки фиксировать решение для **этого tar/source/operator**. Код/архив после принятия не подменять. [Полный готовый owner block](TASK-009-NEXT-STEPS.md) переносит 17 KBpinnedoperator и весь kit через прежний credential; проверяет актуальный serverSHA/HTTPS/место, свежий backup, update, SQLintegrity и рабочий rollback. SSH identity/agent developer не предоставлены, настоящий сервер не изменён. Живые Telegram/телефон/product acceptance подтверждает владелец отдельно.

Интеграцию PR10 завершает management, developer не сливает. По прямому поручению **не запускать Actions**: все новые commits/merge/squash должны сохранить **[skip ci]**. Это scoped exception TASK-009; постоянные workflows/защиты/стандарт не менять. После owner выполнения нужны его фактический receipt/source/check и результат пользовательской проверки, а не лишь HTTP200 или этот handoff.
