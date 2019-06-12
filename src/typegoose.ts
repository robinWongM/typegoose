/** @format */

import 'reflect-metadata';
import * as mongoose from 'mongoose';

(mongoose as any).Promise = global.Promise;

import { constructors, hooks, methods, models, plugins, schema, schemaOptions, virtuals, schemaGenerated } from './data';

export * from './option';
export * from './method';
export * from './prop';
export * from './hooks';
export * from './plugin';
export * from '.';
export { getClassForDocument } from './utils';

export type InstanceType<T> = T & mongoose.Document;
export type ModelType<T> = mongoose.Model<InstanceType<T>> & T;

export interface GetModelForClassOptions {
  existingMongoose?: mongoose.Mongoose;
  existingConnection?: mongoose.Connection;
}

export class Typegoose {
  getModelForClass<T>(t: T, { existingMongoose, existingConnection }: GetModelForClassOptions = {}) {
    const name = this.constructor.name;
    if (!models[name]) {
      this.setModelForClass(t, {
        existingMongoose,
        existingConnection,
      });
    }

    return models[name] as ModelType<this> & T;
  }

  setModelForClass<T>(t: T, { existingMongoose, existingConnection }: GetModelForClassOptions = {}) {
    const name = this.constructor.name;

    // get schema of current model
    let sch = this.buildSchema<T>(t, name);
    // get parents class name
    let parentCtor = Object.getPrototypeOf(this.constructor.prototype).constructor;
    // iterate trough all parents
    while (parentCtor && parentCtor.name !== 'Typegoose' && parentCtor.name !== 'Object') {
      // extend schema
      sch = this.buildSchema<T>(t, parentCtor.name, sch);
      // next parent
      parentCtor = Object.getPrototypeOf(parentCtor.prototype).constructor;
    }

    let model = mongoose.model.bind(mongoose);
    if (existingConnection) {
      model = existingConnection.model.bind(existingConnection);
    } else if (existingMongoose) {
      model = existingMongoose.model.bind(existingMongoose);
    }

    models[name] = model(name, sch);
    constructors[name] = this.constructor;

    return models[name] as ModelType<this> & T;
  }

  private buildSchema<T>(t: T, name: string, sch?: mongoose.Schema) {
    const Schema = mongoose.Schema;

    Object.keys(schema[name]).forEach((key: string) => {
      const currentProp = schema[name][key];
      if (currentProp[0] && currentProp[0].subSchema) {
        schema[name][key][0] = {
          ...schema[name][key][0],
          type: schemaGenerated[currentProp[0].subSchema.name],
        };
        delete schema[name][key][0].subSchema;
      } else if (currentProp.subSchema) {
        schema[name][key] = {
          ...schema[name][key],
          type: schemaGenerated[currentProp.subSchema.name],
        };
        delete schema[name][key].subSchema;
      }
    })

    if (!sch) {
      sch = schemaOptions[name] ? new Schema(schema[name], schemaOptions[name]) : new Schema(schema[name]);
    } else {
      sch.add(schema[name]);
    }

    const staticMethods = methods.staticMethods[name];
    if (staticMethods) {
      sch.statics = Object.assign(staticMethods, sch.statics || {});
    } else {
      sch.statics = sch.statics || {};
    }

    const instanceMethods = methods.instanceMethods[name];
    if (instanceMethods) {
      sch.methods = Object.assign(instanceMethods, sch.methods || {});
    } else {
      sch.methods = sch.methods || {};
    }

    if (hooks[name]) {
      const preHooks = hooks[name].pre;
      preHooks.forEach(preHookArgs => {
        (sch as any).pre(...preHookArgs);
      });
      const postHooks = hooks[name].post;
      postHooks.forEach(postHookArgs => {
        (sch as any).post(...postHookArgs);
      });
    }

    if (plugins[name]) {
      for (const plugin of plugins[name]) {
        sch.plugin(plugin.mongoosePlugin, plugin.options);
      }
    }

    const getterSetters = virtuals[name];
    if (getterSetters) {
      for (const key of Object.keys(getterSetters)) {
        if (getterSetters[key].get) {
          sch.virtual(key).get(getterSetters[key].get);
        }

        if (getterSetters[key].set) {
          sch.virtual(key).set(getterSetters[key].set);
        }
      }
    }

    const indices = Reflect.getMetadata('typegoose:indices', t) || [];
    for (const index of indices) {
      sch.index(index.fields, index.options);
    }

    schemaGenerated[name] = sch;

    return sch;
  }
}
