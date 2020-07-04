import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const produtsId = products.map(product => ({ id: product.id }));

    const checkProdutsExists = await this.productsRepository.findAllById(
      produtsId,
    );

    if (checkProdutsExists.length !== products.length) {
      throw new AppError('One or more product not foud');
    }

    const mappedProdudts = products.map(product => {
      const foundProduct = checkProdutsExists.find(
        productToFind => productToFind.id === product.id,
      );

      if ((foundProduct?.quantity || 0) < product.quantity) {
        throw new AppError(`Product ${product.id} - Quantity is not available`);
      }

      if (foundProduct) {
        foundProduct.quantity -= product.quantity;
      }

      return {
        product_id: product.id,
        price: foundProduct?.price || 0,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: mappedProdudts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
