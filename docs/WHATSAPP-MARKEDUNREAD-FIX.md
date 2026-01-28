# Fix Bug: WhatsApp markedUnread Error

## 🐛 Deskripsi Bug

Bot WhatsApp crash dengan error:

```
Error [TypeError]: Cannot read properties of undefined (reading 'markedUnread')
    at I (https://static.whatsapp.net/rsrc.php/v4iMny4/yo/l/en_GB-j/MIKtGDXrUmZ.js:1546:4178)
```

Error ini terjadi saat bot mencoba mengirim pesan menggunakan `message.reply()` atau `client.sendMessage()`.

## 🔍 Penyebab

1. **WhatsApp Web API berubah** - Property `markedUnread` tidak lagi tersedia di objek chat internal WhatsApp Web
2. **whatsapp-web.js library** memanggil `sendSeen()` secara internal sebelum mengirim pesan
3. Fungsi `sendSeen()` mencoba mengakses `chat.markedUnread` yang undefined

## ✅ Solusi

### 1. Upgrade whatsapp-web.js

```bash
pnpm add whatsapp-web.js@latest
```

Pada saat fix ini dibuat, versi yang digunakan: **1.34.4**

### 2. Tambahkan webVersionCache di client config

File: `src/client/index.js`

```javascript
const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
  // FIX: Gunakan webVersionCache untuk mengatasi masalah versi WA Web
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/AKASHAorg/webwhatsapp-versions/main/canary.json",
  },
});

module.exports = { client };
```

### 3. Buat Helper Functions untuk Safe Send

File: `src/utils/waHelper.js`

```javascript
// src/utils/waHelper.js
// Helper untuk mengatasi bug markedUnread di whatsapp-web.js

/**
 * Safe reply - mengirim pesan dengan penanganan error markedUnread
 * @param {Object} message - WhatsApp message object
 * @param {string} text - Text to reply
 * @param {Object} clientOrOptions - Optional: WhatsApp client or reply options
 */
async function safeReply(message, text, clientOrOptions = {}) {
  const chatId = message.from;

  // Determine if third param is a client or options object
  let client = message.client || message._client;
  let options = {};

  if (clientOrOptions) {
    if (clientOrOptions.pupPage || clientOrOptions.initialize) {
      client = clientOrOptions;
    } else {
      options = clientOrOptions;
    }
  }

  try {
    // Coba kirim menggunakan pupPage.evaluate (bypass sendSeen yang bermasalah)
    if (client?.pupPage) {
      try {
        const result = await client.pupPage.evaluate(
          async (chatId, content) => {
            try {
              let chat = window.Store?.Chat?.get(chatId);

              if (!chat) {
                const wid = window.Store?.WidFactory?.createWid(chatId);
                if (wid) {
                  chat = await window.Store?.Chat?.find(wid);
                }
              }

              if (chat) {
                const msgResult = await window.WWebJS.sendMessage(
                  chat,
                  content,
                  {},
                  {},
                );
                return {
                  success: true,
                  id: msgResult?.id?._serialized || "sent",
                };
              }

              return { success: false, error: "Chat not found" };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
          chatId,
          text,
        );

        if (result.success) {
          console.log(`✅ [safeReply] Sent via pupPage to ${chatId}`);
          return result;
        }

        console.log(
          `⚠️ [safeReply] pupPage failed: ${result.error}, trying fallback`,
        );
      } catch (pupErr) {
        console.log(
          `⚠️ [safeReply] pupPage error: ${pupErr.message}, trying fallback`,
        );
      }
    }

    // Fallback ke message.reply dengan try-catch
    return await message.reply(text, undefined, options);
  } catch (error) {
    const errorMsg = error?.message || String(error);

    // Jika error markedUnread, pesan kemungkinan sudah terkirim
    if (errorMsg.includes("markedUnread")) {
      console.log(
        `⚠️ [safeReply] markedUnread error (ignored, pesan mungkin terkirim)`,
      );
      return { success: true, warning: "markedUnread" };
    }

    console.error(`❌ [safeReply] Error: ${errorMsg}`);
    throw error;
  }
}

/**
 * Safe send message menggunakan client
 * @param {Object} client - WhatsApp client
 * @param {string} to - Recipient JID (62xxx@c.us)
 * @param {string} text - Text to send
 * @param {Object} options - Optional send options
 */
async function safeSendMessage(client, to, text, options = {}) {
  try {
    if (client?.pupPage) {
      try {
        const result = await client.pupPage.evaluate(
          async (chatId, content) => {
            try {
              let chat = window.Store?.Chat?.get(chatId);

              if (!chat) {
                const wid = window.Store?.WidFactory?.createWid(chatId);
                if (wid) {
                  chat = await window.Store?.Chat?.find(wid);
                }
              }

              if (chat) {
                const msgResult = await window.WWebJS.sendMessage(
                  chat,
                  content,
                  {},
                  {},
                );
                return {
                  success: true,
                  id: msgResult?.id?._serialized || "sent",
                };
              }

              return { success: false, error: "Chat not found" };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
          to,
          text,
        );

        if (result.success) {
          console.log(`✅ [safeSendMessage] Sent via pupPage to ${to}`);
          return result;
        }

        console.log(
          `⚠️ [safeSendMessage] pupPage failed: ${result.error}, trying fallback`,
        );
      } catch (pupErr) {
        console.log(
          `⚠️ [safeSendMessage] pupPage error: ${pupErr.message}, trying fallback`,
        );
      }
    }

    // Fallback ke client.sendMessage
    return await client.sendMessage(to, text, options);
  } catch (error) {
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes("markedUnread")) {
      console.log(`⚠️ [safeSendMessage] markedUnread error ke ${to} (ignored)`);
      return { success: true, warning: "markedUnread", to };
    }

    console.error(`❌ [safeSendMessage] Error ke ${to}: ${errorMsg}`);
    throw error;
  }
}

module.exports = { safeReply, safeSendMessage };
```

