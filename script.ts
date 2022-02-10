import * as EmailValidator from "email-validator"
import inquirer from "inquirer"
import { execa } from "execa"
import { generate } from "generate-password"
import { appendFile, mkdir, readFile, writeFile } from "fs/promises"
import { spawn } from "child_process"
import pty from "node-pty"
import os from "os"
import clipboard from "clipboardy"
import open from "open"

// Todo: Check for existing keys and ask if want to use that

const run = async () => {
    const { email } = await inquirer.prompt([
        {
            name: "email",
            type: "input",
            message: '"What is your GitHub email address?"',
        },
    ])

    if (!EmailValidator.validate(email)) {
        throw new Error("Invalid email address")
    }

    const passphrase = generate({
        length: 16,
        numbers: true,
    })

    console.log("passphrase", passphrase)

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

    const sshAgent = await execa("eval", ["$(ssh-agent -s)"], { shell: true })
    console.log("sshAgent", sshAgent.stdout)

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
                cols: 80,
                rows: 30,
                cwd: process.env.HOME,
            }
        )

        sshAdd.onData((data) => {
            if (data.includes("Enter passphrase")) {
                sshAdd.write(passphrase + "\r")
            } else if (data.trim().length) {
                console.log(data)
            }
        })

        sshAdd.onExit(() => {
            resolve()
        })
    })

    const publicKey = await readFile(`${sshDir}/id_ed25519.pub`, "utf8")

    await clipboard.write(publicKey)

    await open("https://github.com/settings/ssh/new")
}

run().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
