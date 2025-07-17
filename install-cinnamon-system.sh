#!/bin/bash

echo "============================================="
echo "Installing Cinnamon System Modifications"
echo "============================================="

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

# Backup timestamp
BACKUP_DIR="/tmp/cinnamon-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Tworzę backup oryginalnych plików w: $BACKUP_DIR${NC}"

# Lista plików do modyfikacji
declare -A FILES_TO_INSTALL=(
    ["files/usr/share/cinnamon/cinnamon-settings/bin/SettingsWidgets.py"]="/usr/share/cinnamon/cinnamon-settings/bin/SettingsWidgets.py"
    ["files/usr/share/cinnamon/cinnamon-settings/bin/JsonSettingsWidgets.py"]="/usr/share/cinnamon/cinnamon-settings/bin/JsonSettingsWidgets.py"
    ["js/ui/settings.js"]="/usr/share/cinnamon/js/ui/settings.js"
)

# Funkcja backup i kopiowanie
backup_and_install() {
    local source_file="$1"
    local dest_file="$2"
    
    echo "Przetwarzam: $dest_file"
    
    # Sprawdź czy plik źródłowy istnieje
    if [[ ! -f "$source_file" ]]; then
        echo -e "${RED}  ❌ Plik źródłowy nie istnieje: $source_file${NC}"
        return 1
    fi
    
    # Sprawdź czy plik docelowy istnieje i zrób backup
    if [[ -f "$dest_file" ]]; then
        echo "  📁 Tworzę backup oryginalnego pliku..."
        cp "$dest_file" "$BACKUP_DIR/$(basename $dest_file).backup"
    else
        echo -e "${YELLOW}  ⚠️  Plik docelowy nie istnieje: $dest_file${NC}"
        # Utwórz katalog jeśli nie istnieje
        mkdir -p "$(dirname "$dest_file")"
    fi
    
    # Kopiuj nowy plik
    echo "  📋 Kopiuję nowy plik..."
    cp "$source_file" "$dest_file"
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}  ✅ Pomyślnie zainstalowano${NC}"
        # Ustaw odpowiednie uprawnienia
        chmod 644 "$dest_file"
        return 0
    else
        echo -e "${RED}  ❌ Błąd kopiowania${NC}"
        return 1
    fi
}

# Funkcja restart Cinnamon
restart_cinnamon() {
    echo -e "${YELLOW}🔄 Restartuję Cinnamon...${NC}"
    
    # Sprawdź czy Cinnamon jest uruchomiony
    if ! pgrep -x "cinnamon" > /dev/null; then
        echo -e "${YELLOW}  ⚠️  Cinnamon nie jest uruchomiony${NC}"
        return 1
    fi
    
    # Restart Cinnamon jako oryginalny użytkownik
    echo "  📱 Wykonuję restart..."
    
    # Znajdź DISPLAY użytkownika
    USER_DISPLAY=$(sudo -u "$SUDO_USER" printenv DISPLAY 2>/dev/null || echo ":0")
    
    # Restart przez DBus (bezpieczniejszy sposób)
    sudo -u "$SUDO_USER" DISPLAY="$USER_DISPLAY" dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.Eval string:'global.reloadTheme(); Meta.restart("Restarting...");' 2>/dev/null
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}  ✅ Cinnamon zostanie zrestartowany${NC}"
        sleep 2
        return 0
    else
        # Fallback - klasyczny restart
        echo "  🔄 Próbuję alternatywny sposób restartu..."
        sudo -u "$SUDO_USER" DISPLAY="$USER_DISPLAY" cinnamon --replace &
        
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}  ✅ Cinnamon zostanie zrestartowany${NC}"
            return 0
        else
            echo -e "${YELLOW}  ⚠️  Automatyczny restart się nie powiódł${NC}"
            echo -e "${YELLOW}     Zrestartuj ręcznie: Alt+F2 → r → Enter${NC}"
            return 1
        fi
    fi
}

echo
echo "Instaluję zmodyfikowane pliki Cinnamon..."
echo

