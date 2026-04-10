export interface Zipcode {
  _id: string;
  zipcode: string;
  minCartValue: number;
  deliveryFee?: number;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateZipcodeDto {
  zipcode: string;
  minCartValue: number;
  deliveryFee: number;
  label?: string;
}

export interface UpdateZipcodeDto {
  _id: string;
  zipcode: string;
  minCartValue: number;
  deliveryFee: number;
  label?: string;
}
