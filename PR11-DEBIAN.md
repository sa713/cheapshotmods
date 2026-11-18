# Cheapshot Mods — обновление Debian до PR №11

Для существующей установки Cheapshot Mods в `/opt/cheapshotmods` на Debian amd64 с общим внешним proxy. Комплект связан с [PR №11](https://github.com/sa713/cheapshotmods/pull/11) и точным SHA `ed8503c77c684cb8d1b2a7163bfbb56958b62b9a`. В нём компактный интерфейс из правок по скриншотам. Архив — 132 014 447 байт, SHA-256 `d5f9f075dd6fedcfc0d21c3fdae37b175eadd3506e0acaa23fa79d9f0f50369a`. [Приватный снимок комплекта](https://github.com/sa713/cheapshotmods/tree/1946771ac1379fb743912b2d3f6dfaad991289e1).

## Обновление

Подключитесь к действующему Debian по SSH обычным способом. Выполните `sudo -i`, затем вставьте весь блок ниже в root-терминал. Он использует существующий приватный файл `/root/.config/cheapshotmods/github.curl` с доступом Contents Read к репозиторию. Git, npm, сборка и GitHub Actions на сервере не требуются.

Блок сверяет текущий SHA с работающим HTTPS и измеряет свободное место до большой загрузки. Минимум на ФС установки, загрузки и Docker — 3 253 568 589 байт плюс три размера текущих данных. При неизвестной версии, нехватке места или несовпадении хешей команда остановится. Для предварительной проверки замените `update` на `preflight` **только в первой строке** блока. Если проверка прошла, выполните блок с `update`.

```bash
bash -s -- update <<'CHM_PR11_COMMAND'
#!/usr/bin/env bash
# Owner-operated bootstrap; the verified Python helper performs all host checks.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
CHM_OPERATION=${1:-update}
case "$CHM_OPERATION" in fetch|preflight|prepare|update|check|rollback) ;; *) echo 'Unknown operation.' >&2; exit 2;; esac
CHM_OPERATOR=/root/cheapshotmods-pr11-c720d3b96c04.py
if [[ ! -e "$CHM_OPERATOR" && ! -L "$CHM_OPERATOR" ]]; then
  python3 -I - <<'PY_CREDENTIAL'
from pathlib import Path
import stat
p=Path('/root/.config/cheapshotmods/github.curl')
assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Existing root-owned0600 GitHub curl credential required'
PY_CREDENTIAL
  CHM_BOOTSTRAP_TEMP=$(mktemp -d /root/cheapshotmods-pr11-command-XXXXXX)
  trap 'rm -rf -- "$CHM_BOOTSTRAP_TEMP"' EXIT
  curl --disable --config /root/.config/cheapshotmods/github.curl \
    --fail --silent --show-error --location --connect-timeout 15 --max-time 60 --max-filesize 65536 \
    --output "$CHM_BOOTSTRAP_TEMP/operator.json" \
    https://api.github.com/repos/sa713/cheapshotmods/git/blobs/472f7c43c23c2b60121d9d8f19b67b2fa0e9cd4d
  python3 -I - "$CHM_BOOTSTRAP_TEMP/operator.json" "$CHM_OPERATOR" <<'PY_FETCH'
import base64,hashlib,json,os,sys
from pathlib import Path
value=json.loads(Path(sys.argv[1]).read_text())
assert value['encoding']=='base64'
data=base64.b64decode(''.join(value['content'].split()),validate=True)
assert len(data)==17706 and hashlib.sha256(data).hexdigest()=='c720d3b96c04a6c88dac09e5753a550f9b03a6a5b0a19deacf196b99efddeb0e', 'Operator checksum mismatch'
with os.fdopen(os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as output: output.write(data)
PY_FETCH
fi
python3 -I - "$CHM_OPERATOR" <<'PY_VERIFY'
from pathlib import Path
import hashlib,stat,sys
p=Path(sys.argv[1]);assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Unexpected local operator file'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='c720d3b96c04a6c88dac09e5753a550f9b03a6a5b0a19deacf196b99efddeb0e', 'Local operator checksum mismatch; stop without overwriting'
PY_VERIFY
printf 'Verified operator: %s\n' "$CHM_OPERATOR"
if [[ "$CHM_OPERATION" != fetch ]]; then python3 -I "$CHM_OPERATOR" "$CHM_OPERATION"; fi
CHM_PR11_COMMAND
```

Обновление создаёт живую резервную копию SQLite, затем установщик проверяет импортированный образ, останавливает приложение на время перехода и переносит согласованную копию данных в новый volume. Прежний образ и прежний volume сохраняются парой для отката. Успех подтверждают строки `Updated runtime: ed8503c77c684cb8d1b2a7163bfbb56958b62b9a` и `Database check` со схемой 6, `integrity: ok` и нулём ошибок внешних ключей. Пути к backup и receipt команда печатает отдельно. При недостатке места сохраните сообщение preflight и освободите место на выделенной ФС либо добавьте диск.

## Проверка и откат

Из root-терминала после обновления:

```bash
python3 -I /root/cheapshotmods-pr11-c720d3b96c04.py check
```

Закройте и заново откройте Mini App. Проверьте один ряд характеристик, компактные списки, сохранённые инвентари, историю и точку возврата. Для отката непосредственно этого обновления до других операций update или restore:

```bash
python3 -I /root/cheapshotmods-pr11-c720d3b96c04.py rollback
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
```

Откат возвращает прежнюю пару образа и данных. Записи, сделанные после обновления, сохраняются в новом volume и не переносятся в прежнюю БД автоматически. Штатный backup доступен командой `bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods`.

## Проверенные границы

Сборка, все 13 контрольных сумм, переносимые доказательства конфига и слоёв образа и 30 скомпилированных файлов сверены. Проверки интерфейса и исходников описаны в [PR №11](https://github.com/sa713/cheapshotmods/pull/11). Проверки установочного комплекта авторские. Фактическая установка и проверка телефоном выполняются владельцем.

На изолированном Debian 13 проверены приватное скачивание с GitHub, работающий HTTPS, обновление с комплекта TASK-009 `eb655846`, обе зелёные рецептуры с отменой и штатный откат. Проверка семи игровых таблиц показала сохранность исходных и рабочих модов, истории команд и снимка. Проверен автоматический возврат при искусственном сбое после обновления. Этот прогон использовал Docker 29.9.2 rootless/vfs. На фактическом Docker установщик отдельно проверит импортированный образ до остановки приложения. [Отчёт прогона](PR11-debian-proof.json)
