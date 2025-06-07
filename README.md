# Claude Code Terminal

WebブラウザでClaude Codeを実行できるターミナルアプリケーション

## 技術スタック

- **フロントエンド**: Next.js 14, xterm.js, Socket.IO Client
- **バックエンド**: Bun + Express + Socket.IO + unbuffer (PTY)

## セットアップ

1. 依存関係のインストール
```bash
npm install
```

2. Bunのインストール（サーバー用）
```bash
curl -fsSL https://bun.sh/install | bash
```

3. expectパッケージのインストール（unbuffer用）
```bash
brew install expect
```

## 起動方法

### Bunでサーバーを起動（推奨）
```bash
~/.bun/bin/bun start-all-bun.js
```

### または個別に起動
```bash
# Terminal 1: Bunでサーバー起動
~/.bun/bin/bun server-unbuffer-bun.js

# Terminal 2: Next.js起動
npm run dev
```

## 使い方

1. http://localhost:3000 にアクセス
2. ターミナルが表示されたら、通常のコマンドを実行可能
3. "Launch Claude Code"ボタンをクリックするか、`claude`と入力してClaude Codeを起動

## なぜBunを使うのか？

- **高速な起動**: Node.jsより高速にサーバーが起動
- **低メモリ使用量**: 効率的なメモリ管理
- **ネイティブTypeScriptサポート**: トランスパイル不要

## アーキテクチャ

```
ブラウザ (xterm.js)
    ↕️ WebSocket
Bun Server (Socket.IO)
    ↕️ stdin/stdout
unbuffer → bash → claude
```

unbufferを使用することで、Claude Codeのような対話型プログラムが正常に動作します。