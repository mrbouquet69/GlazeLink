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

  // /sessionvote posts in this channel
  sessionVoteChannelId: 'PUT_SESSION_VOTE_CHANNEL_ID_HERE',

  // Number of reactions required to start a session
  requiredVotes: 15,

  // ERLC API Configuration
  erlc: {
    apiBaseUrl: 'https://api.erlc.cc/v1',
    apiKey: 'PUT_ERLC_API_KEY_HERE'
  }
};
