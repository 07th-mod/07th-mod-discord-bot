
// Currently not used
function tryFixRoles() {
  const normalRole = currentGuild.roles.get(idRoleNormalChannels);
  const userWhoNeedsAddRole = [];

  currentGuild.members.forEach((m) => {
    const userHasSpoilerRole = m.roles.has(idRoleHigurashiSpoilers)
    || m.roles.has(idRoleUminekoSpoilers)
    || m.roles.has(idRoleOtherGameSpoilers)
    || m.roles.has(idRoleDeveloperViewer)
    || m.roles.has(idRoleCiconia)
    || m.roles.has(idRoleNSFW);

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