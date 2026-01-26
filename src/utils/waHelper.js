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
    // Check if it's a WhatsApp client (has pupPage property)
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
              // Find chat using Store.Chat
              let chat = window.Store?.Chat?.get(chatId);

              if (!chat) {
                // Try to find using findCommonGroups as fallback
                const wid = window.Store?.WidFactory?.createWid(chatId);
                if (wid) {
                  chat = await window.Store?.Chat?.find(wid);
                }
              }

              if (chat) {
                // Send message using WWebJS.sendMessage
                const msgResult = await window.WWebJS.sendMessage(chat, content, {}, {});
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
          text
        );

        if (result.success) {
          console.log(`✅ [safeReply] Sent via pupPage to ${chatId}`);
          return result;
        }
        
        // Jika pupPage gagal, lanjut ke fallback
        console.log(`⚠️ [safeReply] pupPage failed: ${result.error}, trying fallback`);
      } catch (pupErr) {
        console.log(`⚠️ [safeReply] pupPage error: ${pupErr.message}, trying fallback`);
      }
    }
    
    // Fallback ke message.reply dengan try-catch
    return await message.reply(text, undefined, options);
  } catch (error) {
    const errorMsg = error?.message || String(error);

    // Jika error markedUnread, pesan kemungkinan sudah terkirim
    if (errorMsg.includes("markedUnread")) {
      console.log(`⚠️ [safeReply] markedUnread error (ignored, pesan mungkin terkirim)`);
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
    // Coba kirim menggunakan pupPage.evaluate
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

              // Jika chat masih tidak ditemukan, coba buat chat baru via sendTextMsgToChat
              if (!chat) {
                // Metode alternatif: gunakan Store.SendTextMsgToChat jika tersedia
                if (window.Store?.SendTextMsgToChat) {
                  const wid = window.Store?.WidFactory?.createWid(chatId);
                  if (wid) {
                    await window.Store.SendTextMsgToChat(wid, content);
                    return { success: true, id: "sent-via-SendTextMsgToChat" };
                  }
                }
                return { success: false, error: "Lid is missing in chat table" };
              }

              if (chat) {
                const msgResult = await window.WWebJS.sendMessage(chat, content, {}, {});
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
          text
        );

        if (result.success) {
          console.log(`✅ [safeSendMessage] Sent to ${to}`);
          return result;
        }
        
        // pupPage gagal, coba fallback (tidak perlu log warning)
      } catch (pupErr) {
        // pupPage error, coba fallback (tidak perlu log warning)
      }
    }
    
    // Fallback ke client.sendMessage - wrap dalam try-catch khusus markedUnread
    try {
      const msg = await client.sendMessage(to, text, options);
      console.log(`✅ [safeSendMessage] Sent to ${to}`);
      return msg;
    } catch (fallbackErr) {
      const errMsg = fallbackErr?.message || String(fallbackErr);
      if (errMsg.includes("markedUnread")) {
        // markedUnread error tapi pesan SUDAH TERKIRIM - anggap sukses
        console.log(`✅ [safeSendMessage] Sent to ${to} (markedUnread ignored)`);
        return { success: true, to };
      }
      throw fallbackErr;
    }
  } catch (error) {
    const errorMsg = error?.message || String(error);

    // Jika error markedUnread, pesan kemungkinan sudah terkirim
    if (errorMsg.includes("markedUnread")) {
      console.log(`⚠️ [safeSendMessage] markedUnread error ke ${to} (ignored)`);
      return { success: true, warning: "markedUnread", to };
    }

    console.error(`❌ [safeSendMessage] Error ke ${to}: ${errorMsg}`);
    throw error;
  }
}

module.exports = { safeReply, safeSendMessage };
