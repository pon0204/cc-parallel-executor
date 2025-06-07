# CC並列実行システム データベース設計

## 1. データベース概要

CC並列実行システムでは、SQLiteを使用してローカル環境でデータを管理します。

## 2. ER図

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   projects      │     │   tasks         │     │   task_logs     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │1   *│ id (PK)         │1   *│ id (PK)         │
│ name            ├─────┤ project_id (FK) ├─────┤ task_id (FK)    │
│ description     │     │ parent_task_id  │     │ cc_instance_id  │
│ workdir         │     │ name            │     │ log_level       │
│ created_at      │     │ description     │     │ message         │
│ updated_at      │     │ status          │     │ created_at      │
│ status          │     │ priority        │     └─────────────────┘
│ config_json     │     │ assigned_to     │
└─────────────────┘     │
                        │ task_type       │
                        │ input_data      │     ┌─────────────────┐
                        │ output_data     │     │ cc_instances    │
                        │ created_at      │     ├─────────────────┤
                        │ updated_at      │     │ id (PK)         │
                        │ started_at      │*   1│ name            │
                        │ completed_at    ├─────┤ type            │
                        └─────────────────┘     │ status          │
                                               │ created_at      │
┌─────────────────┐     ┌─────────────────┐     │ last_heartbeat  │
│ requirements    │     │ features        │     └─────────────────┘
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ project_id (FK) │     │ project_id (FK) │
│ type            │     │ name            │
│ title           │     │ description     │
│ content         │     │ priority        │
│ created_at      │     │ status          │
│ updated_at      │     │ created_at      │
└─────────────────┘     │ updated_at      │
                        └─────────────────┘
```

## 3. テーブル定義

### 3.1 projects（プロジェクト）

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | INTEGER | PRIMARY KEY | プロジェクトID |
| name | VARCHAR(255) | NOT NULL | プロジェクト名 |
| description | TEXT | | プロジェクト説明 |
| workdir | VARCHAR(500) | NOT NULL | 作業ディレクトリパス（CC起動場所） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |
| status | VARCHAR(50) | NOT NULL | ステータス（active/inactive/completed） |
| config_json | TEXT | | プロジェクト設定（JSON） |

### 3.2 tasks（タスク）

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | INTEGER | PRIMARY KEY | タスクID |
| project_id | INTEGER | FOREIGN KEY | プロジェクトID |
| parent_task_id | INTEGER | FOREIGN KEY | 親タスクID |
| name | VARCHAR(255) | NOT NULL | タスク名 |
| description | TEXT | | タスク説明 |
| status | VARCHAR(50) | NOT NULL | ステータス |
| priority | INTEGER | NOT NULL | 優先度（1-10） |
| assigned_to | INTEGER | FOREIGN KEY | 割り当てCC ID |
| task_type | VARCHAR(50) | NOT NULL | タスクタイプ |
| input_data | TEXT | | 入力データ（JSON） |
| output_data | TEXT | | 出力データ（JSON） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |
| started_at | TIMESTAMP | | 開始日時 |
| completed_at | TIMESTAMP | | 完了日時 |

### 3.3 cc_instances（CCインスタンス）

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | INTEGER | PRIMARY KEY | インスタンスID |
| name | VARCHAR(255) | NOT NULL | インスタンス名 |
| type | VARCHAR(50) | NOT NULL | タイプ（parent/child） |
| status | VARCHAR(50) | NOT NULL | ステータス |
| worktree_path | VARCHAR(500) | | worktreeパス（子CCの場合） |
| parent_instance_id | INTEGER | FOREIGN KEY | 親CCインスタンスID |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| last_heartbeat | TIMESTAMP | | 最終生存確認日時 |

### 3.4 task_logs（タスクログ）

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | INTEGER | PRIMARY KEY | ログID |
| task_id | INTEGER | FOREIGN KEY | タスクID |
| cc_instance_id | INTEGER | FOREIGN KEY | CCインスタンスID |
| log_level | VARCHAR(20) | NOT NULL | ログレベル |
| message | TEXT | NOT NULL | ログメッセージ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### 3.5 requirements（要件定義）

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | INTEGER | PRIMARY KEY | 要件ID |
| project_id | INTEGER | FOREIGN KEY | プロジェクトID |
| type | VARCHAR(50) | NOT NULL | 要件タイプ |
| title | VARCHAR(255) | NOT NULL | 要件タイトル |
| content | TEXT | NOT NULL | 要件内容 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### 3.6 features（機能要件）

| カラム名 | データ型 | 制約 | 説明 |
|---------|---------|------|------|
| id | INTEGER | PRIMARY KEY | 機能ID |
| project_id | INTEGER | FOREIGN KEY | プロジェクトID |
| name | VARCHAR(255) | NOT NULL | 機能名 |
| description | TEXT | | 機能説明 |
| priority | INTEGER | NOT NULL | 優先度 |
| status | VARCHAR(50) | NOT NULL | ステータス |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

## 4. インデックス設計

```sql
-- projects
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- tasks
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- task_logs
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_cc_instance_id ON task_logs(cc_instance_id);
CREATE INDEX idx_task_logs_created_at ON task_logs(created_at);

-- requirements
CREATE INDEX idx_requirements_project_id ON requirements(project_id);

-- features
CREATE INDEX idx_features_project_id ON features(project_id);
CREATE INDEX idx_features_status ON features(status);
```

## 5. データモデルの特徴

- **階層構造**: タスクは親子関係を持つことができる
- **JSON形式**: 柔軟なデータ構造のためconfig、input_data、output_dataはJSON形式で保存
- **監査証跡**: created_at、updated_atで変更履歴を追跡
- **ステータス管理**: 各エンティティで状態遷移を管理

## 6. パフォーマンス考慮事項

- 適切なインデックスによるクエリ最適化
- JSON データの適切なサイズ管理
- 定期的なVACUUM実行によるデータベース最適化
- ログデータの定期的なアーカイブ