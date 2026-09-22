// Sistema de Controle - Grupo WhatsApp de Vendas
// Painel Web + Bot Baileys | Banco JSON (sem compilação)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

// ---------- Banco JSON ----------
function defaultDB() {
  return {
    vendedores: [
      { id: 1, nome: 'Ana Silva', telefone: '5511999990001', comissao: 10, ativo: true, totalVendas: 0 },
      { id: 2, nome: 'Carlos Souza', telefone: '5511999990002', comissao: 10, ativo: true, totalVendas: 0 }
    ],
    vendas: [],
    produtos: [
      { id: 1, nome: 'Produto Exemplo', preco: 99.9, estoque: 50 }
    ],
    config: {
      grupoId: '',
      metaMensal: 10000,
      msgBoasVindas: 'Bem-vindo(a) ao grupo de vendas! Digite !ajuda para ver os comandos.',
      relatorioDiario: true,
      horarioRelatorio: '18:00'
    },
    seq: { vendedor: 3, venda: 1, produto: 2 }
  };
}
function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) { const d = defaultDB(); fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); return d; }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { const d = defaultDB(); return d; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
let db = loadDB();

// ---------- Estado Bot ----------
let sock = null;
let qrCode = null;
let conectado = false;
let logsBot = [];

function logBot(msg) {
  const l = `[${new Date().toLocaleString('pt-BR')}] ${msg}`;
  logsBot.push(l); if (logsBot.length > 100) logsBot.shift();
  console.log(l);
}

// ---------- API: Dashboard ----------
app.get('/api/dashboard', (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = new Date().toISOString().slice(0, 7);
  const vendasHoje = db.vendas.filter(v => v.data.startsWith(hoje));
  const vendasMes = db.vendas.filter(v => v.data.startsWith(mes));
  const totalHoje = vendasHoje.reduce((s, v) => s + Number(v.valor), 0);
  const totalMes = vendasMes.reduce((s, v) => s + Number(v.valor), 0);
  const ticketMedio = db.vendas.length ? db.vendas.reduce((s, v) => s + Number(v.valor), 0) / db.vendas.length : 0;
  const ranking = [...db.vendedores].map(v => ({
    ...v,
    total: db.vendas.filter(x => x.vendedorId === v.id).reduce((s, x) => s + Number(x.valor), 0),
    qtd: db.vendas.filter(x => x.vendedorId === v.id).length
  })).sort((a, b) => b.total - a.total);
  res.json({
    totalHoje, totalMes, ticketMedio,
    qtdHoje: vendasHoje.length, qtdMes: vendasMes.length, qtdTotal: db.vendas.length,
    meta: db.config.metaMensal, pctMeta: db.config.metaMensal ? Math.round(totalMes / db.config.metaMensal * 100) : 0,
    ranking, estoqueBaixo: db.produtos.filter(p => p.estoque < 10)
  });
});

// ---------- API: Vendedores ----------
app.get('/api/vendedores', (req, res) => res.json(db.vendedores));
app.post('/api/vendedores', (req, res) => {
  const { nome, telefone, comissao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const v = { id: db.seq.vendedor++, nome, telefone: (telefone || '').replace(/\D/g, ''), comissao: Number(comissao || 10), ativo: true, totalVendas: 0 };
  db.vendedores.push(v); saveDB(db); res.json(v);
});
app.put('/api/vendedores/:id', (req, res) => {
  const v = db.vendedores.find(x => x.id === Number(req.params.id));
  if (!v) return res.status(404).json({ erro: 'Não encontrado' });
  Object.assign(v, req.body); saveDB(db); res.json(v);
});
app.delete('/api/vendedores/:id', (req, res) => {
  db.vendedores = db.vendedores.filter(x => x.id !== Number(req.params.id));
  saveDB(db); res.json({ ok: true });
});

// ---------- API: Vendas ----------
app.get('/api/vendas', (req, res) => {
  const vendas = [...db.vendas].reverse().map(v => ({
    ...v,
    vendedorNome: (db.vendedores.find(x => x.id === v.vendedorId) || {}).nome || ('ID ' + v.vendedorId)
  }));
  res.json(vendas);
});
app.post('/api/vendas', async (req, res) => {
  const { vendedorId, valor, descricao, produtoId, qtd } = req.body;
  if (!vendedorId || !valor) return res.status(400).json({ erro: 'Vendedor e valor são obrigatórios' });
  const venda = {
    id: db.seq.venda++, vendedorId: Number(vendedorId),
    valor: Number(valor), descricao: descricao || '',
    data: new Date().toISOString(), origem: req.body.origem || 'painel'
  };
  db.vendas.push(venda);
  if (produtoId) {
    const p = db.produtos.find(x => x.id === Number(produtoId));
    if (p) p.estoque = Math.max(0, p.estoque - Number(qtd || 1));
  }
  saveDB(db);
  // avisa no grupo
  const vend = db.vendedores.find(x => x.id === venda.vendedorId);
  if (vend) {
    const com = (venda.valor * (vend.comissao || 10) / 100).toFixed(2);
    await enviarGrupo(`💰 *Nova venda!*\n👤 ${vend.nome}\n💵 R$ ${venda.valor.toFixed(2)}${venda.descricao ? '\n📝 ' + venda.descricao : ''}\n🎯 Comissão: R$ ${com}`);
  }
  res.json(venda);
});
app.delete('/api/vendas/:id', (req, res) => {
  db.vendas = db.vendas.filter(x => x.id !== Number(req.params.id));
  saveDB(db); res.json({ ok: true });
});

// ---------- API: Produtos / Estoque ----------
app.get('/api/produtos', (req, res) => res.json(db.produtos));
app.post('/api/produtos', (req, res) => {
  const { nome, preco, estoque } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const p = { id: db.seq.produto++, nome, preco: Number(preco || 0), estoque: Number(estoque || 0) };
  db.produtos.push(p); saveDB(db); res.json(p);
});
app.put('/api/produtos/:id', (req, res) => {
  const p = db.produtos.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ erro: 'Não encontrado' });
  Object.assign(p, req.body); saveDB(db); res.json(p);
});
app.delete('/api/produtos/:id', (req, res) => {
  db.produtos = db.produtos.filter(x => x.id !== Number(req.params.id));
  saveDB(db); res.json({ ok: true });
});

