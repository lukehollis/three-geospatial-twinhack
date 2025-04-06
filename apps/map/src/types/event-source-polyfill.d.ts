declare module 'event-source-polyfill' {
  export class EventSourcePolyfill implements EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourceInit);
    readonly CLOSED: number;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly readyState: number;
    readonly url: string;
    readonly withCredentials: boolean;
    onopen: (evt: Event) => any;
    onmessage: (evt: MessageEvent) => any;
    onerror: (evt: Event) => any;
    addEventListener(type: string, listener: EventListener): void;
    dispatchEvent(evt: Event): boolean;
    removeEventListener(type: string, listener: EventListener): void;
    close(): void;
  }
}
