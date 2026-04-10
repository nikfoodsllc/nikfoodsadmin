import { ObjectId } from 'mongodb';

export interface IWeeklyMenu {
  _id?: ObjectId;
  allDays: ObjectId[];
  monday: ObjectId[];
  tuesday: ObjectId[];
  wednesday: ObjectId[];
  thursday: ObjectId[];
  friday: ObjectId[];
  saturday: ObjectId[];
  weekStartDate: Date;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPopulatedFoodItem {
  _id: ObjectId;
  name: string;
  price: number;
  image?: string;
  category?: string;
  description?: string;
  [key: string]: unknown;
}

export interface IWeeklyMenuPopulated {
  _id?: ObjectId;
  allDays: IPopulatedFoodItem[];
  monday: IPopulatedFoodItem[];
  tuesday: IPopulatedFoodItem[];
  wednesday: IPopulatedFoodItem[];
  thursday: IPopulatedFoodItem[];
  friday: IPopulatedFoodItem[];
  saturday: IPopulatedFoodItem[];
  weekStartDate: Date;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
