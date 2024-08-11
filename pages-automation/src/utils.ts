import type { HookExtensionContext } from '@directus/extensions';
import type { ActionHandler, FilterHandler } from '@directus/types';
import axios from 'axios';
import { sendDataToDev } from './api';
import { IPageActionHandlers, IPageFilterHandlers, Page } from './models';

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
        'Content-Type': 'application/json',
      };

      if (!env.FRONT_END_LINK?.length)
        throw new Error(
          'The FRONT_END_LINK env variable has not been set within the Directus env.'
        );

      const link = `${env.FRONT_END_LINK}/api/webhooks/page`;
      logger.info('Sending page data to the dev server.');
      const request = await axios.post(link, data, {
        headers,
      });

      if (request.status !== 200)
        throw new Error('Could not send page data to the dev server.');

      logger.info('Data sent to the frontend.');
    } catch (error) {
      const child = logger.child({ error });
      child.error('Failed to send page data to dev server: ');
    }
  };

  const update: ActionHandler = async ({
    keys,
    event,
    payload: { status, permalink },
  }: any) => {
    const mayThrowMissingDevLinkError = () => {
      if (!env?.FRONT_END_LINK.length)
        throw new Error(
          'Cannot send updated page changes to the dev server because the FRONT_END_LINK env is not set.'
        );
    };
    const Pages = () => database('pages');

    try {
      const pages = (await Pages().whereIn('id', keys)) as Page[];
      if (!pages.length) throw new Error(`No page with id in ${keys} exists.`);

      if (
        status &&
        status === 'archived' &&
        pages.some(({ permalink }) => permalink.at(-1) === '/')
      ) {
        const archivingRootPages = pages
          .filter(({ permalink }) => permalink.at(-1) === '/')
          .map(({ title, permalink, id }) => ({ title, permalink, id }));

        for (const { permalink } of archivingRootPages) {
          try {
            await Pages()
              .whereILike('permalink', `${permalink}%`)
              .whereNot('status', status)
              .update({ status });
          } catch (error) {
            const child = logger.child({ 'permalink-error': error });
            child.error(
              `Could not archive the children pages for page with permalink: ${permalink}`
            );
            continue;
          }
        }

        const child = logger.child({
          pages: archivingRootPages,
        });
        child.info('Archived the following pages: ');

        const data = {
          slugs: archivingRootPages.map(({ permalink }) => permalink),
          event,
          status,
        };

        mayThrowMissingDevLinkError();
        const link = `${env.FRONT_END_LINK}/api/webhooks/pages`;
        await sendDataToDev({ data, logger, link, env });
      } else if (status?.length) {
        const statusPages = pages.map(({ title, permalink, id }) => ({
          title,
          permalink,
          id,
        }));

        for (const { id } of statusPages) {
          try {
            await Pages().where('id', id).update({ status });
          } catch (error) {
            const child = logger.child({ 'permalink-error': error });
            child.error(`Could not update the status for the: ${id}.`);
            continue;
          }
        }

        const child = logger.child({
          pages: statusPages,
        });
        child.info('Updated statuses for the following pages: ');

        const data = {
          slugs: statusPages.map(({ permalink }) => permalink),
          event,
          status,
        };

        mayThrowMissingDevLinkError();
        const link = `${env.FRONT_END_LINK}/api/webhooks/pages`;
        await sendDataToDev({ data, logger, link, env });
      } else if (permalink?.length) {
        const data = {
          slug: permalink,
          event,
          status,
        };

        mayThrowMissingDevLinkError();
        const link = `${env.FRONT_END_LINK}/api/webhooks/page`;
        await sendDataToDev({ data, logger, link, env });
      }
    } catch (error) {
      const child = logger.child({ error });
      child.error('Failed to send page data to dev server.');
    }
  };

  return { create, update };
}

function pageFilterHandlers({
  logger,
  database,
}: HookExtensionContext): IPageFilterHandlers {
  const pageDelete: FilterHandler = async (payload: any) => {
    const [key, ..._] = payload;
    const Pages = () => database('pages');

    try {
      const page = (await Pages().where('id', key).first()) as Page;
      if (!page) throw new Error(`No page with id ${key} exists.`);

      const { permalink } = page;

      if (permalink.at(-1) !== '/') return payload;

      await Pages()
        .whereILike('permalink', `${permalink}%`)
        .whereNot('permalink', permalink)
        .del();

      logger.info(
        `Child pages for the root page with permalink of '${page.permalink}' have been deleted`
      );

      return payload;
    } catch (error) {
      const child = logger.child({ error });
      child.error('Failed to send page data to dev server.');
    }
  };

  return { pageDelete };
}

export { pageActionHandlers, pageFilterHandlers };
