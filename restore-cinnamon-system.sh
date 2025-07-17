#!/bin/bash

echo "=== Przywracanie oryginalnych ustawień systemowych Cinnamon ==="

# Kolory do output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sprawdź czy skrypt jest uruchomiony jako root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Ten skrypt musi być uruchomiony jako root (sudo)${NC}"
   echo "Użyj: sudo $0"
   exit 1
fi

# Sprawdź czy mamy SUDO_USER (oryginalny użytkownik)
if [[ -z "$SUDO_USER" ]]; then
    echo -e "${RED}❌ Nie można określić oryginalnego użytkownika. Uruchom z sudo.${NC}"
    exit 1
fi

# Znajdź najnowsze kopie zapasowe
CALENDAR_BACKUP=$(ls -t /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py.backup-* 2>/dev/null | head -1)
SCHEMA_BACKUP=$(ls -t /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml.backup-* 2>/dev/null | head -1)

# Przywróć oryginalny moduł cs_calendar.py
if [ -n "$CALENDAR_BACKUP" ]; then
    echo "Przywracanie oryginalnego cs_calendar.py z kopii: $CALENDAR_BACKUP"
    sudo cp "$CALENDAR_BACKUP" /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py
    sudo chown root:root /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py
    sudo chmod 644 /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py
    echo "Moduł cs_calendar.py przywrócony"
else
    echo "Brak kopii zapasowej cs_calendar.py - usuwanie zmodyfikowanego pliku"
    if [ -f "/usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py" ]; then
        sudo rm /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py
        echo "Zmodyfikowany cs_calendar.py usunięty"
    fi
fi

# Przywróć oryginalny schemat GSettings
if [ -n "$SCHEMA_BACKUP" ]; then
    echo "Przywracanie oryginalnego schematu GSettings z kopii: $SCHEMA_BACKUP"
    sudo cp "$SCHEMA_BACKUP" /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml
    sudo chown root:root /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml
    sudo chmod 644 /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml
    echo "Schemat GSettings przywrócony"
else
    echo "OSTRZEŻENIE: Brak kopii zapasowej schematu GSettings!"
    echo "Możesz spróbować przywrócić oryginalny schemat z pakietu:"
    echo "sudo apt-get install --reinstall cinnamon-common"
fi

# Kompiluj schematy GSettings
echo "Kompilowanie schematów GSettings..."
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
echo "Schematy GSettings skompilowane"

# Usuń kopie zapasowe starsze niż 30 dni
echo "Czyszczenie starych kopii zapasowych..."
sudo find /usr/share/cinnamon/cinnamon-settings/modules/ -name "cs_calendar.py.backup-*" -mtime +30 -delete 2>/dev/null
sudo find /usr/share/glib-2.0/schemas/ -name "org.cinnamon.gschema.xml.backup-*" -mtime +30 -delete 2>/dev/null

echo ""
echo "=== Przywracanie zakończone! ==="
echo ""
echo "WAŻNE:"
echo "1. Uruchom ponownie Cinnamon (Alt+F2, wpisz 'r' i naciśnij Enter)"
echo "2. Lub wyloguj się i zaloguj ponownie"
echo "3. Ustawienia systemowe powinny wrócić do oryginalnego stanu"
echo ""
echo "Jeśli nadal masz problemy, spróbuj:"
echo "sudo apt-get install --reinstall cinnamon cinnamon-common"

echo "=============================================" 