// ---------- API: Config ----------
app.get('/api/config', (req, res) => res.json(db.config));
app.post('/api/config', (req, res) => {
  Object.assign(db.config, req.body); saveDB(db); res.json(db.config);
});

// ---------- API: Grupo / Bot ----------
app.get('/api/grupo/status', (req, res) => res.json({ conectado, qr: qrCode, grupoId: db.config.grupoId, logs: logsBot.slice(-20) }));
app.post('/api/grupo/enviar', async (req, res) => {
  const { msg } = req.body;
  if (!msg) return res.status(400).json({ erro: 'Mensagem vazia' });
  const ok = await enviarGrupo(msg);
  res.json({ ok });
});
app.post('/api/grupo/relatorio', async (req, res) => {
  await enviarRelatorio();
  res.json({ ok: true });
});

// ---------- Funções Bot ----------
async function enviarGrupo(texto) {
  try {
    if (!sock || !conectado || !db.config.grupoId) { logBot('(painel) Sem conexão — mensagem não enviada ao grupo: ' + texto.slice(0, 60)); return false; }
    await sock.sendMessage(db.config.grupoId, { text: texto });
    return true;
  } catch (e) { logBot('Erro ao enviar: ' + e.message); return false; }
}

async function enviarRelatorio() {
  const mes = new Date().toISOString().slice(0, 7);
  const vendasMes = db.vendas.filter(v => v.data.startsWith(mes));
  const total = vendasMes.reduce((s, v) => s + Number(v.valor), 0);
  const ranking = [...db.vendedores].map(v => ({
    nome: v.nome,
    total: vendasMes.filter(x => x.vendedorId === v.id).reduce((s, x) => s + Number(x.valor), 0)
  })).sort((a, b) => b.total - a.total);
  let txt = `📊 *Relatório de vendas — ${mes}*\n💰 Total: R$ ${total.toFixed(2)}\n🧾 Vendas: ${vendasMes.length}\n🎯 Meta: R$ ${Number(db.config.metaMensal).toFixed(2)} (${db.config.metaMensal ? Math.round(total / db.config.metaMensal * 100) : 0}%)\n\n🏆 *Ranking:*\n`;
  ranking.forEach((r, i) => { txt += `${i + 1}º ${r.nome} — R$ ${r.total.toFixed(2)}\n`; });
  await enviarGrupo(txt);
}

