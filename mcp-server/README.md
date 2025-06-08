# Claude Code Parallel MCP Server

Model Context Protocol (MCP) サーバー実装。親Claude Codeから子CCを生成・管理するための並列実行制御システム。

## アーキテクチャ

### STDIO Transport

このMCPサーバーはSTDIOトランスポートを使用してClaude Codeと通信します。

**STDIOモードの特徴**:
- Claude CLIと直接統合
- JSON-RPC 2.0プロトコル準拠
- 標準入出力経由の通信
- セキュアでシンプルな実装

## 使用方法

### 1. サーバー起動

```bash
# 開発モード
bun run dev

# プロダクション
bun run build
bun run start
```

### 2. Claude Codeへの登録

```bash
# STDIO transport
claude mcp add claude-code-parallel "bun /path/to/mcp-server/src/index.ts"
```

### 3. 親CCでの使用例

MCPツールは自動的にClaude Codeに登録され、以下のように使用できます：

- `create_child_cc`: 子CCインスタンスを作成してタスクを並列実行
- `get_available_tasks`: プロジェクトの利用可能なタスクを取得
- `update_task_status`: タスクのステータスを更新

## API仕様

### ツール一覧

1. **create_child_cc**: 子CCインスタンスを作成
   - `parentInstanceId`: 親CCインスタンスID
   - `taskId`: 実行するタスクのID
   - `instruction`: 詳細な指示内容
   - `projectWorkdir`: プロジェクトの作業ディレクトリ

2. **get_available_tasks**: 利用可能なタスクを取得
   - `projectId`: プロジェクトID

3. **update_task_status**: タスクステータスを更新
   - `taskId`: タスクID
   - `status`: 新しいステータス (pending/queued/running/completed/failed)
   - `result`: タスク実行結果（オプション）

## 実装詳細

### プロジェクトサーバーとの連携

MCPサーバーはプロジェクトサーバー（ポート8081）と連携して動作します：

1. タスク情報の取得
2. 子CCインスタンスの作成依頼
3. タスクステータスの更新

### Git Worktree管理

子CCインスタンス作成時に自動的にGit worktreeを作成し、並列実行環境を分離します。

### エラーハンドリング

- JSON-RPC 2.0準拠のエラーレスポンス
- 適切なエラーメッセージの返却
- プロジェクトサーバーエラーの伝播

## 開発者向けメモ

### 環境変数

- `PROJECT_SERVER_URL`: プロジェクトサーバーのURL（デフォルト: http://localhost:8081）

### トラブルシューティング

```bash
# MCPツールが表示されない場合
claude mcp list

# MCPサーバーを再登録
claude mcp remove claude-code-parallel
claude mcp add claude-code-parallel "bun /path/to/mcp-server/src/index.ts"

# ログの確認
# STDIOモードではコンソールエラー出力を確認
```