import React, { useEffect, useState } from 'react';
import { AiLib } from '@chancetop/ai-api';
import { useAiLibState } from './useAiLibState';
import { v4 as uuid } from 'uuid';

type Props = {};

export function ChatBox({}: Props) {
  const [aiLib] = useState(() => {
    const instance = new AiLib({
      baseUrl: 'https://sse-test.connexup-uat.net/agent/chat/stream',
      // baseUrl: 'http://localhost:3030/sse/unstable-stream',

      onMessage: (data: any) => {
        console.log('receive data: ', data);
        if (data.type === 'end') {
          instance.disconnect();
        }
      },
      onError: (e: any) => {
        console.log('receive error: ', e.message);
      },
    } as any);

    return instance;
  });

  const { status, message, error } = useAiLibState({
    aiLib,
    selector: (state) => state,
  });

  const [conversationId] = useState(() => uuid());

  const [list, setList] = useState<
    {
      sender: string;
      msg: string;
      error?: string | null;
      status: 'complete' | 'waiting';
    }[]
  >([]);

  const [inputVal, setInputVal] = useState('');

  const [streamContent, setStreamContent] = useState('');

  useEffect(() => {
    return () => {
      aiLib.destroy();
    };
  }, []);

  useEffect(() => {
    if (status === 'open') {
      setStreamContent((pre) => {
        if (typeof message === 'object' && message !== null) {
          return pre + JSON.stringify(message);
        }
        return pre + (message || '');
      });
    } else if (status === 'closed') {
      setList((pre) => {
        const res = [...pre];
        const lastItem = res[res.length - 1];
        if (lastItem?.status === 'waiting') {
          res.splice(res.length - 1, 1, {
            ...lastItem,
            msg: streamContent || '好的，停下来了，有问题再问我！',
            status: 'complete',
          });
        }

        console.log('closed:', streamContent, pre, res);
        return res;
      });
      setStreamContent('');
    } else if (status === 'error') {
      setList((pre) => {
        const res = [...pre];
        const lastItem = res[res.length - 1];
        if (lastItem?.status === 'waiting') {
          res.splice(res.length - 1, 1, {
            ...lastItem,
            msg: '哦哦，我出错了，请稍后再试！',
            error: error ? error.errorCode + ', ' + error.errorMessage : null,
          });
        }
        return res;
      });
    }
  }, [status, message, error]);

  const handleChat = (value: string) => {
    aiLib.disconnect();
    setList((pre) => {
      const res = [...pre];
      const lastItem = res[res.length - 1];
      if (lastItem?.status === 'waiting') {
        res.splice(res.length - 1, 1, {
          ...lastItem,
          msg: streamContent || '好的，停下来了，有问题再问我！',
          status: 'complete',
        });
      }
      return [
        ...res,
        { sender: 'user', msg: value, status: 'complete' },
        { sender: 'ai', msg: '', status: 'waiting' },
      ];
    });
    setStreamContent('');
    aiLib.connect({
      url: '',
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

  const handleChatNoStream = () => {
    aiLib.disconnect();
    setList((pre) => {
      const res = [...pre];
      const lastItem = res[res.length - 1];
      if (lastItem?.status === 'waiting') {
        res.splice(res.length - 1, 1, {
          ...lastItem,
          msg: streamContent || '好的，停下来了，有问题再问我！',
          status: 'complete',
        });
      }
      return [
        ...res,
        { sender: 'user', msg: '测试非推流接口', status: 'complete' },
        { sender: 'ai', msg: '', status: 'waiting' },
      ];
    });
    setStreamContent('');
    aiLib.connect({
      url: 'http://localhost:3030/test-typeorm',
      method: 'GET',
      streaming: false,
    });
  };

  const handleStopChat = () => {
    aiLib.disconnect();
  };

  return (
    <div style={{ width: '800px' }}>
      list:
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          borderBottom: '1px solid gray',
          height: '300px',
          overflow: 'auto',
        }}
      >
        {list.map((item, index) => (
          <div
            style={{
              width: '30%',
              background: item.sender === 'ai' ? 'white' : 'lightblue',
              alignSelf: item.sender === 'ai' ? 'flex-start' : 'flex-end',
              textAlign: item.sender === 'ai' ? 'left' : 'right',
              color: 'black',
              wordBreak: 'break-all',
            }}
            key={index}
          >
            <div key={index}>
              {item.status === 'complete'
                ? item.msg
                : streamContent || 'waiting...'}
            </div>
            <div style={{ color: 'red' }}>{item.error}</div>
          </div>
        ))}
      </div>
      chatBox:
      <textarea
        style={{ width: '100%', height: '50px' }}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
      >
        {inputVal}
      </textarea>
      <button
        onClick={() => {
          handleChat(inputVal);
          setInputVal('');
        }}
      >
        发送
      </button>
      <button
        onClick={() => {
          handleChat(
            'image test: this is my menu image:https://fbrdevstorage.blob.core.windows.net/static/fbr-dev/product/file/f11cbad9ae694bd193db35603cdc398e.jpg'
          );
        }}
      >
        解析图片
      </button>
      <button
        onClick={() => {
          handleChatNoStream();
        }}
      >
        发送非推流消息
      </button>
      <button onClick={handleStopChat}>停止回答</button>
    </div>
  );
}
