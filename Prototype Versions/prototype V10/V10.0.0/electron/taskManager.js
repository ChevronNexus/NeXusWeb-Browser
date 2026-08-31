/**
 * taskManager.js
 * Real-Time Browser Task Manager for NeXusWeb
 * Chromium / Electron Process Telemetry, PID mapping, and 1-click Process Termination.
 */

const { app } = require('electron')

function getBrowserTasks(allTabs = [], allExtensions = []) {
  try {
    const metrics = app.getAppMetrics() || []
    
    // Map renderer PIDs to tabs and extensions
    const tabPidMap = new Map()
    allTabs.forEach(tab => {
      if (tab?.view?.webContents?.getOSProcessId) {
        try {
          const pid = tab.view.webContents.getOSProcessId()
          if (pid) {
            tabPidMap.set(pid, {
              id: tab.id,
              title: tab.title || tab.url || 'Web Tab',
              url: tab.url,
              favicon: tab.favicon,
            })
          }
        } catch (e) {}
      }
    })

    const extMap = new Map()
    allExtensions.forEach(ext => {
      extMap.set(ext.id, ext.name || ext.id)
    })

    let totalMemKB = 0
    let totalCpu = 0

    const tasks = metrics.map(m => {
      const pid = m.pid
      const type = m.type // 'Browser', 'Tab', 'GPU', 'Utility', 'Zygote', etc.
      const cpu = m.cpu ? Math.round(m.cpu.percentCPUUsage * 10) / 10 : 0
      const memWorkingSetKB = m.memory?.workingSetSize || 0
      const memPrivateKB = m.memory?.privateBytes || 0
      const memMB = Math.round((memWorkingSetKB / 1024) * 10) / 10
      const privateMB = Math.round((memPrivateKB / 1024) * 10) / 10

      totalMemKB += memWorkingSetKB
      totalCpu += cpu

      let taskName = `${type} Process`
      let category = type
      let icon = '⚡'
      let isKillable = type !== 'Browser'

      if (type === 'Browser') {
        taskName = 'Browser Main (NeXusWeb Core)'
        icon = '🌐'
      } else if (type === 'GPU') {
        taskName = 'GPU Hardware Rasterizer'
        icon = '🎮'
      } else if (type === 'Tab' || type === 'Renderer') {
        const tabInfo = tabPidMap.get(pid)
        if (tabInfo) {
          taskName = `Tab: ${tabInfo.title}`
          icon = '📄'
        } else {
          taskName = `Web Renderer (${pid})`
          icon = '📄'
        }
      } else if (type === 'Utility') {
        taskName = 'Network Service & Audio Engine'
        icon = '📡'
      } else if (type === 'Extension') {
        taskName = 'Extension Background Worker'
        icon = '🧩'
      }

      return {
        pid,
        name: taskName,
        type: category,
        cpuPercent: cpu,
        memoryMB: memMB,
        privateMB,
        icon,
        isKillable,
        sandboxed: m.sandboxed || false,
      }
    })

    // Sort: Browser Main first, then by Memory descending
    tasks.sort((a, b) => {
      if (a.type === 'Browser') return -1
      if (b.type === 'Browser') return 1
      return b.memoryMB - a.memoryMB
    })

    const totalMemMB = Math.round((totalMemKB / 1024) * 10) / 10
    const totalCpuPercent = Math.round(totalCpu * 10) / 10

    return {
      success: true,
      tasks,
      summary: {
        totalMemMB,
        totalCpuPercent,
        processCount: tasks.length,
        timestamp: Date.now(),
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      tasks: [],
      summary: { totalMemMB: 0, totalCpuPercent: 0, processCount: 0 }
    }
  }
}

function killTaskProcess(pid) {
  try {
    if (!pid || pid === process.pid) {
      return { success: false, error: 'Cannot terminate main browser process' }
    }
    process.kill(pid, 'SIGKILL')
    return { success: true, pid }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = {
  getBrowserTasks,
  killTaskProcess,
}
