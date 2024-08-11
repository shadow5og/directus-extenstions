import { defineHook } from '@directus/extensions-sdk';
import { Form } from './models';

const fieldTypeMap = {
  text: 'string',
  textarea: 'text',
  checkbox: 'string',
  radio: 'string',
  select: 'string',
  number: 'decimal',
  email: 'string',
  date: 'dateTime',
  range: 'string',
  tel: 'string',
  file: 'string',
};

export default defineHook(({ filter, action }, context) => {
  const { database, logger, services, getSchema } = context;
  const { CollectionsService, FieldsService } = services;

  filter('forms.items.create', async (payload: Form, _, { accountability }) => {
    const { key: collection, schema } = payload;
    const collectionsService = new CollectionsService({
      schema: await getSchema(),
      accountability,
    });

    const fields = schema.map(({ name: field, type: fieldType }) => {
      const type = fieldTypeMap[fieldType as keyof typeof fieldTypeMap];
      return {
        field,
        type,
      };
    });

    const tableExists = await database.schema
      .withSchema('public')
      .hasTable(collection);

    if (!tableExists)
      await database.schema
        .withSchema('public')
        .createTable(collection, (table) => {
          table.uuid('id').primary();

          for (const { field, type } of fields) {
            // @ts-ignore
            table[type](field);
          }

          logger.info(`Created a new table named ${collection}`);
        });

    await collectionsService.createOne({
      collection,
      fields,
    });

    const Collections = () => database('directus_collections');

    // Add collection to Directus system collections
    await Collections().insert({
      collection: collection,
      singleton: false,
      sort_field: 'id',
      accountability: 'all',
      group: 'website',
      versioning: false,
      hidden: false,
      archive_app_filter: true,
    });

    const Fields = () => database('directus_fields');

    await Fields().insert({
      collection: collection,
      field: 'id',
      special: 'uuid',
      interface: 'input',
      required: true,
      sort: 0,
      width: 'full',
      readonly: true,
      hidden: false,
    });

    // Dynamically add fields to the new collection
    await Promise.all(
      schema.map(
        async ({ name }, index) =>
          await Fields().insert({
            collection: collection,
            field: name,
            interface: 'input',
            required: true,
            sort: 1 + index,
            width: 'full',
            readonly: false,
            hidden: false,
          })
      )
    );

    return payload;
  });

  action('forms.items.update', () => {
    console.log('Creating Item!');
  });
});
