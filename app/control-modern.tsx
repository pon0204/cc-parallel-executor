'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Trash2, 
  Terminal, 
  Rocket, 
  Code2, 
  Database, 
  FileCode2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';

interface Task {
  id: string;
  name: string;
  prompt: string;
  icon: React.ReactNode;
  category: string;
}

interface Session {
  sessionId: string;
  taskId?: string;
  status: string;
  output?: any[];
  createdAt?: Date;
}

const predefinedTasks: Task[] = [
  {
    id: 'task1',
    name: 'Pythonフィボナッチ関数',
    prompt: 'フィボナッチ数列を計算するPython関数を再帰とループの両方で実装してください。パフォーマンスの比較も含めてください。',
    icon: <Code2 className="w-4 h-4" />,
    category: 'algorithm'
  },
  {
    id: 'task2',
    name: 'React TODOコンポーネント',
    prompt: 'TypeScriptを使用してReactのTODOリストコンポーネントを作成してください。追加、削除、完了切り替え機能を含め、LocalStorageでデータを永続化してください。',
    icon: <FileCode2 className="w-4 h-4" />,
    category: 'frontend'
  },
  {
    id: 'task3',
    name: 'SQL分析クエリ',
    prompt: '顧客の注文データを分析し、売上高でトップ10の顧客を見つけるSQLクエリを作成してください。月別の売上推移も含めてください。',
    icon: <Database className="w-4 h-4" />,
    category: 'database'
  },
  {
    id: 'task4',
    name: 'REST API設計',
    prompt: 'ブログプラットフォーム用のRESTful APIを設計してください。投稿、コメント、ユーザー管理、認証を含め、OpenAPI仕様で文書化してください。',
    icon: <Rocket className="w-4 h-4" />,
    category: 'backend'
  }
];

export default function ModernApiControl() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [outputs, setOutputs] = useState<{ [key: string]: string[] }>({});
  const [selectedCategory, setSelectedCategory] = useState('all');

  // セッション作成
  const createSession = async (prompt: string, taskId?: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, cols: 100, rows: 30 })
      });
      
      const data = await response.json();
      const newSession: Session = {
        sessionId: data.sessionId,
        taskId,
        status: 'created',
        createdAt: new Date()
      };
      
      setSessions(prev => [...prev, newSession]);
      startOutputPolling(data.sessionId);
      
      return data.sessionId;
    } catch (error) {
      console.error('セッション作成に失敗しました:', error);
    }
  };

  // バッチ実行
  const runBatch = async () => {
    setLoading(true);
    try {
      const tasks = predefinedTasks.map(task => ({
        id: task.id,
        prompt: task.prompt
      }));
      
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });
      
      const data = await response.json();
      
      data.results.forEach((result: any) => {
        if (result.sessionId) {
          const newSession: Session = {
            sessionId: result.sessionId,
            taskId: result.taskId,
            status: 'running',
            createdAt: new Date()
          };
          setSessions(prev => [...prev, newSession]);
          startOutputPolling(result.sessionId);
        }
      });
    } catch (error) {
      console.error('バッチ実行に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  // 出力をポーリング
  const startOutputPolling = (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/output`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }
        
        const data = await response.json();
        
        if (data.output && data.output.length > 0) {
          setOutputs(prev => ({
            ...prev,
            [sessionId]: data.output.map((o: any) => o.data)
          }));
        }
        
        const statusResponse = await fetch(`/api/sessions/${sessionId}`);
        const statusData = await statusResponse.json();
        
        setSessions(prev => prev.map(s => 
          s.sessionId === sessionId ? { ...s, status: statusData.status } : s
        ));
        
        if (statusData.status === 'exited') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('ポーリングエラー:', error);
        clearInterval(pollInterval);
      }
    }, 2000);
  };

  // セッション終了
  const terminateSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      setOutputs(prev => {
        const newOutputs = { ...prev };
        delete newOutputs[sessionId];
        return newOutputs;
      });
    } catch (error) {
      console.error('セッション終了に失敗しました:', error);
    }
  };

  // 全セッションクリア
  const clearAllSessions = async () => {
    for (const session of sessions) {
      await terminateSession(session.sessionId);
    }
  };

  // ステータスアイコン取得
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'exited':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // ステータスバリアント取得
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "success" | "warning" => {
    switch (status) {
      case 'running':
        return 'default';
      case 'exited':
        return 'success';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // カテゴリでタスクをフィルタ
  const filteredTasks = selectedCategory === 'all' 
    ? predefinedTasks 
    : predefinedTasks.filter(task => task.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center justify-center gap-2">
            <Terminal className="w-10 h-10" />
            Claude Code コントロールパネル
          </h1>
          <p className="text-muted-foreground">
            複数のClaude Codeインスタンスを並列実行・管理
          </p>
        </div>

        {/* アクションバー */}
        <Card>
          <CardHeader>
            <CardTitle>クイックアクション</CardTitle>
            <CardDescription>
              事前定義されたタスクを実行したり、カスタムプロンプトを送信できます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={runBatch}
                disabled={loading}
                size="lg"
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    実行中...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    全タスクを並列実行
                  </>
                )}
              </Button>
              
              {sessions.length > 0 && (
                <Button
                  onClick={clearAllSessions}
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  全セッションをクリア
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">カスタムプロンプト</label>
              <div className="flex gap-2">
                <Input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="実行したいプロンプトを入力..."
                  className="flex-1"
                />
                <Button
                  onClick={() => customPrompt && createSession(customPrompt)}
                  disabled={!customPrompt}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  実行
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* タスク一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>事前定義タスク</CardTitle>
            <CardDescription>
              カテゴリごとにタスクを選択して実行できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">すべて</TabsTrigger>
                <TabsTrigger value="algorithm">アルゴリズム</TabsTrigger>
                <TabsTrigger value="frontend">フロントエンド</TabsTrigger>
                <TabsTrigger value="backend">バックエンド</TabsTrigger>
                <TabsTrigger value="database">データベース</TabsTrigger>
              </TabsList>
              
              <TabsContent value={selectedCategory} className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTasks.map(task => (
                    <Card key={task.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {task.icon}
                          {task.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {task.prompt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => createSession(task.prompt, task.id)}
                          className="w-full gap-2"
                          variant="outline"
                        >
                          <Sparkles className="w-4 h-4" />
                          このタスクを実行
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* アクティブセッション */}
        {sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>アクティブセッション ({sessions.length})</CardTitle>
              <CardDescription>
                実行中のClaude Codeセッションを監視・管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.map(session => {
                  const task = predefinedTasks.find(t => t.id === session.taskId);
                  const output = outputs[session.sessionId] || [];
                  
                  return (
                    <Card key={session.sessionId} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              {task?.icon || <Terminal className="w-4 h-4" />}
                              {task?.name || 'カスタムタスク'}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              セッションID: {session.sessionId}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusVariant(session.status)} className="gap-1">
                              {getStatusIcon(session.status)}
                              {session.status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => terminateSession(session.sessionId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-black/90 rounded-md p-3 max-h-48 overflow-auto">
                          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                            {output.length > 0 ? (
                              output.slice(-20).join('')
                            ) : (
                              <span className="text-gray-500">出力を待機中...</span>
                            )}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}