import axios from "axios";
import { ISendDataToDevArgs } from "./models";

async function sendDataToDev({ data, logger, link, env }: ISendDataToDevArgs) {
  if (!env?.PAGE_WEB_HOOK_API_KEY.length)
    logger.warn(
      `The PAGE_WEB_HOOK_API_KEY is not set in the directus env. The requests to the webhook will not be authenticated.`
    );

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": env?.PAGE_WEB_HOOK_API_KEY ?? "",
  };

  logger.info("Sending page data to the dev server.");
  const request = await axios.post(link, data, {
    headers,
  });

  if (request.status !== 200)
    throw new Error("Could not send page data to the dev server.");

  logger.info("Data sent to the frontend.");
}

export { sendDataToDev };
