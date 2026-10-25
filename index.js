const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

const { DISCORD_TOKEN: T, CLIENT_ID: C, GUILD_ID: G } = process.env;
const REVIEW_CHANNEL_ID = '1563709838142349342';

if (!T || !C || !G) {
  console.error('Configure DISCORD_TOKEN, CLIENT_ID e GUILD_ID.');
  process.exit(1);
}

const file = path.join(__dirname, 'data.json');

const fresh = () => ({
  banners: {},
  recruits: [],
  farm: {},
  farmRecords: [],
  chest: [],
  reviewChannelId: null
});

function load() {
  try {
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      ...fresh(),
      ...old,
      banners: { ...fresh().banners, ...(old.banners || {}) },
      recruits: Array.isArray(old.recruits) ? old.recruits : [],
      farm: old.farm && typeof old.farm === 'object' ? old.farm : {},
      farmRecords: Array.isArray(old.farmRecords) ? old.farmRecords : [],
      chest: Array.isArray(old.chest) ? old.chest : []
    };
  } catch {
    return fresh();
  }
}

let db = load();
const save = () =>
  fs.writeFileSync(file, JSON.stringify(db, null, 2));

const commands = [
  new SlashCommandBuilder()
    .setName('recrutamento')
    .setDescription('Publica o painel de recrutamento'),

  new SlashCommandBuilder()
    .setName('farme')
    .setDescription('Publica o painel de registro de farm'),

  new SlashCommandBuilder()
    .setName('bau')
    .setDescription('Publica o painel de movimentações do baú'),

  new SlashCommandBuilder()
    .setName('configuracao')
    .setDescription('Personaliza banners e configurações')
].map(x => x.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.pendingForms = new Map();

const admin = i => Boolean(
  i.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
);

const RED = 0xC1121F;

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
  const b = new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style);

  if (emoji) b.setEmoji(emoji);
  return b;
};

const row = (...items) =>
  new ActionRowBuilder().addComponents(...items);

function embed(title, description, key, color = RED) {
  const e = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: '👑 TROPA DO RODO 2 • NOVA RIO RP' })
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: 'NOVA RIO RP • RESPEITO • LEALDADE • COMPROMISSO'
    })
    .setTimestamp();

  if (key && db.banners[key]) e.setImage(db.banners[key]);
  return e;
  }
async function getReviewChannel(guild) {
  const channel = await guild.channels.fetch(REVIEW_CHANNEL_ID);

  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(
      `O canal privado ${REVIEW_CHANNEL_ID} não foi encontrado.`
    );
  }

  const me = guild.members.me ||
    await guild.members.fetch(client.user.id);

  const permissions = channel.permissionsFor(me);

  if (
    !permissions?.has(PermissionFlagsBits.ViewChannel) ||
    !permissions?.has(PermissionFlagsBits.SendMessages) ||
    !permissions?.has(PermissionFlagsBits.EmbedLinks)
  ) {
    throw new Error(
      'O bot precisa de Ver Canal, Enviar Mensagens e Incorporar Links no canal de recrutamento.'
    );
  }

  return channel;
}

function createRecruitmentPanel(channelId) {
  return embed(
    '📋 RECRUTAMENTO OFICIAL',
    [
      'Faça sua inscrição para a **Tropa do Rodo 2**.',
      '',
      '📝 Clique no botão abaixo e responda ao formulário.',
      '🔒 Sua ficha será enviada para o canal privado da liderança.',
      `📨 Canal de análise: <#${channelId}>`,
      '',
      '⚠️ Responda com sinceridade e respeite as regras da Nova Rio RP.'
    ].join('\n'),
    'recruitment'
  );
}

function createFarmPanel() {
  return embed(
    '💰 REGISTRO DE FARM',
    [
      'Utilize os botões abaixo para registrar seu farm.',
      '',
      '📥 **Registrar entrada:** informe o valor arrecadado.',
      '📊 **Consultar registros:** veja os registros disponíveis.'
    ].join('\n'),
    'farm'
  );
}

function createChestPanel() {
  return embed(
    '📦 CONTROLE DO BAÚ',
    [
      'Registre as movimentações do baú da facção.',
      '',
      '📥 **Entrada:** registrar item ou dinheiro recebido.',
      '📤 **Saída:** registrar item ou dinheiro retirado.',
      '',
      '⚠️ Informe os dados corretamente.'
    ].join('\n'),
    'chest'
  );
}

