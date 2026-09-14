# Security Notes

Keep API keys in environment variables; do not place them in `agents_config.json` or commit `.env` files. The local bridge is intended for the desktop host and has no production authentication layer.

Review agent permissions and approval triggers before connecting a gateway that can execute tools or modify external systems.
