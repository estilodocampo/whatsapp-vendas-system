# Deploy no Railway

## Opção A — pelo painel (recomendado, sem CLI)
1. Acesse https://railway.app/new
2. Clique em **Deploy from GitHub repo** (conecte sua conta GitHub se pedir)
3. Selecione `estilodocampo/whatsapp-vendas-system`
4. Railway detecta Node sozinho (`npm install` + `node server.js`)
5. Em **Settings → Networking → Generate Domain** para obter a URL pública
6. Abra `https://SUA-URL/api/dashboard` — deve retornar JSON
7. Abra `https://SUA-URL/` e escaneie o QR na aba **Grupo / Bot**

> ⚠️ Arquivos `auth/` (sessão WhatsApp) e `db.json` são apagados a cada redeploy.
> Em **Volumes → New Volume**, monte em `/app/auth` para manter a sessão do bot logada.

## Opção B — via CLI
```bash
railway login
railway link   # selecione o projeto
railway up
railway domain # gera URL pública
```
