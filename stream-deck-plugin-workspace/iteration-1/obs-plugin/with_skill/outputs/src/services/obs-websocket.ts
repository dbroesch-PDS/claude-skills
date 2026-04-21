import { createHash, randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import streamDeck from "@elgato/streamdeck";

export type OBSState = {
  connected: boolean;
  recording: boolean;
  streaming: boolean;
  micMuted: boolean;
  currentScene: string;
};

export type OBSStateChangeListener = (state: OBSState) => void;

interface GlobalSettings {
  obsHost?: string;
  obsPort?: number;
  obsPassword?: string;
}

/**
 * OBS WebSocket v5 client.
 *
 * The OBS WebSocket protocol (v5) uses a request/response model over a
 * single WebSocket connection. Authentication is performed on hello/identify.
 *
 * Docs: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
 */
export class OBSWebSocketService {
  private ws: WebSocket | null = null;
  private state: OBSState = {
    connected: false,
    recording: false,
    streaming: false,
    micMuted: false,
    currentScene: "",
  };
  private listeners: OBSStateChangeListener[] = [];
  private requestCallbacks = new Map<string, (result: unknown) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private micSourceName = "Mic/Aux"; // default; can be overridden via settings

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get isConnected(): boolean {
    return this.state.connected;
  }

  get currentState(): OBSState {
    return { ...this.state };
  }

  onStateChange(listener: OBSStateChangeListener): void {
    this.listeners.push(listener);
  }

  async loadFromSettings(): Promise<void> {
    const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const host = settings.obsHost ?? "127.0.0.1";
    const port = settings.obsPort ?? 4455;
    const password = settings.obsPassword ?? "";
    this.connect(host, port, password);
  }

  connect(host: string, port: number, password: string): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const url = `ws://${host}:${port}`;
    streamDeck.logger.info(`OBS: connecting to ${url}`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      streamDeck.logger.info("OBS: WebSocket open — awaiting Hello");
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as OBSMessage;
        this.handleMessage(msg, password);
      } catch (err) {
        streamDeck.logger.error(`OBS: failed to parse message: ${err}`);
      }
    });

    ws.on("close", () => {
      streamDeck.logger.warn("OBS: connection closed");
      this.setState({ connected: false });
      this.scheduleReconnect(host, port, password);
    });

    ws.on("error", (err: Error) => {
      streamDeck.logger.error(`OBS: WebSocket error: ${err.message}`);
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.setState({ connected: false });
  }

  async toggleRecording(): Promise<void> {
    await this.sendRequest("ToggleRecord");
  }

  async toggleStreaming(): Promise<void> {
    await this.sendRequest("ToggleStream");
  }

  async toggleMute(sourceName?: string): Promise<void> {
    const source = sourceName ?? this.micSourceName;
    await this.sendRequest("ToggleInputMute", { inputName: source });
  }

  async switchScene(sceneName: string): Promise<void> {
    await this.sendRequest("SetCurrentProgramScene", { sceneName });
  }

  async getSceneList(): Promise<string[]> {
    const result = await this.sendRequest("GetSceneList") as { scenes: Array<{ sceneName: string }> };
    return (result?.scenes ?? []).map((s) => s.sceneName).reverse();
  }

  setMicSourceName(name: string): void {
    this.micSourceName = name;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private handleMessage(msg: OBSMessage, password: string): void {
    switch (msg.op) {
      case OBSOp.Hello:
        this.handleHello(msg.d as OBSHelloData, password);
        break;
      case OBSOp.Identified:
        this.handleIdentified();
        break;
      case OBSSOp.RequestResponse:
        this.handleRequestResponse(msg.d as OBSRequestResponseData);
        break;
      case OBSOp.Event:
        this.handleEvent(msg.d as OBSEventData);
        break;
      default:
        break;
    }
  }

  private handleHello(data: OBSHelloData, password: string): void {
    streamDeck.logger.info(`OBS: Hello received (obsWebSocketVersion ${data.obsWebSocketVersion})`);
    const identifyPayload: Record<string, unknown> = {
      rpcVersion: 1,
      eventSubscriptions: EventSubscription.General | EventSubscription.Outputs | EventSubscription.Scenes | EventSubscription.Inputs,
    };

    if (data.authentication) {
      const { challenge, salt } = data.authentication;
      const secret = createHash("sha256")
        .update(password + salt)
        .digest("base64");
      const authResponse = createHash("sha256")
        .update(secret + challenge)
        .digest("base64");
      identifyPayload.authentication = authResponse;
    }

    this.send({ op: OBSOp.Identify, d: identifyPayload });
  }

  private async handleIdentified(): Promise<void> {
    streamDeck.logger.info("OBS: Identified — connected");
    this.setState({ connected: true });

    // Fetch initial state
    try {
      const [recordStatus, streamStatus, sceneData, muteData] = await Promise.all([
        this.sendRequest("GetRecordStatus") as Promise<{ outputActive: boolean }>,
        this.sendRequest("GetStreamStatus") as Promise<{ outputActive: boolean }>,
        this.sendRequest("GetCurrentProgramScene") as Promise<{ currentProgramSceneName: string }>,
        this.sendRequest("GetInputMute", { inputName: this.micSourceName }).catch(() => ({ inputMuted: false })) as Promise<{ inputMuted: boolean }>,
      ]);

      this.setState({
        recording: recordStatus.outputActive,
        streaming: streamStatus.outputActive,
        currentScene: sceneData.currentProgramSceneName,
        micMuted: muteData.inputMuted,
      });
    } catch (err) {
      streamDeck.logger.warn(`OBS: error fetching initial state: ${err}`);
    }
  }

  private handleRequestResponse(data: OBSRequestResponseData): void {
    const cb = this.requestCallbacks.get(data.requestId);
    if (cb) {
      this.requestCallbacks.delete(data.requestId);
      cb(data.responseData ?? null);
    }
  }

  private handleEvent(data: OBSEventData): void {
    switch (data.eventType) {
      case "RecordStateChanged":
        this.setState({ recording: (data.eventData as { outputActive: boolean }).outputActive });
        break;
      case "StreamStateChanged":
        this.setState({ streaming: (data.eventData as { outputActive: boolean }).outputActive });
        break;
      case "CurrentProgramSceneChanged":
        this.setState({ currentScene: (data.eventData as { sceneName: string }).sceneName });
        break;
      case "InputMuteStateChanged": {
        const ed = data.eventData as { inputName: string; inputMuted: boolean };
        if (ed.inputName === this.micSourceName) {
          this.setState({ micMuted: ed.inputMuted });
        }
        break;
      }
      default:
        break;
    }
  }

  private sendRequest(type: string, data?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("OBS WebSocket not connected"));
        return;
      }
      const requestId = randomBytes(8).toString("hex");
      this.requestCallbacks.set(requestId, resolve);
      this.send({
        op: OBSOp.Request,
        d: {
          requestType: type,
          requestId,
          requestData: data,
        },
      });
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.requestCallbacks.has(requestId)) {
          this.requestCallbacks.delete(requestId);
          reject(new Error(`OBS request ${type} timed out`));
        }
      }, 5000);
    });
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setState(partial: Partial<OBSState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch (err) {
        streamDeck.logger.error(`OBS: state listener error: ${err}`);
      }
    }
  }

  private scheduleReconnect(host: string, port: number, password: string): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      streamDeck.logger.info("OBS: attempting reconnect...");
      this.connect(host, port, password);
    }, 5000);
  }
}

// ---------------------------------------------------------------------------
// OBS WebSocket v5 protocol types
// ---------------------------------------------------------------------------

enum OBSOp {
  Hello = 0,
  Identify = 1,
  Identified = 2,
  Request = 6,
  Event = 5,
}

enum OBSSOp {
  RequestResponse = 7,
}

enum EventSubscription {
  General = 1 << 0,
  Outputs = 1 << 6,
  Scenes = 1 << 7,
  Inputs = 1 << 9,
}

interface OBSMessage {
  op: number;
  d: unknown;
}

interface OBSHelloData {
  obsWebSocketVersion: string;
  rpcVersion: number;
  authentication?: {
    challenge: string;
    salt: string;
  };
}

interface OBSRequestResponseData {
  requestType: string;
  requestId: string;
  requestStatus: { result: boolean; code: number };
  responseData?: Record<string, unknown>;
}

interface OBSEventData {
  eventType: string;
  eventData: unknown;
}

export const obsService = new OBSWebSocketService();
