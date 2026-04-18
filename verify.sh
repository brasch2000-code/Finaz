export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install --no-audit --no-fund > build.log 2>&1
npx next build >> build.log 2>&1
echo "BUILD_DONE" >> build.log
