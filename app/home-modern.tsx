'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Terminal, 
  Rocket, 
  Code2, 
  Zap,
  GitBranch,
  Settings,
  ArrowRight,
  Sparkles,
  Cpu,
  Globe
} from 'lucide-react';

const features = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: "高速実行",
    description: "Bunランタイムによる高速なサーバー起動と実行"
  },
  {
    icon: <GitBranch className="w-6 h-6" />,
    title: "並列処理",
    description: "複数のClaude Codeインスタンスを同時実行"
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: "Webインターフェース",
    description: "ブラウザから簡単にアクセス・操作可能"
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: "API制御",
    description: "REST APIによるプログラマティックな制御"
  }
];

const pages = [
  {
    title: "シングルターミナル",
    description: "基本的なClaude Codeターミナルインターフェース",
    icon: <Terminal className="w-5 h-5" />,
    href: "/terminal",
    color: "from-blue-500 to-cyan-500"
  },
  {
    title: "APIコントロールパネル",
    description: "複数のClaude Codeインスタンスを管理・並列実行",
    icon: <Settings className="w-5 h-5" />,
    href: "/control",
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "並列実行デモ",
    description: "複数のターミナルでタスクを同時実行",
    icon: <Rocket className="w-5 h-5" />,
    href: "/parallel",
    color: "from-green-500 to-emerald-500"
  }
];

export default function HomeModern() {
  return (
    <div className="min-h-screen bg-background">
      {/* ヒーローセクション */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 sm:py-32">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Claude Code Web Terminal
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
              Claude Codeを
              <span className="text-primary"> Webブラウザ</span>
              で実行
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              複数のClaude Codeインスタンスを並列実行し、
              ブラウザから簡単に管理できる革新的なターミナルシステム
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2" asChild>
                <Link href="/control">
                  <Rocket className="w-5 h-5" />
                  コントロールパネルを開く
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <Link href="/terminal">
                  <Terminal className="w-5 h-5" />
                  ターミナルを起動
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 機能セクション */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold">主な機能</h2>
          <p className="text-muted-foreground">
            最新技術を活用した高性能なターミナルシステム
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ページリンクセクション */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold">利用可能なインターフェース</h2>
          <p className="text-muted-foreground">
            用途に応じて最適なインターフェースを選択
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pages.map((page, index) => (
            <Card key={index} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${page.color}`} />
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${page.color} flex items-center justify-center text-white`}>
                    {page.icon}
                  </div>
                  {page.title}
                </CardTitle>
                <CardDescription className="mt-2">
                  {page.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost" 
                  className="gap-2 group-hover:gap-3 transition-all"
                  asChild
                >
                  <Link href={page.href}>
                    アクセス
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 技術スタック */}
      <div className="max-w-7xl mx-auto px-6 py-16 border-t">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold">技術スタック</h2>
          <p className="text-muted-foreground">
            モダンな技術を組み合わせて構築
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-2">
            <div className="text-4xl font-bold text-primary">Next.js 14</div>
            <div className="text-sm text-muted-foreground">フロントエンド</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl font-bold text-primary">Bun</div>
            <div className="text-sm text-muted-foreground">サーバーランタイム</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl font-bold text-primary">xterm.js</div>
            <div className="text-sm text-muted-foreground">ターミナルエミュレータ</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl font-bold text-primary">Socket.IO</div>
            <div className="text-sm text-muted-foreground">リアルタイム通信</div>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="border-t">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Code2 className="w-4 h-4" />
            Claude Code Terminal - Powered by modern web technologies
          </div>
        </div>
      </footer>
    </div>
  );
}