# Instaluj wszystkie pliki
SUCCESS_COUNT=0
TOTAL_COUNT=${#FILES_TO_INSTALL[@]}

for source_file in "${!FILES_TO_INSTALL[@]}"; do
    dest_file="${FILES_TO_INSTALL[$source_file]}"
    
    if backup_and_install "$source_file" "$dest_file"; then
        ((SUCCESS_COUNT++))
    fi
    echo
done

echo "============================================="
echo -e "Instalacja zakończona: ${GREEN}$SUCCESS_COUNT${NC}/$TOTAL_COUNT plików"
echo -e "Backup zapisany w: ${YELLOW}$BACKUP_DIR${NC}"
echo

if [[ $SUCCESS_COUNT -eq $TOTAL_COUNT ]]; then
    echo -e "${GREEN}✅ Wszystkie pliki zostały pomyślnie zainstalowane!${NC}"
    echo
    
    # Automatyczny restart Cinnamon
    restart_cinnamon
    
    echo
    echo -e "${GREEN}🎉 Instalacja zakończona pomyślnie!${NC}"
    echo "Applet kalendarza został automatycznie zainstalowany wraz z modułem ustawień."
else
    echo -e "${RED}❌ Niektóre pliki nie zostały zainstalowane. Sprawdź błędy powyżej.${NC}"
    exit 1
fi

echo "============================================="

# Sprawdź czy skrypt jest uruchomiony z odpowiedniego katalogu
if [ ! -f "files/usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py" ]; then
    echo "Błąd: Skrypt musi być uruchomiony z głównego katalogu projektu"
    exit 1
fi

# Utwórz kopię zapasową oryginalnego modułu cs_calendar.py
echo "Tworzenie kopii zapasowej oryginalnego cs_calendar.py..."
if [ -f "/usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py" ]; then
    sudo cp /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py.backup-$(date +%Y%m%d-%H%M%S)
    echo "Kopia zapasowa utworzona"
else
    echo "Oryginalny plik cs_calendar.py nie istnieje - prawdopodobnie pierwsza instalacja"
fi

# Utwórz kopię zapasową oryginalnego schematu GSettings
echo "Tworzenie kopii zapasowej oryginalnego schematu GSettings..."
if [ -f "/usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml" ]; then
    sudo cp /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml.backup-$(date +%Y%m%d-%H%M%S)
    echo "Kopia zapasowa schematu utworzona"
fi

# Zainstaluj nowy moduł cs_calendar.py
echo "Instalowanie nowego modułu cs_calendar.py..."
sudo cp files/usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py /usr/share/cinnamon/cinnamon-settings/modules/
sudo chown root:root /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py
sudo chmod 644 /usr/share/cinnamon/cinnamon-settings/modules/cs_calendar.py
echo "Moduł cs_calendar.py zainstalowany"

# Zainstaluj nowy schemat GSettings
echo "Instalowanie nowego schematu GSettings..."
sudo cp data/org.cinnamon.gschema.xml /usr/share/glib-2.0/schemas/
sudo chown root:root /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml
sudo chmod 644 /usr/share/glib-2.0/schemas/org.cinnamon.gschema.xml
echo "Schemat GSettings zainstalowany"

# Kompiluj schematy GSettings
echo "Kompilowanie schematów GSettings..."
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
echo "Schematy GSettings skompilowane"

# Zainstaluj rozszerzone pliki systemowe Cinnamon
echo "Instalowanie rozszerzonych plików systemowych..."
sudo cp js/ui/settings.js /usr/share/cinnamon/js/ui/
sudo cp files/usr/share/cinnamon/cinnamon-settings/bin/SettingsWidgets.py /usr/share/cinnamon/cinnamon-settings/bin/
sudo cp files/usr/share/cinnamon/cinnamon-settings/bin/JsonSettingsWidgets.py /usr/share/cinnamon/cinnamon-settings/bin/
sudo cp files/usr/share/cinnamon/cinnamon-settings/xlet-settings.py /usr/share/cinnamon/cinnamon-settings/

# Ustaw odpowiednie uprawnienia
sudo chown root:root /usr/share/cinnamon/js/ui/settings.js
sudo chown root:root /usr/share/cinnamon/cinnamon-settings/bin/SettingsWidgets.py
sudo chown root:root /usr/share/cinnamon/cinnamon-settings/bin/JsonSettingsWidgets.py
sudo chown root:root /usr/share/cinnamon/cinnamon-settings/xlet-settings.py

sudo chmod 644 /usr/share/cinnamon/js/ui/settings.js
sudo chmod 644 /usr/share/cinnamon/cinnamon-settings/bin/SettingsWidgets.py
sudo chmod 644 /usr/share/cinnamon/cinnamon-settings/bin/JsonSettingsWidgets.py
sudo chmod 755 /usr/share/cinnamon/cinnamon-settings/xlet-settings.py

echo "Pliki systemowe zainstalowane"

# Instalacja appletu kalendarza
echo "Instalowanie appletu kalendarza..."
if [ -d "/usr/share/cinnamon/applets/calendar@cinnamon.org" ]; then
    echo "  📁 Tworzę backup oryginalnego appletu..."
    sudo cp -r /usr/share/cinnamon/applets/calendar@cinnamon.org /usr/share/cinnamon/applets/calendar@cinnamon.org.backup-$(date +%Y%m%d-%H%M%S)
fi

echo "  📋 Kopiuję nowy applet..."
sudo cp -r files/usr/share/cinnamon/applets/calendar@cinnamon.org/ /usr/share/cinnamon/applets/

# Ustaw odpowiednie uprawnienia dla katalogu i plików appletu
echo "  🔐 Ustawiam uprawnienia..."
sudo chown -R root:root /usr/share/cinnamon/applets/calendar@cinnamon.org/
sudo chmod 755 /usr/share/cinnamon/applets/calendar@cinnamon.org/
sudo chmod 644 /usr/share/cinnamon/applets/calendar@cinnamon.org/*.js /usr/share/cinnamon/applets/calendar@cinnamon.org/*.json

echo "  ✅ Applet kalendarza zainstalowany i uprawnienia ustawione"

echo ""
echo "=== Instalacja zakończona pomyślnie! ==="
echo ""
echo "WAŻNE:"
echo "1. Uruchom ponownie Cinnamon (Alt+F2, wpisz 'r' i naciśnij Enter)"
echo "2. Lub wyloguj się i zaloguj ponownie"
echo "3. Otwórz Ustawienia systemowe > Data i czas"
echo "4. Nowa sekcja 'Advanced Date Format' powinna być dostępna"
echo ""
echo "W przypadku problemów użyj skryptu restore-cinnamon-system.sh"

echo "=============================================" 