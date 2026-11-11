# Состояние управления

## Текущее состояние — 2026-11-11

[TASK-009](tasks/TASK-009.md) — **review**, ветка `chm-009-dropdowns-green-recipes` / [PR10](https://github.com/sa713/cheapshotmods/pull/10) в main. Runtime **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**; app/rules/deploy/root tests/workflows/lock после него не менялись. Новая передача добавляет README/.delivery: отдельно проверенный owner operator, его tests, документы и доказательства. Стандарт 1.1.0 не обновлялся.

Владелец прямо заменил для TASK-009 Actions jobs соответствующими проверками Codex, а Actions artifacts — доступной приватной передачей, без ожидания квоты и платных услуг. [Разовое решение](tasks/TASK-009.md#разовый-маршрут-по-прямому-разрешению-владельца--2026-11-11). Исторические failure quota/CI сохранены; новых Actions runs нет, workflow/settings не отключались.

Сохранённый exact local tar **1487bedc2d7c1cf18b4b1d336ca87a72a2fe1d3b007e9a39c86b29ecf81e08c6**, 132005139 байт, app config CCC повторно сверён без пересборки. Реальный private download и reassembly всех 32 частей прошёл: [delivery commit 1a15be22d1e00d50542090786c47e15a76151d18](https://github.com/sa713/cheapshotmods/tree/1a15be22d1e00d50542090786c47e15a76151d18). Прежнего Contents Read-only достаточно. Это не локальный путь и не Actions artifact.

Прежние 111 native / 58 Chromium/capacity/negative и exact source CI вычислительные результаты переиспользованы, не названы новыми запусками. Новый owner helper/SHA256 89d1f329 отдельно прошёл real Debian 13/HTTPS/private download/update/backup/оба recipe/undo, полные SQL hashes всех 7 игровых таблиц, обычный и аварийный rollback. Config, отдельный b008 и proxy ID/image/mounts сохранены. [Provenance и ограничения](TASK-009-PRIVATE-DELIVERY.md), [owner proof](evidence/TASK-009/owner-helper-integration.json).

Полный exact local CCC classic/containerd matrix не запустился в Codex из-за cgroup/UID-map restrictions. Это не success. Старые successful real Docker 29.8 CI матрицы этого source относятся к другим archive/config bytes и остаются отдельным доказательством кода. Management должен оценить границу; unchanged installer обязательно проверяет loaded crypto на целевом Docker до stop/data. [Ограничение](evidence/TASK-009/codex-store-bootstrap-limitation.json).

Следующий ответственный — **management**: [пакет для независимой приёмки](TASK-009-MANAGEMENT-HANDOFF.md). После приёмки — **владелец** по [готовому root update/check/rollback](TASK-009-NEXT-STEPS.md). SSH identity/agent developer не предоставлены, настоящий сервер не изменялся. Его актуальный SHA, место и HTTPS проверяет operator до обновления. Предварительная установка TASK-008 не нужна. При интеграции сохранять **[skip ci]**; новых Actions или постоянных изменений CI/стандарта не поручено.

- technical_acceptance: **pending, independent management/reviewer**.
- delivery_package: **prepared, private Git transfer roundtrip verified**.
- installation: **pending owner execution after acceptance; exact commands ready**.
- product_acceptance/integration: **pending**.
- Последнее содержательное подтверждение: **2026-11-11**, изменение маршрута владельцем, сверка неизменного архива и новый изолированный operator lifecycle. Это не независимое review или реальный server update.

TASK-001–008 в main; их kits/reviews сохраняют собственные SHA. Текущий serverSHA не предполагается по прежнему сообщению о работоспособности.

## Предыдущий технический этап — 2026-11-09

[TASK-008](tasks/TASK-008.md) — **accepted, интегрирована в main** через [PR9](https://github.com/sa713/cheapshotmods/pull/9), merge `db2f43ada73aa14af19d6b1e5ffb2ff25608724b`. Зафиксированный исходный набор, явная замена снимка и отдельный полный возврат реализованы; прежняя кнопка сброса эксперимента сохранена.

На завершении TASK-008 активных реализаций не было. TASK-001–008 и исправление группировки включены в main; новая активная TASK-009 указана выше.

## Техническая приёмка TASK-008

Проверенный runtime и источник неизменяемого комплекта — `0f2cd90c5b672d67409c2687e4e90a8ce9797482`, schema 6. Management изучил [независимое accepted review](reviews/TASK-008-review.md), [доказательства](TASK-008-VALIDATION.md) и точные GitHub runs/jobs/steps: [verify + container-smoke](https://github.com/sa713/cheapshotmods/actions/runs/42532270563), [debian-kit](https://github.com/sa713/cheapshotmods/actions/runs/42532270571). Все обязательные проверки завершены success. Подтверждены 96 native / 47 Chromium, шесть переходов с прежних версий, резервное копирование/восстановление/парный откат и переносимость между Docker stores. Это изученные CI/reviewer доказательства, а не повторные локальные запуски management.

Метаданные artifact **13637904971** сверены через GitHub API: source совпадает, artifact не истёк, expires **2026-12-08T23:11:21Z**, ZIP SHA256 `137d70277d444e5466af98b31f9c060e137b46cea59a09d64ab330f97cba5537`. [Готовый комплект и операторские команды](TASK-008-NEXT-STEPS.md) сохраняют этот source; SHA последующих управляющих документов не подменяет источник уже собранного комплекта.

Runtime → передача `5bbf615fd10dd65083f00853494e7846f896286c` меняет только `.delivery`; передача → merge не меняет дерево. Управляющая актуализация меняет только README и документы состояния, очереди, задачи, паспорта и эксплуатации. Функциональные исходники, тесты, deploy, workflows и lock-файл сохранены.

После слияния фактически завершён [main CI42565774435](https://github.com/sa713/cheapshotmods/actions/runs/42565774435) на merge `db2f43ada73aa14af19d6b1e5ffb2ff25608724b`: verify, container-smoke и все их обязательные шаги **success**. Текущий статус последующих управляющих коммитов доступен в GitHub Actions; этот запуск относится именно к merge.

## Незавершённая внешняя приёмка TASK-008

- technical_acceptance: **accepted**.
- integration: **completed**, PR9 merged.
- product_acceptance: **pending** для TASK-008.
- delivery: **pending** для TASK-008.

Владелец сообщил о реализации доработки и поручил актуализировать репозиторий. Установка именно TASK-008 на целевой Debian и живые сценарии телефона/Telegram этим сообщением не подтверждены. Для проверки именно версии TASK-008 сохранена [TASK-008-NEXT-STEPS](TASK-008-NEXT-STEPS.md); она не является обязательной промежуточной установкой перед будущей TASK-009. Management серверных команд не выполнял. Открытых блокеров технической интеграции нет.

## История GitHub и границы полномочий

Полный код TASK-001–007 ранее включён в main через [PR8](https://github.com/sa713/cheapshotmods/pull/8), merge `3ffeca3f50c8950d169b928601e16aa770c96221`, с сохранением продуктовой истории. PR1, PR8 и PR9 merged; PR3–7 закрыты как вошедшие через PR8. PR2 остаётся исторической диагностикой, его отдельный workflow не переносился. Старые завершённые ветки сохранены как история и не являются базой для новых задач.

Сообщение владельца от 2026-11-08 о работоспособности установленного Debian-сервиса относится к прежней установке; точный серверный SHA в нём не указан. Повторная установка старого комплекта ради порядка на GitHub не требуется.

Поручение и карточка TASK-008 разрешают техническую приёмку, слияние и управляющую актуализацию в main. Реальный Debian, БД, общий proxy, BotFather, доступы и публичность репозитория не изменялись; новые расходы не поручены. Исторические отчёты, комплекты и ограничения внешней приёмки сохранены.
