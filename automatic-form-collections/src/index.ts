import { createError } from '@directus/errors';
import { defineHook } from '@directus/extensions-sdk';
import { Form } from './models';

const NoFormCollectionFoundError = createError(
  'FORM Collection NOT FOUND',
  'Form  collectionnot found.',
  404
);
const chunkSize = 30;

const fieldTypeMap = {
  text: 'string',
  textarea: 'text',
  checkbox: 'string',
  radio: 'string',
  select: 'string',
  number: 'float',
  decimal: 'decimal',
  email: 'string',
  date: 'dateTime',
  range: 'string',
  tel: 'string',
  file: 'string',
};

export default defineHook(({ filter, action }, context) => {
  const { database, logger, services, getSchema } = context;
  const { CollectionsService } = services;

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
          table.uuid('id').defaultTo(database.fn.uuid()).primary();

          for (const { field, type } of fields) {
            // @ts-ignore
            table[type](field);
          }
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
      group: 'form_submission_models',
      versioning: false,
      hidden: false,
      archive_app_filter: true,
    });

    const Fields = () => database('directus_fields');

    await Fields().insert({
      collection,
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
    await database.batchInsert(
      'directus_fields',
      fields.map(({ field }, index) => ({
        collection,
        field,
        interface: 'input',
        required: true,
        sort: 1 + index,
        width: 'full',
        readonly: false,
        hidden: false,
      })),
      chunkSize
    );

    return payload;
  });

  action('forms.items.update', async (payload, { accountability }) => {
    const {
      keys,
      collection,
      payload: { schema },
    } = payload;

    if (!schema?.length) return;

    const fieldNames = (schema as Form['schema']).map(({ name }) => name);
    const collectionsService = new CollectionsService({
      schema: await getSchema(),
      accountability,
    });
    const Forms = () => database(collection);
    const preProcessedSchemaData = (schema as Form['schema']).map(
      ({ name: field, type: fieldType }) => {
        const type = fieldTypeMap[fieldType as keyof typeof fieldTypeMap];
        return {
          field,
          type,
        };
      }
    );

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const formCollections = await Forms().where('id', key).select('key');

      if (!formCollections.length) throw new NoFormCollectionFoundError();

      const [data] = formCollections;
      const { key: formCollectionName } = data;
      const Fields = () => database('directus_fields');
      const fieldsToBeDeleted = (
        await Fields()
          .where('collection', formCollectionName)
          .andWhereNot('field', 'id')
          .andWhereNot((qB) => qB.whereIn('field', fieldNames))
          .select('field')
      ).map(({ field }) => field);

      await Fields()
        .where('collection', formCollectionName)
        .whereIn('field', fieldsToBeDeleted)
        .del();

      const existingFields = (
        await Fields()
          .where('collection', formCollectionName)
          .andWhereNot('field', 'id')
          .andWhere((qB) => qB.whereIn('field', fieldNames))
          .select('field')
      ).map(({ field }) => field);

      const potentiallyModifiedFields = preProcessedSchemaData.filter(
        ({ field }) => existingFields.includes(field)
      );

      const newFields = preProcessedSchemaData.filter(
        ({ field }) =>
          !fieldsToBeDeleted.includes(field) && !existingFields.includes(field)
      );

      for (const field of fieldsToBeDeleted) {
        try {
          await database.schema.alterTable(
            formCollectionName,
            function (table) {
              table.dropColumn(field);
            }
          );
        } catch (error: any) {
          if (error.code === '42703') 'pass';
          else throw error;
        }
      }

      for (const { field, type } of potentiallyModifiedFields) {
        try {
          await database.schema.alterTable(
            formCollectionName,
            function (table) {
              // @ts-ignore
              table[type](field).alter();
            }
          );
        } catch (error: any) {
          if (error.code === '42703') 'pass';
          else throw error;
        }
      }

      for (const { field, type } of newFields) {
        try {
          await database.schema.alterTable(
            formCollectionName,
            function (table) {
              // @ts-ignore
              table[type](field);
            }
          );
        } catch (error: any) {
          if (error.code === '42701') 'pass';
          else throw error;
        }
      }

      logger.info(`Updated Schema for the ${formCollectionName} table.`);

      await collectionsService.updateOne(
        formCollectionName,
        potentiallyModifiedFields.concat(newFields)
      );

      // // Dynamically add fields to the new collection
      await database.batchInsert(
        'directus_fields',
        newFields.map(({ field }, index) => ({
          collection: formCollectionName,
          field,
          interface: 'input',
          required: true,
          sort: 1 + index,
          width: 'full',
          readonly: false,
          hidden: false,
        })),
        chunkSize
      );

      logger.info(`Update table ${formCollectionName}`);
    }
  });
});
