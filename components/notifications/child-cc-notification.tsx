'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertCircle, HelpCircle } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface Notification {
  id: string;
  instanceId: string;
  taskId?: string;
  type: 'waiting_input' | 'action_required';
  actionType?: string;
  context?: string;
  timestamp: Date;
}

interface ChildCCNotificationProps {
  socket: Socket | null;
  onFocusTerminal?: (instanceId: string) => void;
}

export function ChildCCNotification({ socket, onFocusTerminal }: ChildCCNotificationProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!socket) return;

    // 入力待ち通知
    const handleNeedsInput = (data: {instanceId: string; taskId?: string; context?: string}) => {
      const notification: Notification = {
        id: `${data.instanceId}-${Date.now()}`,
        instanceId: data.instanceId,
        taskId: data.taskId,
        type: 'waiting_input',
        context: data.context,
        timestamp: new Date()
      };

      setNotifications(prev => [...prev, notification]);

      toast({
        title: `子CC ${data.instanceId.slice(0, 8)} が入力を待っています`,
        description: 'タスク: ' + (data.taskId?.slice(0, 8) || '不明'),
        action: onFocusTerminal ? (
          <Button 
            size="sm" 
            onClick={() => {
              onFocusTerminal(data.instanceId);
              removeNotification(notification.id);
            }}
          >
            表示
          </Button>
        ) : undefined,
      });
    };

    // アクション必要通知
    const handleActionRequired = (data: {instanceId: string; taskId?: string; actionType?: string; context?: string}) => {
      const notification: Notification = {
        id: `${data.instanceId}-${Date.now()}`,
        instanceId: data.instanceId,
        taskId: data.taskId,
        type: 'action_required',
        actionType: data.actionType,
        context: data.context,
        timestamp: new Date()
      };

      setNotifications(prev => [...prev, notification]);

      const actionTypeText = {
        question: '質問への回答',
        choice: '選択',
        confirmation: '確認',
        continue: '継続の判断',
        execute: '実行の承認',
        general_question: '応答'
      }[data.actionType || ''] || 'アクション';

      toast({
        title: `子CCが${actionTypeText}を待っています`,
        description: `インスタンス: ${data.instanceId.slice(0, 8)}`,
        variant: 'default',
        action: onFocusTerminal ? (
          <Button 
            size="sm" 
            onClick={() => {
              onFocusTerminal(data.instanceId);
              removeNotification(notification.id);
            }}
          >
            対応する
          </Button>
        ) : undefined,
      });
    };

    socket.on('dashboard:child-cc-needs-input', handleNeedsInput);
    socket.on('dashboard:child-cc-action-required', handleActionRequired);

    return () => {
      socket.off('dashboard:child-cc-needs-input', handleNeedsInput);
      socket.off('dashboard:child-cc-action-required', handleActionRequired);
    };
  }, [socket, toast, onFocusTerminal]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'waiting_input':
        return <Info className="h-4 w-4" />;
      case 'action_required':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (type: string): "default" | "destructive" => {
    return type === 'action_required' ? 'default' : 'default';
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.slice(-3).map((notification) => (
        <Alert 
          key={notification.id} 
          variant={getAlertVariant(notification.type)}
          className="cursor-pointer transition-all hover:shadow-lg"
          onClick={() => {
            if (onFocusTerminal) {
              onFocusTerminal(notification.instanceId);
              removeNotification(notification.id);
            }
          }}
        >
          <div className="flex items-start gap-2">
            {getIcon(notification.type)}
            <div className="flex-1">
              <AlertDescription className="text-sm">
                <div className="font-medium mb-1">
                  {notification.type === 'waiting_input' 
                    ? '子CCが入力待機中' 
                    : `子CCが${notification.actionType || 'アクション'}を必要としています`}
                </div>
                {notification.taskId && (
                  <div className="text-xs text-muted-foreground">
                    タスク: {notification.taskId.slice(0, 8)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </div>
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
            >
              ×
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}