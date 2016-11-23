(() => {
    "use strict";

    const app = WinJS.Application;
    let isFirstActivation = true;

    // Consts
    const DEVICE_SELECTOR_BUTTON_ID = "deviceSelectorButton";
    const LOCAL_SETTING_DEVICE_ID = "deviceID";
    const LOCAL_SETTING_VOICE_ID = "voiceID";
    const MESSAGE_INPUT_ID = "messageInput";
    const TEMP_FILE_NAME = "message.wav";
    const VOICE_SELECTOR_BUTTON_ID = "voiceSelectorButton";

    const localSettings = Windows.Storage.ApplicationData.current.localSettings;
    const synthesizer = new Windows.Media.SpeechSynthesis.SpeechSynthesizer();
    let selectedDeviceID = getDefaultDeviceID();
 
    app.onactivated = (args) => {
        if (isFirstActivation) {
            args.setPromise(WinJS.UI.processAll().then(function completed() {
                Windows.UI.ViewManagement.ApplicationView.getForCurrentView()
                    .setPreferredMinSize({width: 310, height: 150})

                new AudioRendererSelector(
                    document.getElementById(DEVICE_SELECTOR_BUTTON_ID),
                    onSelectDevice,
                    selectedDeviceID
                );

                new MessageInput(
                    document.getElementById(MESSAGE_INPUT_ID),
                    onPlayMessage
                );

                const defaultVoiceID = getDefaultVoiceID();
                synthesizer.voice =
                    Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices.find(
                        voice => voice.id === defaultVoiceID
                    );
                new SpeechSynthesizerVoiceSelector(
                    document.getElementById(VOICE_SELECTOR_BUTTON_ID),
                    onSelectVoice,
                    defaultVoiceID
                );
            }));
        }
        isFirstActivation = false;
    };
    app.start();

    function getDefaultDeviceID() {
        const localSetting = localSettings.values[LOCAL_SETTING_DEVICE_ID];
        if (localSetting) {
            return localSetting;
        }
        return Windows.Media.Devices.MediaDevice.getDefaultAudioRenderId(
            Windows.Media.Devices.AudioDeviceRole.communications
        );
    }

    function onSelectDevice(deviceInfo) {
        selectedDeviceID = deviceInfo.id;
        localSettings.values[LOCAL_SETTING_DEVICE_ID] = deviceInfo.id;
    }

    function getDefaultVoiceID() {
        const localSetting = localSettings.values[LOCAL_SETTING_VOICE_ID];
        if (localSetting) {
            return localSetting;
        }
        return Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices[0].id;
    }

    function onSelectVoice(voice) {
        synthesizer.voice = voice;
        localSettings.values[LOCAL_SETTING_VOICE_ID] = voice.id;
    }

    function onPlayMessage(message) {
        const streamPromise = synthesizer.synthesizeTextToStreamAsync(message);

        // Get audio buffer.
        const bufferPromise = streamPromise.then(stream => {
            const dataReader = new Windows.Storage.Streams.DataReader(stream);
            return dataReader.loadAsync(stream.size).then(
                () => dataReader.readBuffer(stream.size)
            );
        });

        // Write buffer to temp file.
        const filePromise = bufferPromise.then(buffer => {
            const tempFolder =
                Windows.Storage.ApplicationData.current.temporaryFolder;
            const filePromise =
                tempFolder.tryGetItemAsync(TEMP_FILE_NAME).then(file => {
                    if (file === null) {
                        return tempFolder.createFileAsync(TEMP_FILE_NAME);
                    }
                    return file;
                });
            return filePromise.then(file => Windows.Storage.FileIO.writeBufferAsync(
                file,
                buffer
            )).then(() => filePromise);
        });

        // Use AudioGraph to play buffer.
        const audioGraphSettingsPromise =
            Windows.Devices.Enumeration.DeviceInformation.createFromIdAsync(
                selectedDeviceID
            ).then((selectedDeviceInfo) => {
                const audioGraphSettings =
                    new Windows.Media.Audio.AudioGraphSettings(
                        Windows.Media.Render.AudioRenderCategory.communications
                    );
                audioGraphSettings.primaryRenderDevice = selectedDeviceInfo;
                return audioGraphSettings;
            });

        const audioGraphPromise = audioGraphSettingsPromise.then(
            audioGraphSettings => Windows.Media.Audio.AudioGraph.createAsync(
                audioGraphSettings
            ).then(createAudioGraphResult => {
                if (createAudioGraphResult.status ===
                    Windows.Media.Audio.AudioGraphCreationStatus.success) {
                    return createAudioGraphResult.graph;
                }
                throw new Error(
                    "Error creating AudioGraph",
                    createAudioGraphResult.status
                );
            })
        );
 
        const inputNodePromise = Promise.all([
            audioGraphPromise,
            filePromise
        ]).then(([audioGraph, file]) => {
            return audioGraph.createFileInputNodeAsync(file).then(result => {
                if (result.status ===
                    Windows.Media.Audio.AudioFileNodeCreationStatus.success) {
                    return result.fileInputNode;
                }
                throw new Error(
                    "Error creating AudioFileInputNode",
                    result.status
                );
            });
        });
 
        const outputNodePromise = audioGraphPromise.then(
            audioGraph => audioGraph.createDeviceOutputNodeAsync(
                Windows.Media.Render.AudioRenderCategory.communications
            ).then(result => {
                if (result.status ===
                    Windows.Media.Audio.AudioDeviceNodeCreationStatus.success) {
                    return result.deviceOutputNode;
                }
                throw new Error(
                    'Error creating AudioDeviceOutputNode',
                    result.status
                );
            })
        );
        Promise.all([
            audioGraphPromise,
            inputNodePromise,
            outputNodePromise
        ]).then(([audioGraph, inputNode, outputNode]) => {
            inputNode.addOutgoingConnection(outputNode);
            audioGraph.start();
        });
    }
})();