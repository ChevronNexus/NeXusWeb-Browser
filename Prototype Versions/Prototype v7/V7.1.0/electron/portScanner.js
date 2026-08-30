/**
 * portScanner.js
 * Auto-detects running localhost servers and provides Port Manager capabilities
 * (viewing active listening ports, PID, process name, and killing stuck processes).
 */

const net = require('net')
const { exec } = require('child_process')

const PORT_LABELS = {
  3000: 'React / Next.js / Node',
  3001: 'React / Node (Port 3001)',
  3002: 'React / Node (Port 3002)',
  3003: 'React / Node (Port 3003)',
  4000: 'GraphQL / Strapi / Hexo',
  4200: 'Angular CLI',
  4321: 'Astro Dev Server',
  5000: 'Flask / Python / Werkzeug',
  5001: 'Flask Alt (Port 5001)',
  5002: 'Flask Alt (Port 5002)',
  5050: 'Flask / PgAdmin',
  5173: 'Vite Dev Server',
  5174: 'Vite Alt (Port 5174)',
  5175: 'Vite Alt (Port 5175)',
  5500: 'VS Code Live Server',
  5501: 'VS Code Live Server (5501)',
  7000: 'FastAPI / Custom Dev',
  7860: 'Gradio Web UI',
  8000: 'Django / FastAPI / Python',
  8001: 'Django / Python Alt',
  8080: 'HTTP Server / Tomcat / Vue',
  8081: 'Metro Bundler / React Native',
  8088: 'Custom HTTP Service',
  8501: 'Streamlit App',
  8888: 'Jupyter Notebook',
  9000: 'PHP / Webpack Dev Server',
  9001: 'PHP / Dev Server',
  9229: 'Node.js Debugger',
  11434: 'Ollama LLM API',
}

const COMMON_PORTS = Object.keys(PORT_LABELS).map(p => ({
  port: parseInt(p, 10),
  label: PORT_LABELS[p],
}))

/**
 * Check if a TCP port is open on localhost.
 */
function probePort(port, timeout = 700) {
  return new Promise((resolve) => {
    const checkHost = (host) => {
      return new Promise((res) => {
        const socket = new net.Socket()
        socket.setTimeout(timeout)
        socket.on('connect', () => {
          socket.destroy()
          res(true)
        })
        socket.on('timeout', () => {
          socket.destroy()
          res(false)
        })
        socket.on('error', () => {
          socket.destroy()
          res(false)
        })
        try {
          socket.connect(port, host)
        } catch (e) {
          res(false)
        }
      })
    }

    checkHost('127.0.0.1').then((open) => {
      if (open) {
        resolve(true)
      } else {
        checkHost('::1').then((open6) => resolve(open6))
      }
    })
  })
}

/**
 * Scans all common developer ports plus active system listeners.
 */
async function scanLocalPorts() {
  try {
    const probePromises = COMMON_PORTS.map(async ({ port, label }) => {
      const open = await probePort(port)
      return open ? { port, label, url: `http://localhost:${port}` } : null
    })

    const [probeResults, detailedList] = await Promise.all([
      Promise.all(probePromises),
      getDetailedPortList().catch(() => []),
    ])

    const foundMap = new Map()

    probeResults.filter(Boolean).forEach(item => {
      foundMap.set(item.port, item)
    })

    detailedList.forEach(item => {
      if (!foundMap.has(item.port)) {
        foundMap.set(item.port, {
          port: item.port,
          label: item.processName ? `${item.processName} (Port ${item.port})` : `Local Server (Port ${item.port})`,
          url: `http://localhost:${item.port}`,
          pid: item.pid,
          processName: item.processName,
        })
      } else {
        const existing = foundMap.get(item.port)
        existing.pid = item.pid
        existing.processName = item.processName
      }
    })

    return [...foundMap.values()].sort((a, b) => a.port - b.port)
  } catch (err) {
    console.error('[NeXusWeb] Port scan error:', err)
    return []
  }
}

/**
 * Detailed port inspection for the Port Manager drawer.
 * Returns: [{ port, address, pid, processName, label }]
 */
