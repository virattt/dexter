# WhatsApp Gateway

Chat with Dexter through WhatsApp by linking your phone to the gateway. Messages you send to yourself (self-chat) are processed by Dexter and responses are sent back to the same chat.

## Table of Contents

- [✅ Prerequisites](#-prerequisites)
- [🔗 How to Link WhatsApp](#-how-to-link-whatsapp)
- [🚀 How to Run](#-how-to-run)
- [💬 How to Chat](#-how-to-chat)
- [⚙️ Configuration](#️-configuration)
- [👥 Group Chat](#-group-chat)
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

After linking, you'll be asked how you want to use Dexter:

### Option 1: Self-chat (personal phone)

Use your own WhatsApp to talk to Dexter by messaging yourself. The linked phone number is added to `allowFrom` and self-chat mode is activated automatically.

### Option 2: Dedicated bot phone

If Dexter has its own phone number (e.g. a separate SIM), choose this option and enter the phone number(s) allowed to message it. The gateway will be configured with `dmPolicy: "allowlist"` so other people can DM the bot.

Credentials are saved to `.dexter/credentials/whatsapp/default/`.

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

The gateway configuration is stored at `.dexter/gateway.json`. It's auto-created when you run `gateway:login`.

**Self-chat configuration** (personal phone, message yourself):
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

**Bot phone configuration** (dedicated Dexter phone, others message it):
```json
{
  "gateway": {
    "accountId": "default",
    "logLevel": "info"
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "default": {
          "dmPolicy": "allowlist",
          "allowFrom": ["+1555YOURNUM"],
          "groupPolicy": "disabled",
          "groupAllowFrom": []
        }
      },
      "allowFrom": ["+1555YOURNUM"]
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
| `accounts.<id>.dmPolicy` | DM access policy: `pairing` (default), `allowlist`, `open`, or `disabled` |
| `accounts.<id>.allowFrom` | Per-account allowed senders (overrides top-level `allowFrom`) |
| `gateway.logLevel` | Log verbosity: `silent`, `error`, `info`, `debug` |

## 👥 Group Chat

Dexter can participate in WhatsApp group chats, responding only when @-mentioned.

### Setup

Add group policy to your account in `.dexter/gateway.json`:

```jsonc
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "default": {
          "groupPolicy": "open",       // "open", "allowlist", or "disabled"
          "groupAllowFrom": ["*"]       // no need to list individual group members
        }
      },
      "allowFrom": ["+1234567890"]      // existing DM allowlist (unrelated to groups)
    }
  }
}
```

| Setting | Description |
|---------|-------------|
| `groupPolicy` | `"open"` (any group), `"allowlist"` (restricted), or `"disabled"` (default) |
| `groupAllowFrom` | Which groups Dexter can participate in (`["*"]` for any) |

You don't need to list individual group members — when `groupPolicy` is `"open"`, Dexter will respond to @-mentions from anyone in any group it's added to.

### Usage

1. Add Dexter's WhatsApp number to a group
2. Send messages normally — Dexter stays silent
3. @-mention Dexter (tap `@` and select from the picker) to get a response
4. Dexter sees recent group messages for context, so it can follow the conversation

**Note:** You must use WhatsApp's @-mention picker (tap `@` then select the contact) — typing a phone number manually won't trigger a response.

## 🔄 How to Relink

If you need to relink your WhatsApp (e.g., after logging out or switching phones):

1. Stop the gateway (Ctrl+C)
2. Delete the credentials:
   ```bash
   rm -rf .dexter/credentials/whatsapp/default
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
- Verify your phone number is in `allowFrom` in `.dexter/gateway.json`
- Make sure you're messaging yourself (self-chat mode)

**Debug logs:**
- Check `.dexter/gateway-debug.log` for detailed logs

## 🔧 Full Reset

If you're experiencing persistent issues (connection problems, encryption errors, messages not sending), perform a full reset:

1. **Stop the gateway** (Ctrl+C if running)

2. **Unlink from WhatsApp:**
   - Open WhatsApp on your phone
   - Go to **Settings > Linked Devices**
   - Tap on the Dexter device and select **Log Out**

3. **Clear all local data:**
   ```bash
   rm -rf .dexter/credentials/whatsapp/default
   rm -rf .dexter/gateway.json
   rm -rf .dexter/gateway-debug.log
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
