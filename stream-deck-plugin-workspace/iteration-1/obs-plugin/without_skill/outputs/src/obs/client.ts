import OBSWebSocket from "obs-websocket-js";
import streamDeck from "@elgato/streamdeck";
import type { OBSGlobalSettings } from "./types.js";

type EventCallback = (...args: unknown[]) => void;

/**
 * Singleton wrapper around obs-websocket-js.
 * Handles connect/disconnect, reconnection, and event forwarding.
 */
class OBSClient {
  private ws = new OBSWebSocket();
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private host = "localhost";
  private port = 4455;
  private password = "";

  /** Listeners keyed by OBS event name */
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    // Forward OBS WebSocket events to registered listeners
    this.ws.on("CurrentProgramSceneChanged", (...args) => this.emit("CurrentProgramSceneChanged", ...args));
    this.ws.on("RecordStateChanged", (...args) => this.emit("RecordStateChanged", ...args));
    this.ws.on("StreamStateChanged", (...args) => this.emit("StreamStateChanged", ...args));
    this.ws.on("InputMuteStateChanged", (...args) => this.emit("InputMuteStateChanged", ...args));
    this.ws.on("ConnectionClosed", () => {
      streamDeck.logger.warn("[OBS] Connection closed — scheduling reconnect");
      this.connected = false;
      this.emit("ConnectionClosed");
      this.scheduleReconnect();
    });
    this.ws.on("ConnectionError", (err) => {
      streamDeck.logger.error(`[OBS] Connection error: ${err}`);
      this.connected = false;
      this.scheduleReconnect();
    });
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** Load connection settings from Stream Deck global settings and connect */
  async loadAndConnect(settings: OBSGlobalSettings): Promise<void> {
    this.host = settings.obsHost ?? "localhost";
    this.port = settings.obsPort ?? 4455;
    this.password = settings.obsPassword ?? "";

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const url = `ws://${this.host}:${this.port}`;
      streamDeck.logger.info(`[OBS] Connecting to ${url}`);
      await this.ws.connect(url, this.password || undefined);
      this.connected = true;
      streamDeck.logger.info("[OBS] Connected successfully");
      this.emit("Connected");
    } catch (err) {
      streamDeck.logger.warn(`[OBS] Connect failed: ${err}`);
      this.connected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(delayMs = 5000): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delayMs);
  }

  // ── OBS Requests ──────────────────────────────────────────────────────────

  async getRecordStatus(): Promise<{ outputActive: boolean; outputPaused: boolean }> {
    this.assertConnected();
    const res = await this.ws.call("GetRecordStatus");
    return { outputActive: res.outputActive, outputPaused: res.outputPaused };
  }

  async toggleRecord(): Promise<void> {
    this.assertConnected();
    await this.ws.call("ToggleRecord");
  }

  async getStreamStatus(): Promise<{ outputActive: boolean }> {
    this.assertConnected();
    const res = await this.ws.call("GetStreamStatus");
    return { outputActive: res.outputActive };
  }

  async toggleStream(): Promise<void> {
    this.assertConnected();
    await this.ws.call("ToggleStream");
  }

  async getInputMute(inputName: string): Promise<boolean> {
    this.assertConnected();
    const res = await this.ws.call("GetInputMute", { inputName });
    return res.inputMuted;
  }

  async toggleInputMute(inputName: string): Promise<void> {
    this.assertConnected();
    await this.ws.call("ToggleInputMute", { inputName });
  }

  async getSceneList(): Promise<string[]> {
    this.assertConnected();
    const res = await this.ws.call("GetSceneList");
    return (res.scenes as Array<{ sceneName: string }>)
      .map((s) => s.sceneName)
      .reverse(); // OBS returns scenes bottom-to-top; reverse for natural order
  }

  async getCurrentScene(): Promise<string> {
    this.assertConnected();
    const res = await this.ws.call("GetCurrentProgramScene");
    return res.currentProgramSceneName;
  }

  async setCurrentScene(sceneName: string): Promise<void> {
    this.assertConnected();
    await this.ws.call("SetCurrentProgramScene", { sceneName });
  }

  // ── Event helpers ─────────────────────────────────────────────────────────

  on(event: string, cb: EventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb: EventCallback): void {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  private assertConnected(): void {
    if (!this.connected) throw new Error("OBS WebSocket not connected");
  }
}

export const obs = new OBSClient();
