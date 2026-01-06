import React, { useEffect, useState } from 'react';
import { AiLibOptions, AiLibState, RequestOptions } from '@connexup/ai-api';
import { useAiLibState } from './useAiLibState';
import { useAiLib } from './useAiLib';

type Props<T> = {
  options: AiLibOptions & RequestOptions<T>;
  connectOptions: RequestOptions<T>;
  renderMessage?: (message: any) => React.ReactNode;
  onStateChange?: (state: AiLibState) => void;
};

export function ChatBox<T extends {}>({
  options,
  connectOptions,
  renderMessage,
  onStateChange,
}: Props<T>) {
  const aiLib = useAiLib(options);
  const { status, streamMessage, fullMessages, error } = useAiLibState({
    aiLib,
    selector: (state) => state,
  });

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
    if (status === 'open') {
      setStreamContent((pre) => {
        if (!streamMessage) return pre;

        const res = renderMessage
          ? renderMessage(streamMessage)
          : streamMessage?.content;
        console.log('res: ', res);
        return pre + (res || '');
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
    onStateChange?.({
      status,
      streamMessage,
      error,
      fullMessages,
    });
  }, [status, streamMessage, error]);

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
      ...connectOptions,
      data: {
        ...connectOptions.data,
        message: value,
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
