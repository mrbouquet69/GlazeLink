# ERLC Private server bot
## Requirements

- Node.js 18 or newer
- A Discord bot application

## Setup

1. Open `config.js` and replace every `PUT_..._HERE` value.
2. In the Discord Developer Portal, enable/install the bot with these scopes:
   - `bot`
   - `applications.commands`
3. Give the bot these channel permissions:
   - View Channel
   - Send Messages
   - Embed Links
4. Install packages:

```bash
npm install
```

5. Register the slash command in the configured server:

```bash
npm run deploy
```

6. Start the bot:

```bash
npm start
```

## Command

```text
/sessionstats
/sessionvote
/promo give
/promo revoke
/infract give
/infract revoke
```

All command options are optional. Values omitted from the command use the defaults in `config.js`.

Only members with `allowedRoleId` can run the command. The resulting embed is always posted in `sessionChannelId`, regardless of where the command is run.

The Vote button toggles the current user's vote. View Voters responds privately with the voter list. Votes are saved in `sessions.json` so they survive bot restarts.
