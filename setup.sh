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
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
source "$NVM_DIR/nvm.sh"

# Install Node.js
echo "Installing Node.js 22..."
nvm install 22
nvm use 22
nvm alias default 22

# Clone and setup
echo "Cloning repository..."
rm -rf tezara-crawler
git clone https://github.com/yekta/tezara-crawler.git
cd tezara-crawler
npm install

# Check if rclone is already installed
if command -v rclone &> /dev/null; then
    echo "rclone is already installed. Skipping installation."
else
    echo "Installing rclone..."
    sudo -v && curl https://rclone.org/install.sh | sudo bash
fi

# Prompt for .env content
echo -e "\nPaste your .env content below (end with an empty line):"
env_content=""
while IFS= read -r line < /dev/tty; do
    [[ -z "$line" ]] && break  # Exit the loop if an empty line is entered
    env_content+="$line"$'\n'
done

# Check if no content was captured
if [[ -z "$env_content" ]]; then
    echo "No .env content was provided. Exiting."
    exit 1
fi

echo "Saving .env content..."
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
echo "Checking if directory exists in R2..."
if rclone lsf tezara:tezara-crawler &> /dev/null; then
    echo "Directory exists. Copying files with verbose output..."
    rclone -v copy tezara:tezara-crawler .
else
    echo "Directory not found in R2. Skipping copy operation."
fi

echo "Setup complete!"
