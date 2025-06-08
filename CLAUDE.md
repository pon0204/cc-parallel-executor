# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際のClaude Code (claude.ai/code)へのガイダンスを提供します。

## プロジェクト概要

**Claude Code Terminal** (claude-code-terminal)は、Model Context Protocol (MCP) + STDIO Transportによる革命的なClaude Code並列実行システムです。親子Claude Code階層管理とリアルタイム通信を実現する次世代プラットフォームです。

## 一般的なコマンド

```bash
# 全ての依存関係のインストール（メインプロジェクト + MCPサーバー）
npm run install:all

# 開発モード（3つのサーバーを同時起動）
npm run dev
# または個別に:
npm run dev:next    # Next.js フロントエンド (:8080)
npm run dev:server  # プロジェクトサーバー (:8081)
npm run dev:mcp     # MCPサーバー (:8082)

# プロダクションビルド（全コンポーネント）
npm run build

# プロダクション起動（全サーバー同時）
npm run start

# データベース関連
npm run db:generate  # Prismaクライアント生成
npm run db:push      # スキーマをデータベースにプッシュ
npm run db:seed      # サンプルデータ投入

# 開発ツール
npm run lint         # ESLint実行
npm run format       # Prettier実行
npm run test         # テスト実行
npm run clean        # ビルドファイル削除
```

**重要**: このプロジェクトはNode.js必須です。node-ptyがBunと互換性がないため、必ずNode.js (18以上推奨) を使用してください。

## プロジェクト構造

```
claude-code-terminal/
├── app/                    # Next.js App Routerページ（ポート8080）
│   ├── page.tsx           # ダッシュボードへのリダイレクト
│   ├── dashboard/         # プロジェクト管理ダッシュボード
│   ├── terminal/          # インタラクティブウェブターミナル
│   ├── control/           # APIコントロールインターフェース
│   ├── parallel/          # 並列実行管理
│   ├── test-terminal/     # ターミナルテストページ
│   └── api/               # Next.js APIルートプロキシ
├── components/            # 共有UIコンポーネント（shadcn/ui + Radix UI）
│   ├── dashboard/         # ダッシュボード関連コンポーネント
│   ├── terminal/          # ターミナル関連コンポーネント
│   └── ui/                # shadcn/ui基盤コンポーネント
├── server/                # プロジェクトサーバー（ポート8081）
│   ├── index.ts           # Express + Socket.IO メインサーバー
│   ├── api/               # REST APIルート
│   ├── services/          # ビジネスロジック（Terminal, CC, Worktree）
│   └── utils/             # ユーティリティ（Logger, Prisma, Validation）
├── mcp-server/            # MCPサーバー（ポート8082）
│   ├── src/
│   │   ├── index.ts       # MCPサーバーエントリーポイント
│   │   ├── streamable-server.ts  # Streamable HTTP + SSE実装
│   │   ├── tools/child-cc.ts     # 子CC管理ツール
│   │   └── types.ts       # MCP関連型定義
│   └── package.json       # MCP専用依存関係
├── prisma/                # データベース（SQLite）
│   └── schema.prisma      # MCP対応完全スキーマ
├── lib/                   # 共有ライブラリ
│   ├── api/client.ts      # APIクライアント
│   ├── hooks/             # カスタムReactフック
│   ├── stores/            # Zustand状態管理
│   └── providers.tsx      # React Query等プロバイダー
├── docs/                  # 詳細アーキテクチャドキュメント
└── scripts/               # ユーティリティスクリプト
```

## ハイレベルアーキテクチャ

### 革命的3サーバーアーキテクチャ

1. **フロントエンド（Next.js 14 - ポート8080）**

   - App Router + TypeScript + Tailwind CSS
   - shadcn/ui + Radix UI コンポーネントライブラリ
   - xterm.js ターミナルエミュレーション
   - Socket.IO + React Query によるリアルタイム通信
   - Zustand状態管理
   - ダッシュボード、ターミナル、並列実行管理UI

