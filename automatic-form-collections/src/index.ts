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

const schemaMao = {
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
  const { database, logger, services } = context;

  filter('forms.items.create', async (payload: Form) => {
    const { key: collectionName, schema } = payload;

    await database.schema
      .withSchema('public')
      .createTable(collectionName, (table) => {
        table.uuid('id').primary();

        for (const { name, type } of schema) {
          const dataType: string = schemaMao[type as keyof typeof schemaMao];
          // @ts-ignoreTableBuilder
          table[dataType](name);
        }

        logger.info(`Created a new table named ${collectionName}`);
      });

    const Collections = () => database('directus_collections');

    // Add collection to Directus system collections
    await Collections().insert({
      collection: collectionName,
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
      collection: collectionName,
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
            collection: collectionName,
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
