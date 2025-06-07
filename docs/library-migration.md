# ライブラリ整理・移行ガイド

## 概要

プロジェクトのライブラリを整理し、フロントエンドとバックエンドを明確に分離しました。

## 主な変更点

### 1. 削除したライブラリ
- **重複していたxterm関連**
  - `xterm` → `@xterm/xterm`に統一
  - `xterm-addon-fit` → `@xterm/addon-fit`に統一
  - `xterm-addon-attach` → 削除（使用していない）

### 2. 追加したライブラリ

#### フロントエンド
- **zustand**: 状態管理（Redux Toolkitより軽量）
- **@tanstack/react-query**: APIデータ取得・キャッシュ管理
- **react-hook-form**: フォーム管理
- **zod**: バリデーション

#### バックエンド
- **Prisma + SQLite**: データベースORM
- **node-pty**: 適切なPTYエミュレーション
- **winston**: ロギング
- **execa**: プロセス管理
- **cors**: CORS設定

#### 開発ツール
- **ESLint + Prettier**: コード品質管理
- **tsx**: TypeScript実行環境
- **concurrently**: 並列プロセス実行
- **husky + lint-staged**: Git hooks

### 3. ディレクトリ構造の変更

```
旧構造:
- server-simple.js
- server-api.js
- server-*.js (複数の実験的ファイル)

新構造:
server/
├── index.ts          # エントリーポイント
├── api/              # APIエンドポイント
├── services/         # ビジネスロジック
├── models/           # データモデル
└── utils/            # ユーティリティ
```

## 移行手順

### 1. パッケージの更新
```bash
# 既存のnode_modulesを削除
rm -rf node_modules package-lock.json

# package.jsonを新しいものに置き換え
mv package-new.json package.json

# 依存関係をインストール
npm install
```

### 2. データベースのセットアップ
```bash
# .envファイルを作成
cp .env.example .env

# Prismaクライアントを生成
npm run db:generate

# データベースを作成
npm run db:push
```

### 3. サーバーコードの移行

既存のサーバーファイルは`old/`ディレクトリに移動し、新しい構造で再実装します。

### 4. フロントエンドの更新

#### 状態管理の移行
```typescript
// 旧: Contextや独自の状態管理
// 新: Zustand
import { create } from 'zustand';

export const useProjectStore = create((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
}));
```

#### API通信の移行
```typescript
// 旧: fetch直接使用
// 新: React Query
import { useQuery } from '@tanstack/react-query';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then(res => res.json()),
  });
};
```

## 注意事項

1. **型安全性**: すべての新しいコードはTypeScriptで記述し、any型の使用を避ける
2. **エラーハンドリング**: zodによるバリデーションを全API通信に適用
3. **ログ**: winstonを使用した構造化ログの実装
4. **テスト**: 新しい機能にはテストを追加

## 今後の作業

1. 既存のサーバーコードをTypeScriptに移行
2. Prismaスキーマに基づくデータベース構築
3. API エンドポイントの実装
4. フロントエンドコンポーネントの更新