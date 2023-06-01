import { useState } from 'react';

export interface FormValues {
  topic: string;
  message: string;
}

export interface RequestFormProps {
  connected: boolean;
  onSubmit(query: FormValues): void;
  defaultTopic?: string;
}

/**
 * Accepts user input
 */
export const RequestForm = ({ connected, onSubmit, defaultTopic = 'hello' }: RequestFormProps) => {
  const [topic, setTopic] = useState<string>(defaultTopic);
  const [message, setMessage] = useState<string>('');

  if (!connected) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message === '') {
            return;
          }
          onSubmit({
            topic,
            message,
          });
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div>
            <strong>Topic:</strong>
          </div>
          <div style={{ marginBottom: 5 }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <strong>Request:</strong>
          </div>
          <div>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
            <div>
              <button type="submit">Send</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
