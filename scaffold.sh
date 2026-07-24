#!/usr/bin/env bash
# Prompt AI scaffold script
# Spins up the four top-level folders and their placeholder READMEs.
# This is structure only. It does not install dependencies or run setup.

set -e

FOLDERS=("app" "api" "data" "docs")

for folder in "${FOLDERS[@]}"; do
  mkdir -p "$folder"
  if [ ! -f "$folder/README.md" ]; then
    echo "# Prompt AI, $folder" > "$folder/README.md"
    echo "" >> "$folder/README.md"
    echo "Documentation for this service is in progress. See the project root README.md for the full architecture." >> "$folder/README.md"
  fi
done

echo "Scaffold complete: app/, api/, data/, docs/ created."
