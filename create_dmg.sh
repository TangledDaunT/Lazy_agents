#!/bin/bash
# Script to create a DMG installer for Lazy_agents on macOS

set -e

APP_NAME="Lazy_agents"
VERSION="1.0.0"
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
TEMP_DIR="/tmp/${APP_NAME}_dmg"
SOURCE_DIR="$HOME/Lazy_agents"
APP_BUNDLE_NAME="${APP_NAME}.app"
BACKGROUND_IMAGE=""

echo "📦 Creating DMG installer for ${APP_NAME}..."

# Create temporary directory
mkdir -p "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}/${APP_NAME}"

# Copy application files
echo "📋 Copying application files..."
cp -r "${SOURCE_DIR}/." "${TEMP_DIR}/${APP_NAME}/"

# Create a symbolic link to Applications
ln -s /Applications "${TEMP_DIR}/${APP_NAME}/Applications"

# Create DMG with proper layout
echo "💿 Creating DMG..."
hdiutil create "${DMG_NAME}"     -volname "${APP_NAME}"     -srcfolder "${TEMP_DIR}/${APP_NAME}"     -ov -format UDZO     -fs HFS+     -fsid c0cac93a-79e5-4e20-8f27-9810702e21a5     -anyowners -noio

# Clean up
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ DMG created successfully: ${DMG_NAME}"
echo ""
echo "📝 To install:"
echo "   1. Open ${DMG_NAME}"
echo "   2. Drag Lazy_agents to Applications folder"
echo "   3. Launch from Applications or run: lazy-agents"
echo ""
echo "📝 Post-installation steps:"
echo "   1. Run: lazy-agents"
echo "   2. Open Settings (⚙️) to configure your API key"
echo "   3. Enjoy using Lazy_agents with your Hermes agent!"
