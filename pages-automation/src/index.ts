import { defineHook } from "@directus/extensions-sdk";
import { Page } from "./models";
import { pageActionHandlers } from "./utils";

const pagesDeleteAction = async (
  { keys: [key, ..._] }: any,
  { database }: Record<string, any>
) => {
  const Pages = () => database("pages");

  const page = (await Pages().where("id", key).first()) as Page;
  console.log("Page created!", page);
};

export default defineHook(({ filter, action }, context) => {
  //   filter("pages.items.create", (payload, ctx) => {
  //     console.log("Creating page!");
  //   });
  const { create, update } = pageActionHandlers(context);

  action("pages.items.create", create);
  action("pages.items.update", update);
  action("pages.items.delete", pagesDeleteAction);
});
