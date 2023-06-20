export class TemperaturePicker {
  constructor() {
    this.temperatureColor = null
    this.temperatureInput = null
    this.inputCallback = null
    this.lastInputSent = Date.now()
    this.inputSendTimer = null
  }

  static inputUpdateMinInterval = 500 // ms

  createTemperaturePicker() {
    const temperaturePickerContainer = document.createElement("div");
    temperaturePickerContainer.classList.add("temperature-picker");
    temperaturePickerContainer.addEventListener('updateColorDisplay', this.updateColorDisplay.bind(this))


    this.temperatureColor = document.createElement("div")
    this.temperatureColor.classList.add("temperature-color")
    this.temperatureColor.addEventListener("click", this.toggleTemperatureInput.bind(this))

    this.temperatureInput = document.createElement("div");
    this.temperatureInput.classList.add("temperature-input");
    this.temperatureInput.style.display = "none";

    const temperatureRange = document.createElement("input");
    temperatureRange.setAttribute("type", "range");
    temperatureRange.setAttribute("min", "1700");
    temperatureRange.setAttribute("max", "6500");
    temperatureRange.setAttribute("value", "1700");
    temperatureRange.addEventListener("input", this.updateTemperatureColor.bind(this));

    const temperatureLabel = document.createElement('Label')
    //temperatureLabel.style.display
    temperatureLabel.innerText = 'Temperature'

    this.temperatureInput.appendChild(temperatureRange);
    temperaturePickerContainer.appendChild(this.temperatureColor);
    temperaturePickerContainer.appendChild(this.temperatureInput);
    temperaturePickerContainer.appendChild(temperatureLabel)

    // hide if clicked away from input range
    document.addEventListener('click', e => {
      if (this.temperatureInput.style.display === "none") { return }
      if (e.target === this.temperatureInput) { return }
      if (e.target === this.temperatureColor) { return }
      this.temperatureInput.style.display = "none"
    })

    return temperaturePickerContainer;
  }

  toggleTemperatureInput() {
    this.temperatureInput.style.display = this.temperatureInput.style.display === "none" ? "block" : "none";
  }

  updateColorDisplay(e) {
    const { kelvin } = e.detail
    console.log('kk', kelvin)
    this.temperatureInput.querySelector("input[type='range']").value = kelvin
    const color = TemperaturePicker.calculateColor(kelvin)
    this.temperatureColor.style.backgroundColor = color
  }

  static calculateColor(temperature) {
    // based  on common simplified impl of algoritem by Tanner Helland
    // credit to Tanner Helland
    // http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
      const kelvin = temperature / 100;
      const red = TemperaturePicker.clamp(Math.round(TemperaturePicker.calculateRed(kelvin)), 0, 255);
      const green = TemperaturePicker.clamp(Math.round(TemperaturePicker.calculateGreen(kelvin)), 0, 255);
      const blue = TemperaturePicker.clamp(Math.round(TemperaturePicker.calculateBlue(kelvin)), 0, 255);
      
      return `rgb(${red}, ${green}, ${blue})`;
  }
    
  static calculateRed(kelvin) {
      if (kelvin <= 66) {
        return 255;
      }
    
      let red = kelvin - 60;
      red = 329.698727446 * Math.pow(red, -0.1332047592);
      return TemperaturePicker.clamp(red, 0, 255);
  }
    
  static calculateGreen(kelvin) {
      if (kelvin <= 66) {
        let green = kelvin;
        green = 99.4708025861 * Math.log(green) - 161.1195681661;
        return TemperaturePicker.clamp(green, 0, 255);
      }
    
      let green = kelvin - 60;
      green = 288.1221695283 * Math.pow(green, -0.0755148492);
      return TemperaturePicker.clamp(green, 0, 255);
  }
    
  static calculateBlue(kelvin) {
      if (kelvin >= 66) {
        return 255;
      }
    
      if (kelvin <= 19) {
        return 0;
      }
    
      let blue = kelvin - 10;
      blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
      return TemperaturePicker.clamp(blue, 0, 255);
  }
      
  static clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
  }
  
  updateTemperatureColor() {
    const temperature = parseInt(this.temperatureInput.querySelector("input[type='range']").value)
    // Calculate color based on temperature value here
    const color = TemperaturePicker.calculateColor(temperature);
    this.temperatureColor.style.backgroundColor = color;
    // send to backend to update device
    if (!this.inputCallback) { return }
    const elapsedTime = Date.now() - this.lastInputSent
    clearTimeout(this.inputSendTimer)
    if (elapsedTime > TemperaturePicker.inputUpdateMinInterval) {
      this.inputCallback(temperature)
      this.lastInputSent = Date.now()
    }else{
      this.inputSendTimer = setTimeout(() => {
        this.updateTemperatureColor()
      }, TemperaturePicker.inputUpdateMinInterval - elapsedTime)
      return
    }
  }
}