'use strict';

/**
 * 07th-mod discord bot
 */

// Import the discord.js module
const Discord = require('discord.js');
const fs = require('fs');

// Create an instance of a Discord client
const client = new Discord.Client();

// This is assigned once connection is established
let currentGuild = null;

// 07th mod guild ID
const guildID = '384426173821616128';

// Channel IDs
const idChannelRoleAssignment = '557056028991291394';
const idChannelBotSpam = '557048243696042055';
const idChannelUmiSupport = '392489134721335306';
const idChannelHiguSupport = '392489108875771906';
const idChannelRules = '512701581494583312';

// Role IDs
const idRoleHigurashiSpoilers = '558567398542802944';
const idRoleUminekoSpoilers = '559187484165144586';
const idRoleOtherGameSpoilers = '559187572451180545';
const idRoleNormalChannels = '559248937714712586';

// Reaction to Role map
const emojiToRoleIDMap = {
  mion: idRoleHigurashiSpoilers,
  BEATORICHE: idRoleUminekoSpoilers,
  angelmort: idRoleOtherGameSpoilers,
};

// List of spoiler roles to remove with the !unspoil command
const unspoilerRoleIds = [idRoleHigurashiSpoilers, idRoleUminekoSpoilers, idRoleOtherGameSpoilers];

const usersWhoHaveSentAttachments = new Map();

const verboseLoggingEnabled = false;

function logVerbose(message) {
  if (verboseLoggingEnabled) {
    console.log(message);
  }
}

// Tries to reply to the user, and tag the user in the message. If the bot cannot
// talk on that channel, uses the 'new arrivals' channel. If the bot still cannot
// talk, gives up and logs an error
/* eslint-disable no-unused-vars */
function replyToMessageNoFail(message, replyText) {
  message.channel.send(replyText, { reply: message.member })
    .catch(___exception => console.error('replyToMessageNoFail(): failed to send reply'));
}
/* eslint-enable no-unused-vars */

// Gives the 'spoiler viewer' role to the sender of the given message
function giveMessageSenderSpoilerRole(message, idOfRoleToGive) {
  logVerbose(`Trying to give spoiler role to ${message.member.user.username}`);

  if (message.member.roles.has(idOfRoleToGive)) {
    logVerbose('User already has role! ignoring request :S');
  } else {
    const roleObject = currentGuild.roles.get(idOfRoleToGive);
    message.member.addRole(roleObject);
    replyToMessageNoFail(message, `Congratulations, you now have the ${roleObject.name} role!`);
  }
}

function removeSpoilerRoles(message) {
  unspoilerRoleIds.forEach((roleId) => {
    // eslint-disable-next-line no-unused-vars
    message.member.removeRole(message.guild.roles.get(roleId)).catch((_ex) => {});
  });
  replyToMessageNoFail(message, 'All your spoiler roles have been removed!');
}

// All functions here must take member as argument
const commands = {
  '!spoil_higurashi': message => giveMessageSenderSpoilerRole(message, idRoleHigurashiSpoilers),
  '!spoil_umineko': message => giveMessageSenderSpoilerRole(message, idRoleUminekoSpoilers),
  '!spoil_other': message => giveMessageSenderSpoilerRole(message, idRoleOtherGameSpoilers),
  '!unspoil': removeSpoilerRoles,
  '!help': message => replyToMessageNoFail(message, `The following commands are available:\n - ${Object.keys(commands).join('\n - ')}`),
  '!ping': message => replyToMessageNoFail(message, 'polo'),
};

// The ready event is vital, it means that only _after_ this will
// your bot start reacting to information received from Discord
client.on('ready', () => {
  logVerbose('Successfuly connected to discord servers!');
  currentGuild = client.guilds.get(guildID);
});

// See https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
// Add the 'normal' role when a user leaves a reaction in the #rules channel
client.on('raw', (packet) => {
  // Check that this is a reaction add/remove message
  if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) {
    return;
  }

  // Check that the channel ID is one that we want to monitor
  const channelId = packet.d.channel_id;
  if (![idChannelRules, idChannelRoleAssignment].includes(channelId)) {
    return;
  }

  // Note: packet.d.emoji.id field MAY exist, but not always.
  const emoji = packet.d.emoji.name;
  const userWhoReacted = client.users.get(packet.d.user_id);

  currentGuild.fetchMember(userWhoReacted).then((memberWhoReacted) => {
    if (channelId === idChannelRules) {
      memberWhoReacted.addRole(currentGuild.roles.get(idRoleNormalChannels));
    } else if (channelId === idChannelRoleAssignment) {
      const maybeRoleId = emojiToRoleIDMap[emoji];
      if (maybeRoleId !== undefined) {
        if (packet.t === 'MESSAGE_REACTION_ADD') {
          memberWhoReacted.addRole(currentGuild.roles.get(maybeRoleId));
        } else {
          memberWhoReacted.removeRole(currentGuild.roles.get(maybeRoleId));
        }
      }
    }
  }).catch(logVerbose);
});

// Create an event listener for messages
client.on('message', (message) => {
  logVerbose(`User [${message.author.username}|${message.author.id}] sent [${message.content}]`);

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
      logVerbose(attachment);
      const replyText = `Hi ${message.author.username}, it looks like you have sent an attachment: <${attachment.url}>. 
If it contains spoilers, please re-upload the image with the '✅ Mark as Spoiler' checkbox ticked.
You won't be warned again until the bot is restarted.`;
      replyToMessageNoFail(message, replyText);
    }
  });
});

// client.on('guildMemberAdd', printWelcomeMessage);

// Log our bot in using the token from https://discordapp.com/developers/applications/me
const tokenFileName = './token.token';

fs.readFile(tokenFileName, 'utf-8', (err, content) => {
  if (err) {
    console.error(`Couldn't open discord bot token ${tokenFileName}, ${err}`);
  } else {
    client.login(content.trim());
  }
});
