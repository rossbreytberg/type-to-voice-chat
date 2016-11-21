(() => {
    "use strict";

    const app = WinJS.Application;
    let isFirstActivation = true;

    // Consts
    const MESSAGE_FILE_NAME = "message.wav";

    // DOM Elements
    let devicePickerButton = null;
    let messageInput = null;

    // Message History
    const messageHistory = [];
    let messageHistoryIndex = 0;

    // Audio
    const synthesizer = new Windows.Media.SpeechSynthesis.SpeechSynthesizer();
    let outputDeviceInfo = null;

    app.onactivated = (args) => {
        if (isFirstActivation) {
            args.setPromise(WinJS.UI.processAll().then(function completed() {
                Windows.UI.ViewManagement.ApplicationView.getForCurrentView()
                    .setPreferredMinSize({width: 310, height: 150})

                document.addEventListener("keydown", onKeyDown);

                devicePickerButton = document.getElementById(
                    "devicePickerButton"
                );
                devicePickerButton.addEventListener(
                    "click",
                    onDevicePickerButtonClick
                );

                messageInput = document.getElementById("messageInput");
                messageInput.addEventListener("input", onMessageInputChange);
            }));
        }
        isFirstActivation = false;
    };
    app.start();

    function onKeyDown(eventInfo) {
        switch (eventInfo.keyCode) {
            case 13: // Enter
                return onMessageSubmit();
            case 38: // Up
                return prevMessage();
            case 40: // Down
                return nextMessage();
        }
    }

    function onMessageInputChange(eventInfo) {
        // Update newest message in history as it's typed.
        messageHistory[0] = messageInput.value;
    }

    function onMessageSubmit() {
        const message = messageInput.value;
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
        audioGraphSettings.primaryRenderDevice = outputDeviceInfo;
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

        // Update message history.
        if (messageHistoryIndex > 0) {
            // If a message from history was sent, overwrite the
            // newest index with that message and reset the index.
            messageHistory[0] = messageHistory[messageHistoryIndex];
            messageHistoryIndex = 0;
        }
        messageHistory.unshift("");
        messageInput.value = '';
    }

    function prevMessage() {
        if (messageHistoryIndex >= messageHistory.length - 1) {
            // Reached end of history.
            return;
        }
        messageHistoryIndex++;
        messageInput.value = messageHistory[messageHistoryIndex];
    }

    function nextMessage() {
        if (messageHistoryIndex === 0) {
            // Reached beginning of history.
            return;
        }
        messageHistoryIndex--;
        messageInput.value = messageHistory[messageHistoryIndex];
    }

    function onDevicePickerButtonClick() {
        devicePickerButton.disabled = true;

        const devicePicker = new Windows.Devices.Enumeration.DevicePicker();
        devicePicker.filter.supportedDeviceClasses.append(
            Windows.Devices.Enumeration.DeviceClass.audioRender
        );

        const buttonRect = devicePickerButton.getBoundingClientRect();
        devicePicker.pickSingleDeviceAsync({
            x: buttonRect.left,
            y: buttonRect.top,
            width: buttonRect.width,
            height: buttonRect.height,
        }).done(deviceInfo => {
            if (deviceInfo !== null) {
                outputDeviceInfo = deviceInfo;
            }
            devicePickerButton.disabled = false;
        });
    }
})();
