#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_ROOT="${HOME}/.cache/cinnamon-settings-overlay"
STATE_FILE="${BACKUP_ROOT}/current-backup"

SRC_EXTENSION_CORE="${REPO_ROOT}/files/usr/share/cinnamon/cinnamon-settings/bin/ExtensionCore.py"
SRC_CS_EXTENSIONS="${REPO_ROOT}/files/usr/share/cinnamon/cinnamon-settings/modules/cs_extensions.py"

DST_EXTENSION_CORE="/usr/share/cinnamon/cinnamon-settings/bin/ExtensionCore.py"
DST_CS_EXTENSIONS="/usr/share/cinnamon/cinnamon-settings/modules/cs_extensions.py"

usage() {
    cat <<'EOF'
Usage:
  ./tools/test-extensions-checkbox-overlay.sh install
  ./tools/test-extensions-checkbox-overlay.sh restore
  ./tools/test-extensions-checkbox-overlay.sh status

Commands:
  install  Back up the installed Cinnamon settings files and overlay this repo's versions.
  restore  Restore the last backup created by install.
  status   Show the active backup location, if any.
EOF
}

require_sources() {
    [[ -f "${SRC_EXTENSION_CORE}" ]] || { echo "Missing source file: ${SRC_EXTENSION_CORE}" >&2; exit 1; }
    [[ -f "${SRC_CS_EXTENSIONS}" ]] || { echo "Missing source file: ${SRC_CS_EXTENSIONS}" >&2; exit 1; }
}

require_installed_targets() {
    [[ -f "${DST_EXTENSION_CORE}" ]] || { echo "Missing installed file: ${DST_EXTENSION_CORE}" >&2; exit 1; }
    [[ -f "${DST_CS_EXTENSIONS}" ]] || { echo "Missing installed file: ${DST_CS_EXTENSIONS}" >&2; exit 1; }
}

install_overlay() {
    require_sources
    require_installed_targets

    mkdir -p "${BACKUP_ROOT}"

    local backup_dir
    backup_dir="${BACKUP_ROOT}/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${backup_dir}/bin" "${backup_dir}/modules"

    echo "Creating backup in ${backup_dir}"
    sudo cp "${DST_EXTENSION_CORE}" "${backup_dir}/bin/ExtensionCore.py"
    sudo cp "${DST_CS_EXTENSIONS}" "${backup_dir}/modules/cs_extensions.py"

    echo "Overlaying repo versions into /usr/share/cinnamon/cinnamon-settings"
    sudo cp "${SRC_EXTENSION_CORE}" "${DST_EXTENSION_CORE}"
    sudo cp "${SRC_CS_EXTENSIONS}" "${DST_CS_EXTENSIONS}"

    printf '%s\n' "${backup_dir}" > "${STATE_FILE}"

    cat <<'EOF'

Overlay installed.

Launch the Extensions settings page with:
  cinnamon-settings extensions --tab installed

Restore the original files later with:
  ./tools/test-extensions-checkbox-overlay.sh restore
EOF
}

restore_overlay() {
    require_installed_targets

    if [[ ! -f "${STATE_FILE}" ]]; then
        echo "No backup state file found at ${STATE_FILE}" >&2
        exit 1
    fi

    local backup_dir
    backup_dir="$(<"${STATE_FILE}")"

    [[ -f "${backup_dir}/bin/ExtensionCore.py" ]] || { echo "Missing backup file in ${backup_dir}" >&2; exit 1; }
    [[ -f "${backup_dir}/modules/cs_extensions.py" ]] || { echo "Missing backup file in ${backup_dir}" >&2; exit 1; }

    echo "Restoring backup from ${backup_dir}"
    sudo cp "${backup_dir}/bin/ExtensionCore.py" "${DST_EXTENSION_CORE}"
    sudo cp "${backup_dir}/modules/cs_extensions.py" "${DST_CS_EXTENSIONS}"

    rm -f "${STATE_FILE}"
    echo "Restore complete."
}

show_status() {
    if [[ -f "${STATE_FILE}" ]]; then
        echo "Active backup: $(<"${STATE_FILE}")"
    else
        echo "No active overlay backup recorded."
    fi
}

main() {
    local command="${1:-}"

    case "${command}" in
        install)
            install_overlay
            ;;
        restore)
            restore_overlay
            ;;
        status)
            show_status
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
