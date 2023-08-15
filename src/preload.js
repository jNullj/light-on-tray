const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('light_control', {
  toggle: (id) => ipcRenderer.invoke('light-control:toggle', id),
  bright: (id, brightness) => ipcRenderer.invoke('light-control:bright', id, brightness),
  rgb: (id, color) => ipcRenderer.invoke('light-control:rgb', id, color),
  set_name: (id, name) => ipcRenderer.invoke('light-control:name', id, name),
  resizeBody: () => ipcRenderer.invoke('light-control:resizeBody'),
  handleLightAddRemoval: (callback) => ipcRenderer.on('light-control:addRemove', callback),
  sendAddRemoveDone: (id) => ipcRenderer.send('addRemove.renderer.done-' + id),
  set_color_mode: (id, modeName) => ipcRenderer.invoke('light-control:colorMode', id, modeName),
  set_temperature: (id, temperature) => ipcRenderer.invoke('light-control:temperature', id, temperature)
})

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on('light-control:bright', (e, id, val) => {
    document.getElementById(id).querySelector('.power-slider').value = val
  })
  ipcRenderer.on('light-control:toggle', (e, id, lightOn) => {
    const toggleInput = document.getElementById(id).querySelector('.toggle-light-button')
    if (lightOn === true) {
      toggleInput.checked = true
    }
  })
  ipcRenderer.on('light-control:rgb', (e, id, rgbInt) => {
    const rgbInput = document.getElementById(id).querySelector('.light-color-picker')
    const rgbHtml = '#' + parseInt(rgbInt).toString(16).padEnd(6, '0')
    rgbInput.value = rgbHtml
  })
  ipcRenderer.on('light-control:name', (e, id, name) => {
    const nameTextbox = document.getElementById(id).querySelector('.name-textbox')
    nameTextbox.value = name
  })
  ipcRenderer.on('light-control:temperature', (e, id, temperature) => {
    const temperaturePicker = document.getElementById(id).querySelector('.temperature-picker')
    temperaturePicker.dispatchEvent(new CustomEvent('updateColorDisplay', { detail: { kelvin: temperature } }))
  })
  ipcRenderer.on('light-control:colorMode', (e, id, mode) => {
    const colorMode = document.getElementById(id).querySelectorAll('input[name="color-mode"]')
    colorMode.forEach(radioBox => {
      if (radioBox.value === mode) {
        radioBox.checked = true
      }
    })
  })
})
