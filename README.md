# Tropa do Rodo 2 — Recrutamento completo

## O que esta versão faz
- Formulário de recrutamento com as 30 perguntas enviadas, dividido em 6 partes de 5 perguntas (limite dos modais do Discord).
- Bloqueia nova inscrição se a pessoa já enviou uma ficha.
- A ficha enviada fica pendente e aparece no canal privado `🔒・log-recrutamento`.
- A liderança avalia com os botões **Aprovar** e **Recusar**.
- Ao aprovar, o candidato recebe DM informando que a próxima etapa é entrevista por call e que deve aguardar instruções.
- O painel de farm usa **Registrar farm** e **Ver registros**, sem ranking.
- Painéis e banners seguem o tema preto/vermelho.

## Instalar pelo celular
1. Baixe e extraia o ZIP.
2. Abra seu repositório GitHub `Tropa-do-Rodo-2`.
3. Edite o arquivo `index.js`, substitua TODO o conteúdo pelo `index.js` deste ZIP e faça **Commit changes**.
4. O Render deve iniciar um novo deploy automaticamente.
5. Depois do deploy, use `/recrutamento` para publicar o novo painel. O canal privado de análise será criado automaticamente.
6. Abra as permissões de `🔒・log-recrutamento` e adicione os cargos da liderança que podem ver as fichas. O canal fica oculto para @everyone por padrão; administradores continuam com acesso.

## Atenção
- Não altere `DISCORD_TOKEN`, `CLIENT_ID` e `GUILD_ID` no Render.
- Nunca publique o token no GitHub nem envie para ninguém.
- As fichas ficam guardadas em `data.json`; em hospedagem com armazenamento efêmero, os dados podem se perder após reinícios/deploys. Para produção, configure banco de dados persistente.
- A ficha é bloqueada por usuário Discord após o envio, mesmo que seja recusada.
- A DM do resultado pode falhar se a pessoa bloquear mensagens diretas; a decisão fica registrada no canal privado.
- O Discord limita modais a 5 campos por tela, por isso a ficha tem 6 partes.
- O serviço gratuito do Render pode suspender; não há garantia de 24/7.
