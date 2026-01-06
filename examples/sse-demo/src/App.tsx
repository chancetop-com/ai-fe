import type { AiLibState } from '@connexup/ai-api';
import { ChatBox } from '@connexup/ai-react';

function App() {
  return (
    <ChatBox
      options={{
        baseUrl: 'https://sse-test.connexup-uat.net',
        // baseUrl: 'http://localhost:3030',
        acceptMsgTypes: ['agent_response', 'menu_table', 'menu_preview'],
        onMessage: (data: any) => {
          console.log('receive data: ', data);
        },
        onError: (e: any) => {
          console.log('receive error: ', e.message);
        },
      }}
      connectOptions={{
        url: '/agent/chat/stream',
        method: 'POST',
        data: {
          conversation_id: '2c6caf96-d24c-4f47-a9f8-9eee6feee1bd',
          merchant_id: 'd5673e51-9e7b-4e64-957d-767b67df8db7',
          merchant_name: 'Chancetop Edit',
          user_id: '7e56d5c7-2391-4d8a-b287-836589a6e76f',
        },
        // url: '/sse/stream?errorType=connection_error',
      }}
      renderMessage={(streamMessage: any) => {
        let content: any;
        if (streamMessage.type === 'agent_response') {
          content = streamMessage.content;
        } else if (streamMessage.type === 'menu_table') {
          content = streamMessage.table_config;
        } else if (streamMessage.type === 'menu_preview') {
          content = streamMessage.preview_config;
        }
        if (typeof content === 'object' && content !== null) {
          return JSON.stringify(content);
        }
        return content || '';
      }}
      onStateChange={(state: AiLibState) => {
        console.log('state', state);
      }}
    />
  );
}

export default App;
