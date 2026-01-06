### frontend ai api library
Including start request, request interrupt, error handling, logs, status management

### usage
```javascript
import { AiLib } from '@connexup/ai-api';
const aiLib = new AiLib({
  loggerUrl: "",
  baseUrl: "http://localhost:3030",
  // retryAttempts: 3, //default 3, when error occurs, retry request times
  // acceptMsgTypes: ["agent_response"], // default ["agent_response"], when receive message, trigger callback
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
  // pathParams: {},
  // data: { // optional, use for request body
  //   }
});

setTimeout(() => {
    aiLib.disconnect();
}, 20000);
```