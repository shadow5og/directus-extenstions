import type { HookExtensionContext } from '@directus/extensions';
import type { ActionHandler, FilterHandler } from '@directus/types';
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

      if (!env.FRONT_END_LINK?.length)
        throw new Error(
          'The FRONT_END_LINK env variable has not been set within the Directus env.'
        );

      const link = `${env.FRONT_END_LINK}/api/webhooks/page`;
      await sendDataToDev({ data, logger, link, env });
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
  env,
}: HookExtensionContext): IPageFilterHandlers {
  const pageDelete: FilterHandler = async (payload: any) => {
    const keys = payload;
    const Pages = () => database('pages');
    const mayThrowMissingDevLinkError = () => {
      if (!env?.FRONT_END_LINK.length)
        throw new Error(
          'Cannot send updated page changes to the dev server because the FRONT_END_LINK env is not set.'
        );
    };

    try {
      const pages = (await Pages().whereIn('id', keys)) as Page[];
      if (!pages.length) throw new Error(`No page with id in ${keys} exists.`);

      const rootPages = pages
        .filter(({ permalink }) => permalink.at(-1) === '/')
        .map(({ title, permalink, id }) => ({ title, permalink, id }));

      for (const { permalink } of rootPages) {
        try {
          await Pages()
            .whereILike('permalink', `${permalink}%`)
            .whereNot('permalink', permalink)
            .del();

          logger.info(
            `Child pages for the root page with permalink of '${permalink}' have been deleted`
          );
        } catch (error) {
          const child = logger.child({ 'permalink-error': error });
          child.error(
            `Could not delete the children pages for page with permalink: ${permalink}`
          );
          continue;
        }
      }

      const data = {
        slugs: rootPages.map(({ permalink }) => permalink),
        event: 'pages.items.delete',
      };

      mayThrowMissingDevLinkError();
      const link = `${env.FRONT_END_LINK}/api/webhooks/page`;
      await sendDataToDev({ data, logger, link, env });

      return payload;
    } catch (error) {
      const child = logger.child({ error });
      child.error('Failed to send page data to dev server.');
    }
  };

  return { pageDelete };
}

export { pageActionHandlers, pageFilterHandlers };
