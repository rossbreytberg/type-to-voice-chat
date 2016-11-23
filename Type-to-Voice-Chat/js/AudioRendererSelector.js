class AudioRendererSelector {
    constructor(triggerElement, onSelect) {
        this._triggerElement = triggerElement;
        this._onSelect = onSelect;
        const menu = this._createEmptyMenu();
        this._populateMenu(menu);
        return menu;
    }

    _createEmptyMenu() {
        const menu = new WinJS.UI.Menu(null, {
            anchor: this._triggerElement
        });
        this._triggerElement.ownerDocument.body.appendChild(menu.element);
        this._triggerElement.onclick = () => menu.show();
        return menu;
    }

    _populateMenu(menu) {
        // Add a placeholder "Loading" item to the menu.
        const loadingCommand = new WinJS.UI.MenuCommand(null, {
            id: "loading",
            label: "Loading..."
        });
        menu.element.appendChild(loadingCommand.element);

        // Keep track of selected device ID so we can correctly
        // show a checkmark next to it in the menu.
        // Assume the first selected device is the default.
        let selectedDeviceID =
            Windows.Media.Devices.MediaDevice.getDefaultAudioRenderId(
                Windows.Media.Devices.AudioDeviceRole.communications
            );

        // Populate menu with audio renderers.
        Windows.Devices.Enumeration.DeviceInformation.findAllAsync(
            Windows.Devices.Enumeration.DeviceClass.audioRender
        ).then(devices => {
            loadingCommand.hidden = true;
            devices.forEach(deviceInfo => {
                const command = new WinJS.UI.MenuCommand(null, {
                    id: this._getMenuCommandIDFromDeviceID(deviceInfo.id),
                    label: deviceInfo.name,
                    onclick: () => {
                        menu.getCommandById(this._getMenuCommandIDFromDeviceID(
                            selectedDeviceID
                        )).selected = false;
                        menu.getCommandById(this._getMenuCommandIDFromDeviceID(
                            deviceInfo.id
                        )).selected = true;
                        selectedDeviceID = deviceInfo.id;
                        this._onSelect(deviceInfo);
                    },
                    selected: deviceInfo.id === selectedDeviceID,
                    type: "toggle"
                });
                menu.element.appendChild(command.element);
            });
        });
    }

    _getMenuCommandIDFromDeviceID(string) {
        return string.replace(/[^a-z0-9]/gi, "");
    }
}