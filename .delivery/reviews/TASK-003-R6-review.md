# Независимое ревью TASK-003 R6

- Репозиторий: `sa713/cheapshotmods`, [PR №3](https://github.com/sa713/cheapshotmods/pull/3), base `chm-001-foundation` / `cbfe78164daebf5fed041e391f25087b303784d7`.
- Проверенный код и immutable kit: **`fbe82aef6008d292515c0efce2fde601c221f3d2`**. Начало R6 — `e3d44fa2211d38f27aa85edb900e831daebec58a`; весь R6 diff и последующие исправления прочитаны.
- Reviewer: отдельная сессия Codex без участия в реализации; detached worktree `/workspace/cheapshotmods-task003-r6-review`. Исходники, требования, проверки и старый cf0 report reviewer не изменял; записан только этот новый report. Исправления выполнял автор.
- Дата: 2026-11-06. GitHub connector при завершении проверки подтвердил exact HEAD, PR открыт и не слит.
- **Заключение: accepted** для exact кода и неизменённого canonical kit `fbe82ae` в изолированной области TASK-003 R6. Открытых блокирующих находок нет; R6-F1–F4 закрыты. Это не production-приёмка и не разрешение merge/настройки сервера.

Прочитаны AGENTS.md, закреплённые START/WORKFLOW/reviewer/QUALITY стандарта1.1.0 (`2ff5fe41b5c91f539dda4fce8944007aa0eb425f`), PROJECT, TASK-003, прежний review, изменённые installer/bundle/fixtures/CI и operator docs. Применены навыки `ad-review-change` и `cloud-environment-runtime`; перед Docker прочитано его руководство. Область: переносимая идентичность config/слоёв, schema compatibility, безопасные отказы, exact kit и реальные classic/containerd переносы, регрессии доставки. App/auth/game/UI, PRODUCT и `deploy/ingress.py` не менялись. Shared ingress same-daemon image/env/process/source guards сохранены.

## Принятый неизменяемый комплект

| Доказательство | Значение |
| --- | --- |
| Canonical source SHA | `fbe82aef6008d292515c0efce2fde601c221f3d2` |
| Kit CI | [run42253960168 / job128016036465](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/job/128016036465) |
| Artifact | [13522083303](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/artifacts/13522083303),131881374bytes ZIP, не expired; expires2026-12-06T16:53:01Z |
| ZIP SHA-256 | `fb78a81f5df989c361390c227008916c239b5ad41a5535515cfe1f0581cec062` |
| Tar.gz SHA-256 | `cd250916ed39f7594d0eea37fea6adb185eb2fe9ec2528be7e9e57ea50d8238d` |
| `images.tar.gz` SHA-256 | `f5a300101c1dbc6c280dd2a13441ce3546e774d21341041034e0ece15375dc13` |
| Matrix evidence | [13523361428](https://github.com/sa713/cheapshotmods/actions/runs/42253960168/artifacts/13523361428),33982bytes ZIP; SHA-256 `dcebd78d18dbcd24d7cc00bfb585bf9b7cd4ddf9a53c408ceb6f6a228bd606b1` |

Reviewer самостоятельно скачал оба artifact через GitHub connector, сверил ZIP digests с GitHub API и полным CI log. Tar checksum,13/13 внутренних checksums и11/11 packaged operator/docs файлов побайтово совпали с Git blob exact `fbe82ae`. Отдельный потоковый parser reviewer, без импорта packaged verifier, пересчитал SHA-256 bytes обоих config и всех8+5 uncompressed layers, сверил ordered `rootfs.diff_ids`, platform и app revision. Все значения совпали с manifest format2.

Локальный canonical kit: `/tmp/chm-task003-r6-review-evidence/canonical/cheapshotmods-fbe82aef6008d292515c0efce2fde601c221f3d2-linux-amd64`. Машинное доказательство: `/tmp/chm-task003-r6-review-evidence/canonical-proof.json`; независимый parser `/tmp/chm-task003-r6-review-evidence/inspect-canonical.py`. Архив, manifest и checksums не правились и не перепаковывались.

| Образ | Переносимый config SHA-256; classic native ID | Containerd native ID | Ordered layers |
| --- | --- | --- | --- |
| App `cheapshotmods:fbe82aef6008d292515c0efce2fde601c221f3d2` | `sha256:c312b0b3470fb7edbadfbe8cf462d647a45efae9d466d9e1b9ca4f79da8758d4` | `sha256:0217f2634f59e04f4a5b51697507adaa78ebeb80dad0b138d56f82cf8ac3b24a` | 8 |
| Packaged Caddy2.10.2 | `sha256:aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510` | `sha256:5bf74fd0ea8316ea9934240b594242392bcc0e4f2678d4e06d5c5d3fb9f5932d` | 5 |

Оба образа linux/amd64; app revision точный `fbe82ae`. Native IDs — наблюдения конкретного daemon, не универсальная идентичность. Packaged Caddy используется standalone; existing external Caddy не подменяется.

## Реальные stores и фактические проверки

| Проверка | Исполнитель/версия | Результат |
| --- | --- | --- |
| Offline archive negatives, gzip edge cases | Собственный запуск reviewer, helper e37 идентичен fbe | 14/14 passed; null config, неверный config/platform/layer/order, extra tag, duplicate member, truncation, format1 отказ и gzip valid/truncated/trailing. Собственный прежний3MiB gzip repro после исправления:0/1/1, без timeout/traceback. |
| Syntax/structural/diff | Reviewer на проверенных R6 commits | Bash/Python syntax passed; pinned structural errors0; diff check passed. |
| Exact canonical archive/parser/source | Reviewer, fbe kit | ZIP/tar/13 sums/11 files и config/13 layers подтверждены независимо. |
| Настоящий import/export proof на двух stores | Reviewer, тот же downloaded fbe archive | Docker29.8.0 classic vfs и containerd native с `io.containerd.snapshotter.v1`; packaged `archive` и `loaded` exit0, actual native IDs точно совпали с таблицей/CI. Никаких rebuild для положительных образов. |
| Подмена только runtime config | Reviewer, оба реальных stores | Metadata-only image сохраняет tag после retag, platform/revision/rootfs; добавлен искусственный Env marker. Packaged `loaded` отклоняет `type=config_sha256` с безопасными expected/actual hashes; marker не выводится. Canonical tag восстановлен и полный export proof снова exit0. |
| Общие CI проверки | Независимо прочитаны полные [checks42253960150](https://github.com/sa713/cheapshotmods/actions/runs/42253960150) logs | [verify128016036370](https://github.com/sa713/cheapshotmods/actions/runs/42253960150/job/128016036370):33/33, skipped0; browser12/12. [container128016036525](https://github.com/sa713/cheapshotmods/actions/runs/42253960150/job/128016036525): seed/check/restored HTTP passed. |
| Standalone/external installation | Независимо прочитан полный exact fbe kit CI log | Обе обязательные steps success, не skipped. HTTPS/Secure/Origin/forwarding, пять overrides, соседи/HTTP-01/mounts, restart/backup/restore/update/rollback, drift/network/disk refusal, ingress idempotence/failure/interrupted recovery прошли. |
| Один kit на classic/containerd и reverse | Тот же exact fbe CI, artifact evidence отдельно скачан reviewer | Docker29.8.0 vfs/native; один images archive SHA выше. Full external/lifecycle на обоих, actual installer substituted-config/corrupt-kit отказ до ROOT/data/edge/app, обратный containerd export→fresh classic без rebuild/пересчёта proof — success. |
| Format1→incoming format2→old pair rollback | Тот же exact fbe CI | Exact cf0 installer Git blob + явно synthetic predecessor; update сохраняет level300, после изменения до400 rollback/restart возвращает old installer/image/volume и level300. Это отдельная fixture, не переделка принятого старого kit. |

### Собственное исполнение reviewer

Reviewer использовал только выделенные daemon `chm-r6-yg_98_hf-classic` / `chm-r6-yg_98_hf-containerd` через явные wrappers `/tmp/chm-r6-yg_98_hf/{classic,containerd}/bin/docker`. Source kit один и тот же. Команды packaged verifier: `python3 image-proof.py archive manifest.json images.tar.gz` и `python3 image-proof.py loaded manifest.json` до и после контролируемой подмены; helper и данные — из самостоятельно скачанного kit.

Собственный сценарий `/tmp/chm-task003-r6-review-evidence/local-proof.py` завершился exit0. Safe observations/logs: `/tmp/chm-task003-r6-review-evidence/local-final/proof.json`, `*-loaded.log`, `*-substituted-config.log`, `*-restored.log`, before/after snapshots. Во внутренних stores containers0→0, volumes0→0, сети сохранили точные IDs, прежние cf0 images сохранены; images2→3 за счёт exact нового app. Временные negative images удалены адресно, canonical tags восстановлены. Outer daemon containers/volumes/networks/images сохранили **те же полные IDs**. Backend/cgroups не менялись; глобальные prune/cleanup не выполнялись. Docker-окно возвращено автору после завершения, последующая очистка принадлежит автору.

Это собственный native identity/import/export/negative run; полный app/ingress локально не запускался из-за readonly cloud cgroup. Его реальное выполнение на обоих stores подтверждено независимо прочитанными CI logs и скачанным evidence, а не названо локальным исполнением reviewer.

### Связность CI evidence

Полный final kit job прочитан, все обязательные steps выполнены до upload. Reviewer отдельно сопоставил `classic.json`, `containerd.json`, `containerd-to-classic.json` и `summary.json`: один original images SHA, одинаковые config и ordered diff IDs, разные native IDs, reverse возвращает classic IDs. Containerd-export SHA-256 `127faecebfb86cf10457b963a2f04da4829e254b1fc6a7c6a3a1467d77e9d803` записан отдельно. Исходники matrix экспортируют уже загруженные проверенные images и создают fresh classic store; две независимые сборки не подменяют перенос.

Лог подтверждает legacy level300 в16:42:12UTC, full external classic в16:44:47, containerd в16:51:57, reverse proof в16:52:43. Историческая успешная матрица6f также независимо скачана/прочитана (`13520964388`, ZIP SHA `d8416df577effa4e21a5ad1bb492f0e7c8724ff572e6e3e77215a0d7210669dc`), но её kit не принят из-за F3. Итог относится только к fbe.

## Причина R6 и сохранение старых доказательств

Canonical cf0 tar сохранён неизменным: SHA-256 `5b6683f43cbb11361b317011ab2ef452e25e1f2e8416533b24a1e9e72aa702d4`. Старый `.delivery/reviews/TASK-003-code-review.md` сохранён побайтово: SHA-256 `590cbe220ad765c5f4ae37ee4b24cdd2b96951edc339dc11f9cb72d6be2d1d20`.

Собственный offline разбор cf0 доказал config→ordered13layers и OCI manifest→config/layers связь. Owner containerd IDs app `224b715b65e63febfde0a3934f864440a824d9a8dacbf7ce4c9a206abcd6d425` и proxy `5bf74fd0ea8316ea9934240b594242392bcc0e4f2678d4e06d5c5d3fb9f5932d` уже находились в оригинальном archive и ссылаются на прежние builder/config IDs app `cfdcc939fdc357b5478772a5c836f35819baba1f069691e99ba3636e80095a92` и proxy `aac61abc4024c323602ccb9ee38bd68b147601f518626b2a055e06944e01c510`. Доказательство reviewer: `/tmp/chm-task003-r6-review-evidence/cf0-archive-proof.json`.

Прочитаны author native old-store logs/proof `/tmp/chm-r6-yg_98_hf/cf0-real-store-proof.json`: exact старый `load_images` classic exit0/containerd exit1; переносимый proof обоих и reverse в empty classic passed. Тело функции в scripts независимо сверено с cf0 Git blob. Reviewer самостоятельно проверил author containerd cf0 export SHA `b3b6acf648c742ead25a11fcf8333fadce06d649762b037a7f0595a40f80fa6c` против своего прежнего proof: exit0. Author execution и собственный offline run здесь различены. Старые архивы не перепаковывались ради установки, их expected IDs/checksums не правились.

## Находки и исправления

| Находка | Доказательство и исправление | Итог |
| --- | --- | --- |
| R6 — смешаны native builder/target IDs | `bundle.sh` записывал `.Id`, `chm.sh` сравнивал его на другом daemon. Exact cf0 archive и реальные stores подтвердили config/manifest различие. Format2 связывает raw config SHA с ordered uncompressed layers, проверяет archive до import и actual export после load; same tag/revision/platform недостаточно. | Закрыта exact fbe kit и real-store доказательствами выше. |
| R6-F1 — malformed `config:null` печатает traceback | Собственный отрицательный вход на первой рабочей версии. В4d добавлены config/rootfs/Labels и inspect shape checks, безопасный handler, regression; final14 tests passed. | Закрыта. Env values не раскрывались. |
| R6-F2 — classic DinD не видит `/tmp/.../classic.json` | Exact4d CI failure, самостоятельно скачанный log artifact13520696536, ZIP SHA `4e513a8c981a9aa934f7235e9356f0643a4d6c0f49f26e1b840910a485453df2`.6f перенёс inputs в `/r6`, Buildx только в fixtures; full final matrix реально выполнилась. | Закрыта фактической матрицей. |
| R6-F3 — trailing gzip stream зацикливает decoder | На6f собственный3MiB gzip+второй stream >40s/99%CPU, повтор timeout3s. Автор e37 добавил EOF/unused_data/tail/progress guard. Прежний собственный repro на исправлении: valid0/truncated1/trailing1;14/14 passed; packaged fbe helper exact. | Закрыта независимым повтором. |
| R6-F4 — probe25 зависит от границы минуты | Exacte37 external CI отказал в16:34:00. Собственный actual LoginLimiter check:25split10+15sameIP даёт0отказов;41split20+21 даёт429;41uniqueIPs нижеglobal100 и429 не дают. Fbe меняет только fixture на41uniqueXFF с deadline; final external/matrix success. Auth/proxy не менялись. | Закрыта. |

Неблокирующее замечание: deadline probe проверяется перед запросами, без отдельного post-batch elapsed assertion; крайне медленный последний request может дать консервативный false-negative. Ложного успеха forwarded guard это не создаёт,41нижеglobal100; автор принял замечание, обязательные final проверки прошли. Открытых блокирующих замечаний нет.

## Совместимость, передача и ограничения

Новый installer принимает format2 как входной kit; для существующей format1 установки используется входящий новый `NEW_BUNDLE/chm.sh update ROOT NEW_BUNDLE`. Rollback использует сохранённую image+volume пару и её прежний installer, без импорта старого archive. Обновлены оба fixture-генератора proof; реальная legacy compatibility выше подтверждена. Это объяснено в README/EXTERNAL-PROXY, без ослабления проверки или подгонки IDs.

Operator docs проверены: curl с уже имеющимся `/root/.config/cheapshotmods/github.curl`, без обязательного gh/нового ключа/clone/build; отдельный private каталог, ZIP/tar/inner hashes и остановка при первой ошибке. ROOT не перезаписывается; старые cf0 images не требуют shared cleanup. Проверены точные HTTPS origin/callback/Mini App URL, local0600 secrets, install/stage/apply/check и входящий update. Credential-файл reviewer не читал. В передаче следует указывать только canonical fbe metadata выше; старые kit/CI/review не подменяют эту приёмку.

Реальный Debian владельца, его Docker/config/data/ingress, публичный ACME/продление IP-сертификата, BotFather Allowed URLs и настоящие Login/Mini App/телефон не использовались и не проверены. Их операторская проверка остаётся за владельцем; это согласованная граница изолированной технической приёмки. Main/merge, внешний выпуск и новые расходы не выполнялись. Отчёт не переносится автоматически на новый runtime HEAD или другой archive.
