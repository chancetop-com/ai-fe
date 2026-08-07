import { AiLib } from '@connexup/ai-api';

const test = new AiLib({
  baseUrl: 'http://localhost:3030',
  sessionId: 'test-session-id',
});

test.subscribe({
  onMessage: (event) => {
    console.log('receive event: ', event);
  },
  onError: (error) => {
    console.log('receive error: ', error);
  },
});

test.sendMessage({
  message: 'hello',
});

setTimeout(() => {
  test.disconnect();
}, 20000);
