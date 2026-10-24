const {Client,GatewayIntentBits,REST,Routes,SlashCommandBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,PermissionFlagsBits}=require('discord.js');
const fs=require('node:fs'),path=require('node:path');
const {DISCORD_TOKEN:T,CLIENT_ID:C,GUILD_ID:G}=process.env;
if(!T||!C||!G){console.error('Configure DISCORD_TOKEN, CLIENT_ID e GUILD_ID.');process.exit(1)}
const file=path.join(__dirname,'data.json'),fresh=()=>({banners:{},recruits:[],farm:{},chest:[]});
function load(){try{return {...fresh(),...JSON.parse(fs.readFileSync(file,'utf8'))}}catch{return fresh()}}
let db=load();const save=()=>fs.writeFileSync(file,JSON.stringify(db,null,2));
const names=[['recrutamento','Publica o painel de recrutamento'],['farme','Publica o painel de farm e ranking'],['bau','Publica o painel de movimentações do baú'],['configuracao','Configura os banners']];
const commands=names.map(([name,description])=>new SlashCommandBuilder().setName(name).setDescription(description).toJSON());
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const admin=i=>i.memberPermissions?.has(PermissionFlagsBits.Administrator)||i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
const emb=(title,description,key)=>{const e=new EmbedBuilder().setColor(0xC1121F).setTitle(title).setDescription(description).setFooter({text:'Tropa do Rodo 2 • Nova Rio RP'});if(key&&db.banners[key])e.setImage(db.banners[key]);return e};
const buttons=a=>new ActionRowBuilder().addComponents(...a.map(([id,label,style=ButtonStyle.Danger])=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style)));
const makeModal=(id,title,fields)=>{const m=new ModalBuilder().setCustomId(id).setTitle(title);m.addComponents(...fields.map(([id,label,style=TextInputStyle.Short,required=true])=>new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(1000))));return m};
async function register(){await new REST({version:'10'}).setToken(T).put(Routes.applicationGuildCommands(C,G),{body:commands});console.log('Comandos registrados.')}
client.once('ready',()=>console.log(`Conectado como ${client.user.tag}`));
client.on('interactionCreate',async i=>{try{
if(i.isChatInputCommand()){
 if(!admin(i))return i.reply({content:'Somente a administração pode publicar/configurar painéis.',ephemeral:true});
 if(i.commandName==='recrutamento')return i.reply({embeds:[emb('📝 Recrutamento oficial','Clique abaixo para preencher sua ficha.','recrutamento')],components:[buttons([['apply','Enviar ficha']])]});
 if(i.commandName==='farme')return i.reply({embeds:[emb('⛏️ Controle de farm','Registre seu farm ou veja o ranking.','farme')],components:[buttons([['farmadd','Registrar farm'],['farmrank','Ver ranking',ButtonStyle.Secondary]])]});
 if(i.commandName==='bau')return i.reply({embeds:[emb('📦 Controle do baú','Registre entrada/retirada ou consulte o histórico.','bau')],components:[buttons([['chestadd','Registrar movimentação'],['chesthistory','Ver histórico',ButtonStyle.Secondary]])]});
 if(i.commandName==='configuracao')return i.reply({ephemeral:true,embeds:[emb('⚙️ Banners','Escolha qual painel deseja personalizar. Use URL HTTPS direta para uma imagem.')],components:[buttons([['banner_recrutamento','Recrutamento'],['banner_farme','Farm'],['banner_bau','Baú'],['banner_ranking','Ranking',ButtonStyle.Secondary]])]});
}
if(i.isButton()){
 const id=i.customId;
 if(id.startsWith('banner_')){if(!admin(i))return i.reply({content:'Sem permissão.',ephemeral:true});return i.showModal(makeModal('save_'+id.slice(7),'Alterar banner',[['url','Link HTTPS direto da imagem']]))}
 if(id==='apply')return i.showModal(makeModal('recruit','Ficha de recrutamento',[['charname','Nome do personagem'],['age','Idade real'],['charid','ID no servidor'],['experience','Experiência em RP/SAMP',TextInputStyle.Paragraph],['mic','Possui microfone?']]));
 if(id==='farmadd')return i.showModal(makeModal('farm','Registrar farm',[['amount','Quantidade numérica'],['notes','Observação (opcional)',TextInputStyle.Paragraph,false]]));
 if(id==='chestadd')return i.showModal(makeModal('chest','Movimentação do baú',[['kind','Tipo: entrada ou retirada'],['item','Item/material'],['quantity','Quantidade'],['notes','Observação (opcional)',TextInputStyle.Paragraph,false]]));
 if(id==='farmrank'||id==='banner_ranking'){let s=Object.entries(db.farm).sort((a,b)=>b[1]-a[1]).slice(0,10);return i.reply({ephemeral:id==='banner_ranking',embeds:[emb('🏆 Ranking de farm',s.length?s.map(([u,n],k)=>`**${k+1}.** <@${u}> — **${n}**`).join('\n'):'Nenhum farm registrado.','ranking')]})}
 if(id==='chesthistory'){let s=db.chest.slice(-10).reverse();return i.reply({ephemeral:true,embeds:[emb('📜 Histórico do baú',s.length?s.map(x=>`• ${x.kind}: ${x.item} x${x.quantity} — <@${x.user}> — ${x.date}`).join('\n'):'Nenhuma movimentação.','bau')]})}
 if(id.startsWith('approve_')||id.startsWith('reject_')){if(!admin(i))return i.reply({content:'Somente administração.',ephemeral:true});let ok=id.startsWith('approve_'),r=db.recruits.find(x=>x.id===id.slice(ok?8:7));if(!r)return i.reply({content:'Ficha não encontrada.',ephemeral:true});r.status=ok?'Aprovada':'Recusada';r.reviewer=i.user.id;save();return i.update({embeds:[EmbedBuilder.from(i.message.embeds[0]).addFields({name:'Decisão',value:`${r.status} por ${i.user}`})],components:[]})}
}
if(i.isModalSubmit()){
 const id=i.customId;
 if(id.startsWith('save_')){if(!admin(i))return i.reply({content:'Sem permissão.',ephemeral:true});let key=id.slice(5),url=i.fields.getTextInputValue('url').trim();if(!/^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url))return i.reply({content:'Use link HTTPS direto para PNG, JPG, GIF ou WEBP.',ephemeral:true});db.banners[key]=url;save();return i.reply({content:`Banner ${key} atualizado.`,ephemeral:true})}
 if(id==='recruit'){let r={id:String(Date.now()),user:i.user.id,charname:i.fields.getTextInputValue('charname'),age:i.fields.getTextInputValue('age'),charid:i.fields.getTextInputValue('charid'),experience:i.fields.getTextInputValue('experience'),mic:i.fields.getTextInputValue('mic'),status:'Pendente'};db.recruits.push(r);save();await i.reply({content:'Ficha enviada para análise.',ephemeral:true});let e=emb('📨 Nova ficha',`**Enviado por:** ${i.user}\n**Personagem:** ${r.charname}\n**Idade real:** ${r.age}\n**ID:** ${r.charid}\n**Experiência:** ${r.experience}\n**Microfone:** ${r.mic}\n**Status:** Pendente`);return i.channel.send({embeds:[e],components:[buttons([[`approve_${r.id}`,'Aprovar',ButtonStyle.Success],[`reject_${r.id}`,'Recusar',ButtonStyle.Danger]])]})}
 if(id==='farm'){let n=Number(i.fields.getTextInputValue('amount'));if(!Number.isFinite(n)||n<=0)return i.reply({content:'Informe um número maior que zero.',ephemeral:true});db.farm[i.user.id]=(db.farm[i.user.id]||0)+n;save();return i.reply({content:`Farm registrado: ${n}. Seu total: ${db.farm[i.user.id]}.`,ephemeral:true})}
 if(id==='chest'){let kind=i.fields.getTextInputValue('kind').trim().toLowerCase();if(!['entrada','retirada'].includes(kind))return i.reply({content:'Escreva entrada ou retirada no campo Tipo.',ephemeral:true});let r={kind,item:i.fields.getTextInputValue('item'),quantity:i.fields.getTextInputValue('quantity'),notes:i.fields.getTextInputValue('notes')||'',user:i.user.id,date:new Date().toLocaleString('pt-BR')};db.chest.push(r);save();return i.reply({content:`Movimentação registrada: ${kind} — ${r.item} x${r.quantity}.`,ephemeral:true})}
}
}catch(e){console.error(e);if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:'Erro ao processar. Confira os logs.',ephemeral:true}).catch(()=>{})}});
register().then(()=>client.login(T)).catch(e=>{console.error(e);process.exit(1)});
