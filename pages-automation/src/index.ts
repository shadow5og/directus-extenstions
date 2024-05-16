import { defineHook } from "@directus/extensions-sdk";
import { Page } from "./models";
import axios from "axios";

const pagesDeleteAction = async (
  { keys: [key, ..._] }: any,
  { database }: Record<string, any>
) => {
  const Pages = () => database("pages");

  const page = (await Pages().where("id", key).first()) as Page;
  console.log("Page created!", page);
};

export default defineHook(({ filter, action }, { env, logger }) => {
  //   filter("pages.items.create", (payload, ctx) => {
  //     console.log("Creating page!");
  //   });

  action(
    "pages.items.create",
    async ({ payload: { permalink: slug }, event }: any) => {
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
        logger.error("Failed to send page data to dev server.");
        logger.child({ error });
      }
    }
  );

  action(
    "pages.items.update",
    async (
      { keys: [key, ..._], event }: any,
      { database }: Record<string, any>
    ) => {
      const Pages = () => database("pages");

      try {
        const page = (await Pages().where("id", key).first()) as Page;
        if (!page) throw new Error(`No page with id ${key} exists.`);

        const data = {
          slug: page.permalink,
          event,
        };

        const headers = {
          "Content-Type": "application/json",
        };

        logger.info(env.FRONT_END_LINK);
        logger.info("Sending page data to the dev server.");
        const request = await axios.post(env.FRONT_END_LINK, data, {
          headers,
        });

        if (request.status !== 200)
          throw new Error("Could not send page data to the dev server.");

        logger.info("Data sent to the frontend.");
      } catch (error) {
        logger.error("Failed to send page data to dev server.");
        logger.child({ error });
      }
    }
  );

  action("pages.items.delete", pagesDeleteAction);
});
