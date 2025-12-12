import { AiLib } from '@connexup/ai-api';

const test = new AiLib({
  // loggerUrl: "",
  baseUrl: 'http://localhost:3030',
  onMessage: (data) => {
    console.log('receive data: ', data);
    if (data.type === 'end') {
      test.disconnect();
    }
  },
  onError: (e) => {
    console.log('receive error: ', e);
  },
});

test.connect({
  url: '/sse/stream?errorType=connection_error',
});

setTimeout(() => {
  test.disconnect();
}, 20000);
