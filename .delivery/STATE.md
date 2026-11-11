# Состояние управления

## Текущее состояние — 2026-11-11

[TASK-009](tasks/TASK-009.md) — **implementing**, ветка `chm-009-dropdowns-green-recipes`/[draft PR10](https://github.com/sa713/cheapshotmods/pull/10) вmain. Стартовый HEAD `23430c6873f02c6709ff68c47e2e6fbaf0907e8e` подтверждён; стандарт1.1.0/source2ff5fe41 не изменён. Runtime/source **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0** реализует общий themed combobox, глобальный порядок до пагинации и два зелёных рецепта с server-side stock/atomic undo/retry.

[Авторская проверка](TASK-009-VALIDATION.md):111native,58Chromium, typecheck/lint/build, capacity/negative и собственный canonical TASK008→local TASK009 Debian update/backup/restore/rollback прошли. Schema6 сохранена; actual old TASK008 binary на копии прочитал новую green историю и отменил её. Original/snapshot/прежний reset/старые receipts сохранены. Это самопроверка, не независимое ревью.

Exact CI eb655846: verify111/58/capacity/negative и container-smoke прошли; kit build/fresh/external/7predecessors/classic/containerd/reverse-export прошли. В attempt1 upload proofs/browser был отклонён `Artifact storage quota has been hit`, kit upload skipped; verify/debian-kit поэтому failure. [Шаги CI](evidence/TASK-009/ci-jobs-attempt1.json). Опубликованного CI kit TASK009 пока нет. Local immutable kit не подменяет CI archive.

Владелец отдельно разрешил удалить ровно21неканонический artifact по конкретному списку; [HTTP204receipt и сверка оставшихся168](evidence/TASK-009/storage-cleanup-approved.json). Канонические kits и все proof artifacts сохранены. После очистки запрошен rerun-failed-jobs для обоих runs на том же source. Attempt2 verify130440743126 снова прошёл111/58/negative/capacity, но upload вновь отклонён той же quota error; kit130440796592 ещё выполняется. Container-smoke130440744981/success присутствует в метаданных attempt2. Квота может пересчитываться6–12ч, достаточность очистки не предполагается. Дополнительные удаления/расходы не поручены.

Следующий шаг developer — проверить attempt2, сверить опубликованный exact archive, завершить owner-команды и передать review management. До этого criterion10/delivery блокированы квотой публикации. Management затем организует отдельное независимое ревью и разрешённую интеграцию. Developer reviewer не запускает, PR не сливает; настоящий сервер/БД/proxy/BotFather не меняет.

- technical_acceptance TASK-009: **pending**.
- product_acceptance TASK-009: **pending**.
- delivery TASK-009: **pending, CI artifact publication blocked**.
- Последнее содержательное подтверждение: **2026-11-11**, самопроверка/изученный exact CI и отдельное разрешение владельца на узкую очистку artifacts.

TASK-001–008 уже вmain. Прежние exact kits/reviews ниже сохраняют исторический смысл; установка TASK008 и точный текущий серверный SHA не подтверждены и не являются предварительным условием разработки TASK009.

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
