import { useState } from 'react';
import { ChevronDown, ChevronRight, ListTodo } from 'lucide-react';

export interface PlanTodo {
  content: string;
  status: string;
}

export function PlanUpdateBlock({ todos }: { todos: PlanTodo[] }) {
  const [expanded, setExpanded] = useState(true);

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'var(--color-success)';
      case 'in_progress':
        return 'var(--color-warning)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const statusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Done';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Pending';
    }
  };

  return (
    <div
      className="mb-3 rounded-xl border text-xs"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-tertiary)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex items-center gap-1.5 w-full px-3 py-2 cursor-pointer"
        style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <ListTodo size={14} />
        <span className="font-medium">
          Planning ({todos.filter((todo) => todo.status.toLowerCase() === 'completed').length}/{todos.length})
        </span>
      </button>
      {expanded ? (
        <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <thead>
              <tr
                style={{
                  color: 'var(--color-text-muted)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <th className="text-left py-1.5 pr-3 font-medium">Status</th>
                <th className="text-left py-1.5 font-medium">Task</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((todo, index) => (
                <tr
                  key={`${todo.content}-${index}`}
                  className="border-b"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    <span style={{ color: statusColor(todo.status) }}>
                      {todo.status.toLowerCase() === 'completed'
                        ? '✓ '
                        : todo.status.toLowerCase() === 'in_progress'
                          ? '▶ '
                          : '○ '}
                      {statusLabel(todo.status)}
                    </span>
                  </td>
                  <td className="py-1.5" style={{ color: 'var(--color-text)' }}>
                    {todo.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
