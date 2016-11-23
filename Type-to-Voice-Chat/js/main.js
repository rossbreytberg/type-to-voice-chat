(() => {
    "use strict";

    const app = WinJS.Application;
    let isFirstActivation = true;

    // Consts
    const MESSAGE_FILE_NAME = "message.wav";

    const devicePicker = createDevicePicker();
    let devicePickerButton = null;
    let selectedDeviceInfo = null;
    const synthesizer = new Windows.Media.SpeechSynthesis.SpeechSynthesizer();
    const voicePicker = createVoicePicker();
    let voicePickerButton = null;

    app.onactivated = (args) => {
        if (isFirstActivation) {
            args.setPromise(WinJS.UI.processAll().then(function completed() {
                Windows.UI.ViewManagement.ApplicationView.getForCurrentView()
                    .setPreferredMinSize({width: 310, height: 150})

                devicePickerButton = document.getElementById(
                    "devicePickerButton"
                );
                document.body.appendChild(devicePicker.element);
                devicePickerButton.onclick = () => devicePicker.show();

                voicePickerButton = document.getElementById(
                    "voicePickerButton"
                );
                document.body.appendChild(voicePicker.element);
                voicePickerButton.onclick = () =>  voicePicker.show();

                new MessageInput(
                    document.getElementById("messageInput"),
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
                tempFolder.tryGetItemAsync(MESSAGE_FILE_NAME).then(file => {
                    if (file === null) {
                        return tempFolder.createFileAsync(MESSAGE_FILE_NAME);
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

    function createDevicePicker() {
        const menu = new WinJS.UI.Menu(null, {
            anchor: "devicePickerButton"
        });
        const loadingCommand = new WinJS.UI.MenuCommand(null, {
            id: "loading",
            label: "Loading..."
        });
        menu.element.appendChild(loadingCommand.element);

        const defaultDeviceID =
            Windows.Media.Devices.MediaDevice.getDefaultAudioRenderId(
                Windows.Media.Devices.AudioDeviceRole.communications
            );
        Windows.Devices.Enumeration.DeviceInformation.findAllAsync(
            Windows.Devices.Enumeration.DeviceClass.audioRender
        ).then(devices => {
            loadingCommand.hidden = true;
            devices.forEach(deviceInfo => {
                if (deviceInfo.id === defaultDeviceID) {
                    selectedDeviceInfo = deviceInfo;
                }
                const command = new WinJS.UI.MenuCommand(null, {
                    id: getIDFromString(deviceInfo.id),
                    label: deviceInfo.name,
                    onclick: () => {
                        menu.getCommandById(
                            getIDFromString(selectedDeviceInfo.id)
                        ).selected = false;
                        menu.getCommandById(
                            getIDFromString(deviceInfo.id)
                        ).selected = true;
                        selectedDeviceInfo = deviceInfo;
                    },
                    selected: deviceInfo.id === defaultDeviceID,
                    type: "toggle"

                });
                menu.element.appendChild(command.element);
            });
        });
        return menu;
    }

    function createVoicePicker() {
        const menu = new WinJS.UI.Menu(null, {
            anchor: "voicePickerButton"
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