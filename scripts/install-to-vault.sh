#!/bin/bash

# Install Obsidian Granola Sync plugin to a vault
# Usage: ./install-to-vault.sh /path/to/vault

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if vault path is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No vault path provided${NC}"
    echo "Usage: $0 /path/to/vault"
    exit 1
fi

VAULT_PATH="$1"
PLUGIN_PATH="$VAULT_PATH/.obsidian/plugins/obsidian-granola-sync"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if vault exists
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${RED}Error: Vault directory does not exist: $VAULT_PATH${NC}"
    exit 1
fi

# Check if .obsidian directory exists
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo -e "${RED}Error: Not a valid Obsidian vault (no .obsidian directory found)${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing Obsidian Granola Sync to: $VAULT_PATH${NC}"

# Create plugins directory if it doesn't exist
mkdir -p "$VAULT_PATH/.obsidian/plugins"

# Build the plugin if main.js doesn't exist or is older than source
if [ ! -f "$PROJECT_ROOT/main.js" ] || [ "$PROJECT_ROOT/src" -nt "$PROJECT_ROOT/main.js" ]; then
    echo -e "${YELLOW}Building plugin...${NC}"
    cd "$PROJECT_ROOT"
    npm run build
    
    # Create styles.css
    echo -e "${YELLOW}Creating styles.css...${NC}"
    cat styles/*.css > styles.css
fi

# Create plugin directory
echo -e "${YELLOW}Creating plugin directory...${NC}"
mkdir -p "$PLUGIN_PATH"

# Copy plugin files
echo -e "${YELLOW}Copying plugin files...${NC}"
cp "$PROJECT_ROOT/main.js" "$PLUGIN_PATH/"
cp "$PROJECT_ROOT/manifest.json" "$PLUGIN_PATH/"
cp "$PROJECT_ROOT/styles.css" "$PLUGIN_PATH/"

echo -e "${GREEN}✓ Plugin installed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Open Obsidian"
echo "2. Go to Settings → Community plugins"
echo "3. Disable Safe Mode if needed"
echo "4. Find 'Granola Sync' and enable it"
echo "5. Click the Granola icon in the ribbon to start setup"