'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Task } from '@/lib/api/client';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  ArrowUpDown,
  Bot,
  CheckCircle,
  Clock,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

interface TaskTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onExecute: (taskId: string) => void;
}

export function TaskTable({ tasks, onEdit, onDelete, onStatusChange, onExecute }: TaskTableProps) {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            タスク名
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
    },
    {
      accessorKey: 'status',
      header: 'ステータス',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const statusLabel =
          {
            pending: '待機中',
            queued: 'キュー中',
            running: '実行中',
            completed: '完了',
            failed: '失敗',
          }[status.toLowerCase()] || status;

        const statusColor =
          {
            pending: 'bg-gray-500/10 text-gray-500',
            queued: 'bg-yellow-500/10 text-yellow-500',
            running: 'bg-blue-500/10 text-blue-500',
            completed: 'bg-green-500/10 text-green-500',
            failed: 'bg-red-500/10 text-red-500',
          }[status.toLowerCase()] || 'bg-gray-500/10 text-gray-500';

        return (
          <Badge className={statusColor} variant="secondary">
            {statusLabel}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'taskType',
      header: 'タイプ',
      cell: ({ row }) => {
        const typeLabel =
          {
            general: '一般',
            development: '開発',
            testing: 'テスト',
            documentation: 'ドキュメント',
            review: 'レビュー',
            deployment: 'デプロイ',
            maintenance: 'メンテナンス',
            research: '調査',
          }[row.getValue('taskType') as string] || row.getValue('taskType');

        return <Badge variant="outline">{typeLabel}</Badge>;
      },
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            優先度
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const priority = row.getValue('priority') as number;
        const priorityColor =
          priority <= 3 ? 'text-red-500' : priority <= 7 ? 'text-yellow-500' : 'text-green-500';
        return <div className={`font-medium ${priorityColor}`}>P{priority}</div>;
      },
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            更新日時
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(row.getValue('updatedAt')), {
              addSuffix: true,
              locale: ja,
            })}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'アクション',
      cell: ({ row }) => {
        const task = row.original;
        const canExecute = ['pending', 'PENDING'].includes(task.status) && task.instruction;
        const canStart = ['pending', 'PENDING'].includes(task.status);
        const canComplete = ['running', 'RUNNING'].includes(task.status);

        return (
          <div className="flex items-center gap-2">
            {canExecute && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onExecute(task.id)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Bot className="h-4 w-4" />
              </Button>
            )}
            {canStart && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(task.id, 'running')}
              >
                <PlayCircle className="h-4 w-4" />
              </Button>
            )}
            {canComplete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(task.id, 'completed')}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>操作</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  編集
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  データがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          前へ
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          次へ
        </Button>
      </div>
    </div>
  );
}

