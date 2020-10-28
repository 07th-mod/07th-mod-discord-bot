/* eslint-disable linebreak-style */
'use strict';

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


// The ready event is vital, it means that only _after_ this will
// your bot start reacting to information received from Discord
client.on('ready', () => {
  logVerbose('Successfuly connected to discord servers!');
});

// You can also try to upgrade partials to full instances:
client.on('messageReactionAdd', async (reaction, user) => {
  handleAddOrRemove(reaction, user, false);
});

client.on('messageReactionRemove', async (reaction, user) => {
  handleAddOrRemove(reaction, user, true);
});


async function handleAddOrRemove(reaction, user, isRemove) {
  // If a message gains a reaction and it is uncached, fetch and cache the message
  // You should account for any errors while fetching, it could return API errors if the resource is missing
  if (reaction.message.partial) await reaction.message.fetch();
  // Now the message has been cached and is fully available:
  console.log(`${reaction.message.author}'s message "${reaction.message.content}" gained a reaction!`);
  // Fetches and caches the reaction itself, updating resources that were possibly defunct.
  if (reaction.partial) await reaction.fetch();
  // Now the reaction is fully available and the properties will be reflected accurately:
  console.log(`${reaction.count} user(s) have given the same reaction to this message!`);
}



// Log our bot in using the token from https://discordapp.com/developers/applications/me
const tokenFileName = './token.token';

fs.readFile(tokenFileName, 'utf-8', (err, content) => {
  if (err) {
    console.error(`Couldn't open discord bot token ${tokenFileName}, ${err}`);
  } else {
    client.login(content.trim());
  }
});