function createRecruitmentButtons() {
  return row(
    btn('recruit_apply', 'Preencher ficha', ButtonStyle.Success, '📝')
  );
}

function createFarmButtons() {
  return row(
    btn('farm_add', 'Registrar farm', ButtonStyle.Success, '💰'),
    btn('farm_view', 'Consultar farm', ButtonStyle.Secondary, '📊')
  );
}

function createChestButtons() {
  return row(
    btn('chest_in', 'Entrada', ButtonStyle.Success, '📥'),
    btn('chest_out', 'Saída', ButtonStyle.Danger, '📤'),
    btn('chest_view', 'Consultar', ButtonStyle.Secondary, '📋')
  );
}

function createReviewButtons(recruitId) {
  return row(
    btn(`recruit_approve_${recruitId}`, 'Aprovar', ButtonStyle.Success, '✅'),
    btn(`recruit_reject_${recruitId}`, 'Recusar', ButtonStyle.Danger, '❌')
  );
}

function makeRecruitmentModal() {
  const modal = new ModalBuilder()
    .setCustomId('recruitment_form')
    .setTitle('Ficha de recrutamento');

  for (let i = 0; i < 5; i++) {
    const [label, placeholder] = questions[i];

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`answer_${i}`)
          .setLabel(label.slice(0, 45))
          .setPlaceholder(placeholder.slice(0, 100))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      )
    );
  }

  return modal;
}

function makeExtraQuestionModal(startIndex) {
  const modal = new ModalBuilder()
    .setCustomId(`recruitment_extra_${startIndex}`)
    .setTitle(`Ficha • Perguntas ${startIndex + 1}–${Math.min(startIndex + 5, questions.length)}`);

  for (let i = startIndex; i < Math.min(startIndex + 5, questions.length); i++) {
    const [label, placeholder] = questions[i];

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`answer_${i}`)
          .setLabel(label.slice(0, 45))
          .setPlaceholder(placeholder.slice(0, 100))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
  }

  return modal;
}

function makeFarmModal() {
  const modal = new ModalBuilder()
    .setCustomId('farm_modal')
    .setTitle('Registro de farm');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('farm_amount')
        .setLabel('Valor arrecadado')
        .setPlaceholder('Ex.: 5000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20)
    )
  );

  return modal;
}

function makeChestModal(direction) {
  const modal = new ModalBuilder()
    .setCustomId(`chest_modal_${direction}`)
    .setTitle(direction === 'in' ? 'Entrada no baú' : 'Saída do baú');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('chest_item')
        .setLabel('Item ou dinheiro')
        .setPlaceholder('Informe o item e a quantidade')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('chest_reason')
        .setLabel('Motivo da movimentação')
        .setPlaceholder('Explique o motivo')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    )
  );

  return modal;
}

function formatAnswerEmbeds(recruit) {
  const e = embed(
    `📋 Ficha de ${recruit.username}`,
    [
      `**Candidato:** <@${recruit.userId}>`,
      `**ID da ficha:** \`${recruit.id}\``,
      `**Status:** ${recruit.status}`,
      '',
      ...recruit.answers.map(
        (answer, index) =>
          `**${questions[index][0]}**\n${answer || 'Não informado'}`
      )
    ].join('\n\n'),
    'recruitment'
  );

  return [e];
}

function findRecruit(id) {
  return db.recruits.find(r => r.id === id);
}

