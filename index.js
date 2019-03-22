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

const channelNewArrivals = '557056028991291394';
const channelBotSpam = '557048243696042055';
const channelUmiSupport = '392489134721335306';

// Create an event listener for messages
client.on('message', (message) => {
  // verify messages on the correct channel are filtered
  // To get the channel ID, follow instructions here: https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-
  if (!(message.channel.id === channelBotSpam || message.channel.id === channelUmiSupport)) {
    return;
  }

  console.log(`Got ${message.content} with attachment ${message.attachments} embeds ${message.embeds}`);
  console.log(message.attachments);
  console.log(message);

  // TODO: this will send one message for each attachment!
  // should probably only send one message per user's message.
  message.attachments.array().forEach((attachment) => {
    console.log(attachment);
    message.channel.send(`Hi ${message.author.username}, it looks like you have sent an attachment: <${attachment.url}>. If it contains spoilers, please re-upload the image with spoiler tags.`, { reply: message.member });
  });


  // If the message is "ping"
  if (message.content === 'ping') {
    // Send "pong" to the same channel
    console.log('sent pong');
    message.channel.send('pong');
  }
});

client.on('guildMemberAdd', (member) => {
  const guildMemberAddMessage = `Greetings ${member.user.username}! Please do NOT post spoilers. If you must post spoilers, please use spoiler tags like \`|| A banana naturally splits into three equal pieces ||\``;
  client.channels.get(channelNewArrivals).send(guildMemberAddMessage, { reply: member });
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
