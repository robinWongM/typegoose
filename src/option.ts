/** @format */

import { SchemaOptions } from "mongoose";

import { schemaOptions } from './data';

export const option = (options: SchemaOptions = {}) => (constructor: any) => {
  schemaOptions[constructor.name] = options;
}
