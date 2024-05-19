import { defineHook } from "@directus/extensions-sdk";
import { pageActionHandlers, pageFilterHandlers } from "./utils";

export default defineHook(({ filter, action }, context) => {
  const { create, update } = pageActionHandlers(context);
  const { pageDelete } = pageFilterHandlers(context);

  filter("pages.items.delete", pageDelete);
  action("pages.items.create", create);
  action("pages.items.update", update);
});
