class ProtonioSync {
  constructor() {
    this.api = "https://sync.protonio.de";
    this.room = null;
    this.socket = null;
    this.pendingRequests = [];
  }

  async createRoom(callback) {
    this.stateBroadcastCallback = callback;

    const res = await fetch("https://sync.protonio.de/api/v1/rooms", {
      method: "POST",
    });
    const body = await res.json();
    this.room = body;
    console.log(this.room);

    await this._connect();

    return this.room;
  }

  async openRoom(name, token, callback) {
    this.room = { name, token };
    this.stateBroadcastCallback = callback;

    console.log(this.room);

    await this._connect();

    return this.room;
  }

  async _connect() {
    this.socket = new WebSocket("wss://sync.protonio.de/ws/v1/rooms");
    this.socket.onerror = (error) => {
      console.error(error);
    };

    this.socket.onmessage = (event) => {
      console.log(event.data);
      const { type, payload } = JSON.parse(event.data);
      const first = this.pendingRequests.splice(0, 1)[0];
      if (type === 'STATE_BROADCAST') {
        this.stateBroadcastCallback(payload.state);
        return;
      }
      if (type !== "NOT_FOUND" && `${first.type}_OK` !== type) {
        console.error(`Unexpected response type: ${type}`);
        first.reject(new Error(`Unexpected response type: ${type}`));
        return;
      }
      first.resolve({ type, payload });
    };

    await new Promise((resolve) => {
      this.socket.onopen = () => {
        console.log("connected");
        resolve();
      };
    });

    const authRes = await this._wsRequest("AUTHORIZE", {
      room: this.room.name,
      token: this.room.token,
    });
    console.log(authRes);
  }

  _wsRequest(type, payload) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ type, resolve, reject });
      this.socket.send(JSON.stringify({ type, payload }));
    });
  }

  async getState() {
    const { type, payload } = await this._wsRequest("GET_STATE", {
      room: this.room.name,
    });
    switch (type) {
      case "GET_STATE_OK":
        return payload.state;
      case "NOT_FOUND":
        throw new Error("Room not found");
      default:
        throw new Error(`Unexpected response type: ${type}`);
    }
  }

  async setState(state) {
    const { type, payload } = await this._wsRequest("SET_STATE", {
      room: this.room.name,
      state,
    });
    switch (type) {
      case "SET_STATE_OK":
        return payload.state;
      case "NOT_FOUND":
        throw new Error("Room not found");
      default:
        throw new Error(`Unexpected response type: ${type}`);
    }
  }

  async updateState(state) {
    const { type, payload } = await this._wsRequest("UPDATE_STATE", {
      room: this.room.name,
      state,
    });
    switch (type) {
      case "UPDATE_STATE_OK":
        return payload.state;
      case "NOT_FOUND":
        throw new Error("Room not found");
      default:
        throw new Error(`Unexpected response type: ${type}`);
    }
  }

}
