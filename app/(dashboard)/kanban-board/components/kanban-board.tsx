"use client";

import * as React from "react";
import { GripVertical, Paperclip, MessageSquare, CalendarIcon, PlusCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as Kanban from "@/components/ui/kanban";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  assignee?: string;
  dueDate?: string;
  progress: number;
  attachments?: number;
  comments?: number;
  users: TaskUser[];
}

interface TaskUser {
  name: string;
  src: string;
  alt?: string;
  fallback?: string;
}

export default function KanbanBoard() {
  const [columns, setColumns] = React.useState<Record<string, Task[]>>({
    backlog: [
      {
        id: "1",
        title: "Настроить оплату через Kaspi/KKM",
        description: "Подключить приём оплат для ЖК в Астане, протестировать чеки и возвраты.",
        priority: "high",
        assignee: "Айгерим Нурлан",
        dueDate: "25.06.2024",
        users: [
          {
            name: "Айгерим",
            src: "/logo.png",
            alt: "Айгерим",
            fallback: "AN"
          },
          {
            name: "Данияр",
            src: "/logo.png",
            alt: "Данияр",
            fallback: "DK"
          }
        ],
        progress: 10,
        attachments: 2,
        comments: 4
      },
      {
        id: "2",
        title: "Лендинг ЖК на каз/рус",
        description: "Двухязычный лендинг с формой заявки и блоком о застройщике.",
        priority: "medium",
        assignee: "Мадина Ержан",
        dueDate: "27.06.2024",
        users: [
          {
            name: "Мадина",
            src: "/logo.png",
            alt: "Мадина",
            fallback: "ME"
          },
          {
            name: "Айсұлу",
            src: "/logo.png",
            alt: "Айсұлу",
            fallback: "AS"
          }
        ],
        progress: 0,
        attachments: 1,
        comments: 1
      },
      {
        id: "3",
        title: "Авто-бэкапы CRM",
        description: "Дневные бэкапы в облако (AlmaCloud), проверка восстановления.",
        priority: "low",
        assignee: "Санжар Али",
        dueDate: "30.06.2024",
        users: [
          {
            name: "Санжар",
            src: "/logo.png",
            alt: "Санжар",
            fallback: "SA"
          },
          {
            name: "Айдана",
            src: "/logo.png",
            alt: "Айдана",
            fallback: "AK"
          }
        ],
        progress: 5,
        attachments: 0,
        comments: 3
      },
      {
        id: "4",
        title: "Согласовать договор с застройщиком",
        description: "Уточнить условия по отсрочке, гарантиям и маркетинговому бюджету.",
        priority: "medium",
        assignee: "Әсел Каримова",
        dueDate: "24.06.2024",
        users: [
          {
            name: "Әсел",
            src: "/logo.png",
            alt: "Әсел",
            fallback: "AK"
          },
          {
            name: "Ернар",
            src: "/logo.png",
            alt: "Ернар",
            fallback: "ET"
          }
        ],
        progress: 0,
        attachments: 1,
        comments: 0
      }
    ],
    inProgress: [
      {
        id: "5",
        title: "Запуск рекламы в Алматы",
        description: "Настроить таргет на Telegram и Instagram, проверить конверсии в CRM.",
        priority: "high",
        assignee: "Данияр К.",
        dueDate: "22.06.2024",
        users: [
          {
            name: "Данияр",
            src: "/logo.png",
            alt: "Данияр",
            fallback: "DK"
          },
          {
            name: "Айя",
            src: "/logo.png",
            alt: "Айя",
            fallback: "AA"
          }
        ],
        progress: 40,
        attachments: 2,
        comments: 6
      },
      {
        id: "6",
        title: "Миграция сделок в новую CRM",
        description: "Перенести сценарий, статусы и права. Проверить вебхуки на оплату.",
        priority: "medium",
        assignee: "Самат Ж.",
        dueDate: "23.06.2024",
        users: [
          {
            name: "Самат",
            src: "/logo.png",
            alt: "Самат",
            fallback: "SJ"
          },
          {
            name: "Жансая",
            src: "/logo.png",
            alt: "Жансая",
            fallback: "JA"
          }
        ],
        progress: 55,
        attachments: 3,
        comments: 2
      },
      {
        id: "7",
        title: "Юзабилити-тест для отдела продаж",
        description: "Проверить сценарий быстрой записи лида и выставления счета.",
        priority: "low",
        assignee: "Айым Талгат",
        dueDate: "21.06.2024",
        users: [
          {
            name: "Айым",
            src: "/logo.png",
            alt: "Айым",
            fallback: "AT"
          },
          {
            name: "Амина",
            src: "/logo.png",
            alt: "Амина",
            fallback: "AR"
          }
        ],
        progress: 35,
        attachments: 1,
        comments: 1
      }
    ],
    done: [
      {
        id: "8",
        title: "CI/CD на Vercel",
        description: "Собираем ветку main, автодеплой демо-окружения.",
        priority: "high",
        assignee: "Ержан М.",
        dueDate: "15.06.2024",
        users: [
          {
            name: "Ержан",
            src: "/logo.png",
            alt: "Ержан",
            fallback: "EM"
          },
          {
            name: "Гульнар",
            src: "/logo.png",
            alt: "Гульнар",
            fallback: "GA"
          }
        ],
        progress: 100,
        attachments: 2,
        comments: 4
      },
      {
        id: "9",
        title: "Базовая настройка проекта",
        description: "Создан репозиторий, ESLint/Prettier, алиасы и Husky.",
        priority: "medium",
        assignee: "Дана С.",
        dueDate: "12.06.2024",
        users: [
          {
            name: "Дана",
            src: "/logo.png",
            alt: "Дана",
            fallback: "DS"
          },
          {
            name: "Бекзат",
            src: "/logo.png",
            alt: "Бекзат",
            fallback: "BB"
          }
        ],
        progress: 100,
        attachments: 1,
        comments: 2
      }
    ]
  });

  const [columnTitles, setColumnTitles] = React.useState<Record<string, string>>({
    backlog: "Бэклог",
    inProgress: "В работе",
    done: "Готово"
  });

  function addColumn() {
    const id = `col-${Date.now()}`; // benzersiz id
    setColumns((prev) => ({
      ...prev,
      [id]: [] // boş task listesi
    }));
    setColumnTitles((prev) => ({
      ...prev,
      [id]: `New Column ${Object.keys(prev).length + 1}`
    }));
  }

  return (
    <div className="h-full p-6">
      <div className="mb-4">
        <Button onClick={addColumn}>+ Добавить колонку</Button>
      </div>
      <Kanban.Root value={columns} onValueChange={setColumns} getItemValue={(item) => item.id}>
        <Kanban.Board className="flex w-full gap-4 overflow-x-auto pb-4">
          {Object.entries(columns).map(([columnValue, tasks]) => (
            <Kanban.Column key={columnValue} value={columnValue} className="min-w-[340px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{columnTitles[columnValue]}</span>
                  <Badge variant="secondary">{tasks.length}</Badge>
                </div>
                <div className="flex gap-1">
                  <Kanban.ColumnHandle asChild>
                    <Button variant="ghost" size="icon">
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </Kanban.ColumnHandle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <PlusCircleIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Добавить задачу</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex flex-col gap-2 p-0.5">
                {tasks.map((task) => (
                  <Kanban.Item key={task.id} value={task.id} asHandle asChild>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base font-semibold">{task.title}</CardTitle>
                        <CardDescription>{task.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-muted-foreground flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="size-4" />
                            <span>{task.dueDate}</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-lg border p-1">
                            <div className="relative size-5">
                              <svg
                                className="size-full -rotate-90"
                                viewBox="0 0 36 36"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle
                                  cx="18"
                                  cy="18"
                                  r="16"
                                  fill="none"
                                  className="stroke-current text-gray-200 dark:text-neutral-700"
                                  strokeWidth="2"></circle>
                                <circle
                                  cx="18"
                                  cy="18"
                                  r="16"
                                  fill="none"
                                  className={cn("stroke-current", {
                                    "text-green-600!": task.progress === 100,
                                    "text-orange-500!": task.progress > 50 && task.progress < 100
                                  })}
                                  strokeWidth="2"
                                  strokeDasharray={2 * Math.PI * 16}
                                  strokeDashoffset={
                                    2 * Math.PI * 16 - (2 * Math.PI * 16 * task.progress) / 100
                                  }
                                  strokeLinecap="round"></circle>
                              </svg>
                            </div>
                            {`${task.progress}%`}
                          </div>
                        </div>

                        <div className="text-muted-foreground flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                          <div className="flex -space-x-2 overflow-hidden">
                            {task.users.map((user, index) => (
                              <Avatar key={index} className="border-2 border-white">
                                <AvatarImage
                                  src={
                                    user.src || "/logo.png"
                                  }
                                  alt={user.alt}
                                />
                                <AvatarFallback>{user.fallback}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Paperclip className="h-4 w-4" />
                              <span>{task.attachments}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              <span>{task.comments}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Kanban.Item>
                ))}
              </div>
            </Kanban.Column>
          ))}
        </Kanban.Board>
        <Kanban.Overlay>
          <div className="bg-primary/10 size-full rounded-md" />
        </Kanban.Overlay>
      </Kanban.Root>
    </div>
  );
}
