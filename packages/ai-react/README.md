### ai react library
AiLib simple React state management and AI chatbox component

### usage
```javascript
import { AiLib } from '@connexup/ai-api';
import { useAiLibState } from './useAiLibState';
import { v4 as uuid } from 'uuid';

export function ChatBox({}: Props) {
    const [aiLib] = useState(() => {
    const instance = new AiLib({
      loggerUrl: "",
      loggerAppName: "",
      baseUrl: 'https://sse-test.connexup-uat.net',
      onMessage: (data: any) => {
        console.log('receive data: ', data);
      },
      onError: (e: any) => {
        console.log('receive error: ', e.message);
      },
    });

    return instance;
  });

  const { status, message, error } = useAiLibState({
    aiLib,
    selector: (state) => state,
  });

  const [conversationId] = useState(() => uuid());

useEffect(() => {
    return () => {
      aiLib.destroy();
    };
  }, []);

  const handleChat = (value: string) => {
    aiLib.disconnect();
    
    aiLib.connect({
      url: '/agent/chat/stream',
      method: 'POST',
      payload: {
        message: value,
        merchant_id: '54b78da8-4d71-4576-8f59-915e7bd94561',
        merchant_name: 'Chancetop Edit',
        user_id: '0bfb3b5d-3d71-4753-860f-149a9312cdbe',
        conversation_id: conversationId,
      },
    });
  };

  // you code
  ......
}
```