2. **プロジェクトサーバー（Express + Socket.IO - ポート8081）**

   - **TerminalService**: WebSocket経由のターミナルI/O
   - **CCService**: Claude Code インスタンス管理
   - **WorktreeService**: Git worktree による並列実行環境
   - **Prisma ORM**: SQLite データベース管理
   - **Winston Logger**: 構造化ログ出力

3. **MCPサーバー（STDIO Transport）**
   - **Model Context Protocol**: 並列実行制御の中央司令塔
   - **STDIO Transport**: Claude CLIとの直接統合
   - **JSON-RPC 2.0**: 標準準拠の通信プロトコル
   - **Child CC Manager**: 子CCインスタンス生成・管理
   - **ultrathinkプロトコル**: 確実な親子CC間指示伝達

### MCP並列実行フロー

1. **親CC**: MCPサーバーのツールが自動的に使用可能
2. **MCPサーバー**: Git worktree作成 + 子CCプロセス起動
3. **子CC**: ultrathinkキーワード検出でタスク実行モード移行
4. **WebSocket通信**: リアルタイム進捗更新をフロントエンドに配信

### 主要ページ

- **`/`** - ダッシュボードへの自動リダイレクト
- **`/dashboard`** - プロジェクト管理メインダッシュボード
- **`/dashboard/[projectId]`** - プロジェクト詳細・タスク管理
- **`/terminal`** - 直接CC対話用インタラクティブターミナル
- **`/control`** - カスタムプロンプト付きAPIベースCCコントロール
- **`/parallel`** - 複数のCCインスタンス並列管理
- **`/test-terminal`** - ターミナル機能テスト用ページ

## 主要なアーキテクチャ決定事項

1. **革命的3サーバー分離アーキテクチャ**

   - フロントエンド（8080）、プロジェクトサーバー（8081）、MCPサーバー（STDIO）
   - 各サーバーが独立して動作し、専門領域に特化
   - concurrentlyによる統合開発ワークフロー

2. **Model Context Protocol (MCP) 統合**

   - JSON-RPC 2.0準拠のSTDIO通信
   - `create_child_cc`、`get_available_tasks`、`update_task_status` ツール
   - Claude CLIとの直接統合

3. **完全型安全なデータベース設計**

   - Prisma ORM + SQLite による完全型安全性
   - MCPセッション、CCインスタンス、ultrathinkメッセージの完全追跡
   - Git worktree管理による並列実行環境の隔離

4. **ultrathinkプロトコル実装**

   - 親CCから子CCへの確実な指示伝達メカニズム
   - キーワード検出による自動タスク実行モード移行
   - 階層的CC管理とリアルタイム通信

5. **Git Worktree による並列実行環境**
   - タスクごとの完全隔離された実行環境
   - 自動worktree作成・削除・プルーニング
   - 複数ブランチでの同時作業サポート

## 重要な技術仕様

### MCPツール詳細

**create_child_cc**

```typescript
interface ChildCCOptions {
  parentInstanceId: string; // 親CCインスタンスID
  taskId: string; // 実行タスクID
  instruction: string; // 詳細指示
  projectWorkdir: string; // プロジェクト作業ディレクトリ
}
```

**get_available_tasks** - プロジェクトの利用可能タスク取得
**update_task_status** - タスクステータス更新

### 主要APIエンドポイント

**プロジェクトサーバー（:8081）**

```
GET  /api/projects           - プロジェクト一覧
POST /api/projects           - プロジェクト作成
GET  /api/projects/:id/tasks - プロジェクトタスク一覧
POST /api/cc/child           - 子CC作成
PATCH /api/tasks/:id/status  - タスクステータス更新
```

**MCPサーバー（STDIO）**

```
# Claude CLIに登録することで自動的にツールが使用可能
claude mcp add claude-code-parallel "bun /path/to/mcp-server/src/index.ts"
```

### ultrathinkプロトコル詳細

親CCから子CCへの指示伝達フォーマット：

```
ultrathink

タスク実行指示:

タスクID: ${taskId}
親CCインスタンス: ${parentInstanceId}

作業指示:
${instruction}

このworktreeで独立してタスクを実行し、完了後は結果を報告してください。
```

