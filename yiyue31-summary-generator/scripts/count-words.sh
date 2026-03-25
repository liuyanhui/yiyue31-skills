#!/bin/bash
# Word Counter Script
# Usage: ./count-words.sh <file-path>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_CMD="${SCRIPT_DIR}/word-counter.js"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js to use this script"
    exit 1
fi

# Check if word-counter.js exists
if [ ! -f "$NODE_CMD" ]; then
    echo "Error: word-counter.js not found in $SCRIPT_DIR"
    exit 1
fi

# Check if file argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <file-path>"
    echo ""
    echo "Examples:"
    echo "  $0 ../SKILL.md"
    echo "  $0 ../templates/standard.md"
    echo "  $0 /path/to/document.txt"
    exit 1
fi

FILE_PATH="$1"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File not found: $FILE_PATH"
    exit 1
fi

# Run word counter
node "$NODE_CMD" "$FILE_PATH"
