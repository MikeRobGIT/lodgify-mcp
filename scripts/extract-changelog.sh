#!/bin/bash
# Extract a specific version section from CHANGELOG.md
# Usage: ./scripts/extract-changelog.sh <version>
# Example: ./scripts/extract-changelog.sh 0.1.23

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>" >&2
  echo "Example: $0 0.1.23" >&2
  exit 1
fi

# Remove 'v' prefix if present
VERSION=${VERSION#v}

# Check if CHANGELOG.md exists
if [ ! -f "CHANGELOG.md" ]; then
  echo "Error: CHANGELOG.md not found" >&2
  exit 1
fi

# Extract the section for this version
# This AWK script finds the version heading and prints everything until the next version heading
awk -v ver="$VERSION" '
  /^## \[/ {
    # If we already found our version and hit another version heading, stop
    if (found) exit
    # Check if this heading matches our version
    if ($0 ~ "\\[" ver "\\]") found=1
  }
  # If we found our version, skip the heading line but print everything else
  found && NR > start_line && /^## \[/ && $0 !~ "\\[" ver "\\]" { exit }
  found {
    if (start_line == 0) start_line = NR
    if (NR > start_line) print
  }
' CHANGELOG.md
