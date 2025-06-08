'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, Brain, MessageSquare, Pause, Play, AlertCircle } from 'lucide-react';

export type ClaudeState = 'idle' | 'thinking' | 'responding' | 'waiting_input' | 'executing_tool';

interface ChildCCStatusBadgeProps {
  state: ClaudeState;
  className?: string;
  showIcon?: boolean;
}

export function ChildCCStatusBadge({ state, className, showIcon = true }: ChildCCStatusBadgeProps) {
  const getStateConfig = (state: ClaudeState) => {
    switch (state) {
      case 'idle':
        return {
          label: '待機中',
          variant: 'secondary' as const,
          icon: Pause,
          className: 'bg-gray-100 text-gray-700'
        };
      case 'thinking':
        return {
          label: '思考中',
          variant: 'default' as const,
          icon: Brain,
          className: 'bg-blue-100 text-blue-700',
          animate: true
        };
      case 'responding':
        return {
          label: '応答中',
          variant: 'default' as const,
          icon: MessageSquare,
          className: 'bg-green-100 text-green-700'
        };
      case 'waiting_input':
        return {
          label: '入力待ち',
          variant: 'destructive' as const,
          icon: AlertCircle,
          className: 'bg-orange-100 text-orange-700',
          pulse: true
        };
      case 'executing_tool':
        return {
          label: 'ツール実行中',
          variant: 'default' as const,
          icon: Play,
          className: 'bg-purple-100 text-purple-700',
          animate: true
        };
      default:
        return {
          label: '不明',
          variant: 'outline' as const,
          icon: AlertCircle,
          className: ''
        };
    }
  };

  const config = getStateConfig(state);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        'flex items-center gap-1 transition-all',
        config.className,
        config.pulse && 'animate-pulse',
        className
      )}
    >
      {showIcon && (
        <>
          {config.animate ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Icon className="h-3 w-3" />
          )}
        </>
      )}
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  );
}