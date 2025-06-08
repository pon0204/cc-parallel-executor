'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Requirement } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AlertCircle, Clock, FileText, Pencil, Trash2 } from 'lucide-react';

interface RequirementCardProps {
  requirement: Requirement;
  onEdit?: (requirement: Requirement) => void;
  onDelete?: (requirementId: string) => void;
}

export function RequirementCard({ requirement, onEdit, onDelete }: RequirementCardProps) {
  const priorityColor =
    {
      1: 'bg-red-500/10 text-red-500 border-red-500/20',
      2: 'bg-red-500/10 text-red-500 border-red-500/20',
      3: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      4: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      5: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      6: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      7: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      8: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      9: 'bg-green-500/10 text-green-500 border-green-500/20',
      10: 'bg-green-500/10 text-green-500 border-green-500/20',
    }[requirement.priority] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  const statusColor =
    {
      draft: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      review: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      approved: 'bg-green-500/10 text-green-500 border-green-500/20',
      implemented: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    }[requirement.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  const statusLabel =
    {
      draft: 'ドラフト',
      review: 'レビュー中',
      approved: '承認済み',
      implemented: '実装済み',
      rejected: '却下',
    }[requirement.status] || requirement.status;

  const typeLabel =
    {
      functional: '機能要件',
      non_functional: '非機能要件',
      business: 'ビジネス要件',
      technical: '技術要件',
      ui_ux: 'UI/UX要件',
      security: 'セキュリティ要件',
      performance: 'パフォーマンス要件',
    }[requirement.type] || requirement.type;

  return (
    <Card className="hover:shadow-lg transition-all duration-200 group">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {requirement.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusColor}>
                {statusLabel}
              </Badge>
              <Badge variant="outline">{typeLabel}</Badge>
              <Badge variant="outline" className={priorityColor}>
                <AlertCircle className="h-3 w-3 mr-1" />P{requirement.priority}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <CardDescription className="line-clamp-3">{requirement.content}</CardDescription>

        {/* Last updated */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
          <Clock className="h-3 w-3" />
          <span>
            {formatDistanceToNow(new Date(requirement.updatedAt), {
              addSuffix: true,
              locale: ja,
            })}
          </span>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(requirement)}
            className="flex-1"
          >
            <Pencil className="h-4 w-4 mr-2" />
            編集
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(requirement.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
