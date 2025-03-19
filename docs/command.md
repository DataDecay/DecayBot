# Command Configuration Guide

This guide explains how to create and structure custom commands for your bot, powered by the `CommandParser` class.

Your `CommandParser` loads commands from `/config/commands.json` and executes them dynamically. Follow the instructions below to create or modify commands in that file.

---

## How Commands Work

When a user runs a command (e.g., `db:hello`), the following happens:
1. `CommandParser` looks up the `commands` array from `commands.json`.
2. It finds the command by matching the `name`.
3. If found, it runs the associated `actions` in sequence.

---

## Command Structure

Each command is a JSON object inside the `commands` array.

```json
{
  "name": "commandName",
  "description": "Explain what this command does.",
  "roles": ["public", "trusted", "owner"],
  "actions": [
    {
      "type": "actionType",
      "property": "value"
    }
  ]
}
```

| Field         | Type        | Description                                                                |
|---------------|-------------|----------------------------------------------------------------------------|
| `name`        | `string`    | Command trigger. Users run this command using its name.                    |
| `description` | `string`    | What the command does (used in help text).                                 |
| `roles`       | `array`     | Where the command shows in the help: `public`, `trusted`, or `owner`.      |
| `actions`     | `array`     | List of actions to perform when the command is triggered.                  |

---

## Available Actions

These actions are executed in order by `executeActions()` in your parser:

| Action Type    | Description                                                                                      |
|----------------|--------------------------------------------------------------------------------------------------|
| `chat`         | Sends a chat message.                                                                            |
| `tellraw`      | Sends a rich text message (`JSON`) with colors, clicks, etc.                                     |
| `coreCommand`  | Runs core bot functions like `refillCore` or executes commands via `core.run()`.                |
| `validateHash` | Verifies a user-provided hash (role-based security). Runs `then` or `else` actions accordingly. |
| `startLoop`    | Runs a repeating command at intervals (milliseconds).                                           |
| `stopLoops`    | Stops all active loops.                                                                          |
| `stopBot`      | Stops the bot completely (`bot.quit()`).                                                         |
| `conditional`  | Runs actions based on a condition (`if`/`else`). ⚠️ Uses `eval()`—validate carefully!            |

---

## Create Your Own Command (Step-by-Step)

### 1. **Basic Public Command**
Sends a simple chat message that anyone can use.

```json
{
  "name": "hello",
  "description": "Greets the user.",
  "roles": ["public"],
  "actions": [
    {
      "type": "chat",
      "message": "Hello there!"
    }
  ]
}
```

🔹 Users run: `db:hello`  
🔹 Result: Sends "Hello there!" to everyone in chat.

---

### 2. **Secure Command (Owner Hash Validation)**

Only the `owner` can execute this command by providing a valid hash.

```json
{
  "name": "shutdown",
  "description": "Stops the bot (owner only).",
  "roles": ["owner"],
  "actions": [
    {
      "type": "validateHash",
      "hashType": ["owner"],
      "hashArgIndex": 0,
      "then": [
        {
          "type": "chat",
          "message": "Shutting down bot!"
        },
        {
          "type": "stopBot"
        }
      ],
      "else": [
        {
          "type": "chat",
          "message": "Invalid hash. Access denied."
        }
      ]
    }
  ]
}
```

🔹 Users run: `!shutdown <hash>`  
🔹 Hash is validated using `HashUtils.validateOwner()`.  
🔹 If valid → stops the bot.  
🔹 If invalid → sends an access denied message.

---

### 3. **Conditional Command**

Runs different actions based on the first argument.

```json
{
  "name": "server",
  "description": "Starts or stops the server.",
  "roles": ["owner"],
  "actions": [
    {
      "type": "validateHash",
      "hashType": ["owner"],
      "hashArgIndex": 0,
      "then": [
        {
          "type": "conditional",
          "condition": "args[1] === 'start'",
          "then": [
            {
              "type": "chat",
              "message": "Starting server..."
            },
            {
              "type": "coreCommand",
              "command": "run",
              "args": "'start-server'"
            }
          ],
          "else": [
            {
              "type": "chat",
              "message": "Stopping server..."
            },
            {
              "type": "coreCommand",
              "command": "run",
              "args": "'stop-server'"
            }
          ]
        }
      ],
      "else": [
        {
          "type": "chat",
          "message": "Invalid hash."
        }
      ]
    }
  ]
}
```

🔹 Users run: `!server <hash> start` or `!server <hash> stop`  
🔹 Executes based on the second argument (`args[1]`).

---

### 4. **Looping Command**

Starts a repeating action every second.

```json
{
  "name": "autoMessage",
  "description": "Sends a message every second.",
  "roles": ["owner"],
  "actions": [
    {
      "type": "validateHash",
      "hashType": ["owner"],
      "hashArgIndex": 0,
      "then": [
        {
          "type": "startLoop",
          "intervalMs": 1000,
          "command": "say This is an automated message!"
        },
        {
          "type": "chat",
          "message": "Started auto messaging loop."
        }
      ],
      "else": [
        {
          "type": "chat",
          "message": "Invalid hash."
        }
      ]
    }
  ]
}
```

🔹 Users run: `!autoMessage <hash>`  
🔹 Sends "This is an automated message!" every second until stopped.

---

## ⚙️ Hash Validation Details (`validateHash`)

This action restricts command access based on user hashes.

### Example

```json
{
  "type": "validateHash",
  "hashType": ["owner", "trusted"],
  "hashArgIndex": 0,
  "then": [
    { "type": "chat", "message": "Access granted." }
  ],
  "else": [
    { "type": "chat", "message": "Access denied." }
  ]
}
```

| Property        | Description                                                      |
|-----------------|------------------------------------------------------------------|
| `hashType`      | Roles to validate against (`trusted` / `owner`).                 |
| `hashArgIndex`  | Which argument in `args` contains the hash (starts from `0`).    |
| `then`          | Actions if the hash is valid.                                    |
| `else`          | Actions if the hash is invalid.                                  |

🚨 **Internally**, your JS file uses `HashUtils.validateOwner()`  
✅ Result must be `true` for `then` to run.

---

## ⚠️ `eval()` Warning (Advanced)

The `conditional` and `evaluateArg` actions rely on `eval()` in your `CommandParser`.  
➡️ Do **not** pass untrusted user input directly!  
➡️ Always sanitize or restrict who can execute commands that evaluate conditions.

---

## 🆘 Show Command Help (Built-in)

You can show available commands by calling:

```js
commandParser.showHelp();
```

This sends a `tellraw` message listing all commands, categorized by role.

---

## 📝 Example Command Template

```json
{
  "name": "example",
  "description": "Example command.",
  "roles": ["public"],
  "actions": [
    {
      "type": "chat",
      "message": "This is an example command!"
    }
  ]
}
```

---

# 🎯 Pro Tips
- ✅ Test commands in a staging environment before going live.
- ✅ Use `roles` wisely to protect sensitive commands.
- ✅ Regularly audit commands that use `validateHash` and `eval()`.

---

Let me know if you want an **auto-generator for commands** or a **JSON schema** to validate the config!