function getDetailedPortList() {
  return new Promise((resolve) => {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      return getDetailedLinuxPorts().then(resolve)
    }

    if (process.platform !== 'win32') {
      return resolve([])
    }

    // Use PowerShell Get-NetTCPConnection + Get-Process for high accuracy on Windows
    const cmd = `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in @('127.0.0.1','0.0.0.0','::1','::') -and $_.LocalPort -ge 1000 } | Select-Object -Property LocalAddress, LocalPort, OwningProcess | ConvertTo-Json"`

    exec(cmd, { timeout: 3000 }, (err, stdout) => {
      if (err || !stdout || !stdout.trim()) {
        // Fallback to netstat
        return getDetailedNetstat().then(resolve)
      }

      try {
        let parsed = JSON.parse(stdout)
        if (!Array.isArray(parsed)) parsed = [parsed]

        // Fetch process names for unique PIDs
        const pids = [...new Set(parsed.map(p => p.OwningProcess).filter(Boolean))]
        getProcessNames(pids).then((procMap) => {
          const map = new Map()
          for (const item of parsed) {
            const port = item.LocalPort
            const pid = item.OwningProcess
            if (port < 1000 || port === 5040 || port === 7680) continue // Skip internal OS services

            if (!map.has(port)) {
              const processName = procMap[pid] || 'Process ' + pid
              const label = PORT_LABELS[port] || processName
              map.set(port, {
                port,
                address: item.LocalAddress || '127.0.0.1',
                pid,
                processName,
                label,
                url: `http://localhost:${port}`,
              })
            }
          }
          resolve([...map.values()].sort((a, b) => a.port - b.port))
        })
      } catch (e) {
        getDetailedNetstat().then(resolve)
      }
    })
  })
}

function getProcessNames(pids) {
  return new Promise((resolve) => {
    if (!pids.length) return resolve({})
    const pidFilter = pids.map(p => `Id eq ${p}`).join(' or ')
    const cmd = `powershell -NoProfile -Command "Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id, ProcessName | ConvertTo-Json"`
    exec(cmd, { timeout: 2000 }, (err, stdout) => {
      const map = {}
      if (!err && stdout) {
        try {
          let list = JSON.parse(stdout)
          if (!Array.isArray(list)) list = [list]
          list.forEach(proc => {
            if (proc && proc.Id) map[proc.Id] = proc.ProcessName
          })
        } catch (e) {}
      }
      resolve(map)
    })
  })
}

function getDetailedLinuxPorts() {
  return new Promise((resolve) => {
    // Try ss -tulpn or lsof -i -P -n
    exec('ss -tulpn 2>/dev/null || netstat -tlpn 2>/dev/null || lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null', { timeout: 2500 }, (err, stdout) => {
      if (err || !stdout) return resolve([])
      const map = new Map()
      const lines = stdout.split('\n')
      for (const line of lines) {
        // Parse ss output: LISTEN 0 511 127.0.0.1:5173 0.0.0.0:* users:(("node",pid=12345,fd=22))
        const portMatch = line.match(/(?:127\.0\.0\.1|0\.0\.0\.0|::|::1|\*):(\d+)/)
        if (portMatch) {
          const port = parseInt(portMatch[1], 10)
          if (port >= 1000 && !map.has(port)) {
            const pidMatch = line.match(/pid=(\d+)/i) || line.match(/\s+(\d+)\/(\w+)/)
            const pid = pidMatch ? parseInt(pidMatch[1], 10) : null
            const procMatch = line.match(/users:\(\("([^"]+)"/) || line.match(/(\w+)\s+\d+\s+LISTEN/)
            const procName = procMatch ? procMatch[1] : (pid ? `PID ${pid}` : `Process`)

            map.set(port, {
              port,
              address: '127.0.0.1',
              pid,
              processName: procName,
              label: PORT_LABELS[port] || `${procName} (Port ${port})`,
              url: `http://localhost:${port}`,
            })
          }
        }
      }
      resolve([...map.values()].sort((a, b) => a.port - b.port))
    })
  })
}

function getDetailedNetstat() {
  return new Promise((resolve) => {
    exec('netstat -ano -p tcp', { timeout: 2000 }, (err, stdout) => {
      if (err || !stdout) return resolve([])
      const map = new Map()
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 4) {
            const addr = parts[1]
            const pid = parseInt(parts[parts.length - 1], 10)
            const m = addr.match(/:(\d+)$/)
            if (m) {
              const port = parseInt(m[1], 10)
              if (port >= 1000 && port !== 5040 && port !== 7680 && !map.has(port)) {
                map.set(port, {
                  port,
                  address: addr,
                  pid,
                  processName: 'PID ' + pid,
                  label: PORT_LABELS[port] || 'Server :' + port,
                  url: `http://localhost:${port}`,
                })
              }
            }
          }
        }
      }
      resolve([...map.values()].sort((a, b) => a.port - b.port))
    })
  })
}

/**
 * Terminate process by PID.
 */
function killProcess(pid) {
  return new Promise((resolve, reject) => {
    if (!pid || pid === 0 || pid === 4) {
      return reject(new Error('Cannot kill system process'))
    }
    const cmd = process.platform === 'win32' ? `taskkill /F /PID ${pid} /T` : `kill -9 ${pid}`
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message })
      } else {
        resolve({ success: true, stdout })
      }
    })
  })
}

module.exports = {
  scanLocalPorts,
  probePort,
  getDetailedPortList,
  killProcess,
  COMMON_PORTS,
  PORT_LABELS,
}
