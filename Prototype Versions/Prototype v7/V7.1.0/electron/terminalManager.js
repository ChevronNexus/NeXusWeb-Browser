/**
 * terminalManager.js
 * Manages multiple node-pty terminal sessions for multi-terminal tabs.
 */

let pty = null
try {
  pty = require('node-pty')
} catch (err) {
  console.warn('[NeXusWeb] node-pty not available. Built-in terminal disabled:', err.message)
}

const os = require('os')
const terminals = new Map()

function getShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

function createTerminal(id, cols = 80, rows = 24, onData) {
  if (!pty) {
    if (onData) onData(`\r\n\x1b[33m[NeXusWeb] Native terminal backend (node-pty) not compiled.\x1b[0m\r\n`)
    return { success: false, error: 'node-pty not available' }
  }

  // If session already exists, clean it up
  destroyTerminal(id)

  const shell = getShell()
  const shellArgs = process.platform === 'win32' && shell.toLowerCase().includes('powershell')
    ? ['-NoLogo']
    : []

  try {
    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: Math.max(cols || 80, 20),
      rows: Math.max(rows || 24, 5),
      cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
      env: process.env,
    })

    ptyProcess.onData((data) => {
      if (onData) onData(data)
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      terminals.delete(id)
    })

    terminals.set(id, ptyProcess)
    return { success: true, id, shell }
  } catch (err) {
    console.error(`[NeXusWeb] Failed to spawn terminal ${id}:`, err)
    return { success: false, error: err.message }
  }
}

function writeToTerminal(id, data) {
  const ptyProcess = terminals.get(id)
  if (ptyProcess) {
    try {
      ptyProcess.write(data)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
  return { success: false, error: 'Terminal not found' }
}

function resizeTerminal(id, cols, rows) {
  const ptyProcess = terminals.get(id)
  if (ptyProcess && cols > 0 && rows > 0) {
    try {
      ptyProcess.resize(cols, rows)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
  return { success: false }
}

function destroyTerminal(id) {
  const ptyProcess = terminals.get(id)
  if (ptyProcess) {
    try {
      ptyProcess.kill()
    } catch (e) {}
    terminals.delete(id)
  }
  return { success: true }
}

function destroyAllTerminals() {
  for (const id of terminals.keys()) {
    destroyTerminal(id)
  }
}

module.exports = {
  createTerminal,
  writeToTerminal,
  resizeTerminal,
  destroyTerminal,
  destroyAllTerminals,
}
