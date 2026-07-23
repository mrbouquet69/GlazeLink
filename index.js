const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} = require('discord.js');
const config = require('./config');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DATA_FILE = path.join(__dirname, 'sessions.json');
let sessions = loadSessions();

function loadSessions() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Could not read sessions.json:', error);
    return {};
  }
}

function saveSessions() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('Could not save sessions.json:', error);
  }
}

function codeBlock(value) {
  const safe = String(value).replaceAll('```', '');
  return `\`\`\`${safe}\`\`\``;
}

function buildEmbed(session) {
  return new EmbedBuilder()
    .setColor(39167)
    .addFields(
      {
        name: '**🗒️ | Server Name:**',
        value: codeBlock(session.serverName),
        inline: false
      },
      {
        name: '**🔗 | Server Code**',
        value: `${codeBlock(session.serverCode)}\n`,
        inline: false
      },
      {
        name: '**👤 | Player Count**',
        value: codeBlock(`${session.playerCount}/${session.maxPlayers}`),
        inline: false
      }
    );
}

function buildButtons(sessionId, session) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(session.quickJoinUrl)
      .setLabel('Quick Join')
      .setEmoji('🟢'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`session_vote:${sessionId}`)
      .setLabel(`Vote ${session.voters.length}/${session.votesRequired}`)
      .setEmoji('🗒️'),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`session_voters:${sessionId}`)
      .setLabel('View Voters')
      .setEmoji('👁‍🗨')
  );
}

function hasAllowedRole(interaction) {
  return interaction.member?.roles?.cache?.has(config.allowedRoleId) ?? false;
}

async function fetchServerInfo(serverId) {
  try {
    const response = await fetch(`${config.erlc.apiBaseUrl}/servers/${serverId}`, {
      headers: {
        'Authorization': config.erlc.apiKey
      }
    });

    if (!response.ok) {
      console.error(`ERLC API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      serverName: data.name || 'Unknown Server',
      serverCode: data.code || 'N/A',
      playerCount: data.players || 0,
      maxPlayers: data.max_players || 50,
      quickJoinUrl: data.quick_join_url || 'https://discohook.app'
    };
  } catch (error) {
    console.error('Error fetching server info from ERLC API:', error);
    return null;
  }
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'sessionstats') {
      if (!interaction.inGuild()) {
        return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      }

      if (!hasAllowedRole(interaction)) {
        return interaction.reply({ content: 'You do not have the required role to use this command.', ephemeral: true });
      }

      const channel = await interaction.guild.channels.fetch(config.sessionChannelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.reply({ content: 'The configured session channel is invalid or inaccessible.', ephemeral: true });
      }

      const me = interaction.guild.members.me;
      const permissions = channel.permissionsFor(me);
      if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return interaction.reply({ content: 'The bot needs View Channel, Send Messages, and Embed Links permissions in the configured channel.', ephemeral: true });
      }

      // Get server ID from command options or return error
      const serverId = interaction.options.getString('server-id');
      if (!serverId) {
        return interaction.reply({ content: 'Server ID is required.', ephemeral: true });
      }

      // Fetch server info from ERLC API
      const serverInfo = await fetchServerInfo(serverId);
      if (!serverInfo) {
        return interaction.reply({ content: 'Could not fetch server information from ERLC API. Please check the server ID and try again.', ephemeral: true });
      }

      // Get optional overrides from command options
      const serverName = interaction.options.getString('server-name') ?? serverInfo.serverName;
      const serverCode = interaction.options.getString('server-code') ?? serverInfo.serverCode;
      const playerCount = interaction.options.getInteger('players') ?? serverInfo.playerCount;
      const maxPlayers = interaction.options.getInteger('max-players') ?? serverInfo.maxPlayers;
      const quickJoinUrl = interaction.options.getString('quick-join-url') ?? serverInfo.quickJoinUrl;
      const votesRequired = interaction.options.getInteger('votes-required') ?? 10;

      if (playerCount > maxPlayers) {
        return interaction.reply({ content: 'The current player count cannot be greater than the maximum player count.', ephemeral: true });
      }

      try {
        new URL(quickJoinUrl);
      } catch {
        return interaction.reply({ content: 'The Quick Join URL is not valid.', ephemeral: true });
      }

      const sessionId = `${Date.now()}-${interaction.user.id}`;
      const session = {
        creatorId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: channel.id,
        messageId: null,
        serverId,
        serverName,
        serverCode,
        playerCount,
        maxPlayers,
        quickJoinUrl,
        votesRequired,
        voters: [],
        createdAt: new Date().toISOString()
      };

      const message = await channel.send({
        embeds: [buildEmbed(session)],
        components: [buildButtons(sessionId, session)]
      });

      session.messageId = message.id;
      sessions[sessionId] = session;
      saveSessions();

      return interaction.reply({ content: `Session stats posted in <#${channel.id}>.`, ephemeral: true });
    }

    if (!interaction.isButton()) return;

    const [action, sessionId] = interaction.customId.split(':');
    if (!sessionId || !['session_vote', 'session_voters'].includes(action)) return;

    const session = sessions[sessionId];
    if (!session) {
      return interaction.reply({ content: 'This session is no longer available.', ephemeral: true });
    }

    if (action === 'session_vote') {
      const index = session.voters.indexOf(interaction.user.id);
      let response;

      if (index === -1) {
        session.voters.push(interaction.user.id);
        response = 'Your vote was added.';
      } else {
        session.voters.splice(index, 1);
        response = 'Your vote was removed.';
      }

      saveSessions();

      await interaction.update({
        embeds: [buildEmbed(session)],
        components: [buildButtons(sessionId, session)]
      });

      return interaction.followUp({ content: response, ephemeral: true });
    }

    if (action === 'session_voters') {
      const voterList = session.voters.length
        ? session.voters.map((id, index) => `${index + 1}. <@${id}>`).join('\n')
        : 'No one has voted yet.';

      return interaction.reply({
        content: `**Voters (${session.voters.length}/${session.votesRequired})**\n${voterList}`,
        ephemeral: true,
        allowedMentions: { parse: [] }
      });
    }
  } catch (error) {
    console.error('Interaction error:', error);

    const payload = { content: 'An unexpected error occurred.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(config.token);
