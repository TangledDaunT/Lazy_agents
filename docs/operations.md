# Operations

Start the desktop app with `npm start`. Electron starts the bridge and optional wake-word listener automatically.

The bridge reconnect loop is shutdown-aware. It clears pending timers, closes the WebSocket, and checks that BrowserWindow and webContents are still alive before sending renderer events.

Use the bridge `/health` endpoint for a quick local diagnostic.
