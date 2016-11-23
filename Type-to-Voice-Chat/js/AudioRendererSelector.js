class AudioRendererSelector {
    constructor(triggerElement, onSelect, defaultSelectedID) {
        this._triggerElement = triggerElement;
        this._onSelect = onSelect;
        this._selectedID = defaultSelectedID;
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
                            this._selectedID
                        )).selected = false;
                        menu.getCommandById(this._getMenuCommandIDFromDeviceID(
                            deviceInfo.id
                        )).selected = true;
                        this._selectedID = deviceInfo.id;
                        this._onSelect(deviceInfo);
                    },
                    selected: deviceInfo.id === this._selectedID,
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