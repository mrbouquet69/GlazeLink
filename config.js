module.exports = {
  // Discord Developer Portal -> Bot -> Reset Token
  token: 'PUT_BOT_TOKEN_HERE',

  // Discord Developer Portal -> General Information -> Application ID
  clientId: 'PUT_APPLICATION_ID_HERE',

  // The server where the slash command will be registered
  guildId: 'PUT_SERVER_ID_HERE',

  // /sessionstats posts only in this channel
  sessionChannelId: 'PUT_CHANNEL_ID_HERE',

  // Only members with this role can run /sessionstats
  allowedRoleId: 'PUT_ALLOWED_ROLE_ID_HERE',

  // Default values used when command options are omitted
  defaults: {
    serverName: 'Name',
    serverCode: 'Code',
    playerCount: 0,
    maxPlayers: 50,
    quickJoinUrl: 'https://discohook.app',
    votesRequired: 10
  }
};
