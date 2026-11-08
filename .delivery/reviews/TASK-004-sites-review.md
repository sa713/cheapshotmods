# TASK-004 Sites / PR5 — независимая техническая проверка

- Репозиторий: sa713/cheapshotmods; [PR5](https://github.com/sa713/cheapshotmods/pull/5), [задание](../tasks/TASK-004.md), [исходные требования](../../PRODUCT.md).
- Проверенный source HEAD: **6dc8021e58daa9aa16a93a9265315bb810fe9d0a**. PR повторно прочитан через GitHub: open, не слит; target `chm-003-external-proxy`, base **d7cc4d7b051c9eebfc10fed251ea787ad717f05e**.
- База именно изменения оформления: **05e4cafc18a4688a593475f7d82571a63ea6b6b2** — завершённая функциональная группировка 19a/9a вместе с постановкой d7. Поэтому полный PR также содержит прежнюю зависимость PR4; утверждение «только frontend» относится к diff 05e4caf→6dc8021.
- Reviewer: отдельный контекст Codex `sites_design_review`, 2026-11-07. Реализацию и продуктовые тесты не изменял; собственные диагностические файлы находились только в `/tmp`. Прочитаны AGENTS, закреплённый ai-development 1.1.0/2ff5fe4, START/WORKFLOW/reviewer/QUALITY, паспорт, PRODUCT, TASK-004 и frozen reference.
- **Заключение: accepted** для технического кандидата frontend и указанного immutable Linux/amd64 kit. Продуктовое принятие оформления и фактическая установка владельцем остаются pending. Это заключение не является наблюдением production, разрешением на merge или установкой на сервер.

## Собственное независимое исполнение

Detached worktree `/workspace/cheapshotmods-sites-review` на точном 6dc8021; Node24.22.1, npm11.9.0, Chromium/Playwright. После проверок отслеживаемые файлы чистые. Реальные HTTP/Fastify/SQLite и production auth-код использовались с изолированными криптографическими Telegram/OIDC фикстурами; это не живая Telegram-интеграция.

| Область | Собственная проверка и результат |
| --- | --- |
| Scope и сохранность | `git diff` 05e4caf→HEAD: production только main.tsx/style.css/new presentation.tsx; новый presentation.spec.ts и связанная документация. Server/rules/auth/API/DB/deploy/installer/CI/package/lock, прежние browser-тесты, frozen reference и прежние отзывы/команды побайтово не изменены. Прочитаны transport/load/send/choose, валидация и новые презентационные компоненты. |
| Общая регрессия | `NPM_CONFIG_CACHE=/tmp/chm-npm XDG_CACHE_HOME=/tmp/chm-cache bash scripts/verify.sh` — npm ci, typecheck, lint, **41/41 tests**, build; 0 fail/skip. |
| Браузер и S-01–S-06 | `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser` — **20/20 passed**, 1.4m. Включены прежние 14 сценариев: точные числа, все цены/tier, grouped CRUD, source/work isolation, массовая экипировка и лимит100, worn/unworn craft, последовательный undo/reset/уровень, сохранение/reload, потерянный ответ с тем же ключом, конфликт, SQLite error, expiry/logout/CSRF/account binding и миграция прежних групп. |
| Внешний вид | Собственным прогоном получены **21 пара app/reference PNG** и три comparison.html: inventory/equip/craft/editor/reset/error/empty на1440/360/390. Осмотрены desktop/mobile состояния и длинные числа. Узнаваемы палитра, sidebar, основные колонки, персонаж/расход, emoji-карточки, tier, три входа/результат/цена и modal surface. Честные подписи загруженных групп, дополнительные действия и читаемые ≥44px controls объясняют большую высоту относительно мелкого эталона. Для reset/error HTML эталона дополнен только в reference browser из frozen CSS; эти два состояния не выдаются за исходный DOM Sites. |
| Дополнительная клавиатура | Отдельная reviewer-фикстура: все четыре modal типа на360/801/1440, по24 Tab и24 Shift+Tab, Escape, возврат к trigger, shell inert/ARIA, отсутствие background buttons в accessibility tree и отсутствие изменения revision от клика по backdrop — passed. Переход «Крафт» фокусирует панель; DOM и визуальный порядок list→craft совпадают. |
| Дополнительные числа/layout |128-значные level/value/quantity, производные длинные stats и129-значный craft preview проверены на360/390/640/641/800/801/1000/1001/1190/1191/1500/1501. Нет горизонтального overflow, текстовые Range остаются в viewport, controls≥44px. Полный readout входных чисел доступен; округления через Number и CSS-обрезки точных значений не обнаружены. |
| Дополнительная экипировка/конфликт |105 групп tier2: надетая группа вне первой страницы → корректное отклонение101 → конфликт в equip modal → загрузка актуального состояния внутри modal с сохранением введённых4 → equip4 → Load more → craft с точным payload quantity3/worn3 → undo → reset с сохранением уровня200 — passed. |

Дополнительные проверки исполнялись через `/tmp/chm-sites-review-diagnostics/playwright.config.ts` и `reviewer.spec.ts`, результаты — `/tmp/chm-sites-review-diagnostic-results` и `...-rerun`. В первом прогоне третьей проверки reviewer ошибочно подготовил запас10 для запроса101: приложение корректно ответило нехваткой экземпляров. Исправлена только временная фикстура на1000; целевой повтор прошёл. Продуктовый код и assertions репозитория не менялись. Порты3099–3101 после запусков освобождены.

## CI и самостоятельно проверенные артефакты

GitHub metadata и логи reviewer прочитал самостоятельно, включая checkout точного6dc8021 и фактические результаты; зелёный статус не заменял собственный запуск.

- [Checks run42396981634](https://github.com/sa713/cheapshotmods/actions/runs/42396981634): jobs `verify`128476349161 и `container-smoke`128476349027 success. Лог verify подтверждает41 native/20 browser; обязательные шаги не skipped.
- [Kit run42396981568](https://github.com/sa713/cheapshotmods/actions/runs/42396981568): job `debian-kit`128476349077 success; operator/proof negatives, standalone Debian install, external ingress, реальная classic/containerd матрица и uploads завершены успешно. Docker-исполнение этих CI jobs не называется собственным Docker-запуском reviewer.
- Browser artifact **13583313770**,11,444,301 bytes, ZIP SHA256 `d3225fa31bd8be06c6646c7da4ed47e3c1566bca7c4c556cda593716dce103a9`, expires2026-11-21. В нём находятся comparison.html/PNG из exact-SHA browser workflow. Визуальный осмотр reviewer выполнялся на собственных локальных результатах того же SHA.
- Kit artifact **13583903966**,131,905,126 bytes, expires **2026-12-07T17:51:04Z**. Reviewer независимо скачал его через GitHub plugin и проверил ZIP SHA256 **b29d9ba8fe17c2c1c2e85a6fc1a385b5cd965b367e240931aadd2a50976af740**, два ZIP members, tar SHA256 **2adb57e77465cac923b6473e2c938d57e664a280203dc2fbe729fd4ad38a53e0**, все **13/13 SHA256SUMS**, format2/source/platform/revision и полный `image-proof.py archive` config/ordered-layer proof — passed.
- Reviewer без запуска Docker разобрал runtime layer образа. Его три frontend-файла побайтово совпали с собственной сборкой6dc8021: CSS `56392be793e25c2c181850ca748dfbb29d4a256ffd6b4600e119ade025889a42`; JS `c5ed587526a4840a284d1be405724bccc5bd544b8b2338cf3c2715edbe4f8e86`; HTML `69c4c5297266834a72cd22c34ab4ac569f440e716cb42faf2e0939cdbc6afb38`.
- Store evidence artifact **13584103525** независимо скачан, ZIP SHA256 **0908811a9e53ba6d3be56f6f95d090dbfc5b64e60b6af9df323c1f3645ea91de** проверен. Собственный разбор summary/classic/containerd/containerd-to-classic подтвердил Docker29.8.0 vfs и native `io.containerd.snapshotter.v1`, разные daemon-native IDs, одинаковые config/упорядоченные8 app+5 proxy layers/platform и восстановление classic IDs после обратного импорта. Во всех наблюдениях один input images archive SHA256 **33b1d064bb4fbbb2f1c3305418aa829734f56f4c164c923907a55a4b5391e8c8**, совпадающий с реально скачанным kit. CI log дополнительно содержит итоговую строку успешной real cross-store matrix.

Собственные файлы проверки архива: `/tmp/chm-sites-review-kit.zip`, `/tmp/chm-sites-review-kit`, `/tmp/chm-sites-review-stores.zip`, `/tmp/chm-sites-review-stores`, `/tmp/chm-sites-review-archive-proof.log`. Это локальные рабочие доказательства; долговечные источники — указанные GitHub runs/artifacts.

## Дополнительные Docker-проверки автора и инструкция владельцу

Reviewer прочитал fixture.py/api.cjs/run.sh и самостоятельно проверил JSON, соответствующие логи и хеши **двух авторских** изолированных запусков canonical predecessor kit→canonical6dc→rollback. Сам эти Docker-запуски не повторял.

- FBE **fbe82aef6008d292515c0efce2fde601c221f3d2**, schema2→3: proof SHA256 `98f7d229272b2dead2dbcc3f04fbf8ef4128d29c8939a03943169b6f4d4a0573`.
- **19a6fdde785eb90b01bd78318deeab1a539dde7b**, schema3→3: proof SHA256 `1c9011410dae9c6dab0dbc03666b97153ce93841562955242b4d4b4ac44dce70`.

Оба proof/log подтверждают новый отдельный volume, сохранение config/отдельного operator, receipts и stale revision, крафт надетых/все undo/reset, точный возврат прежних image+volume/raw state/schema/assets и restart после rollback. Новый CSS/JS совпадает с независимо разобранным kit. Ветвление проверки осмысленное: FBE migration rev+1 и отказ старого image читать **копию** schema3; для19a initial snapshot/revision сохранены, старый image читает копию schema3. Fixture обращается к localhost внутри изолированного app; публичный owner origin используется только как HTTP header, не как сетевой адрес назначения.

Материалы автора: `/tmp/chm-sites-upgrade/proof-fbe.json`, `proof-19a.json`, `run-fbe.log`, `run-19a.log`. Первый ошибочный asset-regex запуск harness сохранён отдельно; исправление относилось к тестовому probe до update, не к продукту.

Постоянные копии proof: [FBE→6dc→rollback](../evidence/TASK-004-sites/upgrade-fbe.json) и [19a→6dc→rollback](../evidence/TASK-004-sites/upgrade-19a.json); reviewer сверил их побайтово с проверенными оригиналами и указанными SHA256.

[Инструкция владельцу](../TASK-004-SITES-NEXT-STEPS.md) прочитана после заполнения реальных artifact/hash/expiry. Guards допускают именно FBE или19a/external→6dc и однонаправленный rollback, используется прежний проектный credential/curl, disk guard и образ+volume сохраняются. Нет поручения менять owner server/BotFather/Docker backend. Две неточности черновика исправлены: schema3 несовместима именно с FBE;409 старой вкладки описан условно, полная перезагрузка рекомендована всегда.

## Находки, ограничения и следующий шаг

Подтверждённых блокирующих дефектов в проверенной реализации и передаваемом kit не обнаружено. Ранее отмеченный разрыв visual/DOM order крафта устранён до проверенного source; независимые прогоны выполнены уже после исправления. Чужие исторические TASK-004-review.md и TASK-004-NEXT-STEPS.md не переписывались.

Не проверены на этом кандидате: физический телефон, настоящий Telegram WebView/живые входы, owner Debian, внешняя сеть/TLS/renewal и соседние сервисы. Screen reader и браузеры кроме Chromium отдельно не исполнялись. Это явно ограниченная техническая приёмка согласованного PR/immutable kit, а не свидетельство нового production-выпуска. Пользовательское принятие выбранного оформления остаётся владельцу после показа/установки; merge не выполнен и не разрешается этим review.

Management/developer передаёт владельцу проверенный кандидат, визуальные материалы и точные команды. При изменении production source после6dc8021 требуется соразмерная актуализация review/CI; это заключение не переносится автоматически на новый код.
