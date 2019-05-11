'use strict';

/**
 * 07th-mod discord bot
 */

// Import the discord.js module
const Discord = require('discord.js');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('warnedUsers.sql');
// Setup sqlite database
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS warnedUsers(authorID INTEGER PRIMARY KEY)');
});

// Create an instance of a Discord client
const client = new Discord.Client();

// This is assigned once connection is established
let currentGuild = null;

// 07th mod guild ID
const guildID = '384426173821616128';

// Channel IDs
const idChannelDiscordSupport = '561722362454867968';
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
const idRoleDeveloperViewer = '559987050510811166';
const idRoleDeveloper = '384430157877739520';

// Reaction to Role map
const emojiToRoleIDMap = {
  mion: idRoleHigurashiSpoilers,
  BEATORICHE: idRoleUminekoSpoilers,
  angelmort: idRoleOtherGameSpoilers,
  ohagi: idRoleDeveloperViewer,
//  potato: idRoleNormalChannels, //NOTE: this reaction is 'potato' not 'potato~1'
};

// List of spoiler roles to remove with the !unspoil command
const unspoilerRoleIds = [idRoleHigurashiSpoilers, idRoleUminekoSpoilers, idRoleOtherGameSpoilers, idRoleDeveloperViewer];

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


// Tries to reply to the user, and tag the user in the message. If the bot cannot
// talk on that channel, uses the 'new arrivals' channel. If the bot still cannot
// talk, gives up and logs an error
/* eslint-disable no-unused-vars */
function replyToMessageNoFail(message, replyText) {
  message.channel.send(replyText, { reply: message.member })
    .catch(___exception => console.error('replyToMessageNoFail(): failed to send reply'));
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
    const roleObject = currentGuild.roles.get(idOfRoleToGive);

    if (message.member.roles.has(idOfRoleToGive)) {
      botReplyMessage += `\nYou already have the ${roleObject.name} role!`;
      logVerbose('User already has role! ignoring request :S');
    } else {
      botReplyMessage += `\nCongratulations, you now have the ${roleObject.name} role!`;
      message.member.addRole(roleObject);
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
    const roleObject = message.guild.roles.get(roleId);
    // eslint-disable-next-line no-unused-vars
    message.member.removeRole(roleObject).catch((_ex) => {});
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
  developer: idRoleDeveloperViewer,
  dev: idRoleDeveloperViewer,
  other: idRoleOtherGameSpoilers,
};

const spoilerChannelList = [
  idRoleHigurashiSpoilers,
  idRoleUminekoSpoilers,
  idRoleDeveloperViewer,
  idRoleOtherGameSpoilers];

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
`);
}

function tryFixRoles() {
  const normalRole = currentGuild.roles.get(idRoleNormalChannels);
  const userWhoNeedsAddRole = [];

  currentGuild.members.forEach((m) => {
    const userHasSpoilerRole = m.roles.has(idRoleHigurashiSpoilers)
    || m.roles.has(idRoleUminekoSpoilers)
    || m.roles.has(idRoleOtherGameSpoilers)
    || m.roles.has(idRoleDeveloperViewer);

    if (userHasSpoilerRole && !m.roles.has(idRoleNormalChannels)) {
      logVerbose(`${m.user.username} needs update`);
      userWhoNeedsAddRole.push(m);
    }
  });

  let cnt = 0;
  function fixFunction() {
    if (cnt < userWhoNeedsAddRole.length) {
      const m = userWhoNeedsAddRole[cnt];
      console.log(`Fixing ${m.user.username}`);
      m.addRole(normalRole);

      cnt += 1;
      setTimeout(fixFunction, 500);
    } else {
      logVerbose('Finished fixes!');
    }
  }

  logVerbose('Begin fixing users...');
  setTimeout(fixFunction, 0);
  return userWhoNeedsAddRole.length;
}

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
  if (![idChannelRules, idChannelBotSpam].includes(channelId)) {
    return;
  }

  // Note: packet.d.emoji.id field MAY exist, but not always.
  const emoji = packet.d.emoji.name;
  const userWhoReacted = client.users.get(packet.d.user_id);

  currentGuild.fetchMember(userWhoReacted).then((memberWhoReacted) => {
    // always add normal role if a user ever adds/removes any reaction
    memberWhoReacted.addRole(currentGuild.roles.get(idRoleNormalChannels));

    const maybeRoleId = emojiToRoleIDMap[emoji];
    if (maybeRoleId !== undefined) {
      if (packet.t === 'MESSAGE_REACTION_ADD') {
        memberWhoReacted.addRole(currentGuild.roles.get(maybeRoleId));
      } else {
        memberWhoReacted.removeRole(currentGuild.roles.get(maybeRoleId));
      }
    }
  }).catch(logVerbose);
});

function warnUserEmbedOrImage(message, warnURL) {
  if (message.member.roles.has(idRoleDeveloper)) {
    return;
  }

  CheckUserNeedsWarning(message.author.id, (needsWarning) => {
    // if bot remembers that the user has already sent an image before, don't message.
    if (!needsWarning) {
      return;
    }

    const replyText = `Hi ${message.author.username}, it looks like you have sent an image: <${warnURL}>.
If it contains spoilers, please re-upload the image with the '✅ Mark as Spoiler' checkbox ticked.
You won't be warned again until the bot is restarted.`;

    replyToMessageNoFail(message, replyText);
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

      // Send at most one message
      warnUserEmbedOrImage(message, messageEmbed.url);
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
  if (![idChannelBotSpam,
    idChannelUmiSupport,
    idChannelHiguSupport,
    idChannelDiscordSupport].includes(message.channel.id)) {
    return;
  }

  scanMessageForBotCommand(message);

  scanMessageForAttachmentsAndWarnUser(message);
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
