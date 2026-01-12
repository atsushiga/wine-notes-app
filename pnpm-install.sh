#!/bin/bash
# pnpm installを正しいNode.jsバージョンで実行するスクリプト

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# .nvmrcファイルがあればそれを使用、なければ22.20.0を使用
if [ -f .nvmrc ]; then
  nvm use
else
  nvm use 22.20.0
fi

# nodebrewのPATHを除外して、nvmのNode.jsを優先
export PATH="$NVM_DIR/versions/node/$(node -v | sed 's/v//')/bin:$(echo $PATH | tr ":" "\n" | grep -v nodebrew | tr "\n" ":")"

# pnpmを実行（npx経由で最新版を使用）
npx -y pnpm@latest "$@"
