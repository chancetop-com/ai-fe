// import {sse} from 'core-fe/src/util/sse'

// console.log(777)
// const test = sse({
//     // actionPrefix: "",
//     // url: "http://localhost:3030/sse",
//     // method: "GET",
//     // customHeaders: {},
//     url: "https://sse-test.connexup-uat.net/agent/chat/stream",
//     method: "POST",
//     payload: {"message":"I work in the sector of Fast Casual","merchant_id":"54b78da8-4d71-4576-8f59-915e7bd94561","merchant_name":"Chancetop Edit","user_id":"0bfb3b5d-3d71-4753-860f-149a9312cdbe","conversation_id":"874cac77-2d43-4691-8ae6-25a1358d5172"}
// })

// test.onConnected((connectedTimes) => console.log("connected times", connectedTimes))

// test.onResponse("type", (data) => console.log("receive type: ", data))
// test.onResponse("timestamp", (data) => console.log("receive timestamp: ", data))
// test.onResponse("conversation_id", (data) => console.log("receive conversation_id: ", data))
// test.onResponse("content", (data) => console.log("receive content: ", data))
// test.onResponse("chunk_index", (data) => console.log("receive chunk_index: ", data))
// test.onResponse("is_final_chunk", (data) => console.log("receive is_final_chunk: ", data))

// test.connect()

import { AiLib } from '@chancetop/ai-api';

const test = new AiLib({
  // actionPrefix: "",
  url: 'http://localhost:3030/sse',
  // url: "https://sse-test.connexup-uat.net/agent/chat/stream",
  // method: "POST",
  // payload: {"message":"I work in the sector of Fast Casual","merchant_id":"54b78da8-4d71-4576-8f59-915e7bd94561","merchant_name":"Chancetop Edit","user_id":"0bfb3b5d-3d71-4753-860f-149a9312cdbe","conversation_id":"874cac77-2d43-4691-8ae6-25a1358d5172"},
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

test.connect();

test.on('update', (state) => console.log(777, state));

setTimeout(() => {
  test.disconnect();
}, 20000);
