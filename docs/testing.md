# Testing

Fast checks:

```sh
node --check main.js
node --check renderer.js
node --check dashboard.js
python3 -m py_compile python/hermes_bridge.py
npm start
```

The start check should show the bridge listening on port `8766` and the Electron process connecting to `/bus`. A live prompt additionally requires a reachable Hermes gateway.
