import { TemperaturePicker } from "./TemperaturePicker.js"
new ResizeObserver(() => {
  window.light_control.resizeBody()
}).observe(document.body);

window.light_control.handleLightAddRemoval((event, id, add) => {
  const lightList = document.getElementById('light-list')
  const searchStatus = document.getElementById('scanningDeviceStatusIndicator')
  if (add) {
    searchStatus.hidden = true
    addLightHTML(lightList, id)
  } else {
    document.getElementById(id).remove()
    if (lightList.childElementCount === 0) {
      searchStatus.hidden = false
    }
  }
  window.light_control.sendAddRemoveDone(id)
})

/**
 * 
 * @param {HTMLElement} parent 
 */
function addLightHTML(parent, id){
  const lightContainer = document.createElement('div');
  lightContainer.id = id;

  lightContainer.innerHTML = `
      <input type="checkbox" class="power-state-icon toggle-light-button">
      <input type="textbox" class="name-textbox">
      <div class="power-slider-container">
          <input type="range" min="1" max="100" value="50" class="slider power-slider">
      </div>
      <div class="color-mode-container">
          <label>
              <input type="radio" name="color-mode" value="Color">
              <span>Color<span/>
          </label>
          <label>
              <input type="radio" name="color-mode" value="Temperature">
              <span>Temperature<span/>
          </label>
      </div>
      <div>
          <input type="color" class="light-color-picker" name="color">
          <label for="color">Color</label>
      </div>
  `

  const temperaturePicker = new TemperaturePicker()
  temperaturePicker.inputCallback = (color) => {
    window.light_control.set_temperature(id, color)
  }
  const temperaturePickerContainer1 = temperaturePicker.createTemperaturePicker()
  lightContainer.appendChild(temperaturePickerContainer1)

  parent.appendChild(lightContainer)

  const toggleLight = lightContainer.querySelector('.toggle-light-button');
  const powerSlider = lightContainer.querySelector('.power-slider');
  const lightColor = lightContainer.querySelector('.light-color-picker');
  const nameTextbox = lightContainer.querySelector('.name-textbox');
  const colorMode = lightContainer.querySelectorAll('input[name="color-mode"]');

  toggleLight.addEventListener('click', async () => {
      await window.light_control.toggle(id).then((res) => {
          if (res){
            toggleLight.innerText = "Light is on";
          }else{
            toggleLight.innerText = "Light is off";
          }
      });
    })
    
    powerSlider.addEventListener('click', async () => {
      let bright_val = powerSlider.value
      window.light_control.bright(id, bright_val)
    })

    lightColor.addEventListener('change', async () => {
      let rgb_val_hex = lightColor.value.slice(1)
      let rgb_int = parseInt(rgb_val_hex, 16)
      window.light_control.rgb(id, rgb_int)
    })

  nameTextbox.addEventListener('change', async () => {
    let new_name = nameTextbox.value
    window.light_control.set_name(id, new_name)
  })

  colorMode.forEach(radioBox => {
    radioBox.addEventListener('change', async (e) => {
      window.light_control.set_color_mode(id, e.target.value)
    })
  })
}