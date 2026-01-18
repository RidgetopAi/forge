export interface SSEEvent {
  event?: string;
  data: string;
}

export type SSEEventCallback = (event: SSEEvent) => void;

export class SSEParser {
  private buffer = '';
  private currentEvent: string | undefined;
  private currentData: string[] = [];
  private onEvent: SSEEventCallback;

  constructor(onEvent: SSEEventCallback) {
    this.onEvent = onEvent;
  }

  feed(chunk: string): void {
    this.buffer += chunk;
    this.processBuffer();
  }

  private processBuffer(): void {
    let newlineIndex: number;
    
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.processLine(line);
    }
  }

  private processLine(line: string): void {
    if (line === '') {
      this.dispatch();
      return;
    }

    if (line.startsWith(':')) {
      return;
    }

    const colonIndex = line.indexOf(':');
    let field: string;
    let value: string;

    if (colonIndex === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIndex);
      value = line.slice(colonIndex + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    switch (field) {
      case 'event':
        this.currentEvent = value;
        break;
      case 'data':
        this.currentData.push(value);
        break;
    }
  }

  private dispatch(): void {
    if (this.currentData.length === 0) {
      this.reset();
      return;
    }

    const data = this.currentData.join('\n');
    
    if (data === '[DONE]') {
      this.reset();
      return;
    }

    this.onEvent({
      event: this.currentEvent,
      data,
    });

    this.reset();
  }

  private reset(): void {
    this.currentEvent = undefined;
    this.currentData = [];
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.processLine(this.buffer);
      this.buffer = '';
    }
    this.dispatch();
  }
}
