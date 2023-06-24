const path = require('path');
const { app, Tray, Menu, BrowserWindow, ipcMain } = require('electron')
const Yeelight = require('yeelight2');

const APPNAME = 'light on tray'
const DEBUG = process.argv.includes('-debug')

let tray
/**
 * @type {Object.<number, Yeelight.Light>}
 */
const devices = {}

function exitApp() {
    app.quit(); 
}

function logDBG(...args) {
  if (!DEBUG) { return }
  console.log(...args)
}

function scanDevices(panel){
  try{
    Yeelight.discover(function(device){

      devices[device.id] = device;

      logDBG('found device:' + device.name)
      panel.webContents.send('light-control:addRemove', device.id, true);
      ipcMain.once('addRemove.renderer.done-'+ device.id, () => {
        let blub_name = device.name
        panel.webContents.send('light-control:name', device.id, blub_name)
  
        let dim = device.bright
        panel.webContents.send('light-control:bright', device.id, dim)
        logDBG('bright=' + dim)
  
        let light_state = false
        if (device.power == 'on'){
          light_state = true;
        }else{
          light_state = false;
        }
        panel.webContents.send('light-control:toggle', device.id, light_state)
        logDBG('power-on:' + light_state)
  
        logDBG('rgb:' + device.rgb); // this is string of int val and not hex!
        let rgb = device.rgb;
        panel.webContents.send('light-control:rgb', device.id, rgb);

        logDBG('temperature:', device.ct, ' K')
        panel.webContents.send('light-control:temperature', device.id, device.ct)

        let colorMode
        switch (device.color_mode) {
          case '1':
            colorMode = 'Color'
            break;
          case '2':
            colorMode = 'Temperature'
            break;
          default:
            break;
        }
        logDBG('mode:', colorMode)
        panel.webContents.send('light-control:colorMode', device.id, colorMode)
      })
      device.on('error', err => {
        logDBG('light error:' + err)
        panel.emit('light_failed', device)
      })
    })
  } catch (err) {
    if (err == 'Network timeout, Yeelight not response'){
      //TODO
    }
  }
}

// Creates window & specifies its values
const createWindow = () => {
    const panel = new BrowserWindow({
          show: false,
          frame: false,
          fullscreenable: false,
          resizable: false,
          transparent: true,
          skipTaskbar: true,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js')
          }
      })
      ipcMain.handle('light-control:resizeBody', () => {
        const panelSizeWidthPromise = panel.webContents.executeJavaScript(`
          document.body.clientWidth
        `)
        const panelSizeHeightPromise = panel.webContents.executeJavaScript(`
          document.body.clientHeight
        `)
        Promise.all([panelSizeWidthPromise, panelSizeHeightPromise])
        .then(([panelSizeWidth, panelSizeHeight]) => {
          panel.setContentSize(panelSizeWidth + 16, panelSizeHeight + 16);
          showWindow(panel)
        })
      })

      // This is where the index.html file is loaded into the window
      panel.loadFile(path.join(__dirname, 'panel.html'))
      if (DEBUG) {
        panel.webContents.openDevTools({mode: 'detach'})
      }
  
    // Hide the window when it loses focus
    panel.on('blur', () => {
      if (!panel.webContents.isDevToolsOpened()) {
        panel.hide()
      }
    })

    panel.on('light_failed', device => {
      panel.webContents.send('light-control:addRemove', device.id, false)
      device.exit()
      delete devices[device.id]
    })

    ipcMain.handle('light-control:toggle', (e, id) => {
      const device = devices[id]
        device.toggle().then(() => {
          //todo
        },() => {
          panel.emit('light_failed', device)
        }).catch(() => {
          panel.emit('light_failed', device)
        })
    })
    ipcMain.handle('light-control:bright', (e, id, val) => {
      const device = devices[id]
        device.set_bright(val).then(() => {
          logDBG('dim to:' + val)
        },() => {
          panel.emit('light_failed', device)
        })
    })
    ipcMain.handle('light-control:rgb', (e, id, val) => {
      const device = devices[id]
        device.set_rgb(val).then(() => {
          logDBG('rgb to:' + val)
          panel.webContents.send('light-control:colorMode', device.id, "Color")
        },() => {
          panel.emit('light_failed', device)
        })
    })
    ipcMain.handle('light-control:name', (e, id, val) => {
      const device = devices[id]
      device.set_name(val).then(() => {
        logDBG('set name to:' + val)
      },() => {
        panel.emit('light_failed', device)
      })
  })
  ipcMain.handle('light-control:temperature', (e, id, val) => {
    const device = devices[id]
    device.set_ct_abx(val).then(() => {
      logDBG('set temperature to:' + val)
      panel.webContents.send('light-control:colorMode', device.id, "Temperature")
    },() => {
      panel.emit('light_failed', device)
    })
})
  ipcMain.handle('light-control:colorMode', (e, id, colorMode) => {
    const device = devices[id]
    const log = () => { logDBG('set color mode to:', colorMode) }
    const fail = () => { panel.emit('light_failed', device) }
    switch (colorMode) {
      case "Color":
        device.set_rgb(device.rgb).then(log, fail)
        break;
      case "Temperature":
        device.set_ct_abx(device.ct).then(log, fail)
        break;
      default:
        throw "Illigal colorMode"
        break;
    }
  })
  return {panel}
}

const toggleWindow = (panel) => {
  if (panel.isVisible()) {
    panel.hide()
  } else {
    showWindow(panel)
  }
}

const showWindow = (panel) => {
    const position = getWindowPosition(panel)
    panel.setPosition(position.x, position.y, false)
    panel.show()
    panel.focus()
}

const getWindowPosition = (panel) => {
    const windowBounds = panel.getBounds()
    const trayBounds = tray.getBounds()
  
    // Center window horizontally below the tray icon
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
  
    // Position window 4 pixels vertically below the tray icon
    const y = Math.round(trayBounds.y - windowBounds.height)
  
    return {x: x, y: y}
}

app.whenReady().then(() => {
  const trayIconPath = path.join(__dirname, 'assets/tray-icons/icon256b.png')
  const panel = createWindow().panel

  tray = new Tray(trayIconPath)

  tray.on("click", async () => {
    toggleWindow(panel);
  })

  const trayContextMenu = Menu.buildFromTemplate([
    { label: 'EXIT', type: 'normal', click: exitApp }
  ])

  tray.setToolTip(APPNAME)
  tray.setContextMenu(trayContextMenu)

  setInterval(() => {
    scanDevices(panel)
  }, 5000); 
})