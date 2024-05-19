import axios from "axios";
import { ISendDataToDevArgs } from "./models";

async function sendDataToDev({ data, logger, link }: ISendDataToDevArgs) {
  const headers = {
    "Content-Type": "application/json",
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
