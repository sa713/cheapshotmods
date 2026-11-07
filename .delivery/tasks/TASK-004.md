# TASK-004 — дизайн Sites в основном приложении без изменения функциональности

- Статус: review — frontend/CI/kit проверены, передача точного кандидата; установка и product acceptance владельцем pending
- Риск: обычный — изменение представления всех основных сценариев при сохранении действующей логики, интеграций и данных.
- Решение владельца: 2026-11-07 понравился дизайн отдельной Sites-версии; поручено передать его для реализации в основное приложение, сохранив функционал. Исполнитель — **облачный Codex**, первоначальное упоминание Claude исправлено владельцем как опечатка.
- Репозиторий: https://github.com/sa713/cheapshotmods
- Проверенная исходная ветка: **chm-003-external-proxy**, SHA **a709f5d4dea4946373ea0e7c1f606c5b0a792a5b**. Commit постановки добавляет только документы и неподключённый визуальный эталон. Перед началом прочитать актуальные HEAD/PR/STATE и сохранить новые изменения предыдущей задачи; не делать reset/force ради старой базы.
- PR: [PR5](https://github.com/sa713/cheapshotmods/pull/5), отдельная ветка chm-004-sites-design от актуальной проверенной базы, PR в chm-003-external-proxy. Если предыдущая ветка к тому времени уже интегрирована, выбрать фактическую новую базу по GitHub и записать её; не сливать в main без полномочий.
- Зависимости: использовать функциональную реализацию TASK-002/003 со всеми завершёнными исправлениями R6/R7. Одна активная реализация на репозиторий; не запускать параллельное переписывание, пока предыдущий developer меняет эту же базу. Настройка настоящего Telegram владельцем не требует замены входа ради визуальной проверки.
- Требования: [PRODUCT.md](../../PRODUCT.md), [.delivery/PROJECT.md](../PROJECT.md), действующий контракт UI/API. Зафиксированный эталон: [README](../design/sites-v1/README.md), [HTML](../design/sites-v1/preview.html), [CSS](../design/sites-v1/sites.css), [tokens](../design/sites-v1/tokens.json).

## Цель и границы

Основной мобильный сайт и его Telegram Mini App получают визуальный язык одобренной Sites-версии. Источник поведения — существующее основное приложение. Из Sites переносится оформление и композиция, а не его функциональная реализация.

Сохранить Fastify/React/Vite/SQLite, @chm/rules, Telegram OIDC и подписанный Mini App, текущие API/команды, сессии, CSRF/account preconditions, BigInt/точные числовые строки, исходный и рабочий наборы, сохранение, надетые экземпляры, undo/reset, пагинацию, повторы и конфликты, исправленный installer/external ingress.

Область production-изменений: apps/web/src/main.tsx, style.css, при необходимости выделенные презентационные React-компоненты и локальные SVG/статические ресурсы frontend. Разрешены связанные визуальные тесты/точечная адаптация UI-локаторов и документация. Не менять игровой модуль, сервер, схему БД, auth/API, installer/ingress, CI-защиты, package/lock-файл или стек ради оформления. Если обнаружится необходимое поведенческое изменение, сохранить отдельную находку и продолжить независимую визуальную часть; не исправлять логику скрыто под этим заданием.

Исходный CSS — справочник дизайна: классы основного приложения отличаются, поэтому бездумная замена style.css эталоном не считается переносом. При изменении DOM сохранить существующие обработчики/валидацию/ограничения; допустимы переименованные или выделенные презентационные обёртки и локальное состояние исключительно для управления видами/формами.

## Визуальный результат

- Тёмные графитово-зелёные поверхности, светлый текст, тонкие границы, лаймовый #c5f469 для основного действия и активных состояний.
- Широкий экран: боковая навигация, список/мастерская в основной колонке, заметная карточка персонажа и расход справа. Телефон360/390px: одна колонка, параметры доступны без горизонтального скролла, все действия достижимы без desktop-sidebar.
- Узнаваемые карточки модов с emoji типа, большим параметром, бейджем tier и количеством; оформленные редактор, пустые состояния, подтверждения, loading/disabled, сохранение/ошибки.
- Крафт: три выбранных экземпляра, видимый результат/получаемый tier и цена, понятная отмена/сброс. Действующие дополнительные управления основного приложения сохраняются в том же стиле.
- Согласованные тексты/значения основного продукта предпочтительнее декоративных подписей Sites. Уровень и характеристики берутся из текущего состояния, статус сохранения отражает реальный результат записи.
- Читаемые шрифты/контраст и focus, сенсорные цели не менее44px. Микроподписи8–9px из эталона адаптировать для телефона. Точные длинные целые видны полностью: перенос строк допустим, обрезка/скрытая часть числа — нет.
- Не придумывать новый вариант оформления вместо уже выбранного. Дополнительные работающие функции оформлять совместимо с эталоном.

## Критерии приёмки

1. **Сходство.** При одинаковом демонстрационном наборе сравнить основное приложение с автономным эталоном: инвентарь, примерка/персонаж, тройка и результат крафта, редактор, пустой набор, подтверждение и ошибка. На1440px и360/390px сохраняются палитра, иерархия, карточки, акцент, расположение блоков и характер контролов. Предоставить снимки новой реализации; использовать вымышленные тестовые профили, не настоящие аккаунты/данные владельца.
2. **Функциональная основа.** Без изменения rules/server/API пройти прежние сценарии S-01–S-06 на текущем основном коде. Не добавлять ChatGPT Sign-in, Sites endpoints/D1/Vinext/Cloudflare, demo-команды или модель Sites. Не копировать жёсткие примерные числа в реальные показатели. Никакого анонимного/test входа ради демонстрации.
3. **Не потерять функции при новой компоновке.** Сохранить grouped add/edit/delete любого tier и исходный/work scopes; синхронизацию исходника до начала эксперимента и независимость после начала согласно текущей реализации. Сохранить массовое точное количество в equip, полную экипировку вне загруженной страницы и лимит100; явный выбор надетых и ненадетых экземпляров для крафта с quantity/worn; последовательный undo, reset с подтверждением, сохранение уровня. Упрощённые действия Sites не заменяют более полные действия основного продукта.
4. **Большие наборы.** Работает Load more после первой100-группной страницы, без потерянных действий и ложного «пусто». Нельзя выдавать сумму загруженных страниц за полный размер инвентаря: использовать существующие достоверные summary либо подпись «Загружено групп»/убрать декоративный бейдж. 128-значные входные и производные точные числа не переводятся в Number ради форматирования и не обрезаются CSS. Фильтры, если добавлены для представления, не скрывают существующую пагинацию и явно относятся к загруженным данным.
5. **Сессии и запись.** Сохраняются браузерный Telegram-вход, Mini App bootstrap, cancelled/expired/ненастроенный вход, refresh/logout, реальные saving/saved/error состояния. Pending-команда после потерянного ответа/перезагрузки безопасно повторяется с прежним ключом. CSRF-refresh/account precondition и конфликт ревизий не меняются. Reload/ошибка не должны молча сбрасывать пользовательскую работу; кнопки заблокированы по существующим условиям.
6. **Регрессии.** Прежние смысловые проверки продолжают проходить; менять критерии ради нового поведения нельзя. Допустимо точечно обновить селекторы после осмысленного изменения разметки, сохранив исходные assertions и доступные имена/test IDs где возможно. Пройти существующие verify/browser/container checks; актуальные обязательные installer/cross-store CI jobs не отключать. Добавить только необходимые проверки вновь затронутой навигации/диалогов/мобильной компоновки. Проверить клавиатуру, закрытие диалогов и отсутствие действий за модальным слоем.
7. **Передача.** Новый exact source SHA/PR, результаты CI и визуальное сравнение; отдельный reviewer проверяет ограниченность scope и сохранность поведения. Если нужен новый Debian kit, он собирается CI для нового frontend SHA и передаётся по текущему curl-маршруту с уже существующим проектным credential. Старый app fbe/отдельный b008 ingress-helper на сервере не переустанавливать автоматически ради этого задания. Работа на реальном сервере и ботах остаётся у владельца; новые расходы/публичный registry/merge не делегированы.

## Проверка и доставка

Использовать существующие bash scripts/verify.sh, npm run test:browser и текущие обязательные CI jobs. Для локального визуального сравнения открыть автономный preview.html в своей тестовой среде, затем приложение с изолированными протокольными фикстурами по действующему test workflow. Приватный живой Sites не является обязательной внешней зависимостью: CSS/DOM/палитра уже в репозитории.

Самопроверка автора обязательна, независимую приёмку выполняет другой reviewer/контекст. Reviewer оценивает diff frontend и действительно пройденные сценарии, а не только красивый скриншот. При изменениях после review обновить приёмку затронутой области.

Доставка разработки — проверенный frontend в PR и применимый неизменяемый комплект, если он входит в передачу. Реальные WebView/внешняя сеть/телефон владельца не заявляются проверенными без наблюдения; пользовательское принятие нового оформления pending до показа результата.

## Полномочия и передача

Management подготовил материалы и очередь, основной функциональный код не менял. Реализацию выполняет облачный Codex, не Claude. Sites-версия и её записи остаются отдельным эталоном и не перепубликуются этим заданием. Все прежние границы доступа/слияния/серверных действий из PROJECT сохраняются.

- product_acceptance: pending — владелец выбрал визуальный эталон, реализацию в основном приложении ещё не видел.
- delivery: pending — перенос не реализован.
- Последнее подтверждение: 2026-11-07, прямое поручение владельца и проверенная фактическая frontend-база a709f5d4dea4946373ea0e7c1f606c5b0a792a5b.

## Восстановление базы developer — 2026-11-07

- Постановка d7cc4d7b051c9eebfc10fed251ea787ad717f05e прочитана; production в ней не менялся. Предыдущее исправление группировки завершено: code19a6fdde785eb90b01bd78318deeab1a539dde7b, handoff9a8cd4eaf5fbce036c84e510088a51040839b54e, PR4 и отдельная приёмка сохранены. Новая ветка `chm-004-sites-design` объединяет эту завершённую основу и d7 docs/reference; target `chm-003-external-proxy` не меняется разработчиком. Это интеграция зависимостей в своей ветке, не merge PR/main или серверная установка.
- Возникла коллизия номера: до получения management-задания прежний developer назвал исправление группировки TASK004. Его карточка побайтово сохранена как [TASK-004-mod-stacks.md](TASK-004-mod-stacks.md); исторические `.delivery/reviews/TASK-004-review.md` и `TASK-004-NEXT-STEPS.md` не переписываются. Канонический TASK004 — этот дизайн, новый отчёт будет `TASK-004-sites-review.md`, новые команды — `TASK-004-SITES-NEXT-STEPS.md`. Старые immutableSHA/PR4 ссылки сохраняют первоначальный смысл.
- Функциональная база для проверки scope — завершённый9a8cd4e плюс docs/reference постановки. Production diff именно этой задачи ограничен web; backend migration и группировка являются уже проверенной зависимостью PR4 и не переписываются. Все регрессии прогоняются и на общей новой сборке.

### План

1. Открыть автономный эталон и зафиксировать screenshots/demo состояния на1440/360/390. Сопоставить существующие actions/state с presentation, сохранить accessible names/testIDs и handlers.
2. Перенести палитру/sidebar/workspace/character column, мод-карточки и тройку крафта в React/CSS. Mobile navigation и формы доступны с клавиатуры, диалоги удерживают focus и блокируют фон, числа переносятся полностью. Никаких Sites моделей/серверных изменений.
3. Пройти41native/прежние14browser и нужные visual/navigation/dialog checks; получить одинаковый synthetic dataset/снимки эталона и приложения, измерить44px targets/overflow и состояния ошибок/пустоты.
4. Отдельный reviewer, исправления подтверждённых blockers, exactCI/новый immutablekit и root/curl ownerhandoff. Настоящий Debian/BotFather/публичныйSites/merge не выполняются.

## Самопроверка frontend

Production diff к интегрированной базе05e4caf ограничен main.tsx/style.css/newpresentation.tsx. Backend/rules/auth/API/DB/installer/ingress/CI/package/lock не менялись. Transport/load/send/choose/validation handlers сохранены; новые состояния — только view/filter/help/forms. Frozen reference4files и прежние reviews/команды сохранены побайтово. Все14прежних browser assertions и locators сохранены без переписывания.

- На Node24.22.1/npm11.9.0 с native better-sqlite3: `NPM_CONFIG_CACHE=/tmp/chm-npm XDG_CACHE_HOME=/tmp/chm-cache bash scripts/verify.sh` — npmci/typecheck/lint/41native41pass0fail0skip/build успешны.
- Полный `PLAYWRIGHT_BROWSERS_PATH=/tmp/chm-002-browsers npm run test:browser`:20/20pass,1.4m. Существующие14 плюс6 новых визуальных/modal/offpageequipment/filter/pagination/exactnumbers. Реальный HTTP/SQLite, protocol fixtures с signed synthetic Telegram, не живая интеграция.
- Исправлены собственные presentation defects: декоративный псевдоэлемент создавал17px mobile overflow (сдвинут внутрь, без overflow-hidden маскировки); нативный Tab мог временно увести focus вbody (явный цикл по active controls). CSSorder:-1 крафта удалён, DOM/visual order согласованы с эталоном; «Крафт» фокусирует/прокручивает существующую панель без записи данных.
- [Визуальное сравнение](../design/TASK-004-VISUAL-COMPARISON.md): одинdataset/21парасостояний на1440/360/390 плюс длинные числа; comparison.html иPNG входят в browser artifact. Reset/error referenceDOM дополнены только для демонстрации frozenCSS и честно отмечены; app не подменяется. Передача такого представления не является приёмкой физического WebView/телефона.
- После полного прогона уточнено только кадрирование визуальных тестов: scroll0, viewport дляmodal. Повтор затронутых visualcases проходит отдельно; CI проверит exact candidate целиком. Независимый reviewer привлечён отдельным контекстом; финальные own runs/CI/kit — следующие шаги.

## Exact кандидат и CI — 2026-11-07

Проверенный production/source **`6dc8021e58daa9aa16a93a9265315bb810fe9d0a`**, PR5 в chm-003-external-proxy/d7cc4d7. Последующий handoff commit меняет только `.delivery` документы/отчёт/команды, не новый источник artifact. Scope production относительно интегрированной05e4caf:3webfiles; fourth code/testfile — presentation.spec.ts. Завершённая группировка PR4/19a является сохранённой зависимостью, её код не переписан.

| Проверка/комплект | Результат |
| --- | --- |
| [Checks42396981634](https://github.com/sa713/cheapshotmods/actions/runs/42396981634) | verify128476349161 и container-smoke128476349027 **success**. npmci/typecheck/lint/41native41pass0fail0skip/build,20/20Chromium, measure pipefail/capacity и контейнерныеseed/check/restore выполнены. |
| [Kit42396981568](https://github.com/sa713/cheapshotmods/actions/runs/42396981568) | job128476349077 **success**, всеsteps4helper+14portableproof negatives/build/extract/standaloneDebian/externalsharedproxy/realDocker29.8classic(vfs)+containerd(native)+reverseexport/uploads выполнены безskipped. Workflow и защиты не менялись. |
| [Artifact13583903966](https://github.com/sa713/cheapshotmods/actions/runs/42396981568/artifacts/13583903966) | `cheapshotmods-6dc8021e58daa9aa16a93a9265315bb810fe9d0a-linux-amd64`, ZIP131905126bytes, expires2026-12-07T17:51:04Z. ZIP SHA256 **b29d9ba8fe17c2c1c2e85a6fc1a385b5cd965b367e240931aadd2a50976af740**. |
| Внутреннийtar.gz | SHA256 **2adb57e77465cac923b6473e2c938d57e664a280203dc2fbe729fd4ad38a53e0**. ZIP/tar/все13SHA256SUMS и archiveconfig+orderedlayers proof проверены послеdownload; архив не перепаковывался. |
| images.tar.gz | SHA256 **33b1d064bb4fbbb2f1c3305418aa829734f56f4c164c923907a55a4b5391e8c8**. Manifestformat2/linux-amd64/Node24.22.1/npm11.9.0/image_bytes350662144. Builderappconfig/classicnative fd1a01c1e0e315e9ddde7bbc101d231888b4b05dfa476aaa3734009217c892c4; proxy aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510. |
| [Storeevidence13584103525](https://github.com/sa713/cheapshotmods/actions/runs/42396981568/artifacts/13584103525) | ZIP SHA2560908811a9e53ba6d3be56f6f95d090dbfc5b64e60b6af9df323c1f3645ea91de; один exactarchive/proof в обоих настоящих stores, разные daemon-nativeIDs; containerdexport→freshclassic безrebuild или изменения expectedproof. |
| [Browserartifact13583313770](https://github.com/sa713/cheapshotmods/actions/runs/42396981634/artifacts/13583313770) | ZIP11444301bytes SHA256d3225fa31bd8be06c6646c7da4ed47e3c1566bca7c4c556cda593716dce103a9, expires2026-11-21T17:36:50Z.21параPNG+3comparison.html,128/129+digit snapshots и прежниеmobileсценарии. [Карта снимков/различий](../design/TASK-004-VISUAL-COMPARISON.md). |

Независимый reviewer в собственном detached worktree exact6dc прошёл41native/20browser и3дополнительныхдиагностики:4modaltypes/двустороннийTab48cycles/Escape/inert/backdrop/returnfocus;128digit и256digitstats на12boundarywidths360–1501 безoverflow/clipping ивсеcontrols≥44px;105groups/offpageequipment/invalid101/modal409refresh/equip4/loadmore/worncraft3→undo/reset/level200. Его source tracked files чистые, production не менял. Отдельно прочёл CIlogs/metadata и самостоятельно скачал/пересчитал13sums/imagesconfig+layers/stores; извлёк app layer безDocker и подтвердил all3webdistfiles совпадают с его собственнымbuild. Итог — [TASK-004-sites-review.md](../reviews/TASK-004-sites-review.md); own/CI/authorDocker execution разделены.

Новый source не переносит Sites model/auth/backend/demo. Backend/rules/DB/API/installer/ingress/CI/package/lock и прежние14browser tests относительно05e4caf неизменны. Frozenreference SHA ипрежние reviews/oldguide не переписаны. Product acceptance владельцем и настоящая WebView/телефон послеустановки pending; syntheticподписи не объявляются живымTelegram.

## Проверка обоих обновлений и финальная передача

Автор выполнил два отдельных настоящих прогона на isolated Debian13-slim/linux-amd64/Docker29.9.2vfs с **каноническими прежними kits**, не rebadged новым app: FBE→6dc и19a→6dc. Подписанные synthetic Mini API/SQLite, никак не ownerhost/живойTelegram.

1. FBE создал schema2 с отдельными одинаковыми craft rows/worn/history, sourceedit послеstarted, точными receipts. Incoming6dc installer сделал штатный offline snapshot, отдельный volume и унаследованную schema2→3 migration/revision+1.
2.19a создал schema3/canonicalwork; при update в6dc/schema3 исходные API state/original/work/receipts сохранились **точно**, без нового revision bump.
3. В обеих ветках новыеCSS/JS реально отдавались новымapp поHTTP и совпали с rootbuild/independentarchiveparser: CSS56392be793e25c2c181850ca748dfbb29d4a256ffd6b4600e119ade025889a42, JS c5ed587526a4840a284d1be405724bccc5bd544b8b2338cf3c2715edbe4f8e86. Styles/Sitesmark изменились с прежних, appsource exact6dc.
4. Проверены exactreceipt replay/no duplicate, stale409, два новыхcraft→тотжестек, worncraft/undo ивсеlegacyundo/reset. Config и отдельныйingress-b008807.py сохранилиexacthash; общийproxy не участвовал в local nativeprobe и не перенастраивался. HTTPS/external lifecycle проверены отдельно CI.
5. Проверка старым image шла только на отдельной OnlineBackup копии3: FBE её отверг,19a прочитал. Штатныйrollback вернул старые metadata/image+volume/schema2 или3 и exactrawstate, restart это сохранил. ПрежниеCSS/JShashes восстановились точно; новыйvolume не подключали к неподдерживаемомустаромуimage.

ProofFBE `/tmp/chm-sites-upgrade/proof-fbe.json` SHA256 **98f7d229272b2dead2dbcc3f04fbf8ef4128d29c8939a03943169b6f4d4a0573**; proof19a `/tmp/chm-sites-upgrade/proof-19a.json` **1c9011410dae9c6dab0dbc03666b97153ce93841562955242b4d4b4ac44dce70**; соответствующие run-fbe.log/run-19a.log — те жеJSON. Scripts run.sh7f5d9c7c521fc51be4ddfaff01d3b1baae771a4b49726463f0face67dc658c6c, fixture.py1cc164db3cbce4ca85f96d53eb846d3fb160f2e513508d2f59e4c155146bea64, api.cjs838c97ed565f8f3e29fcb14947f2acd966c424793f4770ad916a924ab6a05371. Начальнаяasset-probe попытка ошибочно выбралаSDKscript вместо/assets; тестовыйregex исправлен доupdate, исходныйlogсохранён. Productcode/kit/CI ради этого не менялись.

[Root/curl команды скачивания, проверки, update/check/rollback](../TASK-004-SITES-NEXT-STEPS.md) принимаютFBEили19a, фиксируютновыйSHA/ZIP/tar и направлениеrollback. Draftdocsfindingsreviewer исправлены: несовместимостьschema3 относится кFBE, а409старойвкладки условен; полныйreload нужен послеобновления. Вписаны точныеartifact/hashes, новыйкомплект не подменяетстарыеархивы. Diskguard не снижен, optionalcleanup удаляеттолькосверенныеroot-owned скачанныекопии прежнихkits; еслиместа мало — stopбезDockerprune/чужихданных.

Передаётся **проверенный кандидат** вreview, exactsource6dc/PR5/immutableartifact13583903966 и [отдельныйacceptedreview](../reviews/TASK-004-sites-review.md). Установка на реальныйDebian/послеустановочныйWebView/пользовательское принятие оформленияpending; реальнаяпредыдущаяверсия владельца послевыданныхкоманд отдельно не подтверждена. Developer не заходил на сервер, не менялBotFather/живойSites/Dockerdaemon/чужиесервисы, не сливалPR/main и не публиковалregistry. Следующее действие владельца — посмотретьснимки/штатно обновить app поguide и проверитьрабочие действия.

Санитизированные JSON итоги обоих nativeпрогонов сохранены долговечно: [FBE→6dc→FBE](../evidence/TASK-004-sites/upgrade-fbe.json), [19a→6dc→19a](../evidence/TASK-004-sites/upgrade-19a.json). Bytes/SHA совпадают с проверенными reviewer временнымиproofs; в них только source/platform/schema/asset hashes/results, без credentials/личнойБД. Ownfixtures containers/volumes/networks после обоих прогонов удалены адресно, baseline bridge/host/none сохранён; daemon/images/cache и ownerhost не перенастраивались.
