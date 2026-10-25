const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

const {
  DISCORD_TOKEN: T,
  CLIENT_ID: C,
  GUILD_ID: G
} = process.env;

const REVIEW_CHANNEL_ID = '1563709838142349342';

if (!T || !C || !G) {
  console.error(
    'Configure DISCORD_TOKEN, CLIENT_ID e GUILD_ID nas variáveis de ambiente.'
  );
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
      banners: {
        ...fresh().banners,
        ...(old.banners || {})
      },
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

const save = () => {
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
};

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
    .setDescription('Personaliza banners e canal de recrutamento')
].map(command => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.pendingForms = new Map();

const admin = interaction => Boolean(
  interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
);

const RED = 0xC1121F;
const DARK = 0x191919;

const questions = [
  ['01. Nome completo do personagem', 'Nome do personagem'],
  ['02. ID do personagem', 'ID do personagem'],
  ['03. Idade do personagem no RP', 'Idade do personagem'],
  ['04. Qual é a história do personagem?', 'História do personagem'],
  ['05. Por que quer entrar na Tropa?', 'Por que quer entrar na Tropa?']
];

const btn = (id, label, style = ButtonStyle.Danger, emoji) => {
  const button = new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style);

  if (emoji) button.setEmoji(emoji);

  return button;
};

const row = (...items) => {
  return new ActionRowBuilder().addComponents(...items);
};

function embed(title, description, key, color = RED) {
  const result = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: '👑 TROPA DO RODO 2 • NOVA RIO RP'
    })
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: 'NOVA RIO RP • RESPEITO • LEALDADE • COMPROMISSO'
    })
    .setTimestamp();

  if (key && db.banners[key]) {
    result.setImage(db.banners[key]);
  }

  return result;
}

function formModal(userId) {
  const modal = new ModalBuilder()
    .setCustomId(`form_${userId}`)
    .setTitle('Ficha do personagem • 5 perguntas');

  modal.addComponents(
    ...questions.map((question, index) => {
      const input = new TextInputBuilder()
        .setCustomId(`q${index}`)
        .setLabel(question[1])
        .setStyle(
          index === 3 || index === 4
            ? TextInputStyle.Paragraph
            : TextInputStyle.Short
        )
        .setRequired(true)
        .setMaxLength(
          index === 3 || index === 4 ? 1000 : 100
        );

      return new ActionRowBuilder().addComponents(input);
    })
  );

  return modal;
}

async function getReviewChannel(guild) {
  if (!guild) {
    throw new Error('A interação não veio de um servidor Discord.');
  }

  const channel = await guild.channels
    .fetch(REVIEW_CHANNEL_ID)
    .catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(
      `O canal privado de recrutamento ${REVIEW_CHANNEL_ID} não existe ou não é um canal de texto.`
    );
  }

  const me = guild.members.me ||
    await guild.members.fetch(client.user.id);

  const permissions = channel.permissionsFor(me);

  if (!permissions?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory
  ])) {
    throw new Error(
      `O bot não tem as permissões necessárias no canal ${channel.id}.`
    );
  }

  return channel;
}

function formatAnswerEmbeds(recruit) {
  const result = embed(
    '📋 FICHA RECEBIDA • EM ANÁLISE',
    `**Candidato:** <@${recruit.user}>\n` +
    `**Status:** 🟡 EM ANÁLISE\n` +
    `**Enviada em:** ${recruit.createdAt}\n\n` +
    '🔒 Ficha exclusiva da liderança.',
    'recrutamento'
  );

  result.addFields(
    questions.map((question, index) => ({
      name: question[0],
      value: String(recruit.answers[index] || '—').slice(0, 1024),
      inline: false
    }))
  );

  return [result];
}

function reviewButtons(id) {
  return row(
    btn(`approve_${id}`, 'Aprovar', ButtonStyle.Success, '✅'),
    btn(`reject_${id}`, 'Recusar', ButtonStyle.Danger, '❌')
  );
}

async function replyError(interaction, error, context) {
  console.error(`[${context}]`, error);

  const content =
    '❌ Não consegui concluir essa ação. Verifique as permissões do bot e os logs da hospedagem.';

  try {
    if (!interaction.isRepliable()) return;

    if (interaction.deferred) {
      await interaction.editReply({
        content,
        embeds: [],
        components: []
      });
    } else if (interaction.replied) {
      await interaction.followUp({
        content,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content,
        ephemeral: true
      });
    }
  } catch (replyError) {
    console.error(
      `[${context}] Também não foi possível responder à interação:`,
      replyError
    );
  }
}

