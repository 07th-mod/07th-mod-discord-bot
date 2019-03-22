'use strict';

/**
 * 07th-mod discord bot
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

// Prints a welcome message, and @tags the given member to encourage them to look at the message
function printWelcomeMessage(member) {
  const guildMemberAddMessage = `Greetings!
  1. By default, you are restricted from viewing the spoiler channels. To gain access, please send \`!show_me_spoilers\` exactly as shown.
  2. Please do not post spoilers in the non-spoiler channels.
  3. In the support channels, <#${idChannelHiguSupport}> and <#${idChannelUmiSupport}>, please use spoiler tags like \`|| A banana splits into three equal pieces ||\` to hide spoilers`;
  client.channels.get(idChannelNewArrivals).send(guildMemberAddMessage, { reply: member });
}

// Gives the 'spoiler viewer' role to the sender of the given message
function giveMessageSenderSpoilerRole(message) {
  console.log(`Trying to give spoiler role to ${message.member.user.username}`);

  if (message.member.roles.has(idRoleSpoilerViewer)) {
    console.log('User already has role! ignoring request :S');
  } else {
    const roleObject = message.guild.roles.get(idRoleSpoilerViewer);
    message.member.addRole(roleObject);
    client.channels.get(idChannelNewArrivals).send('Congratulations, you now have the spoiler role!', { reply: message.member });
  }
}

// All functions here must take member as argument
const commands = {
  ping: message => message.channel.send('pong'),
  '!show_me_spoilers': giveMessageSenderSpoilerRole,
  '!simulate_user_join': message => printWelcomeMessage(message.member),
  '!help': message => message.channel.send(Object.keys(commands).toString()),
};

// Create an event listener for messages
client.on('message', (message) => {
  console.log(`User [${message.author.username}|${message.author.id}] sent [${message.content}]`);

  // If the message's content matches a value in the lookup table, then execute it
  const maybeFunction = commands[message.content];
  if (maybeFunction !== undefined) {
    maybeFunction(message);
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

client.on('guildMemberAdd', printWelcomeMessage);

// Log our bot in using the token from https://discordapp.com/developers/applications/me
const tokenFileName = './token.token';

fs.readFile(tokenFileName, 'utf-8', (err, content) => {
  if (err) {
    console.log(`Couldn't open discord bot token ${tokenFileName}, ${err}`);
  } else {
    client.login(content.trim());
  }
});
