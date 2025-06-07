# Claude Code Terminal

Claude Code (CC) の並列実行とタスク管理を実現するWebアプリケーション

## 概要

このプロジェクトは、Claude Codeを親子関係で管理し、複数のタスクを並列実行できるWebベースのオーケストレーションシステムです。プロジェクトの要件定義からタスク管理、実行、進捗監視まで一元的に管理できます。

### 主な機能

- 🖥️ **Webターミナル**: ブラウザから直接Claude Codeを操作
- 📋 **プロジェクト管理**: 要件定義、機能要件、データベース設計を統合管理
- 🚀 **タスク並列実行**: 親CCが子CCを起動し、タスクを並列処理
- 📊 **ダッシュボード**: タスクの進捗状況をリアルタイムで監視
- 🔗 **タスク依存関係**: タスク間の依存関係を定義し、適切な順序で実行
- 🎌 **日本語対応**: 完全な日本語UI

## 技術スタック

- **フロントエンド**: 
  - Next.js 14 (App Router)
  - TypeScript
  - Tailwind CSS v3
  - shadcn/ui コンポーネント
  - xterm.js (ターミナルエミュレーション)
  
- **バックエンド**:
  - Node.js + Express
  - Socket.IO (リアルタイム通信)
  - unbuffer (PTYエミュレーション)

## セットアップ

### 前提条件

- Node.js 18以上
- expect/unbuffer (PTY用)
  ```bash
  # macOS
  brew install expect
  
  # Ubuntu/Debian
  sudo apt-get install expect
  ```

### インストール

```bash
# 依存関係のインストール
npm install
```

## システムアーキテクチャ

### 親子CC構成
- **親CC**: タスクマネージャーとして機能し、タスクの分配と進捗管理を担当
- **子CC**: 実際のタスクを実行するワーカーインスタンス（デフォルト最大5並列）

### タスク管理
- YAMLファイルでタスク定義と依存関係を管理
- 要件定義、機能要件、DBスキーマと紐づけて管理
- 優先度と依存関係に基づく自動スケジューリング

## 起動方法

### 開発環境

```bash
# ターミナル1: APIサーバー起動（ポート3001）
node server-api.js

# ターミナル2: ターミナルサーバー起動（ポート3001）
npm run server

# ターミナル3: Next.js開発サーバー起動（ポート3000）
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

## 各ページの説明

### 1. ホーム (`/`)
アプリケーションの概要と各機能へのナビゲーション

### 2. ターミナル (`/terminal`)
- インタラクティブなWebターミナル
- Claude Codeを直接操作可能
- リアルタイムの入出力表示

### 3. APIコントロール (`/control`)
- REST API経由でClaude Codeを制御
- カスタムプロンプトの実行
- セッション管理とモニタリング

### 4. 並列実行 (`/parallel`)
- 複数のClaude Codeインスタンスを同時管理
- ターミナルセッションの切り替え
- リアルタイムステータス監視

## API仕様

### プロジェクト作成
```bash
POST /api/projects
Content-Type: application/json

{
  "name": "ECサイト開発",
  "description": "新規ECサイトの構築",
  "workdir": "/path/to/project"
}
```

### タスク登録
```bash
POST /api/projects/:projectId/tasks
Content-Type: multipart/form-data

tasks: task-definition.yaml (ファイル)
```

### 親CC起動
```bash
POST /api/parent-cc/start
Content-Type: application/json

{
  "projectId": "proj_123",
  "maxParallel": 5
}
```

### 子CC制御
```bash
POST /api/child-cc/spawn
Content-Type: application/json

{
  "parentId": "parent_123",
  "taskId": "task_456",
  "context": { ... }
}
```

### タスク進捗取得
```bash
GET /api/tasks/:taskId/progress
```

## タスク定義例

```yaml
project:
  id: "ecommerce_project"
  name: "ECサイト開発"
  
tasks:
  - id: "db_design"
    name: "データベース設計"
    type: "database"
    priority: "high"
    requirements: ["req_001", "req_002"]
    
  - id: "auth_api"
    name: "認証API実装"
    type: "backend"
    priority: "high"
    depends_on: ["db_design"]
    estimated_hours: 4
    
  - id: "product_list_ui"
    name: "商品一覧画面"
    type: "frontend"
    priority: "medium"
    depends_on: []
    estimated_hours: 3
```

## プロジェクト構造

```
claude-code-terminal/
├── app/                    # Next.js App Router
│   ├── page.tsx           # ホームページ
│   ├── terminal/          # ターミナルページ
│   ├── control/           # APIコントロールページ
│   ├── parallel/          # 並列実行ページ
│   └── api/               # APIプロキシ
├── components/            # 共有UIコンポーネント (shadcn/ui)
├── docs/                  # アーキテクチャドキュメント
│   ├── requirements.md    # 要件定義
│   ├── architecture.md    # システム設計
│   ├── database-design.md # DB設計
│   └── task-structure.yaml # タスク定義サンプル
├── lib/                   # ユーティリティ関数
├── server-simple.js       # WebSocketターミナルサーバー
├── server-api.js         # REST APIサーバー
└── CLAUDE.md             # Claude Code用ガイド
```

## トラブルシューティング

### unbufferが見つからない
expectパッケージをインストールしてください。

### APIサーバーに接続できない
ポート3001でserver-api.jsが起動していることを確認してください。

### ターミナルが表示されない
ポート3001でserver-simple.jsが起動していることを確認してください。

## 実装状況

### Phase 1: 基本機能 ✅ 完了
- [x] Webターミナル基盤
- [x] ドキュメント整備
- [x] プロジェクト管理機能
- [x] タスク定義構造の実装

### Phase 2: コア機能 ✅ 完了
- [x] サーバー側TypeScript移行
- [x] 親CC起動・制御機能
- [x] 子CC自動起動（worktree対応）
- [x] タスク配分エンジン
- [x] ultrathinkプロトコル実装

### Phase 3: UI/UX ✅ 完了
- [x] プロジェクトダッシュボード
- [x] ターミナルタブ管理
- [x] 並列実行画面（タブ/分割表示）
- [x] タスクアップロード機能

## 使い方

### 1. プロジェクトを作成
1. ダッシュボードで「新規プロジェクト」をクリック
2. プロジェクト名と作業ディレクトリを入力
3. 作成されたプロジェクトをクリック

### 2. タスクを定義
1. プロジェクトダッシュボードで「タスク定義をアップロード」
2. YAML形式でタスクを定義（`docs/task-structure.yaml`参照）
3. アップロード

### 3. 親CCを起動
1. 「親CCを起動」ボタンをクリック
2. ターミナルタブでClaude Codeが起動
3. 親CCと対話してタスクを選択

### 4. 並列実行
1. 親CCが子CCを起動（ultrathinkプロトコル使用）
2. 各子CCがworktreeで独立して作業
3. タブまたは分割表示で進捗確認

## ライセンス

このプロジェクトはプライベートプロジェクトです。