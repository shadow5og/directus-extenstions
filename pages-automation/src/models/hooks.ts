import type { ActionHandler, EventContext } from "@directus/types";

interface IPageActionHandlers {
  create: ActionHandler;
  update: ActionHandler;
}

export type { IPageActionHandlers };
