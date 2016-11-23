class SpeechSynthesizerVoiceSelector {
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
        Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices.forEach(
            voice => {
                const command = new WinJS.UI.MenuCommand(null, {
                    id: this._getMenuCommandIDFromVoiceID(voice.id),
                    label: voice.displayName,
                    onclick: () => {
                        menu.getCommandById(this._getMenuCommandIDFromVoiceID(
                            this._selectedID
                        )).selected = false;
                        menu.getCommandById(this._getMenuCommandIDFromVoiceID(
                            voice.id
                        )).selected = true;
                        this._selectedID = voice.id
                        this._onSelect(voice);
                    },
                    selected: this._selectedID === voice.id,
                    type: "toggle"
                });
                menu.element.appendChild(command.element);
            }
        );
    }

    _getMenuCommandIDFromVoiceID(string) {
        return string.replace(/[^a-z0-9]/gi, "");
    }
}