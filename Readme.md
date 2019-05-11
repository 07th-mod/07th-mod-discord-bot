# 07th Mod Bot

## Installation

1. You must have the following dependencies installed:
    - node.js (this will install npm)
2. Clone this git repository
3. Run `npm install`, `npm install discord`, `npm install sqlite3`
4. Obtain a discord bot token (TODO: add instructions for this). **Keep this token private!**
5. Save the token in a file called `token.token`, with nothing else in the file **Do not upload this token to Github! (it's in the .gitignore)**
6. Run `npm start` to run the bot

## IDE setup

1. ESlint is used for linting
2. Install the eslint plugin for Visual Studio Code
3. Open the respository **folder** (not just the source file), and Visual Studio Code should add linting.

## Discord Setup

By default, discord doesn't show you the channel/guild IDs, and extra information useful for developing bots. Check out
[this guide](https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-)
to enable developer mode.

There are some gotchas with bots' permissions, see [Discord's permission documentation.](https://discordapp.com/developers/docs/topics/permissions#permission-hierarchy)