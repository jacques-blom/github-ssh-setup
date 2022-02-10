#!/usr/bin/env node

import clipboard from "clipboardy"
import * as EmailValidator from "email-validator"
import { execa } from "execa"
import { mkdir, readFile, writeFile } from "fs/promises"
import { generate } from "generate-password"
import inquirer from "inquirer"
import pty from "node-pty"
import open from "open"
import os from "os"
import colors from "colors"
import boxen from "boxen"

let step = 0
const logStep = async (message: string) => {
    console.log("")
    step++

    const prefix = colors.magenta.bold(`Step ${step} →`)
    console.log(prefix + " " + message)
}

const run = async () => {
    const { email } = await inquirer.prompt({
        name: "email",
        type: "input",
        message: '"What is your GitHub email address?"',
    })

    if (!EmailValidator.validate(email)) {
        throw new Error("Invalid email address")
    }

    const passphrase = generate({
        length: 16,
        numbers: true,
    })

    logStep("Generate new SSH key")

    const sshDir = `${process.env.HOME}/.ssh`

    await mkdir(sshDir, { recursive: true })

    const sshKeygen = execa("ssh-keygen", [
        "-t",
        "ed25519",
        "-C",
        email,
        "-f",
        `${sshDir}/id_ed25519`,
        "-N",
        passphrase,
    ])

    sshKeygen.stdout?.pipe(process.stdout)
    sshKeygen.stderr?.pipe(process.stderr)
    if (sshKeygen.stdin) process.stdin.pipe(sshKeygen.stdin)
    await sshKeygen

    logStep("Start the SSH agent")

    const sshAgent = await execa("eval", ["$(ssh-agent -s)"], { shell: true })
    console.log("sshAgent", sshAgent.stdout)

    logStep("Configure the SSH agent")

    await execa("touch", [`${sshDir}/config`])

    const currentContents = await readFile(`${sshDir}/config`, "utf8")
    if (currentContents.length > 0) {
        const { overwrite } = await inquirer.prompt({
            type: "confirm",
            message: '"Do you want to overwrite ~/.ssh/config?"',
            name: "overwrite",
        })

        if (!overwrite) {
            process.exit(0)
        }
    }

    const config = `
    Host *
    AddKeysToAgent yes
    UseKeychain yes
    IdentityFile ~/.ssh/id_ed25519
    `

    await writeFile(`${sshDir}/config`, config.trim())

    logStep(
        "Add the SSH key to your SSH agent, and add the passphrase to the Keychain"
    )

    const darwinMajorVersion = parseInt(os.release().split(".")[0])

    let flag = "-K"
    if (darwinMajorVersion >= 21) {
        flag = "--apple-use-keychain"
    }

    await new Promise<void>((resolve) => {
        const sshAdd = pty.spawn(
            "/usr/bin/ssh-add",
            [flag, `${sshDir}/id_ed25519`],
            {
                name: "xterm-color",
                cwd: process.env.HOME,
            }
        )

        sshAdd.onData((data) => {
            if (data.includes("Enter passphrase")) {
                sshAdd.write(passphrase + "\r")
            } else if (data.trim().length) {
                console.log(data.trim())
            }
        })

        sshAdd.onExit(() => resolve())
    })

    logStep("Add the public key to GitHub")

    console.log(
        boxen(
            [
                "The last step is to add the public key to your GitHub account.",
                "The public key has already been copied to the clipboard.",
                colors.bold(
                    "Press enter to open your browser, then paste the key."
                ),
            ].join("\n"),
            { padding: 1, borderColor: "green", textAlignment: "center" }
        )
    )

    const { openBrowser } = await inquirer.prompt({
        type: "confirm",
        message: "Press enter to open GitHub in your default browser.",
        name: "openBrowser",
    })

    if (!openBrowser) process.exit(0)

    const publicKey = await readFile(`${sshDir}/id_ed25519.pub`, "utf8")

    await clipboard.write(publicKey)

    await open("https://github.com/settings/ssh/new")
}

run().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
