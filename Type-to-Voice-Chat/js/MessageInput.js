class MessageInput {
    constructor(inputElement, newMessageHandler) {
        this._history = [];
        this._historyIndex = 0;
        this._input = inputElement;
        this._input.oninput = this._onInputChange.bind(this);
        document.onkeydown = this._onKeyDown.bind(this);
        this._newMessageHandler = newMessageHandler;
    }

    _onInputChange() {
        // Update newest message in history as it's typed.
        this._history[0] = this._input.value;
    }

    _onKeyDown(eventInfo) {
        switch (eventInfo.keyCode) {
            case 13: // Enter
                return this._newMessage();
            case 38: // Up
                return this._prevMessage();
            case 40: // Down
                return this._nextMessage();
        }
    }

    _prevMessage() {
        if (this._historyIndex >= this._history.length - 1) {
            // Reached end of history.
            return;
        }
        this._historyIndex++;
        this._input.value = this._history[this._historyIndex];
    }

    _nextMessage() {
        if (this._historyIndex === 0) {
            // Reached beginning of history.
            return;
        }
        this._historyIndex--;
        this._input.value = this._history[this._historyIndex];
    }

    _newMessage() {
        this._newMessageHandler(this._input.value);
        // Update message history.
        if (this._historyIndex > 0) {
            // If a message from history was sent, overwrite the
            // newest index with that message and reset the index.
            this._history[0] = this._history[this._historyIndex];
            this._historyIndex = 0;
        }
        this._history.unshift("");
        this._input.value = "";
    }
}