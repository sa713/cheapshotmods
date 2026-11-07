# TASK004 — сравнение Sites v1 и основного приложения

Эталон — неизменённые файлы [sites-v1](sites-v1/README.md) из постановки d7cc4d7, source Sites e1888fec417c3b31d7fa24b01c34d6aafdf6d919. Поведение нового frontend по-прежнему задают React/существующие handlers, Fastify/API/SQLite и @chm/rules. Из Sites не переносились модель, endpoints, auth, demo или жёсткие показатели.

## Как воспроизвести и открыть снимки

После `bash scripts/verify.sh` выполнить `npm run test:browser`. `tests/browser/presentation.spec.ts` запускает настоящий сервер с существующими isolated signed Telegram fixtures, seed через API и Chromium. HTML эталона открывается локальным file URL, интернет/Sites-аккаунт не нужны. В CI используется тот же тест; весь `test-results` входит в browser artifact exact SHA.

Скачайте browser artifact и откройте `presentation-Sites-reference-and-real-app-visual-states-1440/comparison.html`, аналогично360/390. В каждом HTML слева эталон, справа реальное приложение; относительные PNG должны оставаться рядом. Для обычных состояний снимается страница целиком после одинаковой прокрутки к началу. Editor/reset снимаются в viewport1000px: native backdrop относится к текущему viewport, full-page screenshot неверно помещал бы его на высоте прокрутки. App DOM/CSS/данные ради кадров не подменяются.

В эталоне скрывается только fixed reference switcher, который не является дизайном продукта. Пять состояний inventory/equip/craft/editor/empty взяты из неизменённого HTML. Для reset/error исходный HTML не содержит готового DOM: тест создаёт эти два **дополнительных состояния только в reference browser** из frozen `.modal/.confirm-text/.error-banner` CSS и реального текста приложения. Это сравнение применения предоставленных CSS, не утверждение о настоящей работе Sites. Исходные файлы не меняются.

## Одинаковые данные

Вымышленный профиль: уровень200, группы 🅾1/+10×9, 🅾1/+11×3, 🅾1/+12×3, 💢1/+8×12, 🧿1/+8×6, 💚1/+20×8. Надето по1 из 🅾10/💢8/🧿8: всего3/100, урон252, здоровье200, расход0. Предпросмотр трёх ненадетых 🅾1/+10 даёт 🅾2/+15, цена84. Реальные показатели получены из API/@chm/rules; тест не прописывает их в UI. Порядок строк приложения следует server UUID/cursor, порядок статичного эталона фиксированный; ради снимка server pagination не сортируется/не переписывается.

| Область | Сохранённое сходство и допустимые отличия |
| --- | --- |
| Палитра/иерархия | Background#111312, panel#1a1d1b, sidebar#151815, raised#202421, border#2b302c, text#f0f3ed, accent#c5f469; четыре цветных типа модов, большие параметры/tier badges. Background/accent дополнительно проверяются против tokens.json. |
|1440px | Sidebar226px, основная колонка, character card292px справа и отдельный budget. Геометрия проверена browser assertions. Действующие тексты продукта и реальные команды имеют приоритет над декоративными подписями. |
|360/390px | Sidebar скрыт, одна колонка: character перед инвентарём, budget после мастерской. Основные tabs/формы/logout/help/retry доступны без sidebar. Controls≥44px и captions11–13px увеличивают высоту относительно мелкого эталона. Горизонтальный скролл/обрезка чисел не используются. |
| Инвентарь/примерка | Emoji tiles, крупный процент, badge tier, строки групп и отдельные количества. Сохранены точная массовая примерка и явный craft с персонажа; они занимают больше места, чем упрощённые +/- эталона. |
| Крафт | Три слота, источник «из набора/с персонажа», стрелка, результат/tier/цена, apply/clear/undo. DOM и визуальный порядок: список → мастерская, как в reference. Переход «Крафт» прокручивает и фокусирует панель; выбор сохраняется. Панель доступна в рабочем scope и в режиме примерки, чтобы прежние действия не исчезали. |
| Редактор/подтверждение | Общая тёмная modal surface, тонкая граница, backdrop/blur, lime primary. Существующие select/валидация всех tier/quantity сохранены; добавлены цветные кнопки того же changeType. Native showModal+inert/ARIA, Tab/ShiftTab, Escape и return focus проверены. Reset предупреждает о тех же последствиях. |
| Ошибка/сохранение | Реальные message/problem/busy/pending/conflict, тёплая notice surface, настоящее disabled состояние. Pending retry доступен внутри editor modal, payload/key не заменяются. Никакого декоративного «saved» вместо серверного результата. |
| Большие наборы | «Загружено групп» и фильтр **по загруженным** данным. Load more остаётся и при пустом результате фильтра; это не пустой инвентарь/не лимит100. Вся экипировка берётся из summary, а не только страницы. |
| Точные числа |128digit source/quantity/level и derived129+digit значения переносятся полностью; NumberField дополнительно показывает полное длинное значение. Inventory/value/stats не форматируются через Number и не имеют ellipsis. Число экземпляров в тройке ограничено прежней моделью3, как до редизайна. |

По семь пар состояний на каждой ширине —21 пары PNG; дополнительно exact-values1440/360/390 и exact-editor, старые mobile360/390 screenshot сценарии. Автор просмотрел desktop/mobile equip, editor, craft, empty, confirmation/error и длинные значения; окончательная приёмка — отдельным reviewer на exact source.

## Ограничения

Chromium эмулирует viewport; это не новая проверка настоящего Telegram WebView/физического телефона/owner Debian. Вымышленные signed данные не называются живой Telegram-интеграцией. Frontend и kit передаются без установки на сервер/изменения BotFather/Sites/merge. Продуктовое принятие оформления владельцем остаётся pending.

Замороженные SHA256: preview.html985281d6fad7a4369f04f10c59064c6483d08854e16f2da6ff947ebe2201262d; sites.css566321b603585a5308664514d159413caa44c48b4c26672f651fce0778b6c350; tokens.jsondc6721ee20662416df255b2fe215e0644b888a30b0a191351e6b7254c399d4bb; README50d3da726cb5b82b2bedd60afce0da3c86e46d58b9a8ac18aa0ed1529bb0507f.

## Переданный набор

Exact frontend/source6dc8021e58daa9aa16a93a9265315bb810fe9d0a. [Browserartifact13583313770](https://github.com/sa713/cheapshotmods/actions/runs/42396981634/artifacts/13583313770) содержит все снимки/HTML сравнения; CI20/20 и отдельное ревью выполнялись на этой версии. [Установочныйkit13583903966](https://github.com/sa713/cheapshotmods/actions/runs/42396981568/artifacts/13583903966), команды — [TASK-004-SITES-NEXT-STEPS.md](../TASK-004-SITES-NEXT-STEPS.md). Будущие docs-only SHA не подменяют этот immutable candidate.
