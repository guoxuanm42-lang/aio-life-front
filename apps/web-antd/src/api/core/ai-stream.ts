export interface ServerSentEvent {
  data: string;
  event: string;
}

export interface ServerSentEventParser {
  end: () => void;
  feed: (chunk: string) => void;
}

export function createServerSentEventParser(
  onEvent: (event: ServerSentEvent) => void,
): ServerSentEventParser {
  let buffer = '';

  const dispatch = (frame: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of frame.split(/\r\n|\r|\n/)) {
      if (!line || line.startsWith(':')) continue;

      const separatorIndex = line.indexOf(':');
      const field =
        separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      let value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'event') {
        eventName = value || 'message';
      } else if (field === 'data') {
        dataLines.push(value);
      }
    }

    if (dataLines.length > 0) {
      onEvent({ event: eventName, data: dataLines.join('\n') });
    }
  };

  const drain = () => {
    while (true) {
      const separator = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
      if (!separator || separator.index === undefined) return;

      const frame = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      dispatch(frame);
    }
  };

  return {
    feed(chunk: string) {
      buffer += chunk;
      drain();
    },
    end() {
      drain();
      if (buffer) {
        dispatch(buffer);
        buffer = '';
      }
    },
  };
}
