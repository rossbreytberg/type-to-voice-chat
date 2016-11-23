class SpeechSynthesizerVoiceSelector {
    constructor(triggerElement, synthesizer) {
        this._synthesizer = synthesizer;
        this._triggerElement = triggerElement;
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
                            this._synthesizer.voice.id
                        )).selected = false;
                        menu.getCommandById(this._getMenuCommandIDFromVoiceID(
                            voice.id
                        )).selected = true;
                        this._synthesizer.voice = voice
                    },
                    selected: this._synthesizer.voice.id === voice.id,
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