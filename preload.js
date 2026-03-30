const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pclabs', {
  runScan:        ()       => ipcRenderer.invoke('run-scan'),
  saveReport:     (html)   => ipcRenderer.invoke('save-report', html),
  runJunkScan:    ()       => ipcRenderer.invoke('run-junk-scan'),
  runJunkClean:   (ids)    => ipcRenderer.invoke('run-junk-clean', ids),
  runGameDetect:  ()       => ipcRenderer.invoke('run-game-detect'),
  runGameOptimize:(opts)   => ipcRenderer.invoke('run-game-optimize', opts),
  minimize:       ()       => ipcRenderer.send('win-min'),
  maximize:     ()     => ipcRenderer.send('win-max'),
  close:        ()     => ipcRenderer.send('win-close'),
  openFeedback: ()     => ipcRenderer.send('open-feedback'),
  openExternal: (url)  => ipcRenderer.send('open-external', url),
  validateKey:  (key)  => ipcRenderer.invoke('validate-key', key),
});