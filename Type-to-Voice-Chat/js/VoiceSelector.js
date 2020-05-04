const LOCAL_SETTING_VOICE_ID = "voiceID";

class VoiceSelector {
  constructor(triggerElement, localSettings, synthesizer) {
    this._triggerElement = triggerElement;
    this._localSettings = localSettings;
    this._synthesizer = synthesizer;
    this._selectedID = this._getDefaultVoiceID();
    this._onSelectVoice(
      Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices.find(
        (voice) => voice.id === this._selectedID,
      ),
    );
    const menu = this._createEmptyMenu();
    this._populateMenu(menu);
    return menu;
  }

  _createEmptyMenu() {
    const menu = new WinJS.UI.Menu(null, {
      anchor: this._triggerElement,
    });
    this._triggerElement.ownerDocument.body.appendChild(menu.element);
    this._triggerElement.onclick = () => menu.show();
    return menu;
  }

  _populateMenu(menu) {
    Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices.forEach(
      (voice) => {
        const command = new WinJS.UI.MenuCommand(null, {
          id: this._getMenuCommandIDFromVoiceID(voice.id),
          label: voice.displayName,
          onclick: (voiceID) => {
            menu.getCommandById(
              this._getMenuCommandIDFromVoiceID(this._selectedID),
            ).selected = false;
            menu.getCommandById(
              this._getMenuCommandIDFromVoiceID(voice.id),
            ).selected = true;
            this._selectedID = voice.id;
            this._onSelectVoice(voice);
          },
          selected: this._selectedID === voice.id,
          type: "toggle",
        });
        menu.element.appendChild(command.element);
      },
    );
  }

  _getMenuCommandIDFromVoiceID(string) {
    return string.replace(/[^a-z0-9]/gi, "");
  }

  _getDefaultVoiceID() {
    const localSetting = this._localSettings.values[LOCAL_SETTING_VOICE_ID];
    if (localSetting) {
      return localSetting;
    }
    return Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices[0].id;
  }

  _onSelectVoice(voice) {
    this._synthesizer.voice = voice;
    this._localSettings.values[LOCAL_SETTING_VOICE_ID] = voice.id;
  }
}
