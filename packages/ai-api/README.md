### frontend ai api library

### usage
```javascript
import { AiLib } from '@connexup/ai-api';
const aiLib = new AiLib({
  actionPrefix: "",
  url: "https://sse-test.connexup-uat.net/agent/chat/stream",
  method: "POST",
  payload: {
    "message":"I work in the sector of Fast Casual","merchant_id":"54b78da8-4d71-4576-8f59-915e7bd94561","merchant_name":"Chancetop Edit","user_id":"0bfb3b5d-3d71-4753-860f-149a9312cdbe","conversation_id":"874cac77-2d43-4691-8ae6-25a1358d5172"
    },
  onMessage: (data) => {
    console.log('receive data: ', data);
  },
  onError: (e) => {
    console.log('receive error: ', e);
  },
});

aiLib.on('update', (state) => console.log('aiLib state', state));

aiLib.connect();

setTimeout(() => {
    aiLib.off('update');
    aiLib.disconnect();
}, 20000);
```