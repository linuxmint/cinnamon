#!/bin/bash

set -eu

run_session() {
    repo=$1
    test_root=$2
    master_compat=$3
    xvfb_pid=
    cinnamon_pid=
    stop_process() {
        local process_pid=$1
        test -n "$process_pid" || return

        if kill -0 "$process_pid" 2>/dev/null; then
            kill "$process_pid" 2>/dev/null || true
            for _ in {1..50}; do
                kill -0 "$process_pid" 2>/dev/null || break
                sleep 0.1
            done
            if kill -0 "$process_pid" 2>/dev/null; then
                kill -KILL "$process_pid" 2>/dev/null || true
            fi
        fi
        wait "$process_pid" 2>/dev/null || true
    }
    cleanup_processes() {
        status=$?
        trap - EXIT INT TERM
        stop_process "$cinnamon_pid"
        stop_process "$xvfb_pid"
        exit "$status"
    }
    trap cleanup_processes EXIT INT TERM

    export GSETTINGS_BACKEND=memory
    # Installed Cinnamon 6.6 lacks C APIs required by master main.js.
    # Load only popupMenu.js from the checkout against the host runtime.
    export CINNAMON_JS="$repo:$test_root/modules:/usr/share/cinnamon/js"
    if test "$master_compat" = true; then
        export CINNAMON_POPUP_MENU_TEST_MASTER_COMPAT=1
    else
        unset CINNAMON_POPUP_MENU_TEST_MASTER_COMPAT
    fi
    export CINNAMON_POPUP_MENU_TEST_MODULE=1

    display_file=$test_root/display
    Xvfb -displayfd 3 -screen 0 1280x800x24 -nolisten tcp \
        3>"$display_file" >"$test_root/xvfb.log" 2>&1 &
    xvfb_pid=$!
    for _ in $(seq 1 50); do
        test -s "$display_file" && break
        if ! kill -0 "$xvfb_pid" 2>/dev/null; then
            tail -n 100 "$test_root/xvfb.log"
            exit 1
        fi
        sleep 0.1
    done
    test -s "$display_file"
    IFS= read -r display_number <"$display_file"
    case "$display_number" in
        ''|*[!0-9]*) exit 1 ;;
    esac
    test -S "/tmp/.X11-unix/X$display_number"
    export DISPLAY=:$display_number

    cinnamon --x11 --replace --sm-disable >"$test_root/cinnamon.log" 2>&1 &
    cinnamon_pid=$!
    ready=false
    for _ in $(seq 1 120); do
        if gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon \
            --method org.Cinnamon.Eval '1 + 1' >/dev/null 2>&1; then
            ready=true
            break
        fi
        if ! kill -0 "$cinnamon_pid" 2>/dev/null; then
            tail -n 100 "$test_root/cinnamon.log"
            exit 1
        fi
        sleep 0.1
    done
    test "$ready" = true

    result=$(gdbus call --session --dest org.Cinnamon \
        --object-path /org/Cinnamon --method org.Cinnamon.Eval \
        '(function() { try { imports.tests.unit.popupMenuSignals.run(); return {passed: true}; } catch (e) { return {passed: false, message: e.message, stack: e.stack}; } })()')
    printf '%s\n' "$result"
    case "$result" in
        *'"passed":true'*) ;;
        *) exit 1 ;;
    esac
}

if test "${1:-}" = --session; then
    shift
    run_session "$@"
    exit
fi

for command in dbus-run-session gdbus cinnamon Xvfb timeout; do
    command -v "$command" >/dev/null
done

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
repo=$(CDPATH='' cd -- "$script_dir/.." && pwd)
source_file=${1:-$repo/js/ui/popupMenu.js}
master_compat=${2:-true}
source_file=$(realpath -- "$source_file")
test -f "$source_file"
case "$master_compat" in
    true|false) ;;
    *) exit 2 ;;
esac
test_root=$(mktemp -d /tmp/cinnamon-popup-signals.XXXXXX)
cleanup_root() {
    status=$?
    trap - EXIT INT TERM
    resolved=$(realpath -- "$test_root")
    case "$resolved" in
        /tmp/cinnamon-popup-signals.*) ;;
        *) exit 97 ;;
    esac
    test -d "$resolved"
    rm -r -- "$resolved"
    exit "$status"
}
trap cleanup_root EXIT INT TERM

mkdir -p "$test_root/home" "$test_root/runtime" "$test_root/modules"
chmod 700 "$test_root/runtime"
ln -s "$source_file" "$test_root/modules/popupMenuUnderTest.js"

test_home=$test_root/home
test_runtime=$test_root/runtime

session_status=0
timeout --kill-after=5s 45s env -u AT_SPI_BUS_ADDRESS -u XMODIFIERS \
    HOME="$test_home" XDG_RUNTIME_DIR="$test_runtime" NO_AT_BRIDGE=1 \
    GIO_USE_VFS=local GVFS_DISABLE_FUSE=1 GTK_IM_MODULE=xim IBUS_USE_PORTAL=0 \
    dbus-run-session -- "$0" --session "$repo" "$test_root" "$master_compat" \
    2>"$test_root/dbus.log" || session_status=$?
sleep 1
exit "$session_status"
