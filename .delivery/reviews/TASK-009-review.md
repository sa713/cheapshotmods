# TASK-009 — независимая проверка и решение management

Дата: 2026-11-11. Репозиторий: sa713/cheapshotmods, [PR10](https://github.com/sa713/cheapshotmods/pull/10).

## Решение и область

**accepted для технической интеграции исходного кода PR10 в main.** Подтверждённых дефектов, требующих исправления, не найдено. Это не done, не подтверждение установки и не утверждение о полном независимом прогоне передаваемого Docker-архива на всех backends.

- База: `cf1e0cd531dad2f19f98a2069410f096f1b3d3d6`.
- Runtime/source: `eb655846db16f3dbc6afdb8ca9f9ad4d710848b0`.
- Проверенный HEAD передачи: `e783009b070cecfa83c7995ea35879df76d24ba4`.
- Кандидат установки: tar SHA256 `1487bedc2d7c1cf18b4b1d336ca87a72a2fe1d3b007e9a39c86b29ecf81e08c6`,132005139байт, app config `sha256:ccc2ffc10c50c9968433243e23ed652e610dc7a42a84642459cb1622a29ac520`.
- Operator: SHA256 `89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e`.

Независимую проверку app/rules/API выполнила отдельная сессия **pr10_code_review**, не реализовывавшая изменение. Управляющий отдельно проверил provenance, фактические GitHub jobs/logs, compiled hashes, установочный helper, транспортный manifest и границы доставки. Согласие с автором не использовалось как доказательство. Исходный код при проверке не исправлялся.

## Самостоятельно проверено

Снимок153файлов получен из GitHub connection; каждый проверен по Git blob SHA exact HEAD. Source/rules/UI/tests/build files относительно runtime не изменены; поздние изменения README/.delivery включают **исполняемый owner operator и его тесты**, а не только prose.

Независимый reviewer прочитал исходную потребность, TASK-009, инструкции и связанные code paths:
- Все native select заменены общим combobox/listbox. Открытый popup находится внутри dialog; активный и выбранный варианты разделены, навигация не применяет значение до подтверждения.
- SQL keyset упорядочивает весь набор до LIMIT; числовой TEXT сравнивается точно по длине/цифрам. Comparator соответствует SQL, неизвестный крит отделён от нуля.
- Только green-667/green-788, выход ordinary🅾1.0/10 или12, цена28×n. Сервер использует полный work, свободные прежде надетых; original/baseline сохраняются.
- Применение идёт через существующую транзакцию/batch ledger. Новые тесты проверяют undo, exact retry, KEY_REUSED, stale, concurrency, ошибки после частичного списания и сохранность данных.
- Изменения workflows сохраняют вычислительные проверки; uploads перенесены после них, подключён новый predecessor harness. Не скрыт failure из-за quota.
- Просмотрены первичные PNG автора: [modal360](../evidence/TASK-009/modal-open-type-360.png), [recipe390](../evidence/TASK-009/green-open-recipe-390.png), [long source390](../evidence/TASK-009/long-source-menu-390.png). Открытые меню соответствуют теме, читаемы и помещаются; это не новый запуск браузера.

Фактические независимые запуски на закреплённых Node24.22.1/npm11.9.0:
- npm ci: success,220packages.
- npm run typecheck, npm run lint, npm run build: success.
- npm test: **110/111 passed**, включая все15новых native/API тестов с реальными SQLite/HTTP.
- Единственный failure — прежний database-path тест запуска main на0.0.0.0. Причина отдельно воспроизведена: os.networkInterfaces/Fastify logServerAddress получают `uv_interface_addresses … Unknown system error1` в песочнице. Это ограничение среды, не подтверждённый дефект PR. Полный111/111 здесь не заявляется.
- npm run test:browser остановился до тестов по тому же ограничению; прямой Chromium также отказал в socket() с Operation not permitted/exit134. Нового независимого browser run нет, ограничения не обходились.

Управляющий самостоятельно сравнил production build с сохранённым паспортом: **30 compiled +11 deploy hashes совпали**. Новые tests/runtime не подменялись. Прогнаны **14 image-proof**, **4 ingress-config** проверки; Python AST и shell syntax нового operator/bootstrap/rollback/tests корректны. SHA256/17659байт operator совпали с pin; опубликованный блок NEXT-STEPS буквально совпадает с TASK-009-update.sh.

Дополнительная временная диагностика parser helper:7малых синтетических fixtures (валидный transport, tampered manifest/part, неполнота, duplicate, traversal внешнего/внутреннего tar) прошли. Только fixture identity constants заменялись в памяти; Docker вызов из synthetic fixture не исполнялся. Это проверка логики parser, **не** проверка132MBкандидата.

## Первичные CI, изученные management

Новых Actions не запускали. GitHub API и полные job logs на exact runtime подтвердили:
- [verify job130440743126](https://github.com/sa713/cheapshotmods/actions/runs/42992435585/job/130440743126), attempt2:111/111native,58Chromium, typecheck/lint/build, negative pipeline и capacity прошли; upload упал с Artifact storage quota has been hit, job **failure**.
- container-smoke job130440744981: **success**.
- [debian-kit job130440796592](https://github.com/sa713/cheapshotmods/actions/runs/42992435564/job/130440796592): fresh/external install,7predecessors и real classic/containerd/reverse-export steps **success**; proof uploads failure, kit upload skipped, job **failure**.

Из log подтверждено, что CI app config `sha256:148edf44878acff5d856c39739398dbedc2a9a55ceaa390321316397f544dec8` отличается от передаваемого CCC. Успешная CI matrix подтверждает код/процедуру того же runtime, **не** exact bytes локального CCC tar. Числа111/58 здесь относятся к первичным CI, а не к независимому локальному прогону reviewer.

Разовое разрешение владельца заменить Actions/канал artifacts сохранено в [карточке](../tasks/TASK-009.md#разовый-маршрут-по-прямому-разрешению-владельца--2026-11-11). Failed jobs не переименованы в успешные.

## Доставка и оставшиеся проверки

Независимо прочитаны delivery tree и manifest commit `1a15be22d1e00d50542090786c47e15a76151d18`:32parts существуют, длины совпадают и суммируются в132005139. SHA256 manifest совпадает с pin `b1138a4772cb0b268c1c164e1d4ff8122ce2d26247120fce5582f096ad62c86a`. Повторного независимого скачивания/сборки всего бинарного архива не было: доступный connector не возвращает bytes4MiBчастей, обычный git не имеет CLI credential. Авторский реальный download/reassembly и Debian operator lifecycle остаются **авторскими доказательствами**, подробно проверенными по коду воспроизводителя и [proof](../evidence/TASK-009/owner-helper-integration.json).

Helper сохраняет root/private credential/actual installedSHA/HTTPS/disk guards, fresh backup, отдельную новую data volume и проверку после переключения; post-check failure возвращает прежнюю подтверждённую image+volume пару. Secrets в argv/отчёт не добавлены. У неизменённого installer load_images/loaded crypto proof выполняются **до app stop и копирования/миграции данных** (deploy/chm.sh:301 перед307–310). Bootstrap сверяет pin до исполнения; check/rollback затем работают локально.

Полная новая classic/containerd/reverse matrix для CCC tar **не завершена**, blocked ограничениями Docker/cgroup среды автора; в среде reviewer Docker CLI также отсутствует. Никакой новой successful matrix для CCC этот отчёт не устанавливает. Полный независимый end-to-end operator/Docker lifecycle не выполнен здесь.

**Решение management:** это ограничение не блокирует интеграцию проверенного исходного кода в main. Техническое принятие кода не распространяется на недоказанную переносимость конкретного архива на всех backends. Основание — независимые app/API проверки, первичные exact-source CI/portability, совпавшие compiled/deploy bytes, сохранённые авторские CCC lifecycle и fail-closed барьер до остановки приложения. Внешняя доставка остаётся **pending**; gate на фактическом целевом Docker обязателен, не считается уже пройденным и не обходится. При отказе import/proof/места/HTTPS обновление не продолжать; требуется диагностика по факту, а не повторение команд или ослабление guard.

Management использует делегированные карточкой полномочия только на GitHub-интеграцию; новый риск потери данных/изменение server/proxy/расходы этим решением не разрешаются. Delivery-only binary ref в main не сливается. Новые commits/merge сохраняют [skip ci], workflows/settings не меняются.

## Следующий шаг

Management завершает PR10→main с проверкой ожидаемого HEAD и результата. Затем владелец выполняет [готовый операторский блок](../TASK-009-NEXT-STEPS.md); он проверяет actual serverSHA/HTTPS/место и imported config/layers до остановки. Нужны фактический receipt/runtime/check и живые сценарии меню/порядка/обоих рецептов/undo. До этого installation, product_acceptance и delivery **pending**, TASK-009 не done. Реальные Debian/БД/proxy/BotFather этой приёмкой не изменялись.
