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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers]
});

const DATA_FILE = path.join(__dirname, 'sessions.json');
let sessions = loadSessions();

// Map to store refresh intervals for active sessions
const sessionRefreshIntervals = new Map();

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
      },
      {
        name: '**⏳ | Queue**',
        value: codeBlock(`${session.queueSize}`),
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

function hasManagementRole(interaction) {
  return interaction.member?.roles?.cache?.has(config.ManagementRoleID) ?? false;
}

function isRoleImmune(member) {
  if (!member?.roles) return false;
  return config.immuneRoleIds.some(roleId => member.roles.cache.has(roleId));
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
      queueSize: data.queue_size || 0,
      quickJoinUrl: data.quick_join_url || 'https://discohook.app'
    };
  } catch (error) {
    console.error('Error fetching server info from ERLC API:', error);
    return null;
  }
}

async function updateSessionMessage(sessionId, session) {
  try {
    const guild = await client.guilds.fetch(session.guildId);
    const channel = await guild.channels.fetch(session.channelId);
    const message = await channel.messages.fetch(session.messageId);

    await message.edit({
      embeds: [buildEmbed(session)],
      components: [buildButtons(sessionId, session)]
    });
  } catch (error) {
    console.error(`Error updating session message ${sessionId}:`, error);
  }
}

async function startSessionRefresh(sessionId, session) {
  // Clear any existing interval
  if (sessionRefreshIntervals.has(sessionId)) {
    clearInterval(sessionRefreshIntervals.get(sessionId));
  }

  // Set up auto-refresh every 30 seconds
  const interval = setInterval(async () => {
    const serverInfo = await fetchServerInfo(session.serverId);
    if (serverInfo) {
      session.playerCount = serverInfo.playerCount;
      session.queueSize = serverInfo.queueSize;
      saveSessions();
      await updateSessionMessage(sessionId, session);
    }
  }, 30000); // Update every 30 seconds

  sessionRefreshIntervals.set(sessionId, interval);
}

function stopSessionRefresh(sessionId) {
  if (sessionRefreshIntervals.has(sessionId)) {
    clearInterval(sessionRefreshIntervals.get(sessionId));
    sessionRefreshIntervals.delete(sessionId);
  }
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  // Resume refresh intervals for all existing sessions
  for (const [sessionId, session] of Object.entries(sessions)) {
    startSessionRefresh(sessionId, session);
  }
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
      const quickJoinUrl = interaction.options.getString('quick-join-url') ?? serverInfo.quickJoinUrl;
      const votesRequired = interaction.options.getInteger('votes-required') ?? 10;

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
        playerCount: serverInfo.playerCount,
        maxPlayers: serverInfo.maxPlayers,
        queueSize: serverInfo.queueSize,
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

      // Start auto-refresh for this session
      await startSessionRefresh(sessionId, session);

      return interaction.reply({ content: `Session stats posted in <#${channel.id}>. Player count and queue will update every 30 seconds.`, ephemeral: true });
    }

    // /promo command
    if (interaction.isChatInputCommand() && interaction.commandName === 'promo') {
      if (!interaction.inGuild()) {
        return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      }

      if (!hasManagementRole(interaction)) {
        return interaction.reply({ content: 'Error | You do not have the required role to use this command.', ephemeral: true });
      }

      const action = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('user');
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: 'Could not find the target user in this server.', ephemeral: true });
      }

      if (isRoleImmune(targetMember)) {
        return interaction.reply({ content: 'This user is immune to promos.', ephemeral: true });
      }

      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      if (action === 'give') {
        const newRankName = interaction.options.getString('rank');
        const rankRoleId = config.ranks[newRankName];

        if (!rankRoleId) {
          return interaction.reply({ content: `Invalid rank. Available ranks: ${Object.keys(config.ranks).join(', ')}`, ephemeral: true });
        }

        try {
          const role = await interaction.guild.roles.fetch(rankRoleId);
          if (!role) {
            return interaction.reply({ content: 'The rank role does not exist in this server.', ephemeral: true });
          }

          await targetMember.roles.add(rankRoleId);

          // Send DM to user
          const promoEmbed = new EmbedBuilder()
            .setColor(3447003)
            .setTitle('**🎉 | Promotion Notice**')
            .setDescription(`Congrats you have received a Promotion for ${reason}\nYour new rank is: ${newRankName}\n\nNotes: ${notes}\n\n-# Auth: ${interaction.user.username}`);

          await targetUser.send({ embeds: [promoEmbed] }).catch(() => {});

          return interaction.reply({ content: `✅ Promoted ${targetUser.tag} to ${newRankName}`, ephemeral: true });
        } catch (error) {
          console.error('Error promoting user:', error);
          return interaction.reply({ content: 'An error occurred while promoting the user.', ephemeral: true });
        }
      } else if (action === 'revoke') {
        const rankName = interaction.options.getString('rank');
        const rankRoleId = config.ranks[rankName];

        if (!rankRoleId) {
          return interaction.reply({ content: `Invalid rank. Available ranks: ${Object.keys(config.ranks).join(', ')}`, ephemeral: true });
        }

        try {
          await targetMember.roles.remove(rankRoleId);
          return interaction.reply({ content: `✅ Revoked ${rankName} from ${targetUser.tag}`, ephemeral: true });
        } catch (error) {
          console.error('Error revoking promotion:', error);
          return interaction.reply({ content: 'An error occurred while revoking the promotion.', ephemeral: true });
        }
      }
    }

    // /infract command
    if (interaction.isChatInputCommand() && interaction.commandName === 'infract') {
      if (!interaction.inGuild()) {
        return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      }

      if (!hasManagementRole(interaction)) {
        return interaction.reply({ content: 'Error | You do not have the required role to use this command.', ephemeral: true });
      }

      const action = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('user');
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: 'Could not find the target user in this server.', ephemeral: true });
      }

      if (isRoleImmune(targetMember)) {
        return interaction.reply({ content: 'This user is immune to infractions.', ephemeral: true });
      }

      const type = interaction.options.getString('type');
      const reason = interaction.options.getString('reason');
      const notes = interaction.options.getString('notes') || 'None';

      if (action === 'give') {
        // Send DM to user
        const infractionEmbed = new EmbedBuilder()
          .setColor(3447003)
          .setTitle('**⚠️ | Infraction Notice**')
          .setDescription(`You are receiving an infraction (Type: ${type}) for ${reason}\n\nNotes: ${notes}\n\n-# Auth: ${interaction.user.username}`);

        await targetUser.send({ embeds: [infractionEmbed] }).catch(() => {});

        return interaction.reply({ content: `✅ Infraction (${type}) given to ${targetUser.tag} for: ${reason}`, ephemeral: true });
      } else if (action === 'revoke') {
        return interaction.reply({ content: `✅ Revoked infraction from ${targetUser.tag}`, ephemeral: true });
      }
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
