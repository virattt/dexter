# WhatsApp Gateway

Chat with Dexter through WhatsApp by linking your phone to the gateway. Messages you send to yourself (self-chat) are processed by Dexter and responses are sent back to the same chat.

## Table of Contents

- [✅ Prerequisites](#-prerequisites)
- [🔗 How to Link WhatsApp](#-how-to-link-whatsapp)
- [🚀 How to Run](#-how-to-run)
- [💬 How to Chat](#-how-to-chat)
- [⚙️ Configuration](#️-configuration)
- [🔄 How to Relink](#-how-to-relink)
- [🐛 Troubleshooting](#-troubleshooting)
- [🔧 Full Reset](#-full-reset)

## ✅ Prerequisites

- Dexter installed and working (see main [README](../../../../README.md))
- WhatsApp installed on your phone
- Your phone connected to the internet

## 🔗 How to Link WhatsApp

Link your WhatsApp account to Dexter by scanning a QR code:

```bash
bun run gateway:login
```

This will:
1. Display a QR code in your terminal
2. Open WhatsApp on your phone
3. Go to **Settings > Linked Devices > Link a Device**
4. Scan the QR code

Once linked, your phone number is automatically added to the allowed senders list and credentials are saved to `~/.dexter/credentials/whatsapp/default/`.

## 🚀 How to Run

Start the gateway to begin receiving messages:

```bash
bun run gateway
```

You should see:
```
[whatsapp] Connected
Dexter gateway running. Press Ctrl+C to stop.
```

The gateway will now listen for incoming WhatsApp messages and respond using Dexter.

## 💬 How to Chat

Once the gateway is running:

1. Open WhatsApp on your phone
2. Go to your own chat (message yourself)
3. Send a message like "What is Apple's revenue?"
4. You'll see a typing indicator while Dexter processes
5. Dexter's response will appear in the chat

**Example conversation:**
```
You: What was NVIDIA's revenue in 2024?
Dexter: NVIDIA's revenue for fiscal year 2024 was $60.9 billion...
```

## ⚙️ Configuration

The gateway configuration is stored at `~/.dexter/gateway.json`. It's auto-created when you run `gateway:login`.

**Default configuration:**
```json
{
  "gateway": {
    "accountId": "default",
    "logLevel": "info"
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  },
  "bindings": []
}
```

**Key settings:**

| Setting | Description |
|---------|-------------|
| `channels.whatsapp.allowFrom` | Phone numbers allowed to message Dexter (E.164 format) |
| `channels.whatsapp.enabled` | Enable/disable the WhatsApp channel |
| `gateway.logLevel` | Log verbosity: `silent`, `error`, `info`, `debug` |

## 🔄 How to Relink

If you need to relink your WhatsApp (e.g., after logging out or switching phones):

1. Stop the gateway (Ctrl+C)
2. Delete the credentials:
   ```bash
   rm -rf ~/.dexter/credentials/whatsapp/default
   ```
3. Run login again:
   ```bash
   bun run gateway:login
   ```
4. Scan the new QR code

## 🐛 Troubleshooting

**Gateway shows "Disconnected":**
- Check your internet connection
- Try relinking (see above)

**Messages not being received:**
- Verify your phone number is in `allowFrom` in `~/.dexter/gateway.json`
- Make sure you're messaging yourself (self-chat mode)

**Debug logs:**
- Check `~/.dexter/gateway-debug.log` for detailed logs

## 🔧 Full Reset

If you're experiencing persistent issues (connection problems, encryption errors, messages not sending), perform a full reset:

1. **Stop the gateway** (Ctrl+C if running)

2. **Unlink from WhatsApp:**
   - Open WhatsApp on your phone
   - Go to **Settings > Linked Devices**
   - Tap on the Dexter device and select **Log Out**

3. **Clear all local data:**
   ```bash
   rm -rf ~/.dexter/credentials/whatsapp/default
   rm -rf ~/.dexter/gateway.json
   rm -rf ~/.dexter/gateway-debug.log
   ```

4. **Relink and start fresh:**
   ```bash
   bun run gateway:login
   ```

5. **Scan the QR code** and start the gateway:
   ```bash
   bun run gateway
   ```

This clears all cached credentials and encryption sessions, which resolves most connection issues.
