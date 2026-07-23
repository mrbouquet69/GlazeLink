const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const command = new SlashCommandBuilder()
  .setName('sessionstats')
  .setDescription('Post the current game session statistics.')
  .setDMPermission(false)
  .addStringOption(option =>
    option
      .setName('server-name')
      .setDescription('Displayed server name')
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option
      .setName('server-code')
      .setDescription('Displayed server code')
      .setMaxLength(100)
  )
  .addIntegerOption(option =>
    option
      .setName('players')
      .setDescription('Current player count')
      .setMinValue(0)
  )
  .addIntegerOption(option =>
    option
      .setName('max-players')
      .setDescription('Maximum player count')
      .setMinValue(1)
  )
  .addStringOption(option =>
    option
      .setName('quick-join-url')
      .setDescription('URL used by the Quick Join button')
  )
  .addIntegerOption(option =>
    option
      .setName('votes-required')
      .setDescription('Target number shown on the vote button')
      .setMinValue(1)
      .setMaxValue(100)
  );

async function deploy() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log('Registering /sessionstats...');
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: [command.toJSON()] }
  );
  console.log('Command registered.');
}

deploy().catch(error => {
  console.error('Failed to register commands:', error);
  process.exitCode = 1;
});
