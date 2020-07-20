const DEFAULT_DEVICE_ID = "default";
const LOCAL_SETTING_DEVICE_ID = "deviceID";

class AudioDeviceSelector {
  constructor(triggerElement, localSettings) {
    this._triggerElement = triggerElement;
    this._localSettings = localSettings;
    const menu = this._createEmptyMenu();
    this._populateMenu(menu);
  }

  getSelectedDeviceID() {
    const selectedMenuID = this._getSelectedMenuItemID();
    if (selectedMenuID !== DEFAULT_DEVICE_ID) {
      return selectedMenuID;
    }
    return Windows.Media.Devices.MediaDevice.getDefaultAudioRenderId(
      Windows.Media.Devices.AudioDeviceRole.communications,
    );
  }

  _getSelectedMenuItemID() {
    return (
      this._localSettings.values[LOCAL_SETTING_DEVICE_ID] || DEFAULT_DEVICE_ID
    );
  }

  _createEmptyMenu() {
    const menu = new WinJS.UI.Menu(null, {
      anchor: this._triggerElement,
    });
    this._triggerElement.ownerDocument.body.appendChild(menu.element);
    this._triggerElement.onclick = () => menu.show();
    return menu;
  }

  async _populateMenu(menu) {
    // Add default option
    const defaultCommand = new WinJS.UI.MenuCommand(null, {
      id: DEFAULT_DEVICE_ID,
      label: "Default",
      onclick: this._getOnClickForDeviceID(menu, DEFAULT_DEVICE_ID),
      selected: DEFAULT_DEVICE_ID === this._getSelectedMenuItemID(),
      type: "toggle",
    });
    menu.element.appendChild(defaultCommand.element);
    // Load audio devices
    const devices = await Windows.Devices.Enumeration.DeviceInformation.findAllAsync(
      Windows.Devices.Enumeration.DeviceClass.audioRender,
    );
    // Add option for each device
    devices.forEach((deviceInfo) => {
      const command = new WinJS.UI.MenuCommand(null, {
        id: this._getMenuItemID(deviceInfo.id),
        label: deviceInfo.name,
        onclick: this._getOnClickForDeviceID(menu, deviceInfo.id),
        selected: deviceInfo.id === this._getSelectedMenuItemID(),
        type: "toggle",
      });
      menu.element.appendChild(command.element);
    });
  }

  _getOnClickForDeviceID(menu, deviceID) {
    return () => {
      const previousID = this._getSelectedMenuItemID();
      const previousItem = menu.getCommandById(this._getMenuItemID(previousID));
      if (previousItem) {
        previousItem.selected = false;
      }
      const nextItem = menu.getCommandById(this._getMenuItemID(deviceID));
      nextItem.selected = true;
      this._onSelectDevice(deviceID);
    };
  }

  _getMenuItemID(deviceID) {
    return deviceID.replace(/[^a-z0-9]/gi, "");
  }

  _onSelectDevice(deviceID) {
    this._localSettings.values[LOCAL_SETTING_DEVICE_ID] = deviceID;
  }
}
