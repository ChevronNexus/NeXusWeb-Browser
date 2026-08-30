/**
 * envReader.js
 * Environment Variable file discovery and parser for NeXusWeb Developer Tools.
 * Scans directories for .env, .env.local, .env.development, .env.production, etc.
 */

const fs = require('fs')
const path = require('path')

const ENV_FILE_NAMES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
  '.env.production',
  '.env.production.local',
  '.env.example',
]

function parseEnvContent(content) {
  const lines = content.split(/\r?\n/)
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Skip empty lines or pure comments
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('#')) {
        result.push({ isComment: true, key: '', value: trimmed.substring(1).trim(), raw: rawLine })
      }
      continue
    }

    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/)
    if (match) {
      let key = match[1]
      let value = match[2] || ''

      // Strip surrounding quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r')
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1)
      } else {
        // Strip inline comment if not quoted
        const commentIdx = value.indexOf(' #')
        if (commentIdx !== -1) {
          value = value.substring(0, commentIdx).trim()
        }
      }

      const isSecret = /secret|key|token|pass|auth|cert|private|api_key|pwd/i.test(key)

      result.push({
        isComment: false,
        key,
        value,
        isSecret,
        raw: rawLine,
      })
    }
  }

  return result
}

function findEnvFiles(startDir) {
  const results = []
  const baseDir = startDir || process.cwd()

  try {
    const candidates = [baseDir]

    // Check parent directories up to 2 levels
    try {
      const parent = path.dirname(baseDir)
      if (parent && parent !== baseDir) candidates.push(parent)
    } catch (e) {}

    // Check common workspace folders
    try {
      const subdirs = fs.readdirSync(baseDir, { withFileTypes: true })
      for (const d of subdirs) {
        if (d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== 'dist') {
          candidates.push(path.join(baseDir, d.name))
        }
      }
    } catch (e) {}

    const seenPaths = new Set()

    for (const dir of candidates) {
      for (const envName of ENV_FILE_NAMES) {
        const fullPath = path.join(dir, envName)
        if (fs.existsSync(fullPath) && !seenPaths.has(fullPath)) {
          seenPaths.add(fullPath)
          try {
            const stat = fs.statSync(fullPath)
            if (stat.isFile()) {
              const content = fs.readFileSync(fullPath, 'utf8')
              const parsed = parseEnvContent(content)
              results.push({
                fileName: envName,
                filePath: fullPath,
                dirName: path.basename(dir),
                sizeBytes: stat.size,
                modifiedTime: stat.mtime.toISOString(),
                varCount: parsed.filter(p => !p.isComment).length,
                variables: parsed,
              })
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error('[NeXusWeb] findEnvFiles error:', err)
  }

  return results
}

function readEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = parseEnvContent(content)
    return {
      filePath,
      fileName: path.basename(filePath),
      variables: parsed,
      rawContent: content,
    }
  } catch (e) {
    return null
  }
}

module.exports = {
  findEnvFiles,
  readEnvFile,
  parseEnvContent,
}
