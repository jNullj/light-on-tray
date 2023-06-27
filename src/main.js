const path = require('path');
const os = require('os')
const { app, Tray, Menu, BrowserWindow, ipcMain, screen } = require('electron')
const Yeelight = require('yeelight2');

const APPNAME = 'light on tray'
const DEBUG = process.argv.includes('-debug')
const isLinux = os.platform() === 'linux'

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
      this.close()

      if (devices[device.id]) { return }
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
    const position = isLinux ? getWindowPositionLinux(panel) : getWindowPosition(panel)
    panel.setPosition(position.x, position.y, false)
    panel.show()
    panel.focus()
}

const getWindowPosition = (panel) => {
    const windowBounds = panel.getBounds()
    const trayBounds = tray.getBounds()
    // TODO fix taskbar height
    const edge = closestEdge()
    const centerX = edge.bottom || edge.top
    const centerY = edge.left || edge.right

    const x = Math.floor(
      trayBounds.x
      - centerX*(windowBounds.width - trayBounds.width)/2
      - !centerX*edge.right*windowBounds.width
      + edge.left*trayBounds.width
    )
  
    const y = Math.floor(
      trayBounds.y
      - centerY*(windowBounds.height - trayBounds.height)/2
      - !centerY*edge.bottom*windowBounds.height
      + edge.top*trayBounds.height
    )
  
    return {x: x, y: y}
}

const getWindowPositionLinux = (panel) => {
  const windowBounds = panel.getBounds()
  const taskbarPadding = 10  // TODO assumes taskbar is 10px high
  const edge = closestEdge()
  const centerX = edge.bottom || edge.top
  const centerY = edge.left || edge.right

  const x = Math.floor(
    screen.getCursorScreenPoint().x
    - centerX*windowBounds.width/2
    - !centerX*edge.right*windowBounds.width
    + edge.left*taskbarPadding
  )

  const y = Math.floor(
    screen.getCursorScreenPoint().y
    - centerY*windowBounds.height/2
    - !centerY*edge.bottom*windowBounds.height
    + edge.top*taskbarPadding
  )

  return {x: x, y: y}
}

const closestEdge = () => {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const screenSize = display.size
  const distance = {
    top: cursorPoint.y,
    left: cursorPoint.x,
    bottom: screenSize.height - cursorPoint.y,
    right: screenSize.width - cursorPoint.x,
  }
  const minDistance = Math.min(...Object.values(distance))
  return {
    top: minDistance === distance.top,
    left: minDistance === distance.left,
    bottom: minDistance === distance.bottom,
    right: minDistance === distance.right,
  }
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
