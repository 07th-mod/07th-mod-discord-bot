/* eslint-disable linebreak-style */
'use strict';

// Import the discord.js module
const path = require('path');
const Discord = require('discord.js');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite').verbose();
const db = null;

// Create an instance of a Discord client
const client = new Discord.Client({
  ws: { intents: ['GUILDS', 'GUILD_EMOJIS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'DIRECT_MESSAGES'] },
  // 'Partials' are used for role reactions, see https://discordjs.guide/popular-topics/reactions.html#awaiting-reactions
 partials: [
   'USER',
   //'CHANNEL',
   //'GUILD_MEMBER',
   'MESSAGE',
   'REACTION'],
});

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

const verboseLoggingEnabled = true;

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
async function replyToMessageNoFail(message, replyText, sendAsPrivateMessage = false) {
  try {
    if (message.partial) await message.fetch();
    const sendTarget = sendAsPrivateMessage ? message.author : message.channel;
    await sendTarget.send(replyText, { reply: message.member });
  } catch (error) {
    console.error('replyToMessageNoFail(): failed to send reply');
    console.error(error);
  }
}
/* eslint-enable no-unused-vars */

const giveRoleFailed = '**Warning!** - Whoever sent the last message might be in offline mode, and is invisible to me. Please go online so I can properly reply your message. Otherwise there was some other error (developers: check logs please).'

// Gives the 'spoiler viewer' role to the sender of the given message
async function giveMessageSenderSpoilerRoles(message, roleIDsToGive) {
  try {
    if (message.partial) await message.fetch();

    const member = await message.guild.members.fetch(message.user.id);

    logVerbose(`Trying to give spoiler role to ${member.user.username}`);

    if (!roleIDsToGive.has(idRoleNormalChannels)) {
      roleIDsToGive.push(idRoleNormalChannels);
    }

    let botReplyMessage = 'Trying to give role...';

    roleIDsToGive.forEach(async (idOfRoleToGive) => {
      const currentGuild = message.channel.guild;
      const roleObject = currentGuild.roles.cache.get(idOfRoleToGive);

      if (member.roles.cache.has(idOfRoleToGive)) {
        botReplyMessage += `\nYou already have the ${roleObject.name} role!`;
        logVerbose('User already has role! ignoring request :S');
      } else {
        botReplyMessage += `\nCongratulations, you now have the ${roleObject.name} role!`;
        await member.roles.add(roleObject);
      }
    });

    await replyToMessageNoFail(message, botReplyMessage);
  } catch (error) {
    await replyToMessageNoFail(message, giveRoleFailed);
    console.error(error);
  }
}

async function removeSpoilerRoles(message, roleIDsToRemove) {
  try {
    if (message.partial) await message.fetch();

    const member = await message.guild.members.fetch(message.user.id);
    let botReplyMessage = 'Trying to remove role...';

    roleIDsToRemove.forEach(async (roleId) => {
      const roleObject = message.guild.roles.cache.get(roleId);
      // eslint-disable-next-line no-unused-vars
      await member.roles.remove(roleObject).catch((_ex) => {});
      botReplyMessage += `\nRemoved the ${roleObject.name} role`;
    });

    await replyToMessageNoFail(message, botReplyMessage);
  } catch (error) {
    await replyToMessageNoFail(message, giveRoleFailed);
    console.error(error);
  }
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


async function scanMessageForBotCommand(message) {
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
      await replyToMessageNoFail(message, 'Sorry, locking the non-spoiler channels is not allowed.');
    }

    // Unlock: Always unlock normal channels even user didn't request it
    // Lock: Don't allow user to lock normal channels
    if (isUnlockCommand) {
      idToUnlockList.add(idRoleNormalChannels);
      await giveMessageSenderSpoilerRoles(message, idToUnlockList);
    } else if (isLockCommand) {
      idToUnlockList.delete(idRoleNormalChannels);
      await removeSpoilerRoles(message, idToUnlockList);
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

    await replyToMessageNoFail(message, reply.join('\n\n'));

    return;
  }

  await replyToMessageNoFail(message, `Please **read the rules** in <#512701581494583312>.
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


async function handleAddOrRemoveReaction(reaction, user, isRemove) {
  // If a message gains a reaction and it is uncached, fetch and cache the message
  // You should account for any errors while fetching, it could return API errors if the resource is missing
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();
  if (user.partial) await user.fetch();

  // Now the message has been cached and is fully available:
  console.log(`${reaction.message.author}'s message gained a reaction!`);
  // Fetches and caches the reaction itself, updating resources that were possibly defunct.
  if (reaction.partial) await reaction.fetch();
  // Now the reaction is fully available and the properties will be reflected accurately:
  console.log(`${reaction.count} user(s) have given the same reaction to this message!`);

  const currentGuild = reaction.message.channel.guild;

  if (!user || user.bot || !currentGuild) {
    return;
  }

  // Check that the channel ID is one that we want to monitor
  if (![idChannelRules, idChannelBotSpam].includes(reaction.message.channel.id)) {
    return;
  }

  const memberWhoReacted = await currentGuild.members.fetch(message.user.id);

  // always add normal role if a user ever adds/removes any reaction
  memberWhoReacted.roles.add(currentGuild.roles.cache.get(idRoleNormalChannels));

  const maybeRoleId = emojiToRoleIDMap[reaction.message.emoji.name];
  if (maybeRoleId !== undefined) {
    if (isRemove) {
      await memberWhoReacted.roles.remove(currentGuild.roles.cache.get(maybeRoleId));
    } else {
      await memberWhoReacted.roles.add(currentGuild.roles.cache.get(maybeRoleId));
    }
  }
}

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

    await replyToMessageNoFail(message, replyText);
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

    await replyToMessageNoFail(message, replyText, true);
  });
}



client.on('ready', () => {
  logVerbose('Successfuly connected to discord servers!');
});

client.on('messageReactionAdd', async (reaction, user) => {
  handleAddOrRemoveReaction(reaction, user, false);
});

client.on('messageReactionRemove', async (reaction, user) => {
  handleAddOrRemoveReaction(reaction, user, true);
});

(async () => {
  const db = await sqlite.open({
    filename: '/tmp/database.db',
    driver: sqlite3.Database
  })
})()

// Setup sqlite database
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS warnedUsers(authorID INTEGER PRIMARY KEY)');
  db.run('CREATE TABLE IF NOT EXISTS firstTimeSupportUsers(authorID INTEGER PRIMARY KEY)');
});


// Log our bot in using the token from https://discordapp.com/developers/applications/me
const tokenFileName = './token.token';

fs.readFile(tokenFileName, 'utf-8', (err, content) => {
  if (err) {
    console.error(`Couldn't open discord bot token ${tokenFileName}, ${err}`);
  } else {
    client.login(content.trim());
  }
});
