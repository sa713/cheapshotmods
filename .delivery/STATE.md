# Состояние управления

## Текущее состояние — 2026-11-11

[TASK-009](tasks/TASK-009.md) — **accepted для технической интеграции кода**; [независимая проверка и решение management](reviews/TASK-009-review.md). Подтверждённых блокирующих дефектов нет. [PR10](https://github.com/sa713/cheapshotmods/pull/10) интегрирует код в main; фактическое merge/HEAD читать из GitHub.

Отдельный reviewer проверил app/rules/API, получил110/111native (все15новых прошли); один прежний тест и запуск Chromium остановлены ограничениями песочницы. Management непосредственно прочитал exact runtime CI logs:111native/58Chromium и вычислительные Debian/store steps прошли, jobs verify/debian-kit остаютсяfailure на quota. Собственный build совпал с паспортом по30compiled/11deploy;14image-proof/4ingress проверки и7synthetic parser fixtures прошли. Это разные области доказательств, не один полный независимый end-to-end прогон.

Исходный runtime остаётся **eb655846db16f3dbc6afdb8ca9f9ad4d710848b0**, проверенная передача **e783009b070cecfa83c7995ea35879df76d24ba4**. Управляющая актуализация меняет только документы, не runtime/operator/kit bytes. Закреплённый стандарт1.1.0 сохранён; новых Actions/Actions artifacts/расходов нет. При интеграции — **[skip ci]**.

Точный CCC tar и приватный delivery commit указаны в [NEXT-STEPS](TASK-009-NEXT-STEPS.md). Management сверил manifest/tree/operator pin; полный132MBbinary roundtrip и real operator lifecycle остаются авторскими проверками. Новая полная Docker-store matrix CCC не выполнена; это не successful matrix и не принятая область. Management разрешил включить проверенный source; доставка остаётсяpending с обязательным loaded config/layers gate на целевом Docker **до app stop/data**.

**Следующий ответственный — владелец:** выполнить готовый root update/check/rollback блок [TASK-009-NEXT-STEPS](TASK-009-NEXT-STEPS.md) и вернуть receipt/check/результат живых сценариев. SSH identity/agent у management/developer не предоставлены; настоящий сервер этой проверкой не менялся. Неизвестный installedSHA, недостаток места, HTTPS/import/proof failure останавливают update без обходов. Устанавливать TASK-008 предварительно не требуется.

- technical_acceptance: **accepted для code/integration**, границы — в review.
- integration: по факту [PR10](https://github.com/sa713/cheapshotmods/pull/10), завершает management.
- delivery_package: **prepared**, точный кандидат и авторские lifecycle proofs сохранены.
- installation / product_acceptance / delivery: **pending**; задача не done.
- Последнее подтверждение: **2026-11-11**, независимый code review, собственные проверки management и первичные GitHub logs.

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
