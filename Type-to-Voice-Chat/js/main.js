(() => {
    "use strict";

    const app = WinJS.Application;
    let isFirstActivation = true;

    // Consts
    const DEVICE_SELECTOR_BUTTON_ID = "deviceSelectorButton";
    const MESSAGE_INPUT_ID = "messageInput";
    const TEMP_FILE_NAME = "message.wav";
    const VOICE_SELECTOR_BUTTON_ID = "voiceSelectorButton";

    let selectedDeviceInfo = null;
    const synthesizer = new Windows.Media.SpeechSynthesis.SpeechSynthesizer();
    const voicePicker = createVoicePicker();
    let voicePickerButton = null;

    app.onactivated = (args) => {
        if (isFirstActivation) {
            args.setPromise(WinJS.UI.processAll().then(function completed() {
                Windows.UI.ViewManagement.ApplicationView.getForCurrentView()
                    .setPreferredMinSize({width: 310, height: 150})

                new AudioRendererSelector(
                    document.getElementById(DEVICE_SELECTOR_BUTTON_ID),
                    deviceInfo => selectedDeviceInfo = deviceInfo
                );

                voicePickerButton = document.getElementById(
                    VOICE_SELECTOR_BUTTON_ID
                );
                document.body.appendChild(voicePicker.element);
                voicePickerButton.onclick = () =>  voicePicker.show();

                new MessageInput(
                    document.getElementById(MESSAGE_INPUT_ID),
                    onMessageSubmit
                );
            }));
        }
        isFirstActivation = false;
    };
    app.start();

    function onMessageSubmit(message) {
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
        const audioGraphSettings = new Windows.Media.Audio.AudioGraphSettings(
            Windows.Media.Render.AudioRenderCategory.communications
        );
        audioGraphSettings.primaryRenderDevice = selectedDeviceInfo;
        const audioGraphPromise = Windows.Media.Audio.AudioGraph.createAsync(
            audioGraphSettings
        ).then(createAudioGraphResult => {
            if (createAudioGraphResult.status ===
                Windows.Media.Audio.AudioGraphCreationStatus.success) {
                return createAudioGraphResult.graph;
            }
            throw new Error(
                'Error creating AudioGraph',
                createAudioGraphResult.status
            );
        });
 
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
                    'Error creating AudioFileInputNode',
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

    function createVoicePicker() {
        const menu = new WinJS.UI.Menu(null, {
            anchor: VOICE_SELECTOR_BUTTON_ID
        });
        Windows.Media.SpeechSynthesis.SpeechSynthesizer.allVoices.forEach(
            voice => {
                const command = new WinJS.UI.MenuCommand(null, {
                    id: getIDFromString(voice.id),
                    label: voice.displayName,
                    onclick: () => {
                        menu.getCommandById(
                            getIDFromString(synthesizer.voice.id)
                        ).selected = false;
                        menu.getCommandById(
                            getIDFromString(voice.id)
                        ).selected = true;
                        synthesizer.voice = voice
                    },
                    selected: synthesizer.voice.id === voice.id,
                    type: "toggle"
                });
                menu.element.appendChild(command.element);
            }
        );
        return menu;
    }

    function getIDFromString(string) {
        return string.replace(/[^a-z0-9]/gi, "");
    }
})();