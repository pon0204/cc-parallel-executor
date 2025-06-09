# CC Parallel Executor - Test Suite

このディレクトリには、CC Parallel Executorの包括的なテストスイートが含まれています。

## 🚀 テスト環境

- **Vitest**: 高速で型安全なテストランナー
- **@testing-library/react**: Reactコンポーネントテスト
- **vitest-mock-extended**: 型安全なモック生成
- **@faker-js/faker**: テストデータ生成
- **happy-dom**: 軽量DOM実装
- **supertest**: API統合テスト

## 📁 ディレクトリ構造

```
test/
├── setup/              # テスト環境セットアップ
│   ├── setup.ts        # グローバルセットアップ
│   └── test-env.ts     # 環境変数・モック設定
├── builders/           # テストデータビルダー
│   ├── project.builder.ts
│   ├── task.builder.ts
│   └── requirement.builder.ts
├── mocks/              # モックオブジェクト
│   └── prisma.mock.ts  # Prismaクライアントモック
├── utils/              # テストユーティリティ
│   ├── test-helpers.ts # 汎用ヘルパー関数
│   └── e2e-helpers.ts  # E2Eテストヘルパー
├── fixtures/           # テストフィクスチャ
├── integration/        # 統合テスト
└── snapshots/          # スナップショット

server/
├── services/*.test.ts  # サービス層単体テスト
├── repositories/*.test.ts # リポジトリ層単体テスト
└── api/*.integration.test.ts # API統合テスト
```

## 🏃 テスト実行

### 全テスト実行
```bash
npm test
```

### ウォッチモード（開発時）
```bash
npm run test:watch
```

### UIモード（インタラクティブ）
```bash
npm run test:ui
```

### カバレッジレポート生成
```bash
npm run test:coverage
```

### 特定のテストファイルを実行
```bash
npm test -- server/services/project.service.test.ts
```

### パターンマッチング
```bash
npm test -- --grep "ProjectService"
```

### 単体テストのみ
```bash
npm run test:unit
```

### 統合テストのみ
```bash
npm run test:integration
```

### 型チェック付きテスト
```bash
npm run test:typecheck
```

## 📊 カバレッジ目標

現在の目標カバレッジ率:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

カバレッジレポートは `coverage/` ディレクトリに生成されます。

## 🧪 テストパターン

### 1. 単体テスト（Unit Tests）

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from './project.service';
import { mockDeep } from 'vitest-mock-extended';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepository: IProjectRepository;

  beforeEach(() => {
    mockRepository = mockDeep<IProjectRepository>();
    service = new ProjectService(mockRepository);
  });

  it('should create a project', async () => {
    const project = new ProjectBuilder().build();
    mockRepository.create.mockResolvedValue(project);

    const result = await service.createProject(data);
    
    expect(result).toEqual(project);
  });
});
```

### 2. 統合テスト（Integration Tests）

```typescript
import request from 'supertest';
import { app } from '../server';

describe('Projects API', () => {
  it('should create a project via API', async () => {
    const response = await request(app)
      .post('/api/projects')
      .send({ name: 'Test Project' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: 'Test Project'
    });
  });
});
```

### 3. テストビルダー使用

```typescript
const project = new ProjectBuilder()
  .withName('My Project')
  .withMaxParallelCCs(10)
  .build();

const tasks = new TaskBuilder()
  .withProjectId(project.id)
  .buildMany(5);
```

### 4. カスタムマッチャー

```typescript
// UUID検証
expect(someId).toBeValidUUID();

// 部分オブジェクトマッチ
expect(mockFn).toHaveBeenCalledWithPartial({ name: 'test' });

// スキーマ検証
expect(data).toMatchSchema(zodSchema);
```

## 🎯 ベストプラクティス

1. **Arrange-Act-Assert (AAA) パターン**
   ```typescript
   it('should do something', () => {
     // Arrange
     const input = createTestData();
     
     // Act
     const result = doSomething(input);
     
     // Assert
     expect(result).toBe(expected);
   });
   ```

2. **モックは最小限に**
   - 必要な部分のみモック化
   - 可能な限り実際の実装を使用

3. **テストの独立性**
   - 各テストは独立して実行可能
   - 他のテストに依存しない

4. **明確なテスト名**
   - 何をテストしているか明確に
   - `should` で始まる命名規則

5. **エラーケースもテスト**
   - 正常系だけでなく異常系も
   - エッジケースを網羅

## 🐛 トラブルシューティング

### テストが失敗する場合

1. **環境変数の確認**
   ```bash
   cat .env.test
   ```

2. **データベースのリセット**
   ```bash
   rm prisma/test.db*
   npm run db:push
   ```

3. **キャッシュクリア**
   ```bash
   npm run clean
   rm -rf node_modules/.cache
   ```

4. **詳細ログの確認**
   ```bash
   npm test -- --reporter=verbose
   ```

### パフォーマンステスト

```bash
npm run test:bench
```

ベンチマーク結果は `benchmark-results/` に保存されます。

## 📚 参考リソース

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Mock Service Worker](https://mswjs.io/)
- [Supertest](https://github.com/visionmedia/supertest)