#!/bin/bash
# One-liner installer for Lazy_agents Hermes plugin
# Usage: curl -s https://raw.githubusercontent.com/TangledDaunT/Lazy_agents/main/install_lazy_agents.sh | bash

set -e

echo "🚀 Installing Lazy_agents Hermes plugin..."

# Create installation directory
INSTALL_DIR="$HOME/Lazy_agents"
mkdir -p "$INSTALL_DIR"

# Clone or update repository
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "📥 Updating existing installation..."
    cd "$INSTALL_DIR" && git pull origin master
else
    echo "📥 Cloning repository..."
    git clone https://github.com/TangledDaunT/Lazy_agents.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Check if Python dependencies are installed
echo "🐍 Checking Python dependencies..."
if ! python3 -c "import fastapi, uvicorn, httpx, websockets" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip3 install fastapi uvicorn httpx websockets
fi

# Create launcher script
echo "🚀 Creating launcher script..."
cat > "$INSTALL_DIR/start_lazy_agents.sh" << 'LAUNCHER_EOF'
#!/bin/bash
# Lazy_agents launcher script

# Set environment variables
export HERMES_GATEWAY_URL="http://100.99.161.57:8642"
export HERMES_API_KEY="change-me-local-dev"  # User should update this in Settings

# Start the Hermes bridge in background
echo "🔌 Starting Hermes bridge..."
cd "$HOME/Lazy_agents"
python3 python/hermes_bridge.py &
BRIDGE_PID=$!

# Give bridge time to start
sleep 3

# Start the Electron app
echo "💻 Starting Lazy_agents application..."
npm start

# Cleanup bridge when app exits
echo "🛑 Stopping Hermes bridge..."
kill $BRIDGE_PID 2>/dev/null || true
LAUNCHER_EOF

chmod +x "$INSTALL_DIR/start_lazy_agents.sh"

# Create a symbolic link in /usr/local/bin for easy access
echo "🔗 Creating command-line shortcut..."
sudo mkdir -p /usr/local/bin
sudo ln -sf "$INSTALL_DIR/start_lazy_agents.sh" /usr/local/bin/lazy-agents

# Create application shortcut in Applications folder (optional)
echo "📁 Creating Applications folder shortcut..."
ln -sf "$INSTALL_DIR" "/Applications/Lazy_agents" 2>/dev/null || echo "⚠️  Could not create Applications shortcut (may need sudo)"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Run the application: lazy-agents"
echo "2. Or run directly: $INSTALL_DIR/start_lazy_agents.sh"
echo "3. Open Settings (⚙️) in the app to configure your actual API key"
echo ""
echo "📝 To uninstall:"
echo "   rm -rf "$INSTALL_DIR""
echo "   sudo rm -f /usr/local/bin/lazy-agents"
echo "   rm -f /Applications/Lazy_agents"
echo ""
echo "🎉 Enjoy using Lazy_agents with your Hermes agent!"
