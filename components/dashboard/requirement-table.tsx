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
import type { Requirement } from '@/lib/api/client';
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
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface RequirementTableProps {
  requirements: Requirement[];
  onEdit: (requirement: Requirement) => void;
  onDelete: (requirementId: string) => void;
}

export function RequirementTable({ requirements, onEdit, onDelete }: RequirementTableProps) {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const columns: ColumnDef<Requirement>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            タイトル
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="font-medium">{row.getValue('title')}</div>,
    },
    {
      accessorKey: 'category',
      header: 'カテゴリ',
      cell: ({ row }) => {
        const categoryLabel =
          {
            functional: '機能要件',
            'non-functional': '非機能要件',
            technical: '技術要件',
            business: 'ビジネス要件',
            other: 'その他',
          }[row.getValue('category') as string] || row.getValue('category');

        return <Badge variant="outline">{categoryLabel}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'ステータス',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const statusLabel =
          {
            draft: '下書き',
            review: 'レビュー中',
            approved: '承認済み',
            implemented: '実装済み',
            verified: '検証済み',
          }[status.toLowerCase()] || status;

        const statusColor =
          {
            draft: 'bg-gray-500/10 text-gray-500',
            review: 'bg-yellow-500/10 text-yellow-500',
            approved: 'bg-blue-500/10 text-blue-500',
            implemented: 'bg-green-500/10 text-green-500',
            verified: 'bg-purple-500/10 text-purple-500',
          }[status.toLowerCase()] || 'bg-gray-500/10 text-gray-500';

        return (
          <Badge className={statusColor} variant="secondary">
            {statusLabel}
          </Badge>
        );
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
        const priorityLabel =
          {
            high: '高',
            medium: '中',
            low: '低',
          }[row.getValue('priority') as string] || row.getValue('priority');

        const priorityColor =
          {
            high: 'text-red-500',
            medium: 'text-yellow-500',
            low: 'text-green-500',
          }[row.getValue('priority') as string] || 'text-gray-500';

        return <div className={`font-medium ${priorityColor}`}>{priorityLabel}</div>;
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
        const requirement = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(requirement)}>
                <Pencil className="h-4 w-4 mr-2" />
                編集
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(requirement.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: requirements,
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

