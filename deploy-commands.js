const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const sessionstatsCommand = new SlashCommandBuilder()
  .setName('sessionstats')
  .setDescription('Post the current game session statistics.')
  .setDMPermission(false)
  .addStringOption(option =>
    option
      .setName('server-id')
      .setDescription('ERLC Server ID to fetch statistics from')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('server-name')
      .setDescription('Override displayed server name')
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option
      .setName('server-code')
      .setDescription('Override displayed server code')
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option
      .setName('quick-join-url')
      .setDescription('Override Quick Join URL')
  )
  .addIntegerOption(option =>
    option
      .setName('votes-required')
      .setDescription('Target number shown on the vote button')
      .setMinValue(1)
      .setMaxValue(100)
  );

const sessionvoteCommand = new SlashCommandBuilder()
  .setName('sessionvote')
  .setDescription('Start a session vote in the configured channel.')
  .setDMPermission(false)
  .addStringOption(option =>
    option
      .setName('title')
      .setDescription('Title for the session vote')
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option
      .setName('description')
      .setDescription('Description for the session vote')
      .setRequired(true)
      .setMaxLength(500)
  );

async function deploy() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log('Registering commands...');
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: [sessionstatsCommand.toJSON(), sessionvoteCommand.toJSON()] }
  );
  console.log('Commands registered.');
}

deploy().catch(error => {
  console.error('Failed to register commands:', error);
  process.exitCode = 1;
});
