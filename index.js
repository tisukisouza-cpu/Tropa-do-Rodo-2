const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType, PermissionsBitField
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { DISCORD_TOKEN: T, CLIENT_ID: C, GUILD_ID: G } = process.env;
if (!T || !C || !G) {
  console.error('Configure DISCORD_TOKEN, CLIENT_ID e GUILD_ID nas variáveis de ambiente.');
  process.exit(1);
}

const file = path.join(__dirname, 'data.json');
const fresh = () => ({ banners: {}, recruits: [], farm: {}, farmRecords: [], chest: [], reviewChannelId: null });
function load() {
  try {
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...fresh(), ...old, farmRecords: old.farmRecords || [] };
  } catch { return fresh(); }
}
let db = load();
const save = () => fs.writeFileSync(file, JSON.stringify(db, null, 2));

const commands = [
  new SlashCommandBuilder().setName('recrutamento').setDescription('Publica o painel oficial de recrutamento'),
  new SlashCommandBuilder().setName('farme').setDescription('Publica o painel de registro de farm'),
  new SlashCommandBuilder().setName('bau').setDescription('Publica o painel de movimentações do baú'),
  new SlashCommandBuilder().setName('configuracao').setDescription('Personaliza banners e canal de recrutamento')
].map(x => x.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const admin = i => i.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
const RED = 0xC1121F, DARK = 0x191919;

const questions = [
  ['01. Nome do personagem (IC)', 'Nome do personagem (IC)'],
  ['02. ID do personagem', 'ID do personagem'],
  ['03. Qual é sua idade real?', 'Idade real'],
  ['04. Nick no Discord', 'Nick no Discord'],
  ['05. Há quanto tempo joga SA-MP?', 'Tempo jogando SA-MP'],
  ['06. Cidades/servidores em que já jogou', 'Cidades/servidores em que já jogou'],
  ['07. Possui microfone para call?', 'Possui microfone para call?'],
  ['08. O que significa RP?', 'O que significa RP?'],
  ['09. O que significa ANT RP?', 'O que significa ANT RP?'],
  ['10. O que significa RDM?', 'O que significa RDM?'],
  ['11. O que significa VDM?', 'O que significa VDM?'],
  ['12. O que significa MG (Metagaming)?', 'O que significa MG (Metagaming)?'],
  ['13. Como age se alguém provocar no jogo?', 'Como age se alguém provocar no jogo?'],
  ['14. O que faz ao ver membro quebrando regras?', 'O que faz ao ver membro quebrando regras?'],
  ['15. Aceita hierarquia e orientações dentro das regras?', 'Aceita hierarquia e orientações dentro das regras?'],
  ['16. Compromete-se a respeitar todos os membros?', 'Compromete-se a respeitar todos os membros?'],
  ['17. Por que quer entrar para a Tropa do Rodo 2?', 'Por que quer entrar para a Tropa do Rodo 2?'],
  ['18. O que pode oferecer à facção?', 'O que pode oferecer à facção?'],
  ['19. Por que escolher você?', 'Por que escolher você?'],
  ['20. Pretende ficar bastante tempo? Explique.', 'Pretende ficar bastante tempo? Explique.'],
  ['21. O que significa lealdade no RP?', 'O que significa lealdade no RP?'],
  ['22. Se não receber o cargo esperado, como reage?', 'Se não receber o cargo esperado, como reage?'],
  ['23. Se um membro desrespeitar você, o que fará?', 'Se um membro desrespeitar você, o que fará?'],
  ['24. Como reage se a liderança chamar sua atenção?', 'Como reage se a liderança chamar sua atenção?'],
  ['25. Prefere equipe ou agir sozinho? Por quê?', 'Prefere equipe ou agir sozinho? Por quê?'],
  ['26. Principal objetivo ao entrar na Tropa?', 'Principal objetivo ao entrar na Tropa?'],
  ['27. Quanto tempo por dia pode dedicar à Nova Rio RP?', 'Tempo diário disponível para Nova Rio RP'],
  ['28. Está disposto a aprender e respeitar a hierarquia?', 'Está disposto a aprender e respeitar a hierarquia?'],
  ['29. Como resolveria conflito com outro membro?', 'Como resolveria conflito com outro membro?'],
  ['30. Mensagem à liderança: por que merece oportunidade?', 'Por que merece uma oportunidade?']
];

const btn = (id, label, style = ButtonStyle.Danger, emoji) => {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
};
const row = (...items) => new ActionRowBuilder().addComponents(...items);
function embed(title, description, key, color = RED) {
  const e = new EmbedBuilder().setColor(color)
    .setAuthor({ name: '👑 TROPA DO RODO 2 • NOVA RIO RP' })
    .setTitle(title).setDescription(description)
    .setFooter({ text: 'NOVA RIO RP • RESPEITO • LEALDADE • COMPROMISSO' }).setTimestamp();
  if (key && db.banners[key]) e.setImage(db.banners[key]);
  return e;
}
function formModal(userId, page) {
  const modal = new ModalBuilder().setCustomId(`form_${userId}_${page}`).setTitle(`Ficha de recrutamento • Parte ${page + 1}/6`);
  const fields = questions.slice(page * 5, page * 5 + 5);
  modal.addComponents(...fields.map((q, ix) => {
    const input = new TextInputBuilder().setCustomId(`q${page * 5 + ix}`)
      .setLabel(q[0].slice(0, 45))
      .setStyle((page * 5 + ix >= 5 && page * 5 + ix <= 29) ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(true).setMaxLength(1000);
    return new ActionRowBuilder().addComponents(input);
  }));
  return modal;
}
async function getReviewChannel(guild) {
  if (db.reviewChannelId) {
    const existing = await guild.channels.fetch(db.reviewChannelId).catch(() => null);
    if (existing) return existing;
  }
  const everyone = guild.roles.everyone;
  const channel = await guild.channels.create({
    name: '🔒・log-recrutamento',
    type: ChannelType.GuildText,
    topic: 'Canal privado para análise das fichas da Tropa do Rodo 2. Conceda acesso apenas à liderança.',
    permissionOverwrites: [
      { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }
    ]
  });
  db.reviewChannelId = channel.id;
  save();
  return channel;
}
function formatAnswerEmbeds(recruit) {
  const intro = embed('📋 FICHA RECEBIDA • EM ANÁLISE',
    `**Candidato:** <@${recruit.user}>\n**Status:** 🟡 EM ANÁLISE\n**Enviada em:** ${recruit.createdAt}\n\n🔒 Esta ficha é para uso exclusivo da liderança.`, 'recrutamento');
  const fields = recruit.answers.map((a, n) => ({ name: questions[n][0], value: String(a || '—').slice(0, 1024), inline: false }));
  const e1 = EmbedBuilder.from(intro).addFields(fields.slice(0, 25));
  const e2 = embed('📋 FICHA DE RECRUTAMENTO • CONTINUAÇÃO',
    `**Candidato:** <@${recruit.user}>\n**Personagem:** ${String(recruit.answers[0]).slice(0, 200)}\n**Status:** 🟡 EM ANÁLISE`, 'recrutamento');
  if (fields.length > 25) e2.addFields(fields.slice(25));
  return [e1, e2];
}
function reviewButtons(id) {
  return row(
    btn(`approve_${id}`, 'Aprovar', ButtonStyle.Success, '✅'),
    btn(`reject_${id}`, 'Recusar', ButtonStyle.Danger, '❌')
  );
}

client.once('ready', () => console.log(`Bot online: ${client.user.tag}`));

client.on('interactionCreate', async i => {
  try {
    if (i.isChatInputCommand()) {
      if (!admin(i)) return i.reply({ content: '🔒 Apenas a administração pode publicar ou configurar painéis.', ephemeral: true });

      if (i.commandName === 'recrutamento') {
        const reviewChannel = await getReviewChannel(i.guild);
        return i.reply({
          embeds: [embed('☠️ RECRUTAMENTO OFICIAL • TROPA DO RODO 2',
            '🏴 **NOVA RIO RP**\n\n📋 Clique no botão para preencher sua ficha completa de 30 perguntas.\n\n🔒 **Importante:**\n• Você só pode enviar uma ficha.\n• Depois de enviar, aguarde a decisão da liderança.\n• Se for aprovado, será orientado a participar de uma entrevista por call.\n• A ficha enviada fica no canal privado de análise da liderança.\n\n🟥 **Respeito • Lealdade • Compromisso**', 'recrutamento')],
          components: [row(btn('apply', 'Iniciar ficha de inscrição', ButtonStyle.Danger, '📝'))],
          ephemeral: false
        }).then(async result => {
          console.log(`Canal privado de recrutamento: ${reviewChannel.id}`);
          return result;
        });
      }

      if (i.commandName === 'farme') {
        return i.reply({
          embeds: [embed('💰 REGISTRO DE FARM',
            'Registre suas quantidades e consulte o histórico de registros.\n\n📥 **Registrar farm** — adicionar uma quantidade ao seu histórico.\n📜 **Ver registros** — consultar os registros recentes.', 'farme')],
          components: [row(
            btn('farmadd', 'Registrar farm', ButtonStyle.Success, '💵'),
            btn('farmrecords', 'Ver registros', ButtonStyle.Secondary, '📜')
          )]
        });
      }

      if (i.commandName === 'bau') {
        return i.reply({
          embeds: [embed('📦 CONTROLE DO BAÚ',
            'Registre as entradas e retiradas e consulte o histórico das últimas movimentações.', 'bau')],
          components: [row(
            btn('chestadd', 'Registrar movimentação', ButtonStyle.Danger, '📦'),
            btn('chesthistory', 'Ver histórico', ButtonStyle.Secondary, '📜')
          )]
        });
      }

      if (i.commandName === 'configuracao') {
        return i.reply({
          ephemeral: true,
          embeds: [embed('⚙️ PERSONALIZAÇÃO DOS PAINÉIS',
            'Escolha qual banner deseja alterar. Use um link HTTPS direto de imagem PNG, JPG, GIF ou WEBP.\n\n🔒 O canal de análise de recrutamento é criado automaticamente e fica privado por padrão. Para dar acesso à liderança, abra as permissões desse canal e adicione os cargos de líderes.', null, DARK)],
          components: [
            row(btn('banner_recrutamento', 'Recrutamento', ButtonStyle.Danger, '📝'), btn('banner_farme', 'Farm', ButtonStyle.Danger, '💰')),
            row(btn('banner_bau', 'Baú', ButtonStyle.Danger, '📦'), btn('banner_registro', 'Registro', ButtonStyle.Secondary, '📜'))
          ]
        });
      }
    }

    if (i.isButton()) {
      const id = i.customId;

      if (id.startsWith('banner_')) {
        if (!admin(i)) return i.reply({ content: '🔒 Sem permissão.', ephemeral: true });
        const key = id.slice(7);
        return i.showModal(new ModalBuilder().setCustomId(`save_${key}`).setTitle('Alterar banner')
          .addComponents(row(new TextInputBuilder().setCustomId('url').setLabel('Link HTTPS direto da imagem')
            .setStyle(TextInputStyle.Short).setRequired(true))));
      }

      if (id === 'apply') {
        const prior = db.recruits.find(r => r.user === i.user.id);
        if (prior) {
          const status = prior.status === 'Pendente' ? '🟡 Sua ficha está em análise. Aguarde o resultado.' :
            prior.status === 'Aprovado' ? '✅ Sua ficha foi aprovada. Aguarde as instruções para a entrevista por call.' :
            '❌ Sua ficha foi recusada. Você não pode enviar outra ficha por este painel.';
          return i.reply({ content: status, ephemeral: true });
        }
        return i.showModal(formModal(i.user.id, 0));
      }

      if (id.startsWith('next_')) {
        const [, userId, pageStr] = id.split('_');
        const page = Number(pageStr);
        if (i.user.id !== userId) return i.reply({ content: 'Esta ficha pertence a outra pessoa.', ephemeral: true });
        const draft = i.client.pendingForms?.get(userId);
        if (!draft) return i.reply({ content: 'A ficha expirou. Inicie novamente.', ephemeral: true });
        return i.showModal(formModal(userId, page));
      }

      if (id === 'farmadd') {
        return i.showModal(new ModalBuilder().setCustomId('farm').setTitle('Registrar farm')
          .addComponents(
            row(new TextInputBuilder().setCustomId('amount').setLabel('Quantidade numérica').setStyle(TextInputStyle.Short).setRequired(true)),
            row(new TextInputBuilder().setCustomId('notes').setLabel('Observação (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false))
          ));
      }
      if (id === 'farmrecords') {
        const records = db.farmRecords.slice(-15).reverse();
        const desc = records.length
          ? records.map((r, n) => `**${n + 1}. ${r.amount}** • <@${r.user}> • ${r.date}${r.notes ? `\n_${r.notes}_` : ''}`).join('\n\n')
          : 'Ainda não há registros de farm.';
        return i.reply({ ephemeral: true, embeds: [embed('📜 REGISTROS RECENTES DE FARM', desc, 'registro')] });
      }
      if (id === 'chestadd') {
        return i.showModal(new ModalBuilder().setCustomId('chest').setTitle('Movimentação do baú')
          .addComponents(
            row(new TextInputBuilder().setCustomId('kind').setLabel('Tipo: entrada ou retirada').setStyle(TextInputStyle.Short).setRequired(true)),
            row(new TextInputBuilder().setCustomId('item').setLabel('Item/material').setStyle(TextInputStyle.Short).setRequired(true)),
            row(new TextInputBuilder().setCustomId('quantity').setLabel('Quantidade').setStyle(TextInputStyle.Short).setRequired(true)),
            row(new TextInputBuilder().setCustomId('notes').setLabel('Observação (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false))
          ));
      }
      if (id === 'chesthistory') {
        const rows = db.chest.slice(-10).reverse();
        const desc = rows.length ? rows.map(x => `**${x.kind === 'entrada' ? '📥 ENTRADA' : '📤 RETIRADA'}** • **${x.item} × ${x.quantity}**\n👤 <@${x.user}> · 🕒 ${x.date}`).join('\n\n') : 'Nenhuma movimentação registrada.';
        return i.reply({ ephemeral: true, embeds: [embed('📜 HISTÓRICO DO BAÚ', desc, 'bau')] });
      }
      if (id.startsWith('approve_') || id.startsWith('reject_')) {
        if (!admin(i)) return i.reply({ content: '🔒 Apenas a administração pode avaliar fichas.', ephemeral: true });
        const ok = id.startsWith('approve_');
        const recruitId = id.slice(ok ? 8 : 7);
        const r = db.recruits.find(x => x.id === recruitId);
        if (!r) return i.reply({ content: 'Ficha não encontrada.', ephemeral: true });
        if (r.status !== 'Pendente') return i.reply({ content: 'Esta ficha já foi avaliada.', ephemeral: true });
        r.status = ok ? 'Aprovado' : 'Recusado';
        r.reviewer = i.user.id;
        r.reviewedAt = new Date().toLocaleString('pt-BR');
        save();
        const finalEmbed = EmbedBuilder.from(i.message.embeds[0])
          .addFields({ name: '📌 RESULTADO', value: `${ok ? '✅ APROVADO' : '❌ RECUSADO'} por ${i.user}\n**Data:** ${r.reviewedAt}` });
        await i.update({ embeds: [finalEmbed], components: [] });
        const user = await client.users.fetch(r.user).catch(() => null);
        if (user) {
          const dm = ok
            ? '✅ **Sua ficha para a Tropa do Rodo 2 foi APROVADA!**\nA próxima etapa é uma entrevista por call. Aguarde a liderança enviar as instruções e o horário.'
            : '❌ **Sua ficha para a Tropa do Rodo 2 foi recusada.** Obrigado pelo interesse na Nova Rio RP.';
          await user.send(dm).catch(() => {});
        }
        return;
      }
    }

    if (i.isModalSubmit()) {
      const id = i.customId;

      if (id.startsWith('form_')) {
        const parts = id.split('_');
        const userId = parts[1], page = Number(parts[2]);
        if (i.user.id !== userId) return i.reply({ content: 'Esta ficha pertence a outra pessoa.', ephemeral: true });
        const prior = db.recruits.find(r => r.user === i.user.id);
        if (prior) return i.reply({ content: 'Você já enviou uma ficha. Aguarde o resultado da liderança.', ephemeral: true });

        if (!client.pendingForms) client.pendingForms = new Map();
        let draft = client.pendingForms.get(userId) || { answers: Array(30).fill(null), startedAt: new Date().toLocaleString('pt-BR') };
        for (let n = 0; n < 5; n++) draft.answers[page * 5 + n] = i.fields.getTextInputValue(`q${page * 5 + n}`);
        client.pendingForms.set(userId, draft);

        if (page < 5) {
          await i.reply({
            content: `✅ Parte ${page + 1}/6 salva. Continue para a próxima parte da ficha.`,
            components: [row(btn(`next_${userId}_${page + 1}`, `Continuar • Parte ${page + 2}/6`, ButtonStyle.Danger, '➡️'))],
            ephemeral: true
          });
          return;
        }

        const recruit = {
          id: String(Date.now()), user: userId, answers: draft.answers,
          status: 'Pendente', createdAt: new Date().toLocaleString('pt-BR')
        };
        db.recruits.push(recruit);
        save();
        client.pendingForms.delete(userId);
        await i.reply({
          embeds: [embed('✅ FICHA ENVIADA COM SUCESSO',
            'Sua ficha foi enviada à liderança e está **EM ANÁLISE**.\n\n⏳ Aguarde o resultado. Não é possível enviar outra ficha.\n\nSe for aprovado, você receberá uma mensagem com as instruções para a entrevista por call.', null, 0x2D8A55)],
          ephemeral: true
        });

        const guild = await client.guilds.fetch(G);
        const reviewChannel = await getReviewChannel(guild);
        const [e1, e2] = formatAnswerEmbeds(recruit);
        await reviewChannel.send({ embeds: [e1, e2], components: [reviewButtons(recruit.id)] });
        return;
      }

      if (id.startsWith('save_')) {
        if (!admin(i)) return i.reply({ content: '🔒 Sem permissão.', ephemeral: true });
        const key = id.slice(5), url = i.fields.getTextInputValue('url').trim();
        if (!/^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url)) return i.reply({ content: 'Use link HTTPS direto de uma imagem PNG, JPG, GIF ou WEBP.', ephemeral: true });
        db.banners[key] = url; save();
        return i.reply({ content: `✅ Banner de **${key}** atualizado. Publique novamente o painel para visualizar.`, ephemeral: true });
      }
      if (id === 'farm') {
        const amount = Number(i.fields.getTextInputValue('amount'));
        if (!Number.isFinite(amount) || amount <= 0) return i.reply({ content: 'Informe uma quantidade maior que zero.', ephemeral: true });
        const notes = i.fields.getTextInputValue('notes') || '';
        db.farm[i.user.id] = (db.farm[i.user.id] || 0) + amount;
        db.farmRecords.push({ user: i.user.id, amount, notes, date: new Date().toLocaleString('pt-BR') });
        save();
        return i.reply({ embeds: [embed('✅ FARM REGISTRADO', `**Quantidade adicionada:** ${amount}\n**Total acumulado:** ${db.farm[i.user.id]}`, 'farme', 0x2D8A55)], ephemeral: true });
      }
      if (id === 'chest') {
        const kind = i.fields.getTextInputValue('kind').trim().toLowerCase();
        if (!['entrada', 'retirada'].includes(kind)) return i.reply({ content: 'Escreva exatamente **entrada** ou **retirada** no campo Tipo.', ephemeral: true });
        const r = { kind, item: i.fields.getTextInputValue('item'), quantity: i.fields.getTextInputValue('quantity'), notes: i.fields.getTextInputValue('notes') || '', user: i.user.id, date: new Date().toLocaleString('pt-BR') };
        db.chest.push(r); save();
        return i.reply({ embeds: [embed('✅ MOVIMENTAÇÃO REGISTRADA', `**Tipo:** ${kind === 'entrada' ? '📥 Entrada' : '📤 Retirada'}\n**Item:** ${r.item}\n**Quantidade:** ${r.quantity}\n**Responsável:** ${i.user}`, 'bau', 0x2D8A55)], ephemeral: true });
      }
    }
  } catch (e) {
    console.error(e);
    if (i.isRepliable() && !i.replied && !i.deferred) {
      await i.reply({ content: '❌ Ocorreu um erro ao processar. Confira os logs do Render.', ephemeral: true }).catch(() => {});
    }
  }
});

async function start() {
  await new REST({ version: '10' }).setToken(T).put(Routes.applicationGuildCommands(C, G), { body: commands });
  console.log('Comandos registrados no servidor.');
  await client.login(T);
}
start().catch(e => { console.error(e); process.exit(1); });
