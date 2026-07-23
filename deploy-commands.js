const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('sessionstats')
    .setDescription('Post server stats with real-time player count updates')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('The ERLC server ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('server-name')
        .setDescription('Override server name (optional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('server-code')
        .setDescription('Override server code (optional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('quick-join-url')
        .setDescription('Override quick join URL (optional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('votes-required')
        .setDescription('Number of votes required (default: 10)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('promo')
    .setDescription('Give or revoke a promotion to a user')
    .addSubcommand(subcommand =>
      subcommand
        .setName('give')
        .setDescription('Give a promotion to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to promote')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('rank')
            .setDescription('Rank to promote to')
            .setRequired(true)
            .addChoices(
              Object.keys(config.ranks).map(rank => ({
                name: rank,
                value: rank
              }))
            )
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for promotion')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Additional notes (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('revoke')
        .setDescription('Revoke a promotion from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to revoke promotion from')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('rank')
            .setDescription('Rank to revoke')
            .setRequired(true)
            .addChoices(
              Object.keys(config.ranks).map(rank => ({
                name: rank,
                value: rank
              }))
            )
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for revocation')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Additional notes (optional)')
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('infract')
    .setDescription('Give or revoke an infraction to a user')
    .addSubcommand(subcommand =>
      subcommand
        .setName('give')
        .setDescription('Give an infraction to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to infract')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of infraction')
            .setRequired(true)
            .addChoices(
              { name: 'Warning', value: 'warning' },
              { name: 'Infraction', value: 'infraction' },
              { name: 'Termination', value: 'termination' }
            )
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for infraction')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Additional notes (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('revoke')
        .setDescription('Revoke an infraction from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to revoke infraction from')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of infraction to revoke')
            .setRequired(true)
            .addChoices(
              { name: 'Warning', value: 'warning' },
              { name: 'Infraction', value: 'infraction' },
              { name: 'Termination', value: 'termination' }
            )
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for revocation')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Additional notes (optional)')
            .setRequired(false)
        )
    )
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