### データベーススキーマ要点

- **Project**: Git リポジトリ、並列CC数制限
- **Task**: 階層的タスク、依存関係、ultrathinkプロトコル対応
- **CCInstance**: 親子関係、worktree管理
- **UltrathinkMessage**: 親子CC間通信ログ、実行状況追跡
- **GitWorktree**: 並列実行環境の完全追跡

## 開発ワークフロー

### 1. 環境設定

```bash
# 1. 依存関係インストール
npm run install:all

# 2. 環境変数設定
cp .env.example .env
# .envを編集して適切な設定を行う

# 3. データベース初期化
npm run db:generate
npm run db:push
npm run db:seed  # オプション：サンプルデータ投入
```

### 2. 開発サーバー起動

**統合起動（推奨）**

```bash
npm run dev  # 3つのサーバーを同時起動
```

**個別起動（デバッグ用）**

```bash
# ターミナル1: Next.jsフロントエンド
npm run dev:next

# ターミナル2: プロジェクトサーバー
npm run dev:server

# ターミナル3: MCPサーバー（Bunで実行可能）
cd mcp-server && bun run dev
```

### 3. 前提条件

- **Node.js 18+**: 必須（node-ptyとの互換性のため）
- **npm**: Node.jsパッケージマネージャー
- **Git**: worktree機能が必要
- **Claude CLI**: 子CCインスタンス起動用
- **SQLite**: データベース（組み込み）
- **C++コンパイラ**: node-ptyのネイティブビルドに必要（macOSは通常Xcode Command Line Tools、Linuxはbuild-essential）

### 4. ポート構成（高番号ポート採用）

- **8080**: Next.js フロントエンド
- **8081**: プロジェクトサーバー（Express + Socket.IO）
- **MCPサーバー**: STDIOモード（ポート不要）

## トラブルシューティング

### 1. 起動関連問題

**ポート競合エラー**

```bash
# ポート使用状況確認
lsof -i :8080  # Next.js
lsof -i :8081  # プロジェクトサーバー
# MCPサーバーはSTDIOモードのためポート不要

# 強制終了
kill -9 <PID>
```

**node-ptyのビルドエラー**

```bash
# macOS: Xcode Command Line Toolsをインストール
xcode-select --install

# Linux: build-essentialをインストール
sudo apt-get install build-essential

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
```

### 2. データベース関連問題

**Prismaクライアント不整合**

```bash
npm run db:generate  # クライアント再生成
rm -rf node_modules/.cache  # キャッシュクリア
```

**データベースリセット**

```bash
rm prisma/dev.db*  # データベース削除
npm run db:push    # スキーマ再適用
```

### 3. MCP接続問題

**MCPサーバー接続失敗**

```bash
# MCPサーバー登録確認
claude mcp list

# 再登録
claude mcp remove claude-code-parallel
claude mcp add claude-code-parallel "bun /path/to/mcp-server/src/index.ts"
```

## ベストプラクティス

### 1. 開発規約

**型安全性の徹底**

- すべての新しいコードでTypeScriptを活用
- `@typescript-eslint/no-explicit-any` ルールを厳守
- Prismaによる完全型安全なデータベースアクセス

**コンポーネント設計**

- `/components/ui`から既存のshadcn/uiコンポーネントを使用
- Radix UI プリミティブによる一貫したUI体験
- Tailwind CSSクラスを使用、インラインスタイルは避ける

**状態管理**

- React Query による効率的なサーバー状態管理
- Zustand による軽量なクライアント状態管理
- Socket.IO リアルタイム更新との適切な統合

### 2. アーキテクチャ規約

**マイクロサービス間通信**

- 親CC ↔ MCPサーバー: STDIO
- プロジェクトサーバー ↔ MCPサーバー: REST API
- フロントエンド ↔ プロジェクトサーバー: Socket.IO + HTTP

**エラーハンドリング**

- Winston ログによる構造化エラー記録
- 適切なHTTPステータスコードの使用
- ユーザー向けエラーメッセージの標準化

**セキュリティ**