function createRecruitId() {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

async function publishPanel(interaction, panel, components) {
  await interaction.channel.send({
    embeds: [panel],
    components
  });

  await interaction.reply({
    content: '✅ Painel publicado com sucesso!',
    ephemeral: true
  });
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(T);

  await rest.put(
    Routes.applicationGuildCommands(C, G),
    { body: commands }
  );

  console.log('Comandos registrados na guild configurada.');
}

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
});
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.inGuild()) {
        return interaction.reply({
          content: 'Este comando só pode ser usado em um servidor.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'recrutamento') {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Você precisa ser administrador para publicar este painel.',
            ephemeral: true
          });
        }

        const reviewChannel = await getReviewChannel(interaction.guild);

        return publishPanel(
          interaction,
          createRecruitmentPanel(reviewChannel.id),
          [createRecruitmentButtons()]
        );
      }

      if (interaction.commandName === 'farme') {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Você precisa ser administrador.',
            ephemeral: true
          });
        }

        return publishPanel(
          interaction,
          createFarmPanel(),
          [createFarmButtons()]
        );
      }

      if (interaction.commandName === 'bau') {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Você precisa ser administrador.',
            ephemeral: true
          });
        }

        return publishPanel(
          interaction,
          createChestPanel(),
          [createChestButtons()]
        );
      }

      if (interaction.commandName === 'configuracao') {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Você precisa ser administrador.',
            ephemeral: true
          });
        }

        const panel = embed(
          '⚙️ CONFIGURAÇÃO',
          [
            '**Banners:** configure a imagem dos painéis.',
            '',
            'Use os botões para escolher qual banner alterar.',
            'O canal de recrutamento é fixo:',
            `<#${REVIEW_CHANNEL_ID}>`
          ].join('\n'),
          'config'
        );

        return interaction.reply({
          embeds: [panel],
          components: [
            row(
              btn('banner_recruitment', 'Banner recrutamento'),
              btn('banner_farm', 'Banner farm'),
              btn('banner_chest', 'Banner baú')
            )
          ],
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'recruit_apply') {
        return interaction.showModal(makeRecruitmentModal());
      }

      if (id.startsWith('recruit_approve_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Apenas a liderança pode avaliar fichas.',
            ephemeral: true
          });
        }

        const recruitId = id.slice('recruit_approve_'.length);
        const recruit = findRecruit(recruitId);

        if (!recruit) {
          return interaction.reply({
            content: 'Ficha não encontrada.',
            ephemeral: true
          });
        }

        recruit.status = 'Aprovado';
        recruit.reviewer = interaction.user.id;
        recruit.reviewedAt = new Date().toISOString();
        save();

        await interaction.update({
          embeds: [
            embed(
              `✅ Ficha aprovada — ${recruit.username}`,
              `Candidato: <@${recruit.userId}>\nResponsável: <@${interaction.user.id}>`,
              'recruitment',
              0x2ECC71
            )
          ],
          components: []
        });

        try {
          const user = await client.users.fetch(recruit.userId);
          await user.send(
            '✅ Sua ficha para a Tropa do Rodo 2 foi aprovada! Procure a liderança da Nova Rio RP.'
          );
        } catch {}

        return;
      }

      if (id.startsWith('recruit_reject_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Apenas a liderança pode avaliar fichas.',
            ephemeral: true
          });
        }

        const recruitId = id.slice('recruit_reject_'.length);
        const recruit = findRecruit(recruitId);

        if (!recruit) {
          return interaction.reply({
            content: 'Ficha não encontrada.',
            ephemeral: true
          });
        }

        recruit.status = 'Recusado';
        recruit.reviewer = interaction.user.id;
        recruit.reviewedAt = new Date().toISOString();
        save();

        await interaction.update({
          embeds: [
            embed(
              `❌ Ficha recusada — ${recruit.username}`,
              `Candidato: <@${recruit.userId}>\nResponsável: <@${interaction.user.id}>`,
              'recruitment',
              0x7F1D1D
            )
          ],
          components: []
        });

        try {
          const user = await client.users.fetch(recruit.userId);
          await user.send(
            'Sua ficha para a Tropa do Rodo 2 não foi aprovada desta vez. Você pode conversar com a liderança para obter orientações.'
          );
        } catch {}

        return;
      }

      if (id === 'farm_add') {
        return interaction.showModal(makeFarmModal());
      }

      if (id === 'farm_view') {
        const records = db.farmRecords.slice(-15).reverse();

        return interaction.reply({
          embeds: [
            embed(
              '📊 REGISTROS DE FARM',
              records.length
                ? records.map(r =>
                    `• <@${r.userId}> — **${r.amount}** — <t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R>`
                  ).join('\n')
                : 'Nenhum registro de farm disponível.',
              'farm'
            )
          ],
          ephemeral: true
        });
      }

      if (id === 'chest_in' || id === 'chest_out') {
        return interaction.showModal(
          makeChestModal(id === 'chest_in' ? 'in' : 'out')
        );
      }

      if (id === 'chest_view') {
        const records = db.chest.slice(-15).reverse();

        return interaction.reply({
          embeds: [
            embed(
              '📦 MOVIMENTAÇÕES DO BAÚ',
              records.length
                ? records.map(r =>
                    `• **${r.direction === 'in' ? 'Entrada' : 'Saída'}:** ${r.item}\nPor: <@${r.userId}>\nMotivo: ${r.reason}`
                  ).join('\n\n')
                : 'Nenhuma movimentação registrada.',
              'chest'
            )
          ],
          ephemeral: true
        });
      }

      if (id.startsWith('banner_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Apenas administradores podem configurar banners.',
            ephemeral: true
          });
        }

        const key = id.slice('banner_'.length);
        const modal = new ModalBuilder()
          .setCustomId(`banner_modal_${key}`)
          .setTitle('Configurar banner');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('banner_url')
              .setLabel('URL da imagem')
              .setPlaceholder('https://exemplo.com/imagem.png')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(500)
          )
        );

        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      if (id === 'recruitment_form') {
        const answers = [];

        for (let i = 0; i < 5; i++) {
          answers[i] = interaction.fields.getTextInputValue(`answer_${i}`);
        }

        client.pendingForms.set(interaction.user.id, {
          answers,
          next: 5,
          guildId: interaction.guildId
        });

        return interaction.showModal(makeExtraQuestionModal(5));
      }

      if (id.startsWith('recruitment_extra_')) {
        const startIndex = Number(id.slice('recruitment_extra_'.length));
        const pending = client.pendingForms.get(interaction.user.id);

        if (!pending || pending.guildId !== interaction.guildId) {
          return interaction.reply({
            content: 'Sua ficha expirou. Comece novamente pelo painel de recrutamento.',
            ephemeral: true
          });
        }

        for (
          let i = startIndex;
          i < Math.min(startIndex + 5, questions.length);
          i++
        ) {
          pending.answers[i] =
            interaction.fields.getTextInputValue(`answer_${i}`);
        }

        const next = startIndex + 5;

        if (next < questions.length) {
          pending.next = next;
          return interaction.showModal(makeExtraQuestionModal(next));
        }

        client.pendingForms.delete(interaction.user.id);

        const guild = await client.guilds.fetch(pending.guildId);
        const reviewChannel = await getReviewChannel(guild);

        const recruit = {
          id: createRecruitId(),
          userId: interaction.user.id,
          username: interaction.user.username,
          answers: pending.answers,
          status: 'Pendente',
          createdAt: new Date().toISOString()
        };

        db.recruits.push(recruit);
        save();

        const [recruitEmbed] = formatAnswerEmbeds(recruit);

        await reviewChannel.send({
          embeds: [recruitEmbed],
          components: [createReviewButtons(recruit.id)]
        });

        return interaction.reply({
          content: '✅ Sua ficha foi enviada para a liderança da Tropa do Rodo 2!',
          ephemeral: true
        });
      }

      if (id === 'farm_modal') {
        const amount = interaction.fields.getTextInputValue('farm_amount').trim();

        if (!amount) {
          return interaction.reply({
            content: 'Informe um valor válido.',
            ephemeral: true
          });
        }

        db.farmRecords.push({
          userId: interaction.user.id,
          amount,
          createdAt: new Date().toISOString()
        });

        save();

        return interaction.reply({
          content: '✅ Registro de farm salvo!',
          ephemeral: true
        });
      }

      if (id.startsWith('chest_modal_')) {
        const direction = id.slice('chest_modal_'.length);
        const item = interaction.fields.getTextInputValue('chest_item');
        const reason = interaction.fields.getTextInputValue('chest_reason');

        db.chest.push({
          userId: interaction.user.id,
          direction,
          item,
          reason,
          createdAt: new Date().toISOString()
        });

        save();

        return interaction.reply({
          content: '✅ Movimentação do baú registrada!',
          ephemeral: true
        });
      }

      if (id.startsWith('banner_modal_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '❌ Apenas administradores podem configurar banners.',
            ephemeral: true
          });
        }

        const key = id.slice('banner_modal_'.length);
        const url = interaction.fields.getTextInputValue('banner_url').trim();

        if (!/^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(url)) {
          return interaction.reply({
            content: 'Informe uma URL direta de imagem PNG, JPG, GIF ou WEBP.',
            ephemeral: true
          });
        }

        db.banners[key] = url;
        save();

        return interaction.reply({
          content: '✅ Banner atualizado!',
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('Erro ao processar interação:', error);

    const message =
      '❌ Ocorreu um erro ao processar. Confira os logs do bot e as permissões do canal.';

    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        content: message,
        ephemeral: true
      }).catch(() => {});
    }

    return interaction.reply({
      content: message,
      ephemeral: true
    }).catch(() => {});
  }
});

client.login(T);
