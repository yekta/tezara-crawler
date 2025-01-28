#!/bin/bash
set -e  # Exit on error

# Ensure we're in the home directory
cd ~

# Update system packages
echo "Updating system packages..."
sudo apt update

# Install NVM
echo "Installing NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # Load NVM

# Ensure NVM is available in the current session
source "$HOME/.nvm/nvm.sh"

# Install Node.js
echo "Installing Node.js 22..."
nvm install 22

# Remove existing tezara-crawler directory if it exists
if [ -d "tezara-crawler" ]; then
    echo "Removing existing tezara-crawler directory..."
    rm -rf tezara-crawler
fi

# Clone repository
echo "Cloning tezara-crawler repository..."
git clone https://github.com/yekta/tezara-crawler.git
cd tezara-crawler

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Install rclone
echo "Installing rclone..."
sudo -v && curl https://rclone.org/install.sh | sudo bash

# Create rclone config directory if it doesn't exist
mkdir -p ~/.config/rclone

# Handle .env file
echo "Please paste your environment variables (including R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT) then press Ctrl+D:"
env_content=$(cat)

# Save .env file
echo "$env_content" > .env

# Extract R2 credentials from .env file
eval "$(cat .env | sed 's/^/export /')"

# Verify R2 credentials are present
if [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_ENDPOINT" ]; then
    echo "Error: R2 credentials not found in .env file. Please ensure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT are set."
    exit 1
fi

# Create rclone config file using values from .env
echo "Configuring rclone..."
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
echo "Copying files from S3..."
rclone copy tezara:tezara-crawler .

echo "Setup complete! You can now run the crawler."