#!/bin/bash
set -e  # Exit on error

# Update system packages
echo "Updating system packages..."
sudo apt update

# Install NVM
echo "Installing NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
source "$HOME/.nvm/nvm.sh"

# Install Node.js
echo "Installing Node.js 22..."
nvm install 22

# Clone and setup
echo "Cloning repository..."
rm -rf tezara-crawler
git clone https://github.com/yekta/tezara-crawler.git
cd tezara-crawler
npm install

echo "BEFORE RCLONE"
# Install rclone
echo "Installing rclone..."
sudo -v && curl https://rclone.org/install.sh | sudo bash

echo "AFTER RCLONE"

# Get the env content
echo -e "\nPaste your .env content and press Enter twice:"
env_content=""
while IFS= read -r line; do
    [[ -z "$line" ]] && break
    env_content+="$line"$'\n'
done

echo "AFTER ENV_CONTENT"

# Save to .env
echo "$env_content" > .env

# Parse R2 credentials
R2_ACCESS_KEY_ID=$(echo "$env_content" | grep R2_ACCESS_KEY_ID | sed 's/R2_ACCESS_KEY_ID=//')
R2_SECRET_ACCESS_KEY=$(echo "$env_content" | grep R2_SECRET_ACCESS_KEY | sed 's/R2_SECRET_ACCESS_KEY=//')
R2_ENDPOINT=$(echo "$env_content" | grep R2_ENDPOINT | sed 's/R2_ENDPOINT=//')

# Setup rclone config
mkdir -p ~/.config/rclone
cat > ~/.config/rclone/rclone.conf << EOL
[tezara]
type = s3
provider = Cloudflare
access_key_id = $R2_ACCESS_KEY_ID
secret_access_key = $R2_SECRET_ACCESS_KEY
endpoint = $R2_ENDPOINT
acl = private
EOL

# Copy files using rclone
echo "Copying files from R2..."
rclone copy tezara:tezara-crawler .

echo "Setup complete!"