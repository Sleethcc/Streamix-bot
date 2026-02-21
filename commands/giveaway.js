const fs = require('fs');
const isAdmin = require('../lib/isAdmin');
const { channelInfo } = require('../lib/messageConfig');

const giveawayPath = './data/giveaway.json';

// ==========================
// UTILITIES
// ==========================

function loadData() {
    try {
        if (!fs.existsSync(giveawayPath)) {
            fs.writeFileSync(giveawayPath, JSON.stringify({}, null, 2));
        }
        return JSON.parse(fs.readFileSync(giveawayPath));
    } catch {
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(giveawayPath, JSON.stringify(data, null, 2));
}

function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s}s`;
}

function pickMultipleWinners(participants, count) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// ==========================
// GIVEAWAY COMMAND
// ==========================

async function giveawayCommand(sock, chatId, message, args) {

    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, {
            text: ' This command only works in groups.',
            ...channelInfo
        }, { quoted: message });
    }

    const senderId = message.key.participant || message.key.remoteJid;
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
        return sock.sendMessage(chatId, {
            text: '⚠️ The bot must be admin.',
            ...channelInfo
        }, { quoted: message });
    }

    const data = loadData();
    const action = args[0];

    // ================= START =================
    if (action === 'start') {

        if (!isSenderAdmin && !message.key.fromMe) {
            return sock.sendMessage(chatId, {
                text: ' Only admins can start a giveaway.',
                ...channelInfo
            }, { quoted: message });
        }

        if (data[chatId]?.active) {
            return sock.sendMessage(chatId, {
                text: '⚠️ A giveaway is already active.',
                ...channelInfo
            }, { quoted: message });
        }

        let duration = 5;       // default 5 minutes
        let winnersCount = 1;   // default 1 winner
        let prize = '';

        if (!isNaN(parseInt(args[1]))) {
            duration = parseInt(args[1]) || 5;
            winnersCount = parseInt(args[2]) || 1;
            prize = args.slice(3).join(' ');
        } else {
            prize = args.slice(1).join(' ');
        }

        if (!prize) {
            return sock.sendMessage(chatId, {
                text: 'Usage:\n.giveaway start <minutes> <winners> <prize>\nOR\n.giveaway start <prize>',
                ...channelInfo
            }, { quoted: message });
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const allMembers = groupMetadata.participants.map(p => p.id);

        const endTime = Date.now() + duration * 60000;

        data[chatId] = {
            active: true,
            prize,
            winnersCount,
            participants: [],
            endTime
        };

        saveData(data);

        await sock.sendMessage(chatId, {
            text:
`╭━〔 🐋 𝐆𝐈𝐕𝐄𝐀𝐖𝐀𝐘 🐋〕━━⬣
╰━━━━━━━━━━━━━━━━━━⬣

🏆 𝐏𝐑𝐈𝐙𝐄: *${prize}*
👑 𝐖𝐈𝐍𝐍𝐄𝐑𝐒: *${winnersCount}*
⏳ 𝐃𝐔𝐑𝐀𝐓𝐈𝐎𝐍: *${duration} minute(s)*
🐋 *Type .join to participate*`,
            mentions: allMembers,
            ...channelInfo
        });

        // AUTO TIMER
        setTimeout(async () => {

            const fresh = loadData();
            if (!fresh[chatId]?.active) return;

            const participants = fresh[chatId].participants;

            const groupMetadata = await sock.groupMetadata(chatId);
            const allMembersEnd = groupMetadata.participants.map(p => p.id);

            if (participants.length === 0) {
                delete fresh[chatId];
                saveData(fresh);
                return sock.sendMessage(chatId, {
                    text: '🐋 *Giveaway ended with no participants*.',
                    mentions: allMembersEnd,
                    ...channelInfo
                });
            }

            const winners = pickMultipleWinners(
                participants,
                Math.min(fresh[chatId].winnersCount, participants.length)
            );

            await sock.sendMessage(chatId, {
                text:
`╭━━〔 🐋 𝐑𝐄𝐒𝐔𝐋𝐓𝐒 🐋〕━━⬣
╰━━━━━━━━━━━━━━━━━━⬣


🏆 𝐏𝐑𝐈𝐙𝐄: *${fresh[chatId].prize}*

🥇 𝐖𝐈𝐍𝐍𝐄𝐑𝐒(𝐒):
${winners.map((w, i) => `${i + 1}. @${w.split('@')[0]}`).join('\n')}