async function iniciarBot() {
  try {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@whiskeysockets/baileys');
    const { default: QRCode } = await import('qrcode');
    const { Boom } = await import('@hapi/boom').catch(() => ({ Boom: null }));
    const pino = (await import('pino')).default;
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr) { qrCode = await QRCode.toDataURL(qr); logBot('QR Code gerado — escaneie no painel.'); }
      if (connection === 'open') { conectado = true; qrCode = null; logBot('✅ Bot conectado ao WhatsApp!'); }
      if (connection === 'close') {
        conectado = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        logBot('Conexão fechada (' + code + '). Reconectando em 5s...');
        setTimeout(iniciarBot, 5000);
      }
    });
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          if (!m.message || m.key.fromMe) continue;
          const texto = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
          const remetente = m.key.remoteJid || '';
          const pushName = m.pushName || 'Vendedor';
          if (!texto.startsWith('!')) continue;

          // auto-configura grupo no primeiro comando vindo de grupo
          if (remetente.endsWith('@g.us') && !db.config.grupoId) {
            db.config.grupoId = remetente; saveDB(db);
            logBot('Grupo detectado e salvo: ' + remetente);
          }

          const [cmd, ...args] = texto.split(' ');
          const numero = (m.key.participant || remetente).replace(/\D/g, '');

          if (cmd === '!ajuda') {
            await sock.sendMessage(remetente, { text: '🤖 *Comandos:*\n!venda VALOR DESCRIÇÃO — registrar venda\n!ranking — top vendedores do mês\n!meta — progresso da meta\n!estoque — ver estoque\n!ajuda — esta ajuda' });
          }
          else if (cmd === '!venda') {
            const valor = parseFloat((args[0] || '').replace(',', '.'));
            const desc = args.slice(1).join(' ');
            if (!valor) { await sock.sendMessage(remetente, { text: '⚠️ Uso: !venda 150 Pix cliente X' }); continue; }
            let vend = db.vendedores.find(v => (v.telefone || '').includes(numero.slice(-8)));
            if (!vend) { // cadastra automaticamente
              vend = { id: db.seq.vendedor++, nome: pushName, telefone: numero, comissao: 10, ativo: true, totalVendas: 0 };
              db.vendedores.push(vend);
            }
            const venda = { id: db.seq.venda++, vendedorId: vend.id, valor, descricao: desc, data: new Date().toISOString(), origem: 'whatsapp' };
            db.vendas.push(venda); saveDB(db);
            const com = (valor * (vend.comissao || 10) / 100).toFixed(2);
            await sock.sendMessage(remetente, { text: `✅ Venda registrada!\n👤 ${vend.nome}\n💵 R$ ${valor.toFixed(2)}\n🎯 Sua comissão: R$ ${com}` });
          }
          else if (cmd === '!ranking') {
            const mes = new Date().toISOString().slice(0, 7);
            const vm = db.vendas.filter(v => v.data.startsWith(mes));
            const rk = [...db.vendedores].map(v => ({ nome: v.nome, total: vm.filter(x => x.vendedorId === v.id).reduce((s, x) => s + Number(x.valor), 0) })).sort((a, b) => b.total - a.total).slice(0, 10);
            let t = '🏆 *Ranking do mês:*\n';
            rk.forEach((r, i) => t += `${i + 1}º ${r.nome} — R$ ${r.total.toFixed(2)}\n`);
            await sock.sendMessage(remetente, { text: t });
          }
          else if (cmd === '!meta') {
            const mes = new Date().toISOString().slice(0, 7);
            const total = db.vendas.filter(v => v.data.startsWith(mes)).reduce((s, v) => s + Number(v.valor), 0);
            const pct = db.config.metaMensal ? Math.round(total / db.config.metaMensal * 100) : 0;
            await sock.sendMessage(remetente, { text: `🎯 *Meta:* R$ ${total.toFixed(2)} / R$ ${Number(db.config.metaMensal).toFixed(2)} (${pct}%)` });
          }
          else if (cmd === '!estoque') {
            let t = '📦 *Estoque:*\n';
            db.produtos.forEach(p => t += `• ${p.nome} — ${p.estoque} un (R$ ${Number(p.preco).toFixed(2)})\n`);
            await sock.sendMessage(remetente, { text: t });
          }
        } catch (e) { logBot('Erro msg: ' + e.message); }
      }
    });
    // boas-vindas membros novos
    sock.ev.on('group-participants.update', async (u) => {
      try {
        if (u.action === 'add' && db.config.msgBoasVindas) {
          await sock.sendMessage(u.id, { text: db.config.msgBoasVindas });
        }
      } catch {}
    });
  } catch (e) {
    logBot('Bot em modo manual (instale deps: npm install). ' + e.message);
  }
}

// relatório diário automático
setInterval(() => {
  try {
    if (!db.config.relatorioDiario) return;
    const agora = new Date().toTimeString().slice(0, 5);
    if (agora === (db.config.horarioRelatorio || '18:00')) enviarRelatorio();
  } catch {}
}, 30 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Painel rodando em http://localhost:${PORT}`);
  iniciarBot();
});
