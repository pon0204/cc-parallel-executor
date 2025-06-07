# CC並列実行システム 実装ルール

## 1. プロジェクト構成

### 1.1 ディレクトリ構造
```
claude-code-terminal/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # ダッシュボード関連ページ
│   ├── (terminal)/        # ターミナル関連ページ
│   └── api/               # APIルート
├── components/            # 共有UIコンポーネント
│   ├── ui/               # 基本UIコンポーネント（shadcn/ui）
│   ├── dashboard/        # ダッシュボード専用コンポーネント
│   └── terminal/         # ターミナル専用コンポーネント
├── lib/                   # ユーティリティ関数
│   ├── api/              # API通信関連
│   ├── hooks/            # カスタムフック
│   └── utils/            # 汎用ユーティリティ
├── server/               # バックエンドサーバー
│   ├── api/              # REST APIエンドポイント
│   ├── services/         # ビジネスロジック
│   ├── models/           # データモデル
│   └── utils/            # サーバー用ユーティリティ
├── prisma/               # Prisma設定（SQLite）
└── docs/                 # ドキュメント
```

### 1.2 ファイル命名規則
- コンポーネント: PascalCase (例: `TaskDashboard.tsx`)
- ユーティリティ: camelCase (例: `parseTaskDefinition.ts`)
- 定数: UPPER_SNAKE_CASE (例: `MAX_PARALLEL_CC`)
- 型定義: PascalCase + `.types.ts` (例: `Task.types.ts`)

## 2. ライブラリ構成

### 2.1 フロントエンド

#### UI/スタイリング
- **shadcn/ui**: UIコンポーネントライブラリ（継続使用）
- **Tailwind CSS**: スタイリング（継続使用）
- **lucide-react**: アイコン（継続使用）

#### 状態管理
- **Zustand**: グローバル状態管理（新規追加）
  - 理由: Redux Toolkitより軽量でTypeScript親和性が高い

#### 通信
- **@tanstack/react-query**: APIデータ取得・キャッシュ（新規追加）
- **socket.io-client**: WebSocket通信（継続使用）

#### ターミナル
- **@xterm/xterm**: ターミナルエミュレーション（重複を整理）

#### フォーム/バリデーション
- **react-hook-form**: フォーム管理（新規追加）
- **zod**: スキーマバリデーション（新規追加）

### 2.2 バックエンド

#### フレームワーク
- **Express**: HTTPサーバー（継続使用）
- **Socket.IO**: WebSocketサーバー（継続使用）

#### データベース
- **Prisma**: ORM（新規追加）
- **SQLite**: データベース（新規追加）

#### ユーティリティ
- **zod**: バリデーション（フロントエンドと共通）
- **winston**: ロギング（新規追加）
- **node-pty**: PTYエミュレーション（新規追加）

### 2.3 開発ツール

#### TypeScript関連
- **@types/express**: Express型定義（新規追加）
- **@types/socket.io**: Socket.IO型定義（新規追加）

#### コード品質
- **ESLint**: リンター（新規追加）
- **Prettier**: フォーマッター（新規追加）
- **Husky**: Git hooks（新規追加）

## 3. コーディングルール

### 3.1 TypeScript
```typescript
// ✅ Good: 明示的な型定義
interface Task {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ❌ Bad: any型の使用
const processTask = (task: any) => { ... }

// ✅ Good: 型安全なエラーハンドリング
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

### 3.2 コンポーネント
```tsx
// ✅ Good: 関数コンポーネント + 型定義
interface TaskCardProps {
  task: Task;
  onStatusChange: (status: Task['status']) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{task.name}</CardTitle>
      </CardHeader>
    </Card>
  );
};

// ❌ Bad: デフォルトエクスポート
export default function TaskCard() { ... }
```

### 3.3 API通信
```typescript
// ✅ Good: zodスキーマでバリデーション
const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed'])
});

// API関数は別ファイルに分離
export const taskApi = {
  create: async (data: CreateTaskInput) => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return TaskSchema.parse(await response.json());
  }
};
```

### 3.4 状態管理（Zustand）
```typescript
// ✅ Good: 型安全なストア定義
interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  clearProject: () => set({ currentProject: null })
}));
```

### 3.5 エラーハンドリング
```typescript
// ✅ Good: カスタムエラークラス
export class CCExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public taskId?: string
  ) {
    super(message);
    this.name = 'CCExecutionError';
  }
}

// ✅ Good: try-catchでのエラーハンドリング
try {
  await executeTask(task);
} catch (error) {
  if (error instanceof CCExecutionError) {
    logger.error(`Task ${error.taskId} failed: ${error.message}`);
  }
  throw error;
}
```

## 4. Git コミットルール

### 4.1 コミットメッセージ形式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### 4.2 タイプ
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット変更
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルド・補助ツール

### 4.3 例
```
feat(dashboard): プロジェクト選択画面を実装

- プロジェクト一覧表示
- 検索・フィルタリング機能
- 新規プロジェクト作成ダイアログ

Closes #123
```

## 5. テストルール

### 5.1 単体テスト
- すべてのユーティリティ関数
- カスタムフック
- ビジネスロジック

### 5.2 統合テスト
- APIエンドポイント
- 重要なユーザーフロー

### 5.3 E2Eテスト
- プロジェクト作成〜タスク実行の基本フロー
- エラーケース

## 6. セキュリティルール

### 6.1 入力検証
- すべてのユーザー入力をzodでバリデーション
- SQLインジェクション対策（Prisma使用）
- パスインジェクション対策

### 6.2 エラー情報
- 本番環境では詳細なエラー情報を返さない
- スタックトレースは開発環境のみ

### 6.3 ログ
- 機密情報をログに含めない
- ログレベルを適切に設定

## 7. パフォーマンスルール

### 7.1 フロントエンド
- 遅延ロード（dynamic import）の活用
- React.memoによる不要な再レンダリング防止
- 画像の最適化

### 7.2 バックエンド
- N+1問題の回避（Prismaのinclude活用）
- 適切なインデックス設定
- キャッシュの活用

## 8. アクセシビリティルール

### 8.1 基本要件
- セマンティックHTMLの使用
- 適切なARIA属性
- キーボードナビゲーション対応

### 8.2 ターミナル
- スクリーンリーダー対応（可能な範囲で）
- 高コントラストモード対応