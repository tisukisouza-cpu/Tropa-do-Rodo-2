# Tropa do Rodo 2 — Nova Rio RP

Bot inicial com `/recrutamento`, `/farme`, `/bau` e `/configuracao`.

## Variáveis obrigatórias
- `DISCORD_TOKEN`: token do bot; mantenha secreto.
- `CLIENT_ID`: ID da aplicação no Discord Developer Portal.
- `GUILD_ID`: ID do servidor Discord.

## Iniciar
`npm install`
`npm start`

**Aviso:** esta versão inicial guarda informações em `data.json`. Em hospedagem gratuita com disco efêmero, os dados podem sumir após reinícios ou novos deploys. Antes de usar oficialmente, conecte um banco persistente. Nunca coloque o token no GitHub.
