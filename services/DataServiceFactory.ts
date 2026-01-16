
import { IDataService } from './IDataService';
import { MockDataService } from './MockDataService';
import { SupabaseDataService } from './SupabaseDataService';
import { config } from '../config/app';

export class DataServiceFactory {
  private static instance: IDataService;

  static getService(): IDataService {
    if (!this.instance) {
      if (config.useMockData) {
        this.instance = new MockDataService();
      } else {
        this.instance = new SupabaseDataService();
      }
    }
    return this.instance;
  }
}
