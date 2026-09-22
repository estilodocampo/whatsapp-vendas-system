# Sistema de Controle — Grupo WhatsApp de Vendas

Painel Web + Bot WhatsApp (Baileys). Sem banco externo — usa `db.json`.

## Como rodar
1. Duplo clique em `iniciar.bat` (instala deps na 1ª vez)
   - Ou manual: `"C:\Program Files\nodejs\npm.cmd" install` depois `"C:\Program Files\nodejs\node.exe" server.js`
2. Abra http://localhost:3000
3. Vá em **Grupo / Bot** e escaneie o QR Code com o WhatsApp
4. Adicione o bot ao grupo e digite `!ajuda` no grupo

## Funcionalidades
- Dashboard: vendido hoje/mês, ticket médio, % meta, ranking, estoque baixo
- Vendas: registro manual + automático via `!venda 150 Pix Maria`
- Vendedores: cadastro, telefone, comissão %, auto-cadastro pelo WhatsApp
- Estoque: produtos, preço, baixa automática
- Bot: `!venda !ranking !meta !estoque !ajuda`, boas-vindas, relatório diário auto, aviso de nova venda no grupo
- Painel envia avisos ao grupo

## API
GET /api/dashboard /api/vendedores /api/vendas /api/produtos /api/config /api/grupo/status
POST /api/vendedores /api/vendas /api/produtos /api/config /api/grupo/enviar /api/grupo/relatorio
