import { AiLib } from '@connexup/ai-api';

const test = new AiLib({
  // loggerUrl: "",
  // loggerAppName: "",
  baseUrl: 'http://localhost:3030/sse',
  // baseUrl: "https://sse-test.connexup-uat.net/agent/chat/stream",
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
  url: '',
  // method: "POST",
  // payload: {"message":"I work in the sector of Fast Casual","merchant_id":"54b78da8-4d71-4576-8f59-915e7bd94561","merchant_name":"Chancetop Edit","user_id":"0bfb3b5d-3d71-4753-860f-149a9312cdbe","conversation_id":"874cac77-2d43-4691-8ae6-25a1358d5172"},
});

setTimeout(() => {
  test.disconnect();
}, 20000);
