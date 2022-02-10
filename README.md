# ghss (GitHub SSH Setup)

A command line utility to set up your GitHub SSH keys in 30 seconds. 🐙

It basically automates the steps outlined in GitHub's [documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent).

Right now, this only works on macOS, but if you'd like to contribute Linux or Windows support, please do! 🙏

## Usage

Using npx (recommended):

```bash
npx ghss
```

Alternatively, you can install it globally:

```bash
# NPM
npm install -g ghss
ghss

# Yarn
yarn global add ghss
ghss
```

Then, follow the prompts. Once done, the script will copy the public key to your clipboard and open your browser to the GitHub settings page, where you can paste the key.

It's as simple as that. 🙂

## Demo

![Demo](./demo.gif)

## Security

For added security, and according to best practices, the script generates a secure passphrase for your SSH key and adds it to your macOS keychain, so you won't have to remember or type it.

## Background

I got tired of having to manually do this each time I set up a new machine, so I thought I'd write a script to automate it. Hopefully it saves you some time, too.
