import { IPageActionHandlers, IPageFilterHandlers, Page } from "./models";
import axios from "axios";
import type { HookExtensionContext } from "@directus/extensions";
import type { ActionHandler, FilterHandler } from "@directus/types";

function pageActionHandlers({
  env,
  logger,
  database,
}: HookExtensionContext): IPageActionHandlers {
  const create: ActionHandler = async ({
    payload: { permalink: slug },
    event,
  }: Record<string, any>) => {
    try {
      const data = {
        slug,
        event,
      };

      const headers = {
        "Content-Type": "application/json",
      };

      if (!env.FRONT_END_LINK?.length)
        throw new Error(
          "The FRONT_END_LINK env variable has not been set within the Directus env."
        );

      const link = `${env.FRONT_END_LINK}/api/webhooks/pages`;
      logger.info("Sending page data to the dev server.");
      const request = await axios.post(link, data, {
        headers,
      });

      if (request.status !== 200)
        throw new Error("Could not send page data to the dev server.");

      logger.info("Data sent to the frontend.");
    } catch (error) {
      const child = logger.child({ error });
      child.error("Failed to send page data to dev server: ");
    }
  };

  const update: ActionHandler = async ({
    keys: [key, ..._],
    event,
    payload: { status, permalink },
  }: any) => {
    const Pages = () => database("pages");

    try {
      const page = (await Pages().where("id", key).first()) as Page;
      if (!page) throw new Error(`No page with id ${key} exists.`);

      if (status && status === "archived" && page.permalink.at(-1) === "/") {
        const { permalink } = page;
        const pages = (await Pages()
          .whereILike("permalink", `${permalink}%`)
          .whereNot("status", "archived")
          .update({ status }, ["id"])) as Page[];

        const child = logger.child({
          pages: pages.map(({ title, id }) => ({ title, id })),
        });
        child.info("Archived the following pages: ");

        // TODO: Send the changed pages to the frontend
      } else if (permalink?.length) {
        const data = {
          slug: permalink,
          event,
        };

        const headers = {
          "Content-Type": "application/json",
        };

        if (!env?.FRONT_END_LINK.length)
          throw new Error(
            "Cannot send updated page changes to the dev server because the FRONT_END_LINK env is not set."
          );

        logger.info("Sending page data to the dev server.");
        const link = `${env.FRONT_END_LINK}/api/webhooks/pages`;
        const request = await axios.post(link, data, {
          headers,
        });

        if (request.status !== 200)
          throw new Error("Could not send page data to the dev server.");

        logger.info("Data sent to the frontend.");
      }
    } catch (error) {
      const child = logger.child({ error });
      child.error("Failed to send page data to dev server.");
    }
  };

  return { create, update };
}

function pageFilterHandlers({
  logger,
  database,
}: HookExtensionContext): IPageFilterHandlers {
  const pageDelete: FilterHandler = async (payload: any) => {
    logger.info(payload);
    const [key, ..._] = payload;
    const Pages = () => database("pages");

    try {
      const page = (await Pages().where("id", key).first()) as Page;
      if (!page) throw new Error(`No page with id ${key} exists.`);

      const { permalink } = page;

      if (permalink.at(-1) !== "/") return payload;

      await Pages()
        .whereILike("permalink", `${permalink}%`)
        .whereNot("permalink", permalink)
        .del();

      logger.info(
        `Child pages for the root page with permalink of '${page.permalink}' have been deleted`
      );

      return payload;
    } catch (error) {
      const child = logger.child({ error });
      child.error("Failed to send page data to dev server.");
    }
  };

  return { pageDelete };
}

export { pageActionHandlers, pageFilterHandlers };