- CORS設定の適切な管理
- 環境変数による機密情報管理
- Git worktree による実行環境隔離

## 主要技術スタック詳細

### フロントエンド

- **Next.js 14**: App Router, TypeScript, React 18
- **shadcn/ui**: Radix UI + Tailwind CSS コンポーネント
- **xterm.js**: ターミナルエミュレーション + アドオン
- **Socket.IO Client**: リアルタイム通信
- **React Query**: サーバー状態管理 + キャッシュ
- **Zustand**: 軽量クライアント状態管理
- **React Hook Form**: フォーム管理 + バリデーション

### バックエンド

- **Node.js**: JavaScript実行環境（必須）
- **Express.js**: HTTP サーバーフレームワーク
- **Socket.IO**: WebSocket 通信
- **node-pty**: 完全なPTY（疑似端末）サポート（Claude Code必須）
- **Prisma ORM**: 型安全データベースアクセス
- **Winston**: 構造化ログ出力
- **execa**: 子プロセス実行ラッパー
- **CORS**: クロスオリジン制御
- **tsx**: TypeScript実行環境（開発用）

### MCP関連

- **@modelcontextprotocol/sdk**: 公式MCPサーバーSDK
- **JSON-RPC 2.0**: プロトコル準拠通信
- **STDIO Transport**: Claude CLIとの直接統合
- **execa**: 子プロセス実行

### 開発ツール

- **Bun**: 高速JavaScript/TypeScriptランタイム
- **ESLint**: TypeScript対応リンター
- **Prettier**: コードフォーマッター
- **Husky**: Gitフック管理
- **lint-staged**: ステージファイル自動整形
- **Concurrently**: 複数プロセス並列実行

## 重要な設定ファイル

### TypeScript設定

- **tsconfig.json**: フロントエンド用設定
- **tsconfig.server.json**: サーバー用設定（別ディレクトリ構成）

### 品質管理

- **.eslintrc.json**: 厳格な型安全ルール設定
- **.prettierrc**: 一貫したフォーマット設定
- **lint-staged**: 自動品質チェック

### Next.js設定

- **next.config.js**: React Strict Mode無効（xterm互換性）
- **reactStrictMode: false** でxterm.jsとの競合回避

## プロダクションデプロイ考慮事項

### 環境変数

- `NODE_ENV=production`
- 各サーバーポートの適切な設定
- Claude CLIパスの環境適応
- ログレベル調整

### パフォーマンス最適化

- Next.js 静的生成の活用
- Socket.IO 接続プーリング
- Git worktree 自動クリーンアップ
- データベース接続プール管理

## Claude Code Instance向け重要メモ

- **3サーバーアーキテクチャ**: 必ず全サーバーが起動していることを確認
- **MCPプロトコル**: 子CC作成は必ずMCPサーバー経由で実行
- **ultrathinkキーワード**: 子CCとの通信には必須
- **Git worktree**: 並列実行環境の適切な理解が重要
- **型安全性**: Prismaスキーマとの整合性を常に保つ
- **ログ確認**: Winstonログで詳細な実行状況を追跡可能

## MCPサーバー設定

### 初回セットアップ

```bash
# 1. MCPサーバーをビルド
cd mcp-server && npm run build

# 2. Claude CodeにMCPサーバーを登録
# MCPサーバーはBunで実行可能
claude mcp add claude-code-parallel "bun /path/to/mcp-server/src/index.ts"

# 3. 登録確認
claude mcp list
```

### MCPツール使用方法

親Claude Codeインスタンスで以下のツールが利用可能:

- **create_child_cc**: 子CCインスタンスを作成してタスクを並列実行
- **get_available_tasks**: プロジェクトの利用可能なタスクを取得
- **update_task_status**: タスクのステータスを更新

### トラブルシューティング

```bash
# MCP登録の削除と再登録
claude mcp remove claude-code-parallel
claude mcp add claude-code-parallel "bun /path/to/mcp-server/src/index.ts"

# MCPログの確認
ls -la ~/Library/Caches/claude-cli-nodejs/*/mcp-logs-claude-code-parallel/
```
