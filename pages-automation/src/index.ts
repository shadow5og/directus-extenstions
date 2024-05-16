import { defineHook } from "@directus/extensions-sdk";

const pagesDeleteAndUpdateAction = (
  payload: unknown,
  ctx: Record<string, any>
) => {
  console.log("Page created!", payload);
};

export default defineHook(({ filter, action }) => {
  filter("pages.items.create", (payload, ctx) => {
    console.log("Creating page!");
  });

  action("pages.items.create", pagesDeleteAndUpdateAction);
  action("pages.items.update", pagesDeleteAndUpdateAction);
  action("pages.items.delete", pagesDeleteAndUpdateAction);
});
