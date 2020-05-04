(() => {
  "use strict";

  const MESSAGE_INPUT_ID = "messageInput";
  const DEVICE_SELECTOR_BUTTON_ID = "deviceSelectorButton";
  const VOICE_SELECTOR_BUTTON_ID = "voiceSelectorButton";
  const TEMP_FILE_NAME = "message.wav";

  const localSettings = Windows.Storage.ApplicationData.current.localSettings;
  const synthesizer = new Windows.Media.SpeechSynthesis.SpeechSynthesizer();

  let audioDeviceSelector = null;
  let isFirstActivation = true;

  WinJS.Application.onactivated = async (args) => {
    if (!isFirstActivation) {
      return;
    }
    isFirstActivation = false;
    await WinJS.UI.processAll();
    Windows.UI.ViewManagement.ApplicationView.getForCurrentView().setPreferredMinSize(
      { width: 310, height: 150 },
    );

    audioDeviceSelector = new AudioDeviceSelector(
      document.getElementById(DEVICE_SELECTOR_BUTTON_ID),
      localSettings,
    );

    new MessageInput(document.getElementById(MESSAGE_INPUT_ID), onMessage);

    new VoiceSelector(
      document.getElementById(VOICE_SELECTOR_BUTTON_ID),
      localSettings,
      synthesizer,
    );
  };
  WinJS.Application.start();

  async function onMessage(message) {
    const [file, audioGraph] = await Promise.all([
      createAudioFile(message),
      createAudioGraph(),
    ]);
    const [fileInputNode, deviceOutputNode] = await Promise.all([
      createFileInputNode(audioGraph, file),
      createDeviceOutputNode(audioGraph),
    ]);
    fileInputNode.addOutgoingConnection(deviceOutputNode);
    audioGraph.start();
  }

  async function createAudioFile(message) {
    const stream = await synthesizer.synthesizeTextToStreamAsync(message);
    const dataReader = new Windows.Storage.Streams.DataReader(stream);
    await dataReader.loadAsync(stream.size);
    const buffer = dataReader.readBuffer(stream.size);

    const tempFolder = Windows.Storage.ApplicationData.current.temporaryFolder;
    let file = await tempFolder.tryGetItemAsync(TEMP_FILE_NAME);
    if (file === null) {
      file = await tempFolder.createFileAsync(TEMP_FILE_NAME);
    }
    await Windows.Storage.FileIO.writeBufferAsync(file, buffer);
    return file;
  }

  async function createAudioGraph() {
    const audioGraphSettings = new Windows.Media.Audio.AudioGraphSettings(
      Windows.Media.Render.AudioRenderCategory.communications,
    );
    audioGraphSettings.primaryRenderDevice = await Windows.Devices.Enumeration.DeviceInformation.createFromIdAsync(
      audioDeviceSelector.getSelectedDeviceID(),
    );
    const createAudioGraphResult = await Windows.Media.Audio.AudioGraph.createAsync(
      audioGraphSettings,
    );
    if (
      createAudioGraphResult.status !==
      Windows.Media.Audio.AudioGraphCreationStatus.success
    ) {
      throw new Error(
        "Error creating AudioGraph",
        createAudioGraphResult.status,
      );
    }
    return createAudioGraphResult.graph;
  }

  async function createFileInputNode(audioGraph, file) {
    const createInputNodeResult = await audioGraph.createFileInputNodeAsync(
      file,
    );
    if (
      createInputNodeResult.status !==
      Windows.Media.Audio.AudioFileNodeCreationStatus.success
    ) {
      throw new Error(
        "Error creating AudioFileInputNode",
        createInputNodeResult.status,
      );
    }
    return createInputNodeResult.fileInputNode;
  }

  async function createDeviceOutputNode(audioGraph) {
    const createOutputNodeResult = await audioGraph.createDeviceOutputNodeAsync(
      Windows.Media.Render.AudioRenderCategory.communications,
    );
    if (
      createOutputNodeResult.status !==
      Windows.Media.Audio.AudioDeviceNodeCreationStatus.success
    ) {
      throw new Error(
        "Error creating AudioDeviceOutputNode",
        createOutputNodeResult.status,
      );
    }
    return createOutputNodeResult.deviceOutputNode;
  }
})();
