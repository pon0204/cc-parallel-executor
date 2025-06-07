import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addSampleTasks() {
  const projectId = 'cmbm74nxp0000b9dljybiwfik'; // 既存のプロジェクトID

  const sampleTasks = [
    {
      name: 'UIコンポーネントの改善',
      description: 'ダッシュボードのUIコンポーネントをリファクタリングして、ユーザビリティを向上させる',
      priority: 8,
      taskType: 'development',
      instruction: 'ダッシュボードのUIコンポーネントを分析して、以下の改善を実装してください：\n1. レスポンシブデザインの改善\n2. アクセシビリティの向上\n3. カラーコントラストの最適化\n4. インタラクションの滑らかさの改善',
      status: 'pending'
    },
    {
      name: 'API エラーハンドリング強化',
      description: 'REST APIのエラーハンドリングを改善し、より詳細なエラー情報を提供する',
      priority: 9,
      taskType: 'development',
      instruction: 'APIエラーハンドリングを以下の観点で改善してください：\n1. エラー分類の細分化\n2. ユーザーフレンドリーなエラーメッセージ\n3. ログの構造化と詳細化\n4. エラー復旧の自動化',
      status: 'pending'
    },
    {
      name: 'パフォーマンステスト実装',
      description: 'Claude Code並列実行のパフォーマンステストを作成し、ベンチマークを確立する',
      priority: 7,
      taskType: 'test',
      instruction: '並列実行システムのパフォーマンステストを実装してください：\n1. 同時実行数の限界測定\n2. レスポンス時間の計測\n3. メモリ使用量の監視\n4. ストレステストの実装',
      status: 'pending'
    },
    {
      name: 'ドキュメント更新',
      description: 'アーキテクチャドキュメントとAPIドキュメントを最新状態に更新する',
      priority: 5,
      taskType: 'documentation',
      instruction: 'ドキュメントを以下の内容で更新してください：\n1. 現在の実装状況の反映\n2. APIエンドポイントの詳細説明\n3. 使用例とサンプルコード\n4. トラブルシューティングガイド',
      status: 'pending'
    },
    {
      name: 'セキュリティ監査',
      description: 'アプリケーション全体のセキュリティ監査を実施し、脆弱性を特定・修正する',
      priority: 10,
      taskType: 'development',
      instruction: 'セキュリティ監査を実施してください：\n1. 認証・認可の検証\n2. 入力値検証の確認\n3. SQLインジェクション対策\n4. XSS攻撃対策の実装',
      status: 'pending'
    }
  ];

  try {
    console.log('Adding sample tasks...');
    
    for (const task of sampleTasks) {
      const createdTask = await prisma.task.create({
        data: {
          projectId,
          ...task
        }
      });
      console.log(`✓ Created task: ${createdTask.name} (${createdTask.id})`);
    }

    console.log('\n🎉 Sample tasks added successfully!');
    
    // 作成されたタスクの確認
    const totalTasks = await prisma.task.count({
      where: { projectId }
    });
    
    console.log(`📊 Total tasks in project: ${totalTasks}`);
    
  } catch (error) {
    console.error('❌ Error adding tasks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleTasks();