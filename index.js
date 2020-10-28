/* eslint-disable linebreak-style */
'use strict';

/**
 * 07th-mod discord bot
 */

// Import the discord.js module
const path = require('path');
const Discord = require('discord.js');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('warnedUsers.sql');
// Setup sqlite database
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS warnedUsers(authorID INTEGER PRIMARY KEY)');
  db.run('CREATE TABLE IF NOT EXISTS firstTimeSupportUsers(authorID INTEGER PRIMARY KEY)');
});

// Create an instance of a Discord client
const client = new Discord.Client({
  ws: { intents: ['GUILDS', 'GUILD_EMOJIS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'DIRECT_MESSAGES'] },
  //partials: ['MESSAGE', 'CHANNEL', 'REACTION'], // Used for roles, see https://discordjs.guide/popular-topics/reactions.html#awaiting-reactions
});

// This is assigned once connection is established
// let currentGuild = null;

// 07th mod guild ID
const guildID = '384426173821616128';

// Channel IDs
const idChannelDiscordSupport = '561722362454867968';
const idChannelBotSpam = '557048243696042055';
const idChannelUmiSupport = '392489134721335306';
const idChannelHiguSupport = '392489108875771906';
const idChannelRules = '512701581494583312';

// Role IDs
const idRoleHigurashiSpoilers = '558567398542802944';
const idRoleUminekoSpoilers = '559187484165144586';
const idRoleOtherGameSpoilers = '559187572451180545';
const idRoleNormalChannels = '559248937714712586';
const idRoleDeveloperViewer = '559987050510811166';
const idRoleCiconia = '630212573408788501';
const idRoleDeveloper = '384430157877739520';
const idRoleNSFW = '695820980689305712';

// Reaction to Role map
const emojiToRoleIDMap = {
  mion: idRoleHigurashiSpoilers,
  BEATORICHE: idRoleUminekoSpoilers,
  stun_gun: idRoleCiconia,
  angelmort: idRoleOtherGameSpoilers,
  ohagi: idRoleDeveloperViewer,
  hatchet: idRoleNSFW,
//  potato: idRoleNormalChannels, //NOTE: this reaction is 'potato' not 'potato~1'
};

// List of spoiler roles to remove with the !unspoil command
const unspoilerRoleIds = [idRoleHigurashiSpoilers, idRoleUminekoSpoilers, idRoleCiconia, idRoleOtherGameSpoilers, idRoleDeveloperViewer, idRoleNSFW];

const verboseLoggingEnabled = false;

function logVerbose(message) {
  if (verboseLoggingEnabled) {
    console.log(message);
  }
}


// The callback function will be called with one argument - true if the user needs warning, false otherwise
function CheckUserNeedsWarning(authorID, callback) {
  db.serialize(() => {
    db.get('SELECT * from warnedUsers WHERE authorID = (?)', authorID, (err, row) => {
      if (row === undefined) {
        db.run('INSERT INTO warnedUsers VALUES (?)', authorID);
        callback(true);
      } else {
        callback(false);
      }
      return true;
    });
  });
}

// The callback function will be called with one argument - true if the user needs first time support message, false otherwise
function CheckUserNeedsFirstTimeSupport(authorID, callback) {
  db.serialize(() => {
    db.get('SELECT * from firstTimeSupportUsers WHERE authorID = (?)', authorID, (err, row) => {
      if (row === undefined) {
        db.run('INSERT INTO firstTimeSupportUsers VALUES (?)', authorID);
        callback(true);
      } else {
        callback(false);
      }
      return true;
    });
  });
}


// Tries to reply to the user, and tag the user in the message. If the bot cannot
// talk on that channel, uses the 'new arrivals' channel. If the bot still cannot
// talk, gives up and logs an error
/* eslint-disable no-unused-vars */
function replyToMessageNoFail(message, replyText) {
  message.channel.send(replyText, { reply: message.member })
    .catch(___exception => {
      console.error('replyToMessageNoFail(): failed to send reply');
      console.error(___exception);
    });
}

function replyAsPrivateMessageNoFail(message, replyText) {
  message.author.send(replyText, { reply: message.member })
    .catch(___exception => {
      console.error('replyToMessageNoFail(): failed to send reply');
      console.error(___exception);
    });
}
/* eslint-enable no-unused-vars */

function userIsInvisible(message) {
  if (message.member === null) {
    replyToMessageNoFail(message, '**Warning!** - Whoever sent the last message is in offline mode, and is invisible to me. Please go online so I can properly reply your message.');
    return true;
  }

  return false;
}

// Gives the 'spoiler viewer' role to the sender of the given message
function giveMessageSenderSpoilerRoles(message, roleIDsToGive) {
  if (userIsInvisible(message)) {
    return;
  }

  logVerbose(`Trying to give spoiler role to ${message.member.user.username}`);

  if (!roleIDsToGive.has(idRoleNormalChannels)) {
    roleIDsToGive.push(idRoleNormalChannels);
  }

  let botReplyMessage = 'Trying to give role...';

  roleIDsToGive.forEach((idOfRoleToGive) => {
    const currentGuild = message.channel.guild;
    const roleObject = currentGuild.roles.cache.get(idOfRoleToGive);

    if (message.member.roles.cache.has(idOfRoleToGive)) {
      botReplyMessage += `\nYou already have the ${roleObject.name} role!`;
      logVerbose('User already has role! ignoring request :S');
    } else {
      botReplyMessage += `\nCongratulations, you now have the ${roleObject.name} role!`;
      message.member.roles.add(roleObject);
    }
  });

  replyToMessageNoFail(message, botReplyMessage);
}

function removeSpoilerRoles(message, roleIDsToRemove) {
  if (userIsInvisible(message)) {
    return;
  }

  let botReplyMessage = 'Trying to remove role...';
  roleIDsToRemove.forEach((roleId) => {
    const roleObject = message.guild.roles.cache.get(roleId);
    // eslint-disable-next-line no-unused-vars
    message.member.roles.remove(roleObject).catch((_ex) => {});
    botReplyMessage += `\nRemoved the ${roleObject.name} role`;
  });
  replyToMessageNoFail(message, botReplyMessage);
}

const tokenToChannelIDMap = {
  // 'non spoiler' command handled separately - see scanStringForBotCommand() function
  higurashi: idRoleHigurashiSpoilers,
  higu: idRoleHigurashiSpoilers,
  umineko: idRoleUminekoSpoilers,
  umi: idRoleUminekoSpoilers,
  ciconia: idRoleCiconia,
  developer: idRoleDeveloperViewer,
  dev: idRoleDeveloperViewer,
  other: idRoleOtherGameSpoilers,
  nsfw: idRoleNSFW,
};

const spoilerChannelList = [
  idRoleHigurashiSpoilers,
  idRoleUminekoSpoilers,
  idRoleCiconia,
  idRoleDeveloperViewer,
  idRoleOtherGameSpoilers,
  idRoleNSFW,
];

function scanMessageForBotCommand(message) {
  if (!message.content.startsWith('!')) {
    return;
  }

  const tokArray = message.content.substring(1).toLowerCase().split(/\s+/);
  const tok = new Set(tokArray);
  const isUnlockCommand = tok.has('unlock');
  const isLockCommand = tok.has('lock');

  if (isUnlockCommand || isLockCommand) {
    const idToUnlockList = new Set(tokArray.map(token => tokenToChannelIDMap[token])
      .filter(x => x !== undefined));

    if (tok.has('all')) {
      spoilerChannelList.forEach(x => idToUnlockList.add(x));
    }

    if (isLockCommand && idToUnlockList.has(idRoleNormalChannels)) {
      replyToMessageNoFail(message, 'Sorry, locking the non-spoiler channels is not allowed.');
    }

    // Unlock: Always unlock normal channels even user didn't request it
    // Lock: Don't allow user to lock normal channels
    if (isUnlockCommand) {
      idToUnlockList.add(idRoleNormalChannels);
      giveMessageSenderSpoilerRoles(message, idToUnlockList);
    } else if (isLockCommand) {
      idToUnlockList.delete(idRoleNormalChannels);
      removeSpoilerRoles(message, idToUnlockList);
    }

    return;
  }

  if (tok.has('faq') || tok.has('trouble') || tok.has('troubleshoot') || tok.has('troubleshooting')) {
    const reply = ['Please check if your question is already answered on our FAQs:',
      'Installer Troubleshooting: <https://07th-mod.com/wiki/Higurashi/Higurashi-Part-1---Voice-and-Graphics-Patch/#connection-troubleshooting>'];

    if (message.channel.id !== idChannelHiguSupport) {
      reply.push('Umineko Troubleshooting: <https://07th-mod.com/wiki/Umineko/Umineko-Part-0-TroubleShooting-and-FAQ/>')
    }

    if (message.channel.id !== idChannelUmiSupport) {
      reply.push('Higurashi Troubleshooting: <http://07th-mod.com/wiki/Higurashi/FAQ/>')
    }

    replyToMessageNoFail(message, reply.join('\n\n'));

    return;
  }

  replyToMessageNoFail(message, `Please **read the rules** in <#512701581494583312>.
Then, use the bot like the following to lock/unlock channels:
\`!unlock non spoiler\`
\`!unlock umineko higurashi\`
\`!lock developer umineko other\`
\`!unlock all\`
The following channels are available to unlock(as described in <#512701581494583312>):
    - \`non spoiler\`
    - \`umineko\`
    - \`higurashi\`
    - \`developer\`
    - \`other\`
    - \`nsfw\`
`);
}

var collector = null;
// The ready event is vital, it means that only _after_ this will
// your bot start reacting to information received from Discord
client.on('ready', () => {
  logVerbose('Successfuly connected to discord servers!');

  client.channels.cache.get(idChannelRules).messages.fetch('561412240431906817').then(
    message => {
      message.reactions.cache.forEach((reaction) => {
        console.log(reaction);
        reaction.fetch();
      });

      //const filter = (reaction, user) => true;
      //collector = message.createReactionCollector(filter, {});
      //collector.on('collect', r => console.log(`Collected ${r.emoji.name}`));
    },
  );

  // Cache the reaction message so we can watch for changes on it
  // client.channels.cache.get(idChannelRules).messages.fetchPinned().then(messages => {
  //   console.log(`Received ${messages.size} messages`);
  //   messages.forEach((message) => {
  //     const filter = (reaction, user) => true;
  //     const collector = message.createReactionCollector(filter, {});
  //     collector.on('collect', r => console.log(`Collected ${r.emoji.name}`));
  //   });
  // })
  // .catch(console.error);

});

// NOTE: this function only monitors messages which are cached ('fetched')
// In the 'ready' function we cache the pinned messages in the rules channel to make sure
// we watch the pinned message for reactions.
// Based on: https://discordjs.guide/popular-topics/reactions.html#listening-for-reactions-on-old-messages
client.on('messageReactionAdd', (reaction, user) => {
  console.log(reaction);

  // if (reaction.partial) {
  //   try {
  //     await reaction.fetch();
  //   } catch (error) {
  //     console.error('Failed to react to reaction: ', error);
  //     return;
  //   }
  // }

  if (!user || user.bot || !reaction.message.channel.guild) {
    return;
  }

  const currentGuild = reaction.message.channel.guild;

  // Check that the channel ID is one that we want to monitor
  if (![idChannelRules, idChannelBotSpam].includes(reaction.message.channel.id)) {
    return;
  }

  currentGuild.members.fetch(user).then((memberWhoReacted) => {
    // always add normal role if a user ever adds/removes any reaction
    memberWhoReacted.roles.add(currentGuild.roles.cache.get(idRoleNormalChannels));

    const maybeRoleId = emojiToRoleIDMap[reaction.message.emoji.name];
    if (maybeRoleId !== undefined) {
      //if (packet.t === 'MESSAGE_REACTION_ADD') {
      memberWhoReacted.roles.add(currentGuild.roles.cache.get(maybeRoleId));
      //} else {
      //  memberWhoReacted.roles.remove(currentGuild.roles.cache.get(maybeRoleId));
      //}
    }
  }).catch(logVerbose);
});

// See https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
// Add the 'normal' role when a user leaves a reaction in the #rules channel
// client.on('raw', (packet) => {
//   // Check that this is a reaction add/remove message
//   if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) {
//     return;
//   }

//   // Check that the channel ID is one that we want to monitor
//   const channelId = packet.d.channel_id;
//   if (![idChannelRules, idChannelBotSpam].includes(channelId)) {
//     return;
//   }

//   // Note: packet.d.emoji.id field MAY exist, but not always.
//   const emoji = packet.d.emoji.name;
//   const userWhoReacted = client.users.cache.get(packet.d.user_id);

//   currentGuild.members.fetch(userWhoReacted).then((memberWhoReacted) => {
//     // always add normal role if a user ever adds/removes any reaction
//     memberWhoReacted.addRole(currentGuild.roles.get(idRoleNormalChannels));

//     const maybeRoleId = emojiToRoleIDMap[emoji];
//     if (maybeRoleId !== undefined) {
//       if (packet.t === 'MESSAGE_REACTION_ADD') {
//         memberWhoReacted.addRole(currentGuild.roles.get(maybeRoleId));
//       } else {
//         memberWhoReacted.removeRole(currentGuild.roles.get(maybeRoleId));
//       }
//     }
//   }).catch(logVerbose);
// });

function warnUserEmbedOrImage(message, warnURL) {
  if (message.member.roles.cache.has(idRoleDeveloper)) {
    return;
  }

  CheckUserNeedsWarning(message.author.id, (needsWarning) => {
    // if bot remembers that the user has already sent an image before, don't message.
    if (!needsWarning) {
      return;
    }

    const replyText = `Hi ${message.author.username}, it looks like you have sent an image: <${warnURL}>.
If it contains spoilers, please re-upload the image with the '✅ Mark as Spoiler' checkbox ticked.`;

    replyToMessageNoFail(message, replyText);
  });
}

function scanUserNeedsFirstTimeSupport(message) {
  if (message.member.roles.cache.has(idRoleDeveloper)) {
    return;
  }

  CheckUserNeedsFirstTimeSupport(message.author.id, (needsWarning) => {
    // if bot remembers that the user has already had first time support, don't message.
    if (!needsWarning) {
      return;
    }

    const replyText = `**Please follow the support checklist**: https://07th-mod.com/wiki/support-checklist/
**Make sure to fill in the template**, then copy and paste it into the <#392489108875771906> or <#392489134721335306> channels.

Filling in the template helps us answer you as quickly as possible.`;

    replyAsPrivateMessageNoFail(message, replyText);
  });
}

// TODO: this will send one message for each attachment!
// should probably only send one message per user's message.
// Note: attachment is of type "MessageAttachment
function scanMessageForAttachmentsAndWarnUser(message) {
  // Scan for embeds (previews of links etc.)
  // Need to wait some time before the message.embed field is populated.
  // Not sure if there's an api to watch for the embed being loaded.
  setTimeout(() => {
    logVerbose(message.embeds);
    message.embeds.every((messageEmbed) => {
      if (messageEmbed.thumbnail == null) {
        return true;
      }

      // Send at most one message. Don't warn github embeds as it's usually a flase positive
      if (!messageEmbed.url.includes('github')) {
        warnUserEmbedOrImage(message, messageEmbed.url);
      }

      return false;
    });
  }, 3000);

  // Scan for attachments (files user has uploaded)
  logVerbose(message.attachments);
  message.attachments.array().every((attachment) => {
    // if 'width' is undefined, is not an image
    if (attachment.width == null) {
      return true;
    }

    // if the file part of the URL starts with 'SPOILER_' then it is
    // already marked as spoiler - no warning needed
    if (path.basename(attachment.url).toLowerCase().startsWith('spoiler_')) {
      return true;
    }

    // Send at most one message
    warnUserEmbedOrImage(message, attachment.url);
    return false;
  });
}

// Create an event listener for messages
client.on('message', (message) => {
  logVerbose(`User [${message.author.username}|${message.author.id}] sent [${message.content}]`);

  // verify messages on the correct channel are filtered
  // To get the channel ID, follow instructions here: https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-
  if ([idChannelBotSpam,
    idChannelUmiSupport,
    idChannelHiguSupport,
    idChannelDiscordSupport].includes(message.channel.id)) {
    scanMessageForBotCommand(message);
    scanMessageForAttachmentsAndWarnUser(message);
  }

  // Only send firstTimeSupport to #umi_support and #higu_support (#bot_spam_2 is for testing)
  if ([idChannelBotSpam,
    idChannelUmiSupport,
    idChannelHiguSupport].includes(message.channel.id)) {
    scanUserNeedsFirstTimeSupport(message);
  }
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
