#!/usr/bin/env python3
import os
import sys
import re

def main():
    # Retrieve the target installation destination directory from environment variables
    destdir = os.environ.get("MESON_INSTALL_DESTDIR_PREFIX")
    if not destdir:
        print("Error: MESON_INSTALL_DESTDIR_PREFIX not found.")
        sys.exit(0)

    install_dir = os.path.join(destdir, "share", "cinnamon", "js")

    # Regex pattern to match exactly 4 spaces only at the beginning of each line
    indent_pattern = re.compile(r'^( {4})+', re.MULTILINE)

    if os.path.exists(install_dir):
        print(f"Optimizing JS files: {install_dir}")
        for root, _, files in os.walk(install_dir):
            for file in files:
                if file.endswith(".js"):
                    path = os.path.join(root, file)
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()

                    # Safely convert leading 4-space groups into tabs line by line
                    # without touching spaces inside strings or comments
                    optimized = indent_pattern.sub(lambda match: "\t" * (len(match.group(0)) // 4), content)
                    
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(optimized)

if __name__ == "__main__":
    main()

    return pattern.sub(replace, js_code)
