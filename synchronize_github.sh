#!/bin/bash
echo "You must run this script with as root or you'll get a PolicyKit1 error"
systemctl stop discord-bot
git pull origin master --rebase
systemctl start discord-bot
