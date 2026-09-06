const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9hzTgKSYAKp1u39ftbASW4MpM2r4-1M_aWngzoZLSbfl8xYK4VSlo3l-e2xtKHqhM/exec';

async function sendToSheet(message, sender) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sender })
    });
    return await res.json().catch(()=>({}));
  } catch (e) {
    console.error(e.message);
    return null;
  }
}

function parseMessage(text){
  if(!text) return null;
  if(text.trim().toUpperCase() === 'SALDO') return { type: 'SALDO' };
  if(!text.includes('#')) return null;
  const p = text.split('#');
  if(p.length < 3) return null;
  return {
    type: p[0].toUpperCase(),
    nama: p[1]?.trim(),
    nominal: parseInt((p[2]||'0').replace(/[^0-9]/g,'')),
    kategori: p[3]?.trim() || 'Iuran Bulanan'
  };
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Kas EF Bot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr){
      console.log('===== SCAN QR DI LOGS RENDER =====');
    }
    if(connection === 'close'){
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode!== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
    } else if(connection === 'open'){
      console.log('✅ Bot WA Kas EF Terhubung!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const remoteJid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    console.log(`Pesan: ${text}`);

    const parsed = parseMessage(text);
    if(!parsed) return;

    if(parsed.type === 'SALDO'){
      await sock.sendMessage(remoteJid, { text: `💰 Cek saldo: https://budidarwin00.github.io/Areaef-aski1/` });
      return;
    }

    const sheetRes = await sendToSheet(text, remoteJid);
    const reply = sheetRes?.reply || `✅ Tercatat ${parsed.nama} Rp ${parsed.nominal.toLocaleString('id-ID')}`;
    await sock.sendMessage(remoteJid, { text: reply });
  });
}

startBot();