client.once('ready', () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!admin(interaction)) {
        return interaction.reply({
          content: '🔒 Apenas a administração pode publicar ou configurar painéis.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'recrutamento') {
        const reviewChannel = await getReviewChannel(interaction.guild);

        console.log(
          `[RECRUTAMENTO] Canal privado fixo: ${reviewChannel.id}`
        );

        return interaction.reply({
          embeds: [
            embed(
              '☠️ RECRUTAMENTO OFICIAL • TROPA DO RODO 2',
              '🏴 **NOVA RIO RP**\n\n' +
              '📋 Preencha a ficha do personagem com apenas 5 perguntas, em uma única etapa.\n\n' +
              '🎙️ **Depois da ficha:** a liderança analisará as respostas e, se aprovado, chamará você para uma entrevista por call.\n\n' +
              '🔒 **Importante:**\n' +
              '• Se sua ficha for recusada, poderá tentar novamente.\n' +
              '• Aguarde a decisão da liderança.\n' +
              `• Todas as fichas serão enviadas para <#${reviewChannel.id}>.\n\n` +
              '🟥 **Respeito • Lealdade • Compromisso**',
              'recrutamento'
            )
          ],
          components: [
            row(
              btn(
                'apply',
                'Iniciar ficha de inscrição',
                ButtonStyle.Danger,
                '📝'
              )
            )
          ],
          ephemeral: false
        });
      }

      if (interaction.commandName === 'farme') {
        return interaction.reply({
          embeds: [
            embed(
              '💰 REGISTRO DE FARM',
              'Registre suas quantidades e consulte o histórico de registros.\n\n' +
              '📥 **Registrar farm** — adicionar uma quantidade ao seu histórico.\n' +
              '📜 **Ver registros** — consultar os registros recentes.',
              'farme'
            )
          ],
          components: [
            row(
              btn('farmadd', 'Registrar farm', ButtonStyle.Success, '💵'),
              btn('farmrecords', 'Ver registros', ButtonStyle.Secondary, '📜')
            )
          ]
        });
      }

      if (interaction.commandName === 'bau') {
        return interaction.reply({
          embeds: [
            embed(
              '📦 CONTROLE DO BAÚ',
              'Registre as entradas e retiradas e consulte o histórico das últimas movimentações.',
              'bau'
            )
          ],
          components: [
            row(
              btn('chestadd', 'Registrar movimentação', ButtonStyle.Danger, '📦'),
              btn('chesthistory', 'Ver histórico', ButtonStyle.Secondary, '📜')
            )
          ]
        });
      }

      if (interaction.commandName === 'configuracao') {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            embed(
              '⚙️ PERSONALIZAÇÃO DOS PAINÉIS',
              'Escolha qual banner deseja alterar. Use um link HTTPS direto de imagem PNG, JPG, GIF ou WEBP.\n\n' +
              '🔒 Todas as fichas são enviadas automaticamente para o canal privado configurado no bot. ' +
              'Canal: <#1563709838142349342>. Dê ao bot as permissões Ver canal, Enviar mensagens, Inserir links e Ler histórico de mensagens; dê acesso à liderança nas permissões do canal.',
              null,
              DARK
            )
          ],
          components: [
            row(
              btn('banner_recrutamento', 'Recrutamento', ButtonStyle.Danger, '📝'),
              btn('banner_farme', 'Farm', ButtonStyle.Danger, '💰')
            ),
            row(
              btn('banner_bau', 'Baú', ButtonStyle.Danger, '📦'),
              btn('banner_registro', 'Registro', ButtonStyle.Secondary, '📜')
            )
          ]
        });
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith('banner_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '🔒 Sem permissão.',
            ephemeral: true
          });
        }

        const key = id.slice(7);

        return interaction.showModal(
          new ModalBuilder()
            .setCustomId(`save_${key}`)
            .setTitle('Alterar banner')
            .addComponents(
              row(
                new TextInputBuilder()
                  .setCustomId('url')
                  .setLabel('Link HTTPS direto da imagem')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            )
        );
      }

      if (id === 'apply') {
        client.pendingForms.set(interaction.user.id, {
          startedAt: new Date().toLocaleString('pt-BR')
        });

        return interaction.showModal(
          formModal(interaction.user.id)
        );
      }

      if (id === 'farmadd') {
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId('farm')
            .setTitle('Registrar farm')
            .addComponents(
              row(
                new TextInputBuilder()
                  .setCustomId('amount')
                  .setLabel('Quantidade numérica')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              row(
                new TextInputBuilder()
                  .setCustomId('notes')
                  .setLabel('Observação (opcional)')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(false)
              )
            )
        );
      }

      if (id === 'farmrecords') {
        const records = db.farmRecords.slice(-15).reverse();

        const description = records.length
          ? records.map((record, index) =>
              `**${index + 1}. ${record.amount}** • <@${record.user}> • ${record.date}` +
              (record.notes ? `\n_${record.notes}_` : '')
            ).join('\n\n')
          : 'Ainda não há registros de farm.';

        return interaction.reply({
          ephemeral: true,
          embeds: [
            embed(
              '📜 REGISTROS RECENTES DE FARM',
              description,
              'registro'
            )
          ]
        });
      }

      if (id === 'chestadd') {
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId('chest')
            .setTitle('Movimentação do baú')
            .addComponents(
              row(
                new TextInputBuilder()
                  .setCustomId('kind')
                  .setLabel('Tipo: entrada ou retirada')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              row(
                new TextInputBuilder()
                  .setCustomId('item')
                  .setLabel('Item/material')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              row(
                new TextInputBuilder()
                  .setCustomId('quantity')
                  .setLabel('Quantidade')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              row(
                new TextInputBuilder()
                  .setCustomId('notes')
                  .setLabel('Observação (opcional)')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(false)
              )
            )
        );
      }

      if (id === 'chesthistory') {
        const records = db.chest.slice(-10).reverse();

        const description = records.length
          ? records.map(record =>
              `**${record.kind === 'entrada' ? '📥 ENTRADA' : '📤 RETIRADA'}** • ` +
              `**${record.item} × ${record.quantity}**\n` +
              `👤 <@${record.user}> · 🕒 ${record.date}`
            ).join('\n\n')
          : 'Nenhuma movimentação registrada.';

        return interaction.reply({
          ephemeral: true,
          embeds: [
            embed(
              '📜 HISTÓRICO DO BAÚ',
              description,
              'bau'
            )
          ]
        });
}
            if (id.startsWith('approve_') || id.startsWith('reject_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '🔒 Apenas a administração pode avaliar fichas.',
            ephemeral: true
          });
        }

        const approved = id.startsWith('approve_');
        const recruitId = id.slice(approved ? 8 : 7);

        const recruit = db.recruits.find(
          item => item.id === recruitId
        );

        if (!recruit) {
          return interaction.reply({
            content: 'Ficha não encontrada.',
            ephemeral: true
          });
        }

        if (recruit.status !== 'Pendente') {
          return interaction.reply({
            content: 'Esta ficha já foi avaliada.',
            ephemeral: true
          });
        }

        recruit.status = approved ? 'Aprovado' : 'Recusado';
        recruit.reviewer = interaction.user.id;
        recruit.reviewedAt = new Date().toLocaleString('pt-BR');

        save();

        const finalEmbed = EmbedBuilder
          .from(interaction.message.embeds[0])
          .addFields({
            name: '📌 RESULTADO',
            value:
              `${approved ? '✅ APROVADO' : '❌ RECUSADO'} por ${interaction.user}\n` +
              `**Data:** ${recruit.reviewedAt}`
          });

        await interaction.update({
          embeds: [finalEmbed],
          components: []
        });

        const user = await client.users
          .fetch(recruit.user)
          .catch(() => null);

        if (user) {
          const message = approved
            ? '✅ **Sua ficha para a Tropa do Rodo 2 foi APROVADA!**\n\n' +
              'A próxima etapa é uma entrevista por call. Aguarde a liderança enviar as instruções e o horário.'
            : '❌ **Sua ficha para a Tropa do Rodo 2 foi recusada.**\n\n' +
              'Obrigado pelo interesse na Nova Rio RP.';

          await user.send(message).catch(() => {});
        }

        return;
      }
    }

    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // FORMULÁRIO DE RECRUTAMENTO — 5 PERGUNTAS
      if (id.startsWith('form_')) {
        const userId = id.slice('form_'.length);

        if (interaction.user.id !== userId) {
          return interaction.reply({
            content: 'Esta ficha pertence a outra pessoa.',
            ephemeral: true
          });
        }

        const draft = client.pendingForms.get(userId);

        if (!draft) {
          return interaction.reply({
            content:
              'Sua ficha expirou. Clique em Iniciar ficha de inscrição para começar novamente.',
            ephemeral: true
          });
        }

        const answers = questions.map((_, index) =>
          interaction.fields
            .getTextInputValue(`q${index}`)
            .trim()
            .slice(0, 1000)
        );

        const recruit = {
          id: `${Date.now()}-${userId}`,
          user: userId,
          answers,
          status: 'Pendente',
          createdAt: new Date().toLocaleString('pt-BR')
        };

        let reviewChannel;
        let reviewMessage;

        try {
          const guild = await client.guilds.fetch(G);

          reviewChannel = await getReviewChannel(guild);

          const [answerEmbed] = formatAnswerEmbeds(recruit);

          reviewMessage = await reviewChannel.send({
            content:
              `📥 Nova ficha para análise — candidato: <@${recruit.user}>`,
            embeds: [answerEmbed],
            components: [reviewButtons(recruit.id)]
          });
        } catch (sendError) {
          console.error(
            '[RECRUTAMENTO] Não foi possível enviar a ficha ao canal privado.',
            {
              message: sendError?.message,
              code: sendError?.code,
              channelId: reviewChannel?.id || REVIEW_CHANNEL_ID,
              userId
            }
          );

          return interaction.reply({
            content:
              '❌ Não consegui enviar sua ficha ao canal privado de recrutamento. ' +
              'Sua inscrição não foi confirmada. Avise um administrador para verificar o canal e as permissões do bot.',
            ephemeral: true
          });
        }

        recruit.reviewMessageId = reviewMessage.id;
        recruit.reviewChannelId = reviewChannel.id;

        db.recruits.push(recruit);
        save();

        client.pendingForms.delete(userId);

        return interaction.reply({
          embeds: [
            embed(
              '✅ FICHA ENVIADA COM SUCESSO',
              'Sua ficha do personagem foi enviada à liderança e está **EM ANÁLISE**.\n\n' +
              'Se for aprovado, a próxima etapa será uma entrevista por call. ' +
              'Aguarde as instruções da liderança.',
              null,
              0x2D8A55
            )
          ],
          ephemeral: true
        });
      }

      // ALTERAÇÃO DE BANNERS
      if (id.startsWith('save_')) {
        if (!admin(interaction)) {
          return interaction.reply({
            content: '🔒 Sem permissão.',
            ephemeral: true
          });
        }

        const key = id.slice(5);
        const url = interaction.fields
          .getTextInputValue('url')
          .trim();

        if (!/^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url)) {
          return interaction.reply({
            content:
              'Use um link HTTPS direto de uma imagem PNG, JPG, GIF ou WEBP.',
            ephemeral: true
          });
        }

        if (
          !Object.prototype.hasOwnProperty.call(db.banners, key) &&
          !['recrutamento', 'farme', 'bau', 'registro'].includes(key)
        ) {
          return interaction.reply({
            content: 'Tipo de banner inválido.',
            ephemeral: true
          });
        }

        db.banners[key] = url;
        save();

        return interaction.reply({
          content:
            `✅ Banner de **${key}** atualizado. Publique novamente o painel para visualizar.`,
          ephemeral: true
        });
      }

      // REGISTRO DE FARM
      if (id === 'farm') {
        const amount = Number(
          interaction.fields.getTextInputValue('amount')
        );

        if (!Number.isFinite(amount) || amount <= 0) {
          return interaction.reply({
            content: 'Informe uma quantidade maior que zero.',
            ephemeral: true
          });
        }

        const notes =
          interaction.fields.getTextInputValue('notes') || '';

        db.farm[interaction.user.id] =
          (db.farm[interaction.user.id] || 0) + amount;

        db.farmRecords.push({
          user: interaction.user.id,
          amount,
          notes,
          date: new Date().toLocaleString('pt-BR')
        });

        save();

        return interaction.reply({
          embeds: [
            embed(
              '✅ FARM REGISTRADO',
              `**Quantidade adicionada:** ${amount}\n` +
              `**Total acumulado:** ${db.farm[interaction.user.id]}`,
              'farme',
              0x2D8A55
            )
          ],
          ephemeral: true
        });
      }

      // MOVIMENTAÇÃO DO BAÚ
      if (id === 'chest') {
        const kind = interaction.fields
          .getTextInputValue('kind')
          .trim()
          .toLowerCase();

        if (!['entrada', 'retirada'].includes(kind)) {
          return interaction.reply({
            content:
              'Escreva exatamente **entrada** ou **retirada** no campo Tipo.',
            ephemeral: true
          });
        }

        const record = {
          kind,
          item: interaction.fields.getTextInputValue('item'),
          quantity: interaction.fields.getTextInputValue('quantity'),
          notes: interaction.fields.getTextInputValue('notes') || '',
          user: interaction.user.id,
          date: new Date().toLocaleString('pt-BR')
        };

        db.chest.push(record);
        save();

        return interaction.reply({
          embeds: [
            embed(
              '✅ MOVIMENTAÇÃO REGISTRADA',
              `**Tipo:** ${kind === 'entrada' ? '📥 Entrada' : '📤 Retirada'}\n` +
              `**Item:** ${record.item}\n` +
              `**Quantidade:** ${record.quantity}\n` +
              `**Responsável:** <@${interaction.user.id}>`,
              'bau',
              0x2D8A55
            )
          ],
          ephemeral: true
        });
      }
    }
  } catch (error) {
    await replyError(
      interaction,
      error,
      `interaction:${interaction.customId || interaction.commandName || 'unknown'}`
    );
  }
});

async function start() {
  const rest = new REST({ version: '10' }).setToken(T);

  await rest.put(
    Routes.applicationGuildCommands(C, G),
    { body: commands }
  );

  console.log('Comandos registrados no servidor.');

  await client.login(T);
}

start().catch(error => {
  console.error('Erro ao iniciar o bot:', error);
  process.exit(1);
});
