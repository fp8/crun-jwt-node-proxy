#!/usr/bin/env sh

# Install
yarn
if [ $? -ne 0 ]; then
  echo "Yarn install failed. Exiting."
  exit 1
fi

yarn build:ts
if [ $? -ne 0 ]; then
  echo "Yarn build failed. Exiting."
  exit 1
fi

# Setup for prod
yarn workspaces focus --production
if [ $? -ne 0 ]; then
  echo "Yarn workspaces focus failed. Exiting."
  exit 1
fi

# Done.  Show message and list files
echo "cloud-build-setup.sh completed successfully."
ls -l