🎊 𝐂𝐎𝐍𝐆𝐑𝐀𝐓𝐔𝐋𝐀𝐓𝐈𝐎𝐍𝐒!`,
                mentions: [...allMembersEnd, ...winners],
                ...channelInfo
            });

            delete fresh[chatId];
            saveData(fresh);

        }, duration * 60000);

        return;
    }

    // ================= PARTICIPANTS =================
    if (action === 'members') {

        if (!data[chatId]?.active) {
            return sock.sendMessage(chatId, {
                text: '🐋 *No active giveaway*.',
                ...channelInfo
            }, { quoted: message });
        }

        const participants = data[chatId].participants;

        if (participants.length === 0) {
            return sock.sendMessage(chatId, {
                text:
`╭━━━〔 🐋 𝐓𝐎𝐓𝐀𝐋〕━━━⬣
╰━━━━━━━━━━━━━━━━━━⬣

*No one has joined yet*.`,
                ...channelInfo
            }, { quoted: message });
        }

        const list = participants
            .map((p, i) => `${i + 1}. @${p.split('@')[0]}`)
            .join('\n');

        return sock.sendMessage(chatId, {
            text:
`╭━━━〔 🐋 𝐓𝐎𝐓𝐀𝐋 *${participants.length}*〕━━━━⬣
╰━━━━━━━━━━━━━━━━━━⬣

${list}`,
            mentions: participants,
            ...channelInfo
        }, { quoted: message });
    }

    // ================= END MANUAL =================
    if (action === 'end') {

        if (!data[chatId]?.active) {
            return sock.sendMessage(chatId, {
                text: '🐋 *No active giveaway*.',
                ...channelInfo
            }, { quoted: message });
        }

        const participants = data[chatId].participants;

        const groupMetadata = await sock.groupMetadata(chatId);
        const allMembers = groupMetadata.participants.map(p => p.id);

        if (participants.length === 0) {
            delete data[chatId];
            saveData(data);
            return sock.sendMessage(chatId, {
                text: '🐋 *No members*.',
                mentions: allMembers,
                ...channelInfo
            });
        }

        const winners = pickMultipleWinners(
            participants,
            Math.min(data[chatId].winnersCount, participants.length)
        );

        await sock.sendMessage(chatId, {
            text:
`╭━━〔 🐋 𝐑𝐄𝐒𝐔𝐋𝐓𝐒 🐋〕━━⬣
╰━━━━━━━━━━━━━━━━━━⬣

🏆 𝐏𝐑𝐈𝐙𝐄: *${data[chatId].prize}*

🥇 𝐖𝐈𝐍𝐍𝐄𝐑𝐒(𝐒):
${winners.map((w, i) => `${i + 1}. @${w.split('@')[0]}`).join('\n')}

🎊 𝐂𝐎𝐍𝐆𝐑𝐀𝐓𝐔𝐋𝐀𝐓𝐈𝐎𝐍𝐒!`,
            mentions: [...allMembers, ...winners],
            ...channelInfo
        });

        delete data[chatId];
        saveData(data);
        return;
    }

    return sock.sendMessage(chatId, {
        text:
`╭━〔 🐋 *Available commands* 〕━⬣
┃ ✦ .giveaway start <minutes>\n┃<winners> <prize>
┃ ✦ .giveaway end
┃ ✦ .giveaway info
┃ ✦ .giveaway cancel
┃ ✦ .giveaway members
╰━━━━━━━━━━━━━━━━━━⬣`,
        ...channelInfo
    }, { quoted: message });
}

// ==========================
// JOIN
// ==========================

async function joinGiveaway(sock, chatId, message) {

    if (!chatId.endsWith('@g.us')) return;

    const senderId = message.key.participant || message.key.remoteJid;
    const data = loadData();

    if (!data[chatId]?.active) {
        return sock.sendMessage(chatId, {
            text: '🐋 *No active giveaway*.',
            ...channelInfo
        }, { quoted: message });
    }

    if (data[chatId].participants.includes(senderId)) {
        return;
    }

    data[chatId].participants.push(senderId);
    saveData(data);

    return sock.sendMessage(chatId, {
        text: `✅ @${senderId.split('@')[0]} *joined the giveaway!* *(${data[chatId].participants.length} participants)*`,
        mentions: [senderId],
        ...channelInfo
    });
}

module.exports = {
    giveawayCommand,
    joinGiveaway
};