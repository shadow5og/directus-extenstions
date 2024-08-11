import type { ActionHandler, FilterHandler } from "@directus/types";

interface IPageActionHandlers {
  create: ActionHandler;
  update: ActionHandler;
}

interface IPageFilterHandlers {
  pageDelete: FilterHandler;
}

export type { IPageActionHandlers, IPageFilterHandlers };