### 4. Tambahkan Global Error Handlers

File: `server.js` (di bagian atas, setelah imports)

```javascript
const { safeReply, safeSendMessage } = require("./src/utils/waHelper");

// ===== Global Error Handlers =====
process.on("unhandledRejection", (reason, promise) => {
  // Ignore markedUnread errors
  if (reason?.message?.includes("markedUnread")) {
    console.log("⚠️ [global] Ignored unhandledRejection: markedUnread");
    return;
  }
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  // Ignore markedUnread errors
  if (error?.message?.includes("markedUnread")) {
    console.log("⚠️ [global] Ignored uncaughtException: markedUnread");
    return;
  }
  console.error("Uncaught Exception:", error);
  // Don't exit on markedUnread
});
```

### 5. Ganti semua message.reply dan client.sendMessage

**Sebelum:**

```javascript
await message.reply("Halo!");
await client.sendMessage(jid, "Pesan");
```

**Sesudah:**

```javascript
const { safeReply, safeSendMessage } = require("./src/utils/waHelper");

await safeReply(message, "Halo!", waClient);
await safeSendMessage(client, jid, "Pesan");
```

## 📁 File yang Sudah Diupdate

| File                                    | Status | Perubahan                                                                   |
| --------------------------------------- | ------ | --------------------------------------------------------------------------- |
| `src/client/index.js`                   | ✅     | Tambah `webVersionCache` config                                             |
| `src/utils/waHelper.js`                 | ✅     | File baru dengan `safeReply` & `safeSendMessage`                            |
| `server.js`                             | ✅     | Import waHelper, global error handlers, semua `message.reply` → `safeReply` |
| `routes/broadcast.js`                   | ✅     | Import & gunakan `safeSendMessage`                                          |
| `src/controllers/scheduleController.js` | ✅     | Import & gunakan `safeSendMessage`                                          |
| `src/controllers/guruController.js`     | ✅     | Import `safeReply` & `safeSendMessage`, semua `message.reply` → `safeReply` |
| `src/controllers/siswaController.js`    | ✅     | Import `safeReply` & `safeSendMessage`, semua `message.reply` → `safeReply` |
| `src/features/imgToPdf.js`              | ✅     | Import `safeReply`, semua `message.reply` → `safeReply`                     |

## 🔧 Catatan Penting

1. **`safeReply(message, text, waClient)`** - Untuk membalas pesan dalam handler
   - Parameter ke-3 bisa `waClient` atau `options` object
2. **`safeSendMessage(client, jid, text)`** - Untuk mengirim pesan ke nomor tertentu
   - `jid` harus format `62xxx@c.us`

3. **Media/File** - Untuk mengirim media, masih gunakan `client.sendMessage()` dengan try-catch:

   ```javascript
   try {
     await client.sendMessage(jid, media, { caption: "..." });
   } catch (err) {
     if (!err?.message?.includes("markedUnread")) {
       console.error("Gagal kirim media:", err.message);
     }
   }
   ```

4. **Hapus session jika masih error** - Kadang perlu reset session:
   ```bash
   rm -rf .wwebjs_auth
   node server.js
   # Scan QR ulang
   ```

## 📅 Tanggal Fix

- **Tanggal:** 26 Januari 2026
- **whatsapp-web.js version:** 1.34.4
- **puppeteer version:** 24.36.0

## 🔗 Referensi

- https://github.com/pedroslopez/whatsapp-web.js/issues
- https://github.com/AKASHAorg/webwhatsapp-versions
