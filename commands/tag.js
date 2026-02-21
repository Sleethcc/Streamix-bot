const isAdmin = require('../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const SIGNATURE = '\n\n✦ 𝐒𝐭𝐫𝐞𝐚𝐦𝐢𝐱 🐋';

async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { 
            text: 'Please make the bot an admin first.' + SIGNATURE 
        }, { quoted: message });
        return;
    }

    if (!isSenderAdmin) {
        const stickerPath = './assets/sticktag.webp';
        if (fs.existsSync(stickerPath)) {
            const stickerBuffer = fs.readFileSync(stickerPath);
            await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: message });
        }
        return;
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;
    const mentionedJidList = participants.map(p => p.id);

    if (replyMessage) {
        let messageContent = {};

        // IMAGE
        if (replyMessage.imageMessage) {
            const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
            messageContent = {
                image: { url: filePath },
                caption: (messageText || replyMessage.imageMessage.caption || '') + SIGNATURE,
                mentions: mentionedJidList
            };
        }

        // VIDEO
        else if (replyMessage.videoMessage) {
            const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
            messageContent = {
                video: { url: filePath },
                caption: (messageText || replyMessage.videoMessage.caption || '') + SIGNATURE,
                mentions: mentionedJidList
            };
        }

        // TEXT
        else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
            const originalText =
                replyMessage.conversation ||
                replyMessage.extendedTextMessage.text;

            messageContent = {
                text: originalText + SIGNATURE,
                mentions: mentionedJidList
            };
        }

        // DOCUMENT
        else if (replyMessage.documentMessage) {
            const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
            messageContent = {
                document: { url: filePath },
                fileName: replyMessage.documentMessage.fileName,
                caption: (messageText || '') + SIGNATURE,
                mentions: mentionedJidList
            };
        }

        if (Object.keys(messageContent).length > 0) {
            await sock.sendMessage(chatId, messageContent);
        }

    } else {
        await sock.sendMessage(chatId, {
            text: (messageText || "Tagged message") + SIGNATURE,
            mentions: mentionedJidList
        });
    }
}

module.exports = tagCommand;