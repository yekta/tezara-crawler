#!/bin/bash
set -e  # Exit on error

# Ensure we're in the home directory
cd ~

# Update system packages
sudo apt update

# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
source "$HOME/.nvm/nvm.sh"

# Install Node.js
nvm install 22

# Remove existing directory if it exists
rm -rf tezara-crawler

# Clone and setup
git clone https://github.com/yekta/tezara-crawler.git
cd tezara-crawler
npm install

# Install rclone
sudo -v && curl https://rclone.org/install.sh | sudo bash

# Get all environment variables
echo "Paste your entire .env file content and press Enter:"
read -r env_content

# Save to .env
echo "$env_content" > .env

# Parse R2 credentials from env content
R2_ACCESS_KEY_ID=$(echo "$env_content" | grep R2_ACCESS_KEY_ID | sed 's/R2_ACCESS_KEY_ID=//')
R2_SECRET_ACCESS_KEY=$(echo "$env_content" | grep R2_SECRET_ACCESS_KEY | sed 's/R2_SECRET_ACCESS_KEY=//')
R2_ENDPOINT=$(echo "$env_content" | grep R2_ENDPOINT | sed 's/R2_ENDPOINT=//')

# Verify R2 credentials were found
if [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_ENDPOINT" ]; then
    echo "Error: Missing R2 credentials in .env content"
    exit 1
fi

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
rclone copy tezara:tezara-crawler .