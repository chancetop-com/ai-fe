### frontend ai api library
Including start request, request interrupt, error handling, logs, status management

### usage
```javascript
import { AiLib } from '@connexup/ai-api';
const aiLib = new AiLib({
  loggerUrl: "",
  loggerAppName: "",
  baseUrl: "http://localhost:3030",
  onMessage: (data) => {
    console.log('receive data: ', data);
  },
  onError: (e) => {
    console.log('receive error: ', e);
  },
});

aiLib.connect({
  url: "/sse/stream?errorType=connection_error", // mandatory
  // method: "POST", // optional default “GET”
  // headers: {}, // optional
  // payload: { // optional, use for request body
  //   }
});

setTimeout(() => {
    aiLib.disconnect();
}, 20000);
```