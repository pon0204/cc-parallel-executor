import { logger } from '../utils/logger.js';

export enum OutputType {
  THINKING = 'thinking',      // ✳ Thinking...
  CONTENT = 'content',        // 実際の回答
  PROMPT = 'prompt',          // Human: 
  TOOL_USE = 'tool_use',      // ツール使用中
  ERROR = 'error'             // エラー
}

export enum ClaudeState {
  IDLE = 'idle',
  THINKING = 'thinking',
  RESPONDING = 'responding',
  WAITING_INPUT = 'waiting_input',
  EXECUTING_TOOL = 'executing_tool'
}

interface StateChangeEvent {
  from: ClaudeState;
  to: ClaudeState;
  timestamp: Date;
  instanceId: string;
}

export class ClaudeOutputAnalyzer {
  private state = ClaudeState.IDLE;
  private stateHistory: Array<{state: ClaudeState, timestamp: Date}> = [];
  private buffer = '';
  private lastContentTime = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;
  private onStateChange?: (event: StateChangeEvent) => void;

  constructor(
    private instanceId: string,
    private options: {
      idleTimeoutMs?: number;
      checkIntervalMs?: number;
    } = {}
  ) {
    this.options.idleTimeoutMs = options.idleTimeoutMs || 3000;
    this.options.checkIntervalMs = options.checkIntervalMs || 500;
  }

  start(onStateChange: (event: StateChangeEvent) => void) {
    this.onStateChange = onStateChange;
    
    // 定期的にアイドル状態をチェック
    this.checkInterval = setInterval(() => {
      this.checkIdleStatus();
    }, this.options.checkIntervalMs!);
    
    logger.info(`Claude output analyzer started for instance ${this.instanceId}`);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info(`Claude output analyzer stopped for instance ${this.instanceId}`);
  }

  processOutput(data: string): void {
    this.buffer += data;
    const outputType = this.classifyOutput(data);
    
    // 思考中やツール使用中でなければ最終コンテンツ時刻を更新
    if (outputType === OutputType.CONTENT || outputType === OutputType.PROMPT) {
      this.lastContentTime = Date.now();
    }
    
    // 状態遷移の処理
    this.updateState(outputType, data);
  }

  private isThinkingOutput(data: string): boolean {
    const thinkingPatterns = [
      /✳\s+\w+\.{3}\s*\(\d+s\s*·\s*[↑↓]\s*\d+\s*tokens/,
      /\[ESC to interrupt\]/i,
      /Thinking|Planning|Analyzing|Searching|Reading|Writing|Executing/i
    ];
    
    return thinkingPatterns.some(p => p.test(data));
  }

  private classifyOutput(output: string): OutputType {
    if (this.isThinkingOutput(output)) return OutputType.THINKING;
    if (/Human:\s*$/.test(output)) return OutputType.PROMPT;
    if (/```tool_use|<tool_use>/.test(output)) return OutputType.TOOL_USE;
    if (/error|failed/i.test(output)) return OutputType.ERROR;
    return OutputType.CONTENT;
  }

  private updateState(outputType: OutputType, data: string) {
    const previousState = this.state;
    let newState = this.state;

    switch (outputType) {
      case OutputType.THINKING:
        newState = ClaudeState.THINKING;
        break;
      case OutputType.PROMPT:
        newState = ClaudeState.WAITING_INPUT;
        break;
      case OutputType.TOOL_USE:
        newState = ClaudeState.EXECUTING_TOOL;
        break;
      case OutputType.CONTENT:
        newState = ClaudeState.RESPONDING;
        break;
      case OutputType.ERROR:
        // エラーの場合は現在の状態を維持
        break;
    }

    if (previousState !== newState) {
      this.state = newState;
      this.stateHistory.push({
        state: newState,
        timestamp: new Date()
      });

      // 状態変化を通知
      if (this.onStateChange) {
        this.onStateChange({
          from: previousState,
          to: newState,
          timestamp: new Date(),
          instanceId: this.instanceId
        });
      }

      logger.debug(`Claude state changed: ${previousState} -> ${newState}`, {
        instanceId: this.instanceId
      });
    }
  }

  private checkIdleStatus() {
    const timeSinceLastContent = Date.now() - this.lastContentTime;
    
    // アイドルタイムアウトを超えた場合
    if (timeSinceLastContent > this.options.idleTimeoutMs! && this.state === ClaudeState.RESPONDING) {
      // バッファの最後をチェックして状態を判定
      const lastChars = this.buffer.slice(-200);
      
      if (/Human:\s*$/.test(lastChars)) {
        this.updateState(OutputType.PROMPT, '');
      } else {
        // 回答が完了したと判断
        const previousState = this.state;
        this.state = ClaudeState.IDLE;
        
        if (this.onStateChange) {
          this.onStateChange({
            from: previousState,
            to: ClaudeState.IDLE,
            timestamp: new Date(),
            instanceId: this.instanceId
          });
        }
      }
    }
  }

  getState(): ClaudeState {
    return this.state;
  }

  getStateHistory(): Array<{state: ClaudeState, timestamp: Date}> {
    return [...this.stateHistory];
  }

  getLastOutput(length = 500): string {
    return this.buffer.slice(-length);
  }

  clearBuffer() {
    this.buffer = '';
  }

  // ユーザー入力が必要かどうかを判定
  isWaitingForInput(): boolean {
    return this.state === ClaudeState.WAITING_INPUT;
  }

  // 回答が完了したかどうかを判定
  isResponseComplete(): boolean {
    const timeSinceLastContent = Date.now() - this.lastContentTime;
    return this.state === ClaudeState.IDLE && timeSinceLastContent > this.options.idleTimeoutMs!;
  }

  // 質問やアクションが必要なパターンを検出
  detectActionNeeded(): { needed: boolean; type: string; confidence: number } {
    const lastOutput = this.buffer.slice(-500);
    
    const patterns = [
      { regex: /どうしますか[\?？]\s*$/, type: 'question' },
      { regex: /選んでください\s*$/, type: 'choice' },
      { regex: /確認してください\s*$/, type: 'confirmation' },
      { regex: /よろしいですか[\?？]\s*$/, type: 'confirmation' },
      { regex: /続けますか[\?？]\s*$/, type: 'continue' },
      { regex: /実行しますか[\?？]\s*$/, type: 'execute' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(lastOutput)) {
        return {
          needed: true,
          type: pattern.type,
          confidence: 0.9
        };
      }
    }

    // 一般的な質問パターン
    if (/[\?？]\s*$/.test(lastOutput)) {
      return {
        needed: true,
        type: 'general_question',
        confidence: 0.7
      };
    }

    return {
      needed: false,
      type: 'none',
      confidence: 0
    };
  }
}