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
      baseUrl: 'http://localhost:3030',
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
      url: '/sse/stream?errorType=connection_error',
      method: 'GET',
      payload: {
        conversation_id: conversationId,
      },
    });
  };

  // you code
  ......
}
```