'use strict';

/**
 * A ping pong bot, whenever you send "ping", it replies "pong".
 */

// Import the discord.js module
const Discord = require('discord.js');
const fs = require('fs');

// Create an instance of a Discord client
const client = new Discord.Client();

/**
 * The ready event is vital, it means that only _after_ this will
 * your bot start reacting to information received from Discord
 */
client.on('ready', () => {
  console.log('Successfuly connected to discord servers!');
});

// Channel IDs
const idChannelNewArrivals = '557056028991291394';
const idChannelBotSpam = '557048243696042055';
const idChannelUmiSupport = '392489134721335306';
const idChannelHiguSupport = '392489108875771906';

// Role IDs
const idRoleSpoilerViewer = '558567398542802944';

const usersWhoHaveSentAttachments = new Map();

// Create an event listener for messages
client.on('message', (message) => {
  console.log(`User [${message.author.username}|${message.author.id}] sent [${message.content}]`);

  // If the message is "ping"
  if (message.content === 'ping') {
    // Send "pong" to the same channel
    console.log('sent pong');
    message.channel.send('pong');
  } else if (message.content.trim() === '!show_me_spoilers!') {
    console.log(`Trying to give spoiler role to ${message.member.user.username}`);

    if (message.member.roles.has(idRoleSpoilerViewer)) {
      console.log('User already has role! ignoring request :S');
    } else {
      const roleObject = message.guild.roles.get(idRoleSpoilerViewer);
      message.member.addRole(roleObject);
      client.channels.get(idChannelNewArrivals).send('Congratulations, you now have the spoiler role!', { reply: message.member });
    }
  }

  // verify messages on the correct channel are filtered
  // To get the channel ID, follow instructions here: https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-
  if (!(message.channel.id === idChannelBotSpam
        || message.channel.id === idChannelUmiSupport
        || message.channel.id === idChannelHiguSupport)) {
    return;
  }

  // TODO: this will send one message for each attachment!
  // should probably only send one message per user's message.
  message.attachments.array().forEach((attachment) => {
    if (!usersWhoHaveSentAttachments.has(message.author.id)) {
      usersWhoHaveSentAttachments.set(message.author.id);
      console.log(attachment);
      message.channel.send(`Hi ${message.author.username}, it looks like you have sent an attachment: <${attachment.url}>. 
If it contains spoilers, please re-upload the image with the '✅ Mark as Spoiler' checkbox ticked.
You won't be warned again until the bot is restarted.`, { reply: message.member });
    }
  });
});

client.on('guildMemberAdd', (member) => {
  const guildMemberAddMessage = `Greetings!
  1. By default, you are restricted from viewing the spoiler channels. To gain access, please type \`!show_me_spoilers!\` exactly as shown.
  2. Please do not post spoilers in the non-spoiler channels.
  3. In the support channels, <#${idChannelHiguSupport}}> and <#${idChannelUmiSupport}}>, please use spoiler tags like \`|| A banana splits into three equal pieces ||\` to hide spoilers`;
  client.channels.get(idChannelNewArrivals).send(guildMemberAddMessage, { reply: member });
});

// Log our bot in using the token from https://discordapp.com/developers/applications/me
const tokenFileName = './token.token';

fs.readFile(tokenFileName, 'utf-8', (err, content) => {
  if (err) {
    console.log(`Couldn't open discord bot token ${tokenFileName}, ${err}`);
  } else {
    client.login(content.trim());
  }